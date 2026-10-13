import type { ImportContent } from "@/lib/import/content-schema"
import type { Feature, FeatureActivation, UsesConfig } from "@/lib/types"
import { syncModifierRefs } from "@/lib/compendium/linked-modifiers"
import { detectFeatureModifiers, mergeFeatureModifierDetections } from "@/lib/import/detect-feature-modifiers"
import { parseSignatureExploitTable } from "./alternate-rogue"
import { action, characteristic, effect, notes, replaceWiring, rider, uses } from "./alternate-ranger-monk-progression"
import { raging } from "./alternate-barbarian-rogue-sorcerer-progression"

const plain = (text: string) => text.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
const free: FeatureActivation = { action: true, noEconomyCost: true }
const longRest = [{ rest: "long_rest" as const }]
const bothRests = [{ rest: "short_rest" as const }, ...longRest]
const own = (name?: string) => /^Alternate (Barbarian|Rogue|Sorcerer)$/.test(name ?? "")
const state = (name: string) => [{ id: `alt_state_${name}`, kind: "sheet_toggle" as const, rule: "requires_active" as const, value: `feature_state:${name}` }]
const con = (): UsesConfig => ({ type: "ability_modifier", abilityModifier: "CON", recharges: longRest })
const cha = (): UsesConfig => ({ type: "ability_modifier", abilityModifier: "CHA", recharges: longRest })
const pool = (key: string, amount = 1): UsesConfig => ({ type: "class_resource", classResourceKey: key, classResourceAmount: amount })

/** Each signature table row unlocks separately; later Exploits are not L3 grants. */
function signatureExploits(features: Feature[]): Feature[] {
  const generated = new Map<string, Feature>()
  const result = features.flatMap((f) => {
    if (!/Exploits$/.test(f.name)) return [f]
    const rows = parseSignatureExploitTable(f.description)
    if (!rows.length) return [f]
    for (const row of rows) {
      const name = row.level === f.level ? f.name : `${f.name} (${row.level})`
      generated.set(name, replaceWiring({ ...f, name, level: row.level, isChoice: false, choices: undefined }, [characteristic(name, { type: "grant_custom_ability", abilityNames: row.names })]))
    }
    return []
  })
  return [...result.filter((f) => !generated.has(f.name)), ...generated.values()].sort((a, b) => a.level - b.level)
}

/** Source-explicit timing only. Narrative mentions of an enemy's action do not activate a feature. */
function timing(text: string): FeatureActivation | undefined {
  if (/\b(?:as|use|using|with) (?:an?|your|one) reaction\b/i.test(text)) return { reaction: true }
  if (/\b(?:as|use|using|with) (?:an?|your|one) bonus action\b|as part of (?:your |a )?bonus action/i.test(text)) return { bonusAction: true }
  if (/\b(?:as|use|using) (?:an?|your) action\b/i.test(text)) return { action: true }
  return undefined
}

/** Existing generic UsesConfig supports free uses followed by an alternate pool price. */
function sourceUses(text: string, caster: boolean): UsesConfig | undefined {
  let value: UsesConfig | undefined
  const count = text.match(/(?:number of times|total number of times|number of free uses)[\s\S]{0,90}?equal to (?:1 \+ )?your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/i)
  if (count) value = { type: "ability_modifier", abilityModifier: ({ Strength: "STR", Dexterity: "DEX", Constitution: "CON", Intelligence: "INT", Wisdom: "WIS", Charisma: "CHA" } as const)[count[1] as "Strength"], recharges: /(?:each|a|finish a|between each) short (?:or|and) long rest/i.test(text) ? bothRests : longRest }
  else if (/once (?:per|between each) (?:short (?:or|and) )?long rest|once you use[\s\S]{0,90}finish a (?:short or )?long rest/i.test(text)) value = { type: "fixed", fixedAmount: 1, recharges: /short (?:or|and) long rest/i.test(text) ? bothRests : longRest }
  const fallback = text.match(/(?:no uses|use (?:it|this (?:feature|reaction)) again|additional uses|after (?:that|which)|but to use)[\s\S]{0,120}?(?:expend|spend)\s+(\d+|one|a)\s+(Sorcery Points?|Psi Points?|Exploit Di(?:e|ce)|use of (?:your )?Rage)/i)
  const price = text.match(/(?:expend|spend)\s+(\d+|one|a)\s+(Sorcery Points?|Psi Points?|Exploit Di(?:e|ce)|use of (?:your )?Rage)/i)
  const cost = fallback ?? price
  if (cost) {
    const key = /Sorcery/i.test(cost[2]) ? "alternate_sorcerer_sorcery_points" : /Psi/i.test(cost[2]) ? "psi_points" : /Rage/i.test(cost[2]) ? "rage" : "exploit_dice"
    const amount = Number(cost[1]) || 1
    if (value && fallback) value = { ...value, restoreByResource: { resourceKey: key, resourceAmount: amount, restores: 1 } }
    else if (!value) value = pool(key, amount)
  }
  if (!value && caster && /(?:expend|spend) Sorcery Points/i.test(text)) value = { ...pool("alternate_sorcerer_sorcery_points"), classResourceCostMode: "up_to_proficiency_bonus" }
  return value
}

function sourceSections(description: string): { name: string; description: string; level_requirement?: number }[] {
  return [...description.matchAll(/<p>\s*<strong>([^<]+)<\/strong>([\s\S]*?)(?=<p>\s*<strong>|$)/gi)].map((match) => {
    const text = match[2].replace(/<\/p>\s*$/, "")
    const requirement = text.match(/Prerequisite:\s*(\d+)(?:st|nd|rd|th)-level/i)
    return { name: plain(match[1]).replace(/[.:]$/, ""), description: `<p>${text}</p>`, ...(requirement ? { level_requirement: Number(requirement[1]) } : {}) }
  })
}

/** Extract explicit choice catalogs without applying every alternative to the owner. */
function catalogChoice(f: Feature, catalog: Feature, count: number, mutation = false): Feature {
  const options = sourceSections(catalog.description).map((option) => {
    const candidate = { ...option, level: option.level_requirement ?? f.level } as Feature
    let wired = mergeFeatureModifierDetections(candidate, [], detectFeatureModifiers(option.description, { contentKind: "subclass_feature", featureName: option.name, suppressNameDetection: true }))
    const active = timing(plain(option.description))
    const limitation = mutation ? state(`Mutation: ${option.name}`) : raging
    let modifiers = wired.linkedModifiers ?? []
    if (!modifiers.length) modifiers = [notes(option.name, "Resolve this selected option using its description")]
    modifiers = modifiers.map((m) => ({ ...m, characteristics: m.characteristics?.map((c) => ({ ...c, limitations: [...(c.limitations ?? []), ...limitation] })), activation: m.activation ? { ...m.activation, effects: m.activation.effects?.map((e) => ({ ...e, limitations: [...(e.limitations ?? []), ...limitation] })) } : undefined }))
    if (active) modifiers.push({ ...notes(`${option.name} timing`, "Resolve this active option using its description"), activation: active })
    wired = syncModifierRefs({ ...wired, linkedModifiers: modifiers })
    return { ...option, linkedModifiers: wired.linkedModifiers, modifierRefs: wired.modifierRefs }
  })
  return { ...replaceWiring(f, []), isChoice: true, choices: { category: f.name, count, options,
    ...(mutation ? { choiceCountByLevel: [{ level: 3, count: 3 }, { level: 6, count: 5 }, { level: 10, count: 7 }, { level: 14, count: 9 }], swappableOnRest: true, swapRestType: "long" as const } : {}),
  } }
}

const FREE_TRIGGERS = new Set(["Infectious Fury", "Noxious Strike", "Unwaivering Faith", "Wondrous Success", "Mighty Blow", "Death Strike", "Grave Bolt", "Assassinate", "Predictive Fighting", "Wild Fire", "Wild Growth", "Stoneblood", "Overgrowth", "Otherworldly Step", "Battle Hysteria", "Invigorating Critical", "Demonic Bloodlust"])
const RESET_FALSE_POSITIVES = new Set(["Wild Sorcery", "Chaos Overwhelming", "Controlled Chaos", "Martial Training", "Awakened Bloodline", "Draconic Fury", "Arcane Disruption", "Frenzy", "Champion of the Gods", "Blinding Defense", "Undead Resilience", "Regal Presence", "Blood Magic", "Grave Bolt", "Spell Thief", "Dark Offering", "Soul Trinkets", "Bestial Rage"])

function wireFeature(f: Feature, className: string, subclass: string): Feature {
  if (/Exploits(?: \(\d+\))?$/.test(f.name)) return f
  const text = plain(f.description)
  let feature = RESET_FALSE_POSITIVES.has(f.name) ? replaceWiring(f, []) : f
  let modifiers = [...(feature.linkedModifiers ?? [])]
  // Choice owners carry only the picker, not modifiers extracted from all choices.
  if (feature.isChoice && feature.choices?.options?.length) modifiers = modifiers.filter((m) => m.characteristics?.some((c) => c.type === "subclass_unlock"))
  let activation = timing(text) ?? (FREE_TRIGGERS.has(f.name) ? free : undefined)
  if (f.name === "Savage Companion") activation = { bonusAction: true }
  if (f.name === "Master Poisoner" || f.name === "Quick Fingers" || f.name === "Eye for Detail" || f.name === "Tactical Acumen" || f.name === "Metaphysical Shift") activation = { bonusAction: true }
  if (f.name === "Extra Attack") {
    modifiers = [effect(f.name, { kind: "extra_attack", extraAttackCount: 1 })]
    if (subclass === "Infernal Sorcery") { activation = { bonusAction: true, requirements: [{ kind: "custom", text: "After using your action to cast a spell or Dash" }] }; modifiers.push(effect(`${f.name} follow-up`, { kind: "bonus_action_attack" }, activation)) }
  }
  let config = sourceUses(text, className === "Alternate Sorcerer")
  if (f.name === "Controlled Chaos") config = undefined
  if (f.name === "Ancestral Knowledge") config = { type: "fixed", fixedAmount: 1, recharges: longRest, restoreByResource: { resourceKey: "rage", resourceAmount: 1, restores: 1 } }
  if (["Primeval Eruption", "Primeval Companion", "Favored Presence"].includes(f.name)) config = pool("rage")
  if (f.name === "Reality Warp") config = { ...con(), recharges: [{ rest: "short_rest", amount: 1 }, ...longRest], restoreByResource: { resourceKey: "exploit_dice", resourceAmount: 1, restores: 1 } }
  if (f.name === "Spell Thief") config = { type: "fixed", fixedAmount: 1, recharges: longRest, restoreBySpellSlot: { minSpellLevel: 3, restores: 1 } }
  if (f.name === "Metaphysical Shift") config = { ...pool("psi_points"), classResourceCostMode: "up_to_ability_modifier", classResourceCostAbility: "INT" }
  if (f.name === "Blade of Strife") config = { ...cha(), restoreByResource: { resourceKey: "alternate_sorcerer_sorcery_points", resourceAmount: 3, restores: 1 } }
  // The Blade's recurring attack is a separate free bonus action, not another summon charge.
  if (config && activation) modifiers = [...modifiers.filter((m) => !m.characteristics?.some((c) => c.type === "uses")), uses(f.name, config)]
  if (f.name === "Frenzy" || f.name === "Champion of the Gods") modifiers.push(rider(f.name, ["Attack"], { weaponDamageMenu: true, selectable: true, classResourceKey: "exploit_dice", classResourceDieCount: 2, limitations: raging, menuConditionLabel: f.name === "Frenzy" ? "First Reckless hit on your turn" : "First weapon hit on your turn" }))
  if (f.name === "Frenzy") modifiers.push(characteristic(f.name, { type: "speed", speedType: "walk", mode: "add", value: 10, limitations: raging }))
  if (f.name === "Draconic Fury") modifiers.push(characteristic(f.name, { type: "ac", mode: "flat_bonus", flatBonus: 2, limitations: [...raging, { id: "alt_wyrm_unarmored", kind: "armor_type", rule: "requires_not_wearing", value: "Any armor" }] }), rider(f.name, ["Rage"], { alertSummary: "Once per turn, roll two Rage damage dice; use ancestry damage type" }))
  if (f.name === "Mindless Rage") modifiers = [characteristic(f.name, { type: "condition_immunity", conditions: ["Charmed", "Frightened"], limitations: raging }), notes(f.name, "While Raging, suspend Charmed/Frightened and ignore the first five Exhaustion levels")]
  if (f.name === "Reckless Spellcasting") modifiers = [effect(f.name, { kind: "check_roll_modifier", checkCategory: "spell_attack", checkRollMode: "advantage", limitations: [{ ...raging[0], value: "reckless_attack" }] })]
  if (f.name === "Wild Fury") modifiers = [rider(f.name, ["Savage Companion"], { alertSummary: "Companion attacks are magical; while within 30 feet during Rage, companion resists physical damage" })]
  if (f.name === "War Magic") { activation = { bonusAction: true }; modifiers = [effect(f.name, { kind: "bonus_action_attack" }), notes(f.name, "Only after casting a spell with your action")] }
  if (f.name === "Wild Sorcery") {
    const options = [...f.description.matchAll(/<tr>\s*<td[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)].map((match) => {
      const active = timing(plain(match[2]))
      return { name: `Wild Sorcery ${Number(match[1])}`, description: plain(match[2]), resourceCost: 0, ...(active ? { actionKind: active.reaction ? "reaction" as const : active.bonusAction ? "bonus" as const : "action" as const } : {}) }
    })
    activation = free
    modifiers = [characteristic(f.name, { type: "resource_ability_menu", resourceKey: "rage", waiveResourceCost: true, options }), notes(f.name, "Roll d12 when entering Rage, then choose only that result. Options with actions spend the listed action economy; passive results are reminders.")]
  }
  if (["Iron Grip", "Tyrannical Resilience"].includes(f.name)) modifiers = modifiers.map((m) => ({ ...m, activation: m.activation ? { ...m.activation, effects: m.activation.effects?.map((e) => ({ ...e, limitations: [...(e.limitations ?? []), ...raging] })) } : undefined }))
  if (f.name === "Mental Scourge") modifiers.push(characteristic(f.name, { type: "turn_start_trigger", restoreResourceKey: "psi_points", restoreResourceAmount: 1 }))
  if (f.name === "Undead Resilience" && subclass === "Vampiric Sorcery") modifiers = [characteristic(f.name, { type: "damage_resistance", damageTypes: ["Necrotic", "Poison"] }), characteristic(f.name, { type: "condition_immunity", conditions: ["Poisoned"] }), notes(f.name, "Physical nonmagical/nonsilvered resistance applies only while Blood Magic temporary HP remain")]
  if (f.name === "Spell Thief") modifiers.push(notes(f.name, "Both participants roll a spell attack; on a win negate the spell and record its one free casting"))
  if (f.name === "Assassinate") {
    activation = free
    modifiers = [rider(f.name, ["Attack", "Sneak Attack"], { alertSummary: "Advantage only against a creature that has not acted. Sneak Attack against an Incapacitated or Surprised target automatically crits." }), notes(f.name, "After initiative order is set, may spend one Exploit Die and add it to initiative; adjust the initiative total after rolling.")]
  }
  if (f.name === "Psi Blade") {
    activation = { bonusAction: true }
    modifiers = [characteristic(f.name, { type: "special_attack", attackName: "Psi Blade", attackProfile: "melee", attackAbility: "INT", properties: ["Light", "Thrown (40/120)", "Finesse"], rangeFeet: 5, damageTypes: ["Psychic"], damageDiceCount: 1, damageDieType: "d4", damageAbilityModifier: "INT", damageByLevel: [{ level: 3, mode: "dice", dieCount: 1, dieType: "d4" }, { level: 5, mode: "dice", dieCount: 1, dieType: "d6" }, { level: 11, mode: "dice", dieCount: 1, dieType: "d8" }, { level: 17, mode: "dice", dieCount: 1, dieType: "d10" }] }), notes(f.name, "May also replace an attack in the Attack action. Thrown range 40/120 feet; requires an empty hand. Use STR/DEX instead of INT if preferred by adjusting the roll.")]
  }
  if (f.name === "Acrobatic Training") modifiers.push(characteristic(f.name, { type: "unarmed_strike_damage", die: "1d4", dieByLevel: [{ level: 3, mode: "dice", dieCount: 1, dieType: "d4" }, { level: 5, mode: "dice", dieCount: 1, dieType: "d6" }, { level: 11, mode: "dice", dieCount: 1, dieType: "d8" }, { level: 17, mode: "dice", dieCount: 1, dieType: "d10" }] }), characteristic(f.name, { type: "weapon_ability_override", scope: "specific", weaponNames: ["Unarmed Strike"], appliesTo: "both", ability: "dexterity", treatAsFinesse: true }))
  if (f.name === "Negate Spell") { activation = { reaction: true }; modifiers.push(notes(f.name, "Counterspell uses a reaction; Dispel Magic uses an action. Choose the spell and mark that action economy manually.")) }
  if (["Earthen Form", "Infernal Form"].includes(f.name)) {
    const earth = f.name === "Earthen Form"
    const active = state(f.name)
    const armor = [{ id: "alt_form_no_armor", kind: "armor_type" as const, rule: "requires_not_wearing" as const, value: "Any armor" }, ...(earth ? [{ id: "alt_form_no_shield", kind: "armor_type" as const, rule: "requires_not_wearing" as const, value: "Shield" }] : [])]
    config = { ...cha(), restoreByResource: { resourceKey: "alternate_sorcerer_sorcery_points", resourceAmount: 3, restores: 1 } }
    modifiers = [uses(f.name, config), characteristic(f.name, { type: "ac", mode: "ability_modifiers", base: 10, abilities: earth ? ["CON", "CHA"] : ["DEX", "CHA"], limitations: [...active, ...armor] }),
      characteristic(f.name, { type: "unarmed_strike_damage", die: earth ? "1d6" : "1d8", emptyHandedDie: earth ? "1d8" : null, damageType: earth ? "Bludgeoning" : "Slashing", ability: earth ? "constitution" : "charisma", limitations: active }),
      characteristic(f.name, { type: "weapon_ability_override", scope: "specific", weaponNames: ["Unarmed Strike"], appliesTo: "both", ability: earth ? "constitution" : "charisma", limitations: active }),
      ...(earth ? [] : [characteristic(f.name, { type: "speed", mode: "add", speedType: "walk", value: 10, limitations: active })]),
      notes(f.name, `Enable ${f.name} in sheet toggles for its duration. Its repeated temporary-HP bonus action does not consume another transformation use.`)]
  }
  const gated: Record<string, string> = { "Draconic Wings": "Draconic Wings", "Draconic Flight": "Draconic Flight", "Celestial Flight": "Celestial Flight", "Celestial Ascension": "Radiant Soul", "Sinister Apotheosis": "Infernal Form", "Mountain's Heart": "Earthen Form", "Primordial Monolith": "Earthen Form", "Spectral Step": "Spectral Step" }
  if (gated[f.name]) modifiers = modifiers.map((m) => ({ ...m, characteristics: m.characteristics?.map((c) => c.type === "uses" || c.type === "player_note" ? c : { ...c, limitations: [...(c.limitations ?? []).filter((l) => l.kind !== "sheet_toggle"), ...state(gated[f.name])] }) }))
  if (!modifiers.length && !feature.isChoice && !/Spell List$|Spells$|Spellcasting|Magic$/.test(f.name)) modifiers.push(notes(f.name, "Resolve the described conditions and results manually; this feature does not apply them automatically"))
  if (activation) {
    if (!modifiers.some((m) => m.characteristics?.some((c) => c.type === "player_note"))) modifiers.push(notes(f.name, "Choose targets and resolve conditional results using the full description"))
    feature = action({ ...feature, limitedUses: config ?? feature.limitedUses }, activation, modifiers)
  } else feature = syncModifierRefs({ ...feature, linkedModifiers: modifiers })
  return feature
}

function addedAction(name: string, level: number, description: string, activation: FeatureActivation, config?: UsesConfig): Feature {
  return action(replaceWiring({ name, level, description } as Feature, [...(config ? [uses(name, config)] : []), notes(name, "Resolve the effect using its description")]), activation)
}

export function wireAlternateLastThreeSubclasses(content: ImportContent): ImportContent {
  const resources = [...(content.class_resources ?? [])]
  if (content.subclasses?.some((s) => s.class_name === "Alternate Rogue" && s.name === "Psiknife")) {
    const previous = resources.findIndex((r) => r.class_name === "Alternate Rogue" && r.resource_key === "psi_points")
    if (previous >= 0) resources.splice(previous, 1)
    resources.push({ class_name: "Alternate Rogue", subclass_name: "Psiknife", resource_key: "psi_points", name: "Psi Points", uses: { type: "at_level", atLevelTable: Array.from({ length: 18 }, (_, i) => ({ level: i + 3, count: i + 3 })), recharges: longRest } })
  }
  return { ...content, class_resources: resources, subclasses: content.subclasses?.map((sub) => {
    if (!own(sub.class_name)) return sub
    let features = signatureExploits(sub.features as Feature[])
    const mutations = features.find((f) => f.name === "Mutations (catalog)")
    features = features.map((f) => {
      if (f.name === "Mutations (catalog)") return { ...replaceWiring(f, []), sheetDisplay: { featuresTab: true, combatActions: false } }
      if (f.name === "Aberrant Alchemy" && mutations) return catalogChoice(f, mutations, 3, true)
      if (["Bestial Spirits", "Bestial Skill", "Bestial Champion"].includes(f.name)) {
        const choice = catalogChoice(f, f, 1)
        if (f.name === "Bestial Skill") choice.choices!.options = choice.choices!.options.map((option) => ({ ...option, linkedModifiers: [notes(option.name, "Add Constitution modifier (minimum +1) to the two listed skills")] }))
        return choice
      }
      return wireFeature(f, sub.class_name!, sub.name)
    })
    if (sub.name === "Psiknife") {
      const source = features.find((f) => f.name === "Psionic Awakening")
      if (source) {
        features = features.map((f) => f.name !== source.name ? f : replaceWiring(f, [effect(f.name, { kind: "class_resource", classResourceKey: "psi_points", classResourceChange: "increase", resourceRefreshOnRest: "short_rest", classResourceAmountConfig: { mode: "ability_modifier", ability: "INT", minimum: 1 } })]))
        const parts = sourceSections(source.description)
        for (const part of parts) if (!features.some((f) => f.name === part.name)) features.push(addedAction(part.name, 3, part.description, timing(plain(part.description)) ?? free, /Telepathic/.test(part.name) ? { ...pool("psi_points"), classResourceCostMode: "up_to_available" } : pool("psi_points")))
        const empowered = features.find((f) => f.name === "Empowered Blades")
        if (empowered) for (const part of sourceSections(empowered.description)) if (!features.some((f) => f.name === part.name)) features.push(addedAction(part.name, 7, part.description, free, part.name === "Sentient Strike" ? pool("psi_points") : undefined))
      }
    }
    for (const form of ["Earthen Form", "Infernal Form"]) if (features.some((f) => f.name === form) && !features.some((f) => f.name === `${form}: Fortify`)) features.push(action(replaceWiring({ name: `${form}: Fortify`, level: 3, description: `While ${form} is active, gain temporary hit points equal to your Charisma modifier (minimum 1). This does not consume another transformation use.` } as Feature, [effect(`${form} temporary HP`, { kind: "grant_temp_hp", healMode: "ability_modifier", healAbility: "CHA", healMinimum: 1 })]), { bonusAction: true, requirements: [{ kind: "custom", text: `While ${form} is active` }] }))
    if (sub.name === "Iron Sorcery" && !features.some((f) => f.name === "Blade of Strife Attack")) features.push(action(replaceWiring({ name: "Blade of Strife Attack", level: 3, description: "Move an existing Blade up to 30 feet and repeat its melee spell attack against a target within 10 feet. On hit: 1d8 force; add Charisma at level 6 and another 1d8 at level 14. Requires an active Blade; does not consume another summoning use." } as Feature, [characteristic("Blade of Strife Attack", { type: "special_attack", attackName: "Blade of Strife", attackProfile: "melee", attackAbility: "CHA", damageAbilityModifier: "CHA", damageAbilityFromLevel: 6, properties: ["Spell attack"], rangeFeet: 10, damageTypes: ["Force"], damageDiceCount: 1, damageDieType: "d8", damageByLevel: [{ level: 3, mode: "dice", dieCount: 1, dieType: "d8" }, { level: 14, mode: "dice", dieCount: 2, dieType: "d8" }] }), notes("Blade of Strife damage", "From level 6 add Charisma to damage")] ), { bonusAction: true }))
    const warden = sub.name === "Path of the Warden"
    return { ...sub, features: features as typeof sub.features, ...(warden ? { spellcasting: { ...sub.spellcasting, ability: "Constitution", caster_progression: "pact" as const, pact_magic: true, starts_at: 3,
      progression: Array.from({ length: 18 }, (_, i) => ({ level: i + 3, cantrips: i + 3 >= 10 ? 2 : 1, prepared: Math.floor((i + 3 - 1) / 2) + 1, max_spell_level: i + 3 >= 19 ? 4 : i + 3 >= 13 ? 3 : i + 3 >= 7 ? 2 : 1 })),
    } } : {}) }
  }) }
}
