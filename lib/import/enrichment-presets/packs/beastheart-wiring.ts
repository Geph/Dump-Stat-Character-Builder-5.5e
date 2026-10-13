import type { ImportContent } from "@/lib/import/content-schema"
import type { Feature, FeatureActivation, FeatureEffect, UsesConfig } from "@/lib/types"
import type { CharacteristicModifier } from "@/lib/compendium/characteristic-modifiers"
import { syncModifierRefs, type LinkedModifierInstance } from "@/lib/compendium/linked-modifiers"

type Value<T> = T extends unknown ? Omit<T, "id"> : never
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_")
const plain = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/[’]/g, "'").replace(/\s+/g, " ").trim()
const key = (s: string) => plain(s).toLowerCase()
const ch = (name: string, value: Value<CharacteristicModifier>): LinkedModifierInstance => ({
  instanceId: `bh_${slug(name)}_${value.type}`, catalogRefId: `cat_char_${value.type}`,
  characteristics: [{ ...value, id: `bh_${slug(name)}_${value.type}` } as CharacteristicModifier],
})
const fx = (name: string, value: Omit<FeatureEffect, "id">): LinkedModifierInstance => ({
  instanceId: `bh_${slug(name)}_${value.kind}`, catalogRefId: `cat_fx_${value.kind}`,
  activation: { effects: [{ ...value, id: `bh_${slug(name)}_${value.kind}` }] },
})
const note = (name: string, prompt: string) => ch(name, { type: "player_note", target: "feature", prompt })
const uses = (name: string, config: UsesConfig) => ch(name, { type: "uses", uses: config })
const pool = (amount: number): UsesConfig => ({ type: "class_resource", classResourceKey: "ferocity", classResourceAmount: amount })
const lr = [{ rest: "long_rest" as const }]
const sr = [{ rest: "short_rest" as const }, ...lr]
const once = (short = false): UsesConfig => ({ type: "fixed", fixedAmount: 1, recharges: short ? sr : lr })
const wis = (): UsesConfig => ({ type: "ability_modifier", abilityModifier: "WIS", recharges: lr })
const free: FeatureActivation = { action: true, noEconomyCost: true }
const active = (name: string) => [{ id: `bh_active_${slug(name)}`, kind: "sheet_toggle" as const, rule: "requires_active" as const, value: `feature_state:${name}` }]
const trigger = (text: string): FeatureActivation => ({ ...free, requirements: [{ kind: "custom", text }] })
function wire<T extends Feature>(f: T, mods: LinkedModifierInstance[], activation?: FeatureActivation): T {
  return syncModifierRefs({ ...f, mechanics: [], importModifierMeta: [], activation: activation ?? null, limitedUses: null,
    linkedModifiers: mods.map((mod, i) => i === 0 && activation ? { ...mod, activation: { ...activation, effects: mod.activation?.effects } } : mod),
    sheetDisplay: { featuresTab: true, ...(activation ? { combatActions: true } : {}) } }) as T
}
function companion<T extends Feature>(f: T, mods: LinkedModifierInstance[]): T {
  return { ...wire(f, mods), choices: { category: "Companion upgrade", count: 0, options: [], applyTo: "companion", applyToCompanionFeature: "Companion" }, isChoice: false }
}
const skills = (name: string, values: string[], expertise = false) => ch(name, { type: "skills", entries: values.map(skill => ({ skill, expertise })) })
const save = (name: string, ability: string) => fx(name, { kind: "force_save_control", saveAbility: ability, saveDCBase: 8, saveDCConfig: { mode: "ability_modifier", ability: "WIS" } })
const rider = (name: string, parents: string[], extra: Partial<Extract<CharacteristicModifier, { type: "power_rider" }>> = {}) => ch(name, { type: "power_rider", parentPowerNames: parents, alertSummary: name, ...extra })

/** Explicit costs/timing for the learned library; subclass lists remain independent. */
export function wireBeastheartExploit<T extends Feature>(f: T): T {
  const text = plain(f.description)
  const cost = Number(text.match(/(?:\(|^)(\d+)\+? Ferocity\b/i)?.[1] ?? text.match(/(?:spend|cost[:s]?)\s+(\d+)\s+ferocity/i)?.[1])
  const prices: Record<string, number> = { "aid us, friend":3,"bring them down":4,"drag them":4,"feral reflexes":2,"hurricane blow":3,"no escape":1,"primal pounce":3,"quick hide":2,"thrash":4,"crushing charge":8,"expanding fury":6,"furious vengeance":5,"marked prey":4,"primal shout":6,"wrath of the pack":4,"blood sport":16,"break the earth":14,"bury the dead":16,"imbue projectile":14,"rend":12,"spirit form":14,"drain them":4,"hellish wound":4,"infernal teleport":4,"wicked deception":3,"brimstone teleport":8,"chains from hell":8,"dark of hell":8,"infernal flames":8,"poison rain":8,"elemental shield":3,"freezing strike":2,"sickening strike":3,"wings when i need them":5,"lava geyser":8,"lightning eruption":8,"plant prison":5,"stinging swarm":6,"thunderous rebuke":6 }
  const reaction = /\b(?:use (?:your|a)|as a|using your) reaction\b/i.test(text)
  const attackAction = /whenever you take the Attack action/i.test(text)
  const activation: FeatureActivation = reaction ? { reaction: true } : /as a bonus action/i.test(text) ? { bonusAction: true } : /as an action/i.test(text) ? { action: true } : trigger(attackAction ? "During your Attack action; one such exploit per turn" : "When the described trigger occurs")
  const config = pool(Number.isFinite(cost) && cost > 0 ? cost : prices[key(f.name)] ?? 1)
  if (key(f.name) === "no escape") { config.classResourceCostMode = "up_to_ability_modifier"; config.classResourceCostAbility = "WIS" }
  const mods = [uses(f.name, config), note(f.name, "Companion within 60 feet; not rampaging. Resolve positioning, targets and companion follow-up attacks from the description.")]
  const saveAbility = text.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i)?.[1]
  if (saveAbility) mods.push(save(f.name, saveAbility))
  const damage = text.match(/(?:takes|taking|extra|additional)\s+(\d+)d(\d+)\s+(acid|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder|bludgeoning)?\s*damage/i)
  if (damage && activation.action && !activation.noEconomyCost && !/weapon attack|signature attack/i.test(text)) {
    mods.push(ch(f.name, { type: "special_attack", attackName: f.name, attackAbility: "WIS", attackProfile: "force_save", properties: [], damageTypes: damage[3] ? [damage[3]] : [], damageDiceCount: Number(damage[1]), damageDieType: `d${damage[2]}` as "d6", saveAbility, saveDCBase: 8, saveHalfDamage: /half as much/i.test(text),
      damageByLevel: /17th level|17th-level/.test(text) ? [{ level: 17, mode: "dice", dieCount: Number(damage[1])+1, dieType: `d${damage[2]}` as "d6" }] : [] }))
  }
  return wire(f, mods, activation)
}

function mystic(f: Feature): Feature {
  const options = (f.choices?.options ?? []).map(option => {
    const name = `Mystic Connection: ${option.name}`
    const text = plain(option.description)
    const mods = [note(name, "Use only the option matching your current companion; track its duration and affected targets.")]
    let activation: FeatureActivation | undefined
    if (/bonus action/i.test(text)) activation = { bonusAction: true }
    else if (/as an action/i.test(text)) activation = { action: true }
    else if (/when you hit/i.test(text)) activation = trigger("On a weapon hit")
    if (/long rest/i.test(text)) mods.push(uses(name, /Wisdom modifier/i.test(text) ? wis() : once(/short or long/i.test(text))))
    if (option.name === "Basilisk") mods.push(ch(name, { type: "damage_resistance", damageTypes: ["Bludgeoning", "Piercing", "Slashing"], limitations: active(name) }))
    if (["Blood Hawk", "Bulette"].includes(option.name)) mods.push(ch(name, { type: "speed", speedType: option.name === "Blood Hawk" ? "fly" : "burrow", mode: "equal_to_walk", value: 0, limitations: active(name) }))
    if (option.name === "Gelatinous Cube") {
      // Only the retaliatory acid costs a use; storing/retrieving objects remains free.
      activation = { reaction: true }
      mods.push(ch(name, { type: "special_attack", attackName: "Acid Retaliation", attackProfile: "force_save", properties: [], damageTypes: ["Acid"], damageDiceCount: 3, damageDieType: "d6" }), note(`${name} storage`, "Absorb or excrete objects as an action or bonus action without spending the acid retaliation use; track up to four objects in notes."))
    }
    if (option.name === "Giant Spider") mods.push(fx(name, { kind: "check_roll_modifier", checkCategory: "initiative", checkRollMode: "advantage" }), note(`${name} surprise`, "Cannot be surprised while not incapacitated"))
    if (option.name === "Giant Toad") mods.push(ch(name, { type: "speed", speedType: "swim", mode: "equal_to_walk", value: 0 }))
    if (option.name === "Worg") mods.push(ch(name, { type: "speed", speedType: "walk", mode: "add", value: 10 }))
    if (option.name === "Deinonychus") mods.push(fx(name, { kind: "hide" }))
    const wired = wire({ ...option, name, level: 9 }, mods, activation)
    return { ...option, linkedModifiers: wired.linkedModifiers, modifierRefs: wired.modifierRefs }
  })
  return { ...wire(f, []), choices: { ...f.choices!, options, swappableOnRest: false }, isChoice: true }
}

function base(f: Feature): Feature {
  switch (key(f.name)) {
    case "natural language": return wire(f, [note(f.name, "Simple communication with Beasts and Monstrosities; Animal Handling may replace social checks against them")])
    case "companion bond": return wire({ ...f, isChoice: false, choices: undefined }, [ch(f.name, { type: "subclass_unlock", label: f.name })])
    case "master caregiver": return wire(f, [ch(f.name, { type: "skills", entries: [{ skill: "Animal Handling", expertise: false }], expertiseIfProficient: true })])
    case "superior ferocity": return companion(f, [save(f.name, "Wisdom"), note(f.name, "Ferocity-action DC may use 8 + caregiver PB + Wisdom modifier instead of the printed DC; displayed save buttons use the higher value")])
    case "beyond instinct": return companion(f, [note(f.name, "Turn-start ferocity bonus: +1 at level 5, +3 at 10, +5 at 15. Companion skill substitutions follow the source.")])
    case "improved signature attack": return companion(f, [rider(f.name, ["Signature Attack"], { bonusDice: "1d6", dieByLevel: [{ level: 5, die: "1d6" }, { level: 11, die: "2d6" }, { level: 17, die: "3d6" }] }), note(f.name, "Companion attacks and ferocity actions count as magical")])
    case "faithful companion": return companion(f, [note(f.name, "Commands no longer cost a bonus action. While capable of commanding, choose rampage movement and target.")])
    case "rejuvenating ferocity": return wire(f, [uses(f.name, { ...wis(), classResourceKey: "ferocity", classResourceAmount: 1, classResourceCostMode: "up_to_available" }), ch(f.name, { type: "special_attack", attackName: f.name, attackProfile: "force_save", properties: [], damageTypes: [], damageDiceCount: 0, damageDieType: "d6", healFromResourceSpend: true, healTarget: "controlled_companion" })], { bonusAction: true })
    case "primal strike": return { ...wire(f, []), isChoice: true, choices: { category: "Primal damage type", count: 1, swappableOnRest: false, swappableOnLevelUp: true, options: ["Acid","Cold","Fire","Lightning","Poison","Thunder"].map(type => ({ name: type, description: "Optional extra damage once on your turn.", linkedModifiers: [rider(`${f.name} ${type}`, ["Attack"], { weaponDamageMenu: true, selectable: true, bonusDice: "1d8", dieByLevel: [{ level: 8, die: "1d8" }, { level: 14, die: "2d8" }], bonusDiceType: type, menuConditionLabel: "Once on your turn" })] })) } }
    case "mystic connection": return mystic(f)
    case "loyal to the end": return wire(f, [ch(f.name, { type: "condition_immunity", conditions: ["Charmed", "Frightened"] })])
    case "keen senses": return wire(f, [fx(f.name, { kind: "check_roll_modifier", checkCategory: "skill", checkSkills: ["Perception"], checkRollMode: "advantage" }), note(f.name, "Perception advantage requires sight, hearing or smell; Search is a bonus action")], { bonusAction: true })
    case "summon the wilds": return wire(f, [uses(f.name, once(true)), save(f.name, "Wisdom"), note(f.name, "Place the swarm and apply its penalties to chosen targets; lasts one minute")], { action: true })
    case "unbreakable friendship": return companion(f, [note(f.name, "While caregiver has HP and is perceptible: rampage checks automatically succeed, companion drops to 1 HP instead of 0, initiative grants 1d10 ferocity")])
    default: return f
  }
}

function subclass(f: Feature): Feature {
  const name = key(f.name)
  const text = plain(f.description)
  switch (name) {
    case "beast vitality": return wire(f, [ch(f.name, { type: "hit_points", mode: "per_level", levelScope: "owning_class", value: 1 })])
    case "thickened hide": return companion(f, [ch(f.name, { type: "ac", mode: "flat_bonus", flatBonus: 2 })])
    case "fury of the wise": return wire(f, [skills(f.name, ["Intimidation"]), fx(f.name, { kind: "check_roll_modifier", checkCategory: "skill", checkSkills: ["Intimidation"], checkRollMode: "bonus", bonusConfig: { mode: "ability_modifier", ability: "WIS" } })])
    case "hunter's instincts": return wire(f, [skills(f.name, ["Survival"], true), note(f.name, "Survival may replace Insight to read intentions or detect lies")])
    case "devil's understanding": return wire(f, [ch(f.name, { type: "languages", values: ["Infernal"] }), ch(f.name, { type: "skills", entries: [{ skill: "Arcana", expertise: false }, { skill: "Religion", expertise: false }], choiceCount: 1 })])
    case "primal understanding": return wire(f, [ch(f.name, { type: "languages", values: ["Primordial", "Sylvan"] }), skills(f.name, ["Nature"])])
    case "infernal exploits": case "nature exploits": return { ...f, choices: { ...f.choices!, swappableOnLevelUp: true, options: (f.choices?.options ?? []).map(o => { const wired = wireBeastheartExploit({ ...o, level: 3 }); return { ...o, linkedModifiers: wired.linkedModifiers, modifierRefs: wired.modifierRefs } }) } }
    case "fiendish traits": return { ...wire(f, []), isChoice: true, choices: { ...f.choices!, applyTo: "companion", applyToCompanionFeature: "Companion", swappableOnRest: true, options: (f.choices?.options ?? []).map(o => ({ ...o, linkedModifiers: o.name === "Wings" ? [ch(o.name, { type: "speed", speedType: "fly", mode: "set", value: 40 })] : o.name === "Fiendish Immunities" ? [ch(o.name, { type: "damage_immunity", damageTypes: ["Fire","Poison"] }), ch(o.name, { type: "condition_immunity", conditions: ["Poisoned"] })] : o.name === "Fiery Weapons" ? [rider(o.name, ["Signature Attack"], { bonusDice: "1d6", bonusDiceType: "Fire" })] : [note(o.name, "Deal 1d10 piercing damage when the described trigger occurs")], modifierRefs: [] })) } }
  }
  const mods = [note(f.name, "Resolve targets, range, duration and companion effects from the description.")]
  let activation: FeatureActivation | undefined
  if (["frenzied charge","synchronized stealth"].includes(name)) activation = { reaction: true }
  if (["primal warding","hell's charmer","unseen hunters"].includes(name)) { activation = { action: true }; mods.push(uses(f.name, name === "unseen hunters" ? once() : wis())) }
  if (name === "primal warding") mods.push(ch(f.name, { type: "special_attack", attackName: f.name, attackProfile: "force_save", attackAbility: "WIS", properties: [], damageTypes: ["Force"], damageDiceCount: 4, damageDieType: "d8", saveAbility: "Constitution", saveDCBase: 8, saveHalfDamage: true }))
  if (name === "hell's charmer") mods.push(save(f.name, "Wisdom"))
  if (name === "chosen quarry") { activation = trigger("At turn start after gaining ferocity, without rampaging"); mods.push(uses(f.name, pool(4)), rider(f.name, ["Attack"], { weaponDamageMenu: true, selectable: true, bonusDice: "1d6", menuConditionLabel: "Only your marked quarry" })) }
  if (name === "fiendish form") { activation = { bonusAction: true }; mods.push(uses(f.name, pool(6))) }
  if (name === "sentinel companion") { activation = trigger("Enemy within 5 feet attacks someone other than you or your companion; spends companion reaction"); mods.push(uses(f.name, pool(2))) }
  if (name === "undying protector") { activation = trigger("Drop to 0 HP with companion in sight"); mods.push(uses(f.name, { ...pool(2), classResourceCostMode: "up_to_available" }), note(`${f.name} cost`, "Select exactly 2, then 4, then 6 ferocity, etc.; reset price after a short or long rest. Set HP to 1.") ) }
  if (!activation && /companion/i.test(text)) return companion(f, mods)
  return wire(f, mods, activation)
}

export function wireBeastheartContent(content: ImportContent): ImportContent {
  const owns = (name?: string | null) => /^beastheart$/i.test(name ?? "")
  const abilities = content.import_proposals?.custom_abilities?.map(a => {
    if (!owns(a.source_name) && !["Infernal Bond","Primordial Bond"].includes(a.source_name ?? "")) return a
    const f = wireBeastheartExploit({ name: a.name, description: a.description ?? "", level: Number(a.prerequisite?.match(/\d+/)?.[0] ?? 2) } as Feature)
    return { ...a, modifierWiring: "explicit" as const, linkedModifiers: f.linkedModifiers, modifierRefs: f.modifierRefs, mechanics: [], source: "MCDM", creator: "MCDM" }
  })
  return { ...content,
    ...(abilities ? { import_proposals: { ...content.import_proposals, custom_abilities: abilities } } : {}),
    classes: content.classes?.map(c => {
      if (!owns(c.name)) return c
      let features = (c.features ?? []).filter(f => f.name !== "Subclass").map(f => base(f as Feature))
      // Choice-based upgrades target the companion, never the caregiver.
      if (features.some(f => f.name === "Beyond Instinct")) for (const level of [5,10,15]) for (const kind of ["Save","Skill"]) {
        const name = `Companion ${kind} Proficiency (${level})`
        if (features.some(f => f.name === name)) continue
        const names = kind === "Save" ? ["Strength","Dexterity","Constitution","Intelligence","Wisdom","Charisma"] : ["Acrobatics","Animal Handling","Athletics","Intimidation","Investigation","Perception","Performance","Sleight of Hand","Stealth","Survival"]
        features.push({ name, level, description: "Choose a new proficiency for your companion.", isChoice: true, choices: { category: name, count: 1, applyTo: "companion", applyToCompanionFeature: "Companion", options: names.map(n => ({ name: n, description: n, linkedModifiers: [kind === "Save" ? ch(name, { type: "saving_throws", values: [n] }) : skills(name, [n])] })) } })
      }
      if (features.some(f => f.name === "Loyal to the End") && !features.some(f => f.name === "Companion Loyalty")) features.push(companion({ name: "Companion Loyalty", level: 13, description: "Companion condition protection." }, [ch("Companion Loyalty", { type: "condition_immunity", conditions: ["Charmed","Frightened"] })]))
      if (features.some(f => f.name === "Summon the Wilds") && !features.some(f => f.name === "Move the Swarm")) features.push(wire({ name: "Move the Swarm", level: 18, description: "Move an existing swarm up to 30 feet; does not summon a new swarm." }, [note("Move the Swarm", "Requires your active Summon the Wilds swarm")], { bonusAction: true }))
      return { ...c, spellcasting: null, features: features.sort((a,b) => a.level-b.level) }
    }),
    subclasses: content.subclasses?.map(s => owns(s.class_name) ? { ...s, features: s.features?.map(f => subclass(f as Feature)) } : s),
  } as ImportContent
}
