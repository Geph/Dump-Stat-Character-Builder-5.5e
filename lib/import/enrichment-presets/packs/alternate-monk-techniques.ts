import type { FeatureActivation, UsesConfig } from "@/lib/types"
import type { LinkedModifierInstance } from "@/lib/compendium/linked-modifiers"
import { characteristic, effect, kiUses, MONK_KI, notes, rider, uses } from "./alternate-ranger-monk-progression"

type Timing = "action" | "bonus" | "reaction" | "hit" | "special" | "passive"
/** Technique timing and prices from Alternate Monk 3.1.1; no source prose. */
const TECHNIQUES: Record<string, [Timing, number, boolean?]> = {
  "Arresting Strike": ["hit", 1], "Ascetic Fortitude": ["reaction", 2], "Aura Sight": ["passive", 0],
  "Awaken the Third Eye": ["action", 8], "Banishing Strike": ["hit", 3], "Befuddling Strike": ["hit", 1],
  "Burning Blade": ["bonus", 1], "Commune with Self": ["action", 5], "Conjure Previous Life": ["action", 5],
  "Crippling Strike": ["hit", 1], "Crushing Strike": ["hit", 1, true], "Dazing Strike": ["hit", 1],
  "Deflect Missile": ["reaction", 0], "Deflect Strike": ["reaction", 1], "Divine Light": ["passive", 0],
  "Empty Body": ["bonus", 4], "Empowered Strike": ["hit", 1], "Envenomed Strike": ["hit", 1],
  "Enhanced Grip": ["passive", 0], "Friend of Beast & Leaf": ["action", 5], "Gale Rush": ["action", 1, true],
  "Gentling Touch": ["special", 1, true], "Heavenly Step": ["special", 1], "Impairing Strike": ["hit", 1],
  "Improvised Strikes": ["passive", 0], "Quivering Palm": ["hit", 5], "Seeking Strike": ["special", 1],
  "Indomitable Spirit": ["special", 1], "Mantle of Courtesy": ["special", 1], "Mystic Regeneration": ["action", 2],
  "Mystical Integrity": ["passive", 0], "Patient Defense": ["bonus", 1], "Probing Strike": ["hit", 1],
  "Severing Strike": ["hit", 3], "Slow Fall": ["passive", 0], "Slowing Strike": ["hit", 1],
  "Spiritual Armor": ["bonus", 1], "Step of the Wind": ["bonus", 0], "Stunning Strike": ["hit", 1],
  "Tongue of Sun & Moon": ["passive", 0], "Tremor Strike": ["action", 1, true], "Typhoon Strike": ["action", 1],
  "Word of Creation": ["action", 7],
}

/** Resource references can appear in nested triggers, effects, options, and use configs. */
export function remapMonkResourceReferences<T>(row: T): T {
  if (Array.isArray(row)) return row.map(remapMonkResourceReferences) as T
  if (!row || typeof row !== "object") return row
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
    /^(?:classResourceKey|restoreResourceKey|spendResourceKey|resourceKey)$/.test(key) && typeof value === "string"
      ? /^(?:ki|ki_points|focus_points)$/.test(value) ? MONK_KI : value === "martial_arts_dice" ? "martial_arts_die" : value
      : remapMonkResourceReferences(value),
  ])) as T
}

export function wireAlternateMonkTechnique(row: Record<string, unknown>): Record<string, unknown> {
  if (row.source_name !== "Alternate Monk") return row
  const name = String(row.name)
  const config = TECHNIQUES[name]
  if (!config) return remapMonkResourceReferences(row)
  const [timing, cost, variable] = config
  const activation: FeatureActivation = timing === "action" ? { action: true } : timing === "bonus" ? { bonusAction: true }
    : timing === "reaction" ? { reaction: true } : timing === "passive" ? {} : { action: true, noEconomyCost: true,
      requirements: [{ kind: timing === "hit" ? "on_hit" : "custom", ...(timing === "special" ? { text: "Use only at the trigger described by this technique" } : {}) } as NonNullable<FeatureActivation["requirements"]>[number]] }
  const modifiers: LinkedModifierInstance[] = []
  let useConfig: UsesConfig | undefined = cost ? { ...kiUses(cost), ...(variable ? { classResourceCostMode: "up_to_ability_modifier", classResourceCostAbility: "WIS" } : {}) } : undefined
  if (name === "Word of Creation") useConfig = { type: "fixed", fixedAmount: 1, classResourceKey: MONK_KI, classResourceAmount: 7, recharges: [{ rest: "short_rest" }, { rest: "long_rest" }] }
  if (useConfig) modifiers.push(uses(name, useConfig))
  if (timing === "hit") modifiers.push(rider(name, ["Attack"]))
  if (name === "Aura Sight") modifiers.push(characteristic(name, { type: "vision", visionType: "blindsight", rangeFeet: 20,
    rangeFeetByLevel: [[9, 20], [13, 30], [18, 60]].map(([level, fixed]) => ({ level, mode: "fixed", fixed })) }))
  else if (name === "Divine Light") modifiers.push(characteristic(name, { type: "spells_known", spells: [], choiceGrants: [{ level: 0, count: 2, classNames: ["Cleric"] }] }))
  else if (name === "Mantle of Courtesy") modifiers.push(characteristic(name, { type: "skills", entries: [{ skill: "Persuasion", expertise: false }] }), characteristic(name, { type: "skill_check_alternate_ability", ability: "wisdom", skills: ["Persuasion"] }))
  else if (name === "Step of the Wind") modifiers.push(effect(name, { kind: "movement_option", movementDash: true, movementDisengage: true }, activation))
  else if (name === "Spiritual Armor") modifiers.push(effect(name, { kind: "grant_temp_hp", healMode: "ability_modifier", healAbility: "WIS" }, activation))
  // Keep target resolution and conditional/optional branches in the same overlay,
  // rather than mistaking their text for an always-on stat modifier.
  modifiers.push({ ...notes(name, name === "Deflect Missile" ? "Reduction is free; spend 1 Ki only if returning the caught attack"
    : name === "Quivering Palm" ? "Marked creature and expiry; triggering the saving throw later costs an action, not another 5 Ki"
    : name === "Empty Body" ? "Invisibility/resistance duration; Astral Projection is a separate 8 Ki use"
    : name === "Awaken the Third Eye" ? "While active, reserve 8 maximum Ki; release the reservation when it ends"
    : "Targets, duration, and conditional results from this technique"), activation })
  const casting = timing === "action" ? "Action" : timing === "bonus" ? "Bonus Action" : timing === "reaction" ? "Reaction" : timing === "passive" ? "Passive" : "Special"
  return { ...row, mechanics: [], source_name: "Alternate Monk", eligible_classes: ["Alternate Monk"], ability_role: "knack",
    uses: useConfig ?? null, casting_time: casting, linkedModifiers: modifiers, linked_modifiers: modifiers,
    modifierRefs: modifiers.map((m) => m.catalogRefId), modifier_refs: modifiers.map((m) => m.catalogRefId) }
}

export const ALTERNATE_MONK_TECHNIQUE_NAMES = Object.keys(TECHNIQUES)
export const ALTERNATE_MONK_STRIKE_TECHNIQUE_NAMES = Object.entries(TECHNIQUES).filter(([, [timing]]) => timing === "hit").map(([name]) => name)
