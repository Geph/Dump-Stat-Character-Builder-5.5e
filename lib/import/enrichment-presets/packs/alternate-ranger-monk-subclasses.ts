import type { ImportContent } from "@/lib/import/content-schema"
import type { Feature, FeatureActivation, UsesConfig } from "@/lib/types"
import { syncModifierRefs } from "@/lib/compendium/linked-modifiers"
import { parseAiMechanics } from "@/lib/import/parse-ai-mechanics"
import { detectFeatureModifiers, mergeFeatureModifierDetections } from "@/lib/import/detect-feature-modifiers"
import { action, characteristic, effect, kiUses, MONK_KI, notes, replaceWiring, rider, uses } from "./alternate-ranger-monk-progression"
import { remapMonkResourceReferences, wireAlternateMonkTechnique, ALTERNATE_MONK_STRIKE_TECHNIQUE_NAMES } from "./alternate-monk-techniques"
import { wireAlternateRangerKnack } from "./alternate-ranger-knacks"
import { correctAlternateSubclassFeature } from "./alternate-ranger-monk-corrections"

const plain = (text: string) => text.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
const free: FeatureActivation = { action: true, noEconomyCost: true }
const wisUses = (short = false): UsesConfig => ({ type: "ability_modifier", abilityModifier: "WIS", recharges: short ? [{ rest: "short_rest" }, { rest: "long_rest" }] : [{ rest: "long_rest" }] })

/** Exact signature-table rows are grants at their listed levels, not one L3 grant. */
function signatureTechniques(features: Feature[], content: ImportContent): Feature[] {
  const result: Feature[] = []
  const generated = new Set<string>()
  for (let feature of features) {
    if (!/Techniques$/.test(feature.name) || !/Techniques Known/i.test(feature.description)) { result.push(feature); continue }
    const grants = [...feature.description.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
      const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => plain(m[1]))
      const level = Number.parseInt(cells[0])
      return cells.length === 2 && Number.isFinite(level) && level >= 3 && level <= 20 ? [{ level, name: cells[1] }] : []
    })
    if (!grants.length) { result.push(feature); continue }
    feature = replaceWiring(feature, [])
    for (const grant of grants) {
      const name = grant.level === feature.level ? feature.name : `${feature.name} (${grant.level})`
      generated.add(name)
      result.push(syncModifierRefs({ ...feature, name, level: grant.level, linkedModifiers: [
        characteristic(name, { type: "grant_custom_ability", abilityNames: [grant.name] }),
      ] }))
      if (feature.name === "Open Hand Techniques") {
        const library = [...(content.abilities ?? []), ...(content.import_proposals?.custom_abilities ?? [])]
          .filter((a) => a.source_name === "Alternate Monk" && (a.name === grant.name || ALTERNATE_MONK_STRIKE_TECHNIQUE_NAMES.includes(a.name)))
        const unique = library.filter((a, i) => library.findIndex((b) => b.name === a.name) === i)
        if (unique.length) result[result.length - 1] = syncModifierRefs({ ...result.at(-1)!, linkedModifiers: [], isChoice: true,
          choices: { category: name, count: 1, swappableOnLevelUp: true, options: unique.map((a) => ({ name: a.name,
            description: a.description ?? "", prerequisite: a.prerequisite, level_requirement: a.level_requirement,
            linkedModifiers: [characteristic(`${name} ${a.name}`, { type: "grant_custom_ability", abilityNames: [a.name] })],
          })) },
        })
      }
    }
  }
  return result.filter((f, i) => !generated.has(f.name) || result.findIndex((other) => other.name === f.name && other.level === f.level) === i)
}

/** Rebuild inline exploit options from their full library rows, including degree gates. */
function exploitPicker(feature: Feature, content: ImportContent, monk: boolean): Feature {
  const library = [...(content.abilities ?? []), ...(content.import_proposals?.custom_abilities ?? [])]
  const eligible = library.filter((a) => (a.eligible_classes ?? []).some((n) => monk ? /^Brawler$/i.test(n) : /^(Alternate )?Fighter$/i.test(n)) && a.execution)
  const options = eligible.flatMap((ability) => {
    const oldLevel = ability.level_requirement ?? 1
    if (oldLevel >= 13) return [] // These subclasses never learn fourth/fifth-degree exploits.
    const level = oldLevel >= 9 ? 15 : oldLevel >= 5 ? 7 : 3
    const ctx = { contentKind: "ability" as const, sourceName: monk ? "Alternate Monk" : "Alternate Ranger", featureName: ability.name, level, classPrefix: monk ? "alternate_monk" : "alternate_ranger" }
    const parsed = parseAiMechanics(ability.mechanics, ctx)
    const linked = mergeFeatureModifierDetections(ability as unknown as Feature, parsed.detections,
      detectFeatureModifiers(ability.description ?? "", { ...ctx, suppressNameDetection: true }))
    const activation: FeatureActivation = /bonus action/i.test(ability.execution ?? "") ? { bonusAction: true }
      : /reaction/i.test(ability.execution ?? "") ? { reaction: true } : /^(?:1 )?action$/i.test(ability.execution ?? "") ? { action: true } : free
    linked.linkedModifiers = [...(linked.linkedModifiers ?? []), { ...notes(`${ability.name} execution`, ability.execution!), activation }]
    let prerequisite = (ability.prerequisite ?? "").replace(/\b\d+(?:st|nd|rd|th)[- ]level(?:\s+(?:Fighter|Barbarian|Monk|Ranger))?/gi, `${level}th-level ${monk ? "Monk" : "Ranger"}`)
    if (monk) prerequisite = prerequisite.replace(/Strength (\d+)/gi, "Strength or Wisdom $1")
    return [{ name: ability.name, description: ability.description || "", prerequisite,
      level_requirement: level, linkedModifiers: linked.linkedModifiers, modifierRefs: linked.modifierRefs }]
  })
  const unique = options.filter((o, i) => options.findIndex((p) => p.name === o.name) === i)
  return { ...feature, choices: { ...feature.choices!, options: unique.length ? unique : feature.choices?.options ?? [],
    swappableOnLevelUp: true, swappableOnRest: false,
  } }
}

const MONK_ACTIVE: Record<string, [keyof Pick<FeatureActivation, "action" | "bonusAction" | "reaction"> | "free", number?]> = {
  "Astral Armor": ["bonusAction", 2], "Master Astral Warrior": ["action"], "Unpredictable Sway": ["reaction", 1],
  "Chaotic Luck": ["free", 1], "Touch of Life": ["free", 1], "Touch of Death": ["free", 1], "Master of Harmony": ["action", 6],
  "Practiced Strikes": ["free"], "Ebb and Flow": ["reaction"], "Luminous Spirit": ["free", 1], "Searing Blast": ["bonusAction", 1],
  "Luminous Burst": ["action"], "Master of Radiance": ["bonusAction"], "Divine Conduit": ["action"], "Heavenly Protection": ["free"],
  "Searing Light": ["bonusAction"], "Master of the Sacred Inks": ["bonusAction"], "Frightful Touch": ["free", 1],
  "Pierce the Veil": ["action", 1], "Sinister Vitality": ["free"], "Armor of the Grave": ["free", 1], "Master of Reaping": ["free", 1],
  "Elemental Breath": ["free"], "Shadow Arts": ["action"], "Shadow Step": ["bonusAction"], "Cloak of Shadows": ["action"],
  "Deadly Perfection": ["bonusAction"], "Master of Shining Steel": ["free"], "Elemental Spirit": ["bonusAction"], "Spiritual Flow": ["free", 2],
  "Master of the Elements": ["action"], "Solid Body": ["free"], "Density of Spirit": ["bonusAction", 2], "Earthshaker": ["free"],
  "Infamous Reputation": ["bonusAction", 1], "Flowing River Stance": ["bonusAction"], "River's Reprisal": ["reaction"],
  "Tempestuous Strike": ["bonusAction"], "Crushing Counter": ["reaction"], "Buffeting Winds": ["free", 1],
  "Master of the Hurricane": ["action"], "Heroic Persona": ["bonusAction"], "Entropic Touch": ["action", 2],
  "Void Strike": ["free", 1], "Unmake Magic": ["action", 3], "Master of Entropy": ["free"],
}
const RANGER_ACTIVE: Record<string, FeatureActivation> = {
  "Primal Beast": { bonusAction: true }, "Draconic Companion": { bonusAction: true }, "Elemental Breath": { action: true },
  "Deadly Counter": { reaction: true }, "Whimsical Ward": free, "Faerie Guardian": { action: true }, "Mirthful Step": { bonusAction: true },
  "Ambuscade": { reaction: true, onInitiative: true }, "Cunning Parry": { reaction: true }, "Relentless Hunter": free,
  "Horde Breaker": { action: true }, "Knowledge of the Hunt": { bonusAction: true }, "Hated Foe": { bonusAction: true },
  "Monster's Nemesis": { reaction: true }, "Ruthless Counter": { reaction: true }, "Extraplanar Awareness": { action: true },
  "Ethereal Step": free, "Ethereal Defense": { reaction: true }, "Mage Breaker": { reaction: true }, "Spellbane": free,
  "Reflect Spell": { reaction: true }, "Symbiotic Swarm": { bonusAction: true }, "One with the Swarm": { reaction: true },
  "Swarm Master": free, "Child of the Great Waters": { reaction: true }, "Crimson Mark": { bonusAction: true },
  "Avatar of Primeval Horror": free, "Nomad's Step": { bonusAction: true, reaction: true }, "Wild Shape": { bonusAction: true },
  "Wild Warrior": { onInitiative: true }, "Twist of Fate": { reaction: true }, "Radiant Retort": { reaction: true },
  "Deft Hands": { bonusAction: true }, "Improvised Traps": { action: true }, "Always Prepared": { reaction: true, onInitiative: true },
  "Illusory Strikes": { bonusAction: true }, "Wasteland Mirage": { action: true }, "Winter's Blessing": { action: true },
  "Ruthless Cold": { reaction: true }, "White Walker": { bonusAction: true }, "Beast Command": { action: true, reaction: true },
  "Master Tamer": { bonusAction: true }, "Absolute Command": { reaction: true },
}

function wireSubclassFeature(f: Feature, parent: string, subclass: string): Feature {
  const monk = parent === "Alternate Monk"
  let feature = monk ? remapMonkResourceReferences(f) : f
  // Discard demonstrably wrong namesake mechanics instead of leaving invisible stat inflation.
  if (monk && ["Astral Visage", "Cloak of Shadows", "Shadow Step", "Solid Body"].includes(f.name) ||
      !monk && ["Dread Ambusher", "Cloak of Shadows", "Exceptional Training", "Wild Shape"].includes(f.name)) {
    feature = replaceWiring(feature, [notes(f.name, "Conditional benefits and current state")])
    if (f.name === "Dread Ambusher") feature.linkedModifiers!.push(characteristic(f.name, { type: "initiative", mode: "add_ability_modifier", ability: "WIS", limitations: [
      { id: "ambusher_incapacitated", kind: "condition", rule: "blocked_when_has", value: "Incapacitated" },
      { id: "ambusher_surprised", kind: "condition", rule: "blocked_when_has", value: "Surprised" },
    ] }), rider(f.name, ["Attack"]))
    if (f.name === "Exceptional Training") feature.linkedModifiers!.push(rider(f.name, ["Primal Beast"]))
    if (f.name === "Shadow Step") feature.linkedModifiers!.push(effect(f.name, { kind: "movement_option", movementTeleport: true, moveDistanceMode: "fixed", moveDistanceFixed: 60 }))
    if (f.name === "Wild Shape") feature.linkedModifiers!.push(uses(f.name, { ...wisUses(), recharges: [{ rest: "short_rest", amount: 1 }, { rest: "long_rest" }] }))
  }
  const timing = monk ? MONK_ACTIVE[f.name] : undefined
  const activation = timing ? timing[0] === "free" ? free : { [timing[0]]: true } : !monk ? RANGER_ACTIVE[f.name] : undefined
  if (activation) {
    const modifiers = [...(feature.linkedModifiers ?? [])]
    if (!modifiers.some((m) => m.characteristics?.some((c) => c.type === "player_note"))) modifiers.push(notes(f.name, "Targets, duration, and conditional results"))
    if (timing?.[1]) {
      const config = { ...kiUses(timing[1]), ...(["Pierce the Veil", "Master of Reaping"].includes(f.name) ? { classResourceCostMode: "up_to_ability_modifier" as const, classResourceCostAbility: "WIS" as const } : {}) }
      feature.limitedUses = config
      modifiers.splice(0, modifiers.length, ...modifiers.filter((m) => !m.characteristics?.some((c) => c.type === "uses")), uses(f.name, config))
    }
    feature = action(feature, activation, modifiers)
  }
  if (monk && f.name === "Practiced Strikes") feature = action(replaceWiring(feature, [uses(f.name, wisUses()), notes(f.name, "Once on your turn: waive a Strike Technique's Ki cost")]), free)
  if (monk && f.name === "Luminous Burst") feature = action(replaceWiring(feature, [uses(f.name, { ...wisUses(), restoreByResource: { resourceKey: MONK_KI, resourceAmount: 3, restores: 1 } }), notes(f.name, "Optional extra Ki increases damage; 100-foot line, six Martial Arts Dice, DEX half")]), { action: true })
  if (monk && f.name === "Searing Light") feature = action(replaceWiring(feature, [uses(f.name, { type: "fixed", fixedAmount: 1, recharges: [{ rest: "short_rest" }, { rest: "long_rest" }] }), notes(f.name, "One-minute form; ends if Incapacitated")]), { bonusAction: true })
  const formCosts: Record<string, number> = { "Master of the Sacred Inks": 5, "Master of the Elements": 6, "Master of Entropy": 6, "Master of the Hurricane": 5 }
  if (monk && formCosts[f.name]) feature = action(replaceWiring(feature, [uses(f.name, { type: "fixed", fixedAmount: 1,
    recharges: f.name === "Master of the Hurricane" ? [{ rest: "short_rest" }, { rest: "long_rest" }] : [{ rest: "long_rest" }],
    restoreByResource: { resourceKey: MONK_KI, resourceAmount: formCosts[f.name], restores: 1 },
  }), notes(f.name, "Resolve targets and temporary benefits using the feature description")]), activation!)
  if (!monk && ["Elemental Breath", "Whimsical Ward", "Mirthful Step", "One with the Swarm", "Twist of Fate", "Radiant Retort", "Ruthless Cold"].includes(f.name)) {
    const config = { ...wisUses(), ...(["Elemental Breath", "One with the Swarm", "Radiant Retort", "Ruthless Cold"].includes(f.name) ? { restoreBySpellSlot: { minSpellLevel: f.name === "Elemental Breath" ? 3 : 1, restores: 1 } } : {}),
      ...(f.name === "Ruthless Cold" ? { recharges: [{ rest: "short_rest" as const, amount: 1 }, { rest: "long_rest" as const }] } : {}) }
    feature = action(replaceWiring(feature, [uses(f.name, config), notes(f.name, "Targets and conditional results")]), activation!)
  }
  // A companion's attacks must never change its master's Attack action count.
  if (!monk && ["Greater Companion", "Mythic Companion", "Bestial Focus", "Primal Bond", "Greater Swarm"].includes(f.name)) feature = replaceWiring(feature, [rider(f.name, [subclass === "Drake Guard" ? "Draconic Companion" : subclass === "Beast Master" ? "Primal Beast" : "Symbiotic Swarm"])])
  return syncModifierRefs(correctAlternateSubclassFeature(feature))
}

export function wireAlternateRangerMonkSubclasses(content: ImportContent): ImportContent {
  return { ...content,
    subclasses: content.subclasses?.map((sub) => {
      if (!/^Alternate (Monk|Ranger)$/.test(sub.class_name ?? "")) return sub
      const monk = sub.class_name === "Alternate Monk"
      const features = (monk ? signatureTechniques(sub.features as Feature[], content) : sub.features as Feature[]).map((f) => {
        if (sub.name === "Way of the Brawler" && f.name === "Savage Exploits" || sub.name === "Bounty Hunter" && f.name === "Martial Exploits") return exploitPicker(f, content, monk)
        return wireSubclassFeature(f, sub.class_name!, sub.name)
      })
      const wuJen = sub.name === "Way of the Wu Jen"
      return { ...sub, features: features as typeof sub.features,
        ...(wuJen ? { spellcasting: { ...sub.spellcasting, ability: "Wisdom", caster_progression: "pact" as const, pact_magic: true, starts_at: 3,
          explicit_slot_progression: [{ level: 3, slots: [1] }, { level: 4, slots: [2] }, { level: 7, slots: [0, 2] }, { level: 13, slots: [0, 0, 2] }, { level: 19, slots: [0, 0, 0, 2] }],
          progression: [[3, 2, 2, 1], [5, 2, 3, 1], [7, 2, 4, 2], [9, 2, 5, 2], [10, 3, 5, 2], [13, 3, 6, 3], [17, 4, 7, 3], [19, 4, 7, 4]].map(([level, cantrips, prepared, max_spell_level]) => ({ level, cantrips, prepared, max_spell_level })),
        } } : {}),
      }
    }),
    abilities: content.abilities?.map((a) => wireAlternateRangerKnack(wireAlternateMonkTechnique(a as unknown as Record<string, unknown>)) as unknown as typeof a),
    import_proposals: content.import_proposals ? { ...content.import_proposals,
      custom_abilities: content.import_proposals.custom_abilities?.map((a) => wireAlternateRangerKnack(wireAlternateMonkTechnique(a as unknown as Record<string, unknown>)) as unknown as typeof a),
    } : undefined,
  }
}
