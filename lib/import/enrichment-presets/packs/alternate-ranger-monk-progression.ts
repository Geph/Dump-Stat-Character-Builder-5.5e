import type { ImportContent } from "@/lib/import/content-schema"
import type { Feature, FeatureActivation, FeatureEffect, UsesConfig } from "@/lib/types"
import type { CharacteristicModifier } from "@/lib/compendium/characteristic-modifiers"
import { syncModifierRefs, type LinkedModifierInstance } from "@/lib/compendium/linked-modifiers"
import { ensureSubclassUnlockFeature } from "@/lib/compendium/subclass-unlock-modifier"
import { ALTERNATE_RANGER_KNACKS_KNOWN_BY_LEVEL } from "./alternate-ranger"

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never
export const MONK_KI = "alternate_monk_ki_points"
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_")
export function characteristic(name: string, value: WithoutId<CharacteristicModifier>): LinkedModifierInstance {
  const id = `alt_rm_${slug(name)}_${value.type}`
  return { instanceId: id, catalogRefId: `cat_char_${value.type}`, characteristics: [{ ...value, id } as CharacteristicModifier] }
}
export function effect(name: string, value: Omit<FeatureEffect, "id">, activation?: FeatureActivation): LinkedModifierInstance {
  const id = `alt_rm_${slug(name)}_${value.kind}`
  return { instanceId: id, catalogRefId: `cat_fx_${value.kind}`, activation: { ...activation, effects: [{ id, ...value }] } }
}
export function notes(name: string, prompt: string): LinkedModifierInstance {
  return characteristic(name, { type: "player_note", target: "feature", prompt })
}
export function rider(name: string, parents: string[], extra: Partial<Extract<CharacteristicModifier, { type: "power_rider" }>> = {}): LinkedModifierInstance {
  return characteristic(name, { type: "power_rider", parentPowerNames: parents, alertSummary: name, ...extra })
}
export function uses(name: string, config: UsesConfig): LinkedModifierInstance {
  return characteristic(name, { type: "uses", uses: config, label: name })
}
export const kiUses = (amount: number): UsesConfig => ({ type: "class_resource", classResourceKey: MONK_KI, classResourceAmount: amount })
export function replaceWiring<T extends Feature>(feature: T, linkedModifiers: LinkedModifierInstance[], activation?: FeatureActivation): T {
  return syncModifierRefs({ ...feature, mechanics: [], limitedUses: null, activation: activation ?? null,
    linkedModifiers, sheetDisplay: { ...feature.sheetDisplay, featuresTab: true } }) as T
}
export function action<T extends Feature>(feature: T, activation: FeatureActivation, modifiers?: LinkedModifierInstance[]): T {
  // Imports reconstruct feature activation from linked modifiers. Carry timing on
  // the first modifier too so generated sub-actions survive export/re-import.
  const linkedModifiers = (modifiers ?? feature.linkedModifiers)?.map((modifier, index) => index === 0
    ? { ...modifier, activation: { ...modifier.activation, ...activation, effects: modifier.activation?.effects } }
    : modifier)
  return syncModifierRefs({ ...feature, activation, sheetDisplay: { ...feature.sheetDisplay, featuresTab: true, combatActions: true },
    linkedModifiers }) as T
}
const noArmor = [
  { id: "alt_monk_no_armor", kind: "armor_type" as const, rule: "requires_not_wearing" as const, value: "Any armor" },
  { id: "alt_monk_no_shield", kind: "armor_type" as const, rule: "requires_not_wearing" as const, value: "Shield" },
]
const noHeavy = [{ ...noArmor[0], value: "Heavy armor" }, noArmor[1]]
const free: FeatureActivation = { action: true, noEconomyCost: true }

function rangerFeature<T extends Feature>(f: T): T {
  switch (f.name) {
    case "Knacks": return { ...f, choices: { ...f.choices!, swappableOnRest: false, swappableOnLevelUp: true,
      choiceCountByLevel: [...ALTERNATE_RANGER_KNACKS_KNOWN_BY_LEVEL] } }
    case "Ranger's Quarry": return action(replaceWiring(f, [
      uses(f.name, { type: "class_resource", classResourceKey: "quarry", classResourceAmount: 1 }),
      rider(f.name, ["Attack"], { weaponDamageMenu: true, selectable: true, classResourceKey: "quarry_die", classResourceDieCount: 1 }),
      notes(f.name, "Marked target, one-hour duration, tracking checks, and mark transfer"),
    ]), { bonusAction: true })
    case "Feral Senses": return replaceWiring(f, [rider(f.name, ["Attack"]), notes(f.name,
      f.level! >= 18 ? "Ignore disadvantage against targets within 30 feet" : "Ignore disadvantage against your Quarry")])
    case "Tireless": return replaceWiring(f, [rider(f.name, ["Ranger's Quarry"])])
    case "Foe Slayer": return action(replaceWiring(f, [rider(f.name, ["Attack"]), notes(f.name,
      "On a weapon hit: end the Quarry mark; maximize damage; target CON save if left at 50 HP or less")]), { ...free, requirements: [{ kind: "on_hit" }] })
    case "Extra Attack": return action(replaceWiring(f, [effect(f.name, { kind: "extra_attack", extraAttackCount: 1 }),
      effect(`${f.name} spell follow-up`, { kind: "bonus_action_attack" }, { bonusAction: true })]),
      { bonusAction: true, requirements: [{ kind: "custom", text: "After using your action to cast a Ranger spell" }] })
    default: return f
  }
}

export function wireAlternateMonkCoreFeature<T extends Feature>(f: T): T {
  switch (f.name) {
    case "Mystic Techniques": return syncModifierRefs({ ...f,
      choices: { ...f.choices!, swappableOnRest: false, swappableOnLevelUp: true },
      linkedModifiers: (f.linkedModifiers ?? []).filter((m) => !m.characteristics?.some((c) => c.type === "grant_feat")),
    }) as T
    case "Unarmored Defense": return replaceWiring(f, [characteristic(f.name, { type: "ac", mode: "ability_modifiers", base: 10, abilities: ["DEX", "WIS"], limitations: noArmor })])
    case "Unarmored Movement": return replaceWiring(f, [characteristic(f.name, { type: "speed", speedType: "walk", mode: "add", value: 10,
      valueByLevel: [[2, 10], [6, 15], [10, 20], [14, 25], [18, 30]].map(([level, fixed]) => ({ level, mode: "fixed", fixed })), limitations: noArmor })])
    case "Martial Arts": return action(replaceWiring(f, [
      characteristic(f.name, { type: "unarmed_strike_damage", die: "1d6", dieByLevel: [[1, "d6"], [5, "d8"], [11, "d10"], [17, "d12"]].map(([level, dieType]) => ({ level: Number(level), mode: "dice", dieCount: 1, dieType: dieType as "d6" })), limitations: noHeavy }),
      characteristic(f.name, { type: "weapon_ability_override", ability: "dexterity", appliesTo: "both", scope: "specific", weaponNames: ["Unarmed Strike"], treatAsFinesse: true, limitations: noHeavy }),
      characteristic(`${f.name} weapons`, { type: "weapon_ability_override", ability: "dexterity", appliesTo: "both", scope: "melee", excludedWeaponProperties: ["Heavy", "Special"], treatAsFinesse: true, limitations: noHeavy }),
      characteristic(`${f.name} weapons`, { type: "weapon_damage_die_override", scope: "melee", excludedWeaponProperties: ["Heavy", "Special"], onlyIncrease: true,
        dieSides: 6, dieSidesByLevel: [[1, 6], [5, 8], [11, 10], [17, 12]].map(([level, fixed]) => ({ level, mode: "fixed", fixed })), limitations: noHeavy }),
      effect(f.name, { kind: "bonus_action_attack" }, { bonusAction: true }),
      notes(f.name, "Melee weapons without Heavy/Special qualify. No Heavy armor, shield, or Heavy weapon; Dexterity applies to Grapple/Shove checks only."),
    ]), { bonusAction: true, requirements: [{ kind: "custom", text: "After an Attack action with a Martial Arts attack; equipment restrictions apply" }] })
    case "Flurry of Blows": return action(replaceWiring(f, [uses(f.name, kiUses(1)), effect(f.name, { kind: "bonus_action_attack" }, { bonusAction: true }),
      notes(f.name, "Make two unarmed strikes; resolve each attack separately")]), { bonusAction: true })
    case "Extra Attack": return action(replaceWiring(f, [effect(f.name, { kind: "extra_attack", extraAttackCount: 1 }), effect(`${f.name} movement follow-up`, { kind: "bonus_action_attack" }, { bonusAction: true })]),
      { bonusAction: true, requirements: [{ kind: "custom", text: "After using your action to Dash or Disengage" }] })
    case "Enlightened Strikes": return replaceWiring(f, [rider(f.name, ["Attack"], { alertSummary: "Magical Martial Arts attacks while at least 1 Ki remains" })])
    case "Spirit of Tranquility": return action(replaceWiring(f, [uses(f.name, kiUses(1)), notes(f.name, "Add Wisdom modifier (minimum +1) to this saving throw only")]),
      { ...free, requirements: [{ kind: "make_saving_throw" }] })
    case "Warrior's Spirit": return replaceWiring(f, [characteristic(f.name, { type: "turn_start_trigger", restoreResourceKey: MONK_KI, restoreResourceAmount: 1, blockedByConditions: ["Incapacitated"] })])
    case "Purity of Mind": return action(replaceWiring(f, [uses(f.name, kiUses(1)), notes(f.name, "Choose Charmed or Frightened and remove that condition from the sheet")]),
      { ...free, requirements: [{ kind: "custom", text: "At the start of your turn: end Charmed or Frightened on yourself" }] })
    case "Purity of Spirit": return action(replaceWiring(f, [effect(f.name, { kind: "class_resource", classResourceKey: MONK_KI, classResourceChange: "reset" }),
      notes(f.name, "Complete 10 minutes of light activity outside combat before restoring Ki")]),
      { ...free, requirements: [{ kind: "custom", text: "After 10 minutes of light activity outside combat" }] })
    default: return f
  }
}

/** Scoped mechanical corrections; descriptions remain in the user's source files. */
export function wireAlternateRangerMonkProgression(content: ImportContent): ImportContent {
  return { ...content,
    class_resources: content.class_resources?.map((r) => r.class_name === "Alternate Ranger" && r.resource_key === "knacks_known"
      ? { ...r, uses: { ...r.uses, atLevelTable: [...ALTERNATE_RANGER_KNACKS_KNOWN_BY_LEVEL] } } : r),
    classes: content.classes?.map((cls) => {
      if (!/^Alternate (Ranger|Monk)$/.test(cls.name)) return cls
      const features = cls.features.map((f) => cls.name === "Alternate Ranger" ? rangerFeature(f as Feature) : wireAlternateMonkCoreFeature(f as Feature))
      return { ...cls, features: ensureSubclassUnlockFeature({ name: cls.name, features }, 3) as typeof cls.features }
    }),
  }
}
