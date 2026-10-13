import { describe, expect, it } from "vitest"
import { resolveFeatureEffectHealAmount } from "@/lib/character/resolve-feature-effect-heal"
import { wirePhbSubclassFeatures } from "@/lib/compendium/phb-subclass-wiring"
import type { FeatureEffect } from "@/lib/types"
import { parseCreatureScaledStat } from "@/lib/character/parse-creature-stat-block"

describe("scaled dice healing", () => {
  it("retains companion ability-modifier formulas instead of truncating to the base AC", () => {
    for (const formula of ["13 plus your Wisdom modifier", "13 + WIS mod"]) expect(parseCreatureScaledStat(formula).parts).toEqual([{ type: "fixed", value: 13 }, { type: "scale", ref: { kind: "ability_modifier", ability: "wisdom" } }])
  })
  const effect: FeatureEffect = { id: "heal", kind: "heal_self", healMode: "dice", healDiceCount: 1, healDieType: "d6", healAbility: "WIS", healFlatBonus: 2, bonusByLevel: [{ level: 5, mode: "dice", dieCount: 1, dieType: "d8" }] }
  it("adds the ability once and scales using the owning class, not total multiclass level", () => {
    const context = { characterLevel: 20, classLevel: 3, proficiencyBonus: 6, abilityMods: { WIS: 4 }, random: () => 0.999 }
    expect(resolveFeatureEffectHealAmount(effect, context)).toBe(12)
    expect(resolveFeatureEffectHealAmount(effect, { ...context, classLevel: 5 })).toBe(14)
  })
  it("keeps negative healing clamped and fixed bonus scaling intact", () => {
    expect(resolveFeatureEffectHealAmount({ ...effect, healFlatBonus: -20 }, { characterLevel: 3, proficiencyBonus: 2, abilityMods: { WIS: -1 }, random: () => 0 })).toBe(0)
    expect(resolveFeatureEffectHealAmount({ ...effect, healAbility: null, bonusByLevel: [{ level: 5, mode: "fixed", fixed: 5 }] }, { characterLevel: 5, proficiencyBonus: 3, abilityMods: {}, random: () => 0 })).toBe(6)
  })
  it("rolls Hand of Healing at every Martial Arts die threshold", () => {
    const [f] = wirePhbSubclassFeatures([{ name: "Hand of Healing", level: 3, description: "" }], "Monk", "Warrior of Mercy")
    const heal = f.linkedModifiers!.flatMap((m) => m.activation?.effects ?? []).find((e) => e.kind === "heal_self")!
    for (const [level, maximum] of [[3, 10], [5, 12], [11, 14], [17, 16]]) expect(resolveFeatureEffectHealAmount(heal, { characterLevel: level, classLevel: level, proficiencyBonus: 2, abilityMods: { WIS: 4 }, random: () => 0.999 })).toBe(maximum)
  })
})
