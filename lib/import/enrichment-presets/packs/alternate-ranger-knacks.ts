import type { LinkedModifierInstance } from "@/lib/compendium/linked-modifiers"
import type { FeatureActivation } from "@/lib/types"
import { characteristic, effect, notes, rider, uses } from "./alternate-ranger-monk-progression"

const EXPERTISE: Record<string, string> = { "Alpine Adept": "Athletics", "Aquatic Adept": "Athletics", "Herbalist I": "Medicine",
  "Naturalist I": "Nature", "Rider I": "Animal Handling", "Slayer I": "Perception", "Stalker I": "Stealth", "Strider I": "Survival",
  "Trapper I": "Sleight of Hand", "Urban Adept": "Investigation", "Wild Insight": "Insight" }
const RESISTANCE: Record<string, string> = { "Arctic Adept": "Cold", "Desert Adept": "Fire", "Jungle Adept": "Poison" }
const KNOWN = new Set(["Alpine Adept", "Aquatic Adept", "Desert Adept", "Arctic Adept", "Cavern Adept", "Favored Foe", "Fell Handed I", "Fell Handed II", "Herbalist I", "Herbalist II", "Herbalist III", "Hedge Knight I", "Hedge Knight II", "Jungle Adept", "Naturalist I", "Naturalist II", "Natural Regeneration", "Planar Adept", "Rider I", "Rider II", "Slayer I", "Slayer II", "Slayer III", "Stalker I", "Stalker II", "Stalker III", "Stalker IV", "Strider I", "Strider II", "Strider III", "Strider VI", "Student of the Wild", "Survivor I", "Survivor II", "Survivor III", "Trapper I", "Trapper II", "Urban Adept", "Wild Insight", "Wild Insight II", "Woodsman"])

export function wireAlternateRangerKnack(row: Record<string, unknown>): Record<string, unknown> {
  if (row.source_name !== "Alternate Ranger" || row.ability_role !== "knack") return row
  const name = String(row.name)
  if (!KNOWN.has(name)) return row
  const modifiers: LinkedModifierInstance[] = []
  let activation: FeatureActivation = {}
  if (EXPERTISE[name]) modifiers.push(characteristic(name, { type: "skills", entries: [{ skill: EXPERTISE[name], expertise: true }] }))
  if (RESISTANCE[name]) modifiers.push(characteristic(name, { type: "damage_resistance", damageTypes: [RESISTANCE[name]] }))
  if (name === "Planar Adept") modifiers.push(characteristic(name, { type: "damage_resistance", damageTypes: [], choiceCount: 1, choiceOptions: ["Radiant", "Psychic", "Force", "Necrotic", "Thunder", "Acid", "Fire", "Cold"] }))
  if (name === "Wild Insight II") modifiers.push(characteristic(name, { type: "spells_known", spells: [{ spellId: "import_spell_name:Conjure Familiar", alwaysPrepared: true }] }))
  if (["Alpine Adept", "Aquatic Adept"].includes(name)) modifiers.push(characteristic(name, { type: "speed", speedType: name === "Alpine Adept" ? "climb" : "swim", mode: "set", value: 30 }))
  if (name === "Cavern Adept") { modifiers.push(characteristic(name, { type: "vision", visionType: "darkvision", rangeFeet: 60 })); activation = { bonusAction: true } }
  if (name === "Hedge Knight I") modifiers.push(characteristic(name, { type: "armor_proficiencies", values: ["Heavy armor"] }), characteristic(name, { type: "languages", values: [], choiceCount: 1 }))
  if (name === "Hedge Knight II") modifiers.push(characteristic(name, { type: "skills", entries: ["History", "Persuasion", "Religion"].map((skill) => ({ skill, expertise: false })), choiceCount: 1 }), characteristic(name, { type: "languages", values: [], choiceCount: 1 }), characteristic(name, { type: "skill_check_alternate_ability", skills: ["History", "Persuasion", "Religion"], ability: "wisdom" }))
  if (name === "Herbalist I") modifiers.push(characteristic(name, { type: "tool_proficiencies", values: ["Herbalism Kit"], grantExpertise: true }))
  if (name === "Naturalist I") { modifiers.push(characteristic(name, { type: "skill_check_alternate_ability", skills: ["Nature"], ability: "wisdom" })); activation = { bonusAction: true } }
  if (name === "Student of the Wild") modifiers.push(characteristic(name, { type: "skills", entries: ["Animal Handling", "Athletics", "Insight", "Investigation", "Medicine", "Nature", "Perception", "Sleight of Hand", "Stealth", "Survival"].map((skill) => ({ skill, expertise: false })), choiceCount: 2 }))
  if (name === "Stalker II" || name === "Strider II") { activation = { bonusAction: true }; modifiers.push(effect(name, { kind: "movement_option", movementHide: name === "Stalker II", movementDash: name === "Strider II" }, activation)) }
  if (name === "Strider III") modifiers.push(characteristic(name, { type: "speed", speedType: "walk", mode: "add", value: 10 }))
  if (name === "Survivor I") { activation = { bonusAction: true }; modifiers.push(effect(name, { kind: "grant_temp_hp", healMode: "ability_modifier", healAbility: "CON" }, activation)) }
  if (name === "Trapper I") activation = { action: true }
  if (name === "Natural Regeneration") { activation = { action: true, noEconomyCost: true, requirements: [{ kind: "custom", text: "During a short rest" }] }; modifiers.push(uses(name, { type: "fixed", fixedAmount: 1, recharges: [{ rest: "long_rest" }] })) }
  if (name === "Urban Adept") modifiers.push(characteristic(name, { type: "languages", values: ["Thieves' Cant"] }))
  if (name === "Woodsman") modifiers.push(characteristic(name, { type: "tool_proficiencies", values: ["Woodcarver's Tools"] }))
  if (/^(?:Slayer|Fell Handed) /.test(name)) modifiers.push(rider(name, ["Attack", "Ranger's Quarry"]))
  if (name === "Stalker IV") modifiers.push(rider(name, ["Hide", "Stalker II"]))
  modifiers.push({ ...notes(name, "Choices, conditional benefits, and tracked results from this Knack"), activation })
  return { ...row, mechanics: [], eligible_classes: ["Alternate Ranger"], casting_time: activation.bonusAction ? "Bonus Action" : activation.action ? "Action" : "Passive",
    linkedModifiers: modifiers, linked_modifiers: modifiers, modifierRefs: modifiers.map((m) => m.catalogRefId), modifier_refs: modifiers.map((m) => m.catalogRefId) }
}
