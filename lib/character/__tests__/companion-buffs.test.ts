import { describe, expect, it } from "vitest"
import { companionBuffFromEffect, companionBuffFeatures, healCompanion, upsertCompanionBuff } from "@/lib/character/companion-buffs"
import { collectFeatureRollBonuses } from "@/lib/character/collect-limited-feature-effects"
import { resolveRollMode } from "@/lib/character/resolve-roll-mode"
import { companionStateFromResolved, mergeCompanionState } from "@/lib/character/resolve-companions"
import type { ResolvedCompanion } from "@/lib/character/companion-stat-block"

describe("received companion effects", () => {
  const context = { characterLevel: 7, proficiencyBonus: 3, abilityMods: { CHA: 4 } }
  const buff = companionBuffFromEffect({ id: "inspire", kind: "check_roll_modifier", label: "Inspiring presence", checkCategory: "save", checkRollMode: "bonus", bonusConfig: { mode: "ability_modifier", ability: "CHA" } }, context)

  it("snapshots caster scaling and applies only to the configured recipient roll", () => {
    const features = companionBuffFeatures([buff])
    expect(collectFeatureRollBonuses(features, { kind: "save", ability: "wisdom" }, { proficiencyBonus: 9 }).total).toBe(4)
    expect(collectFeatureRollBonuses(features, { kind: "attack" }, {}).total).toBe(0)
    expect(collectFeatureRollBonuses(companionBuffFeatures([]), { kind: "save" }, {}).total).toBe(0)
  })

  it("refreshes one source, keeps other sources, and survives saved-state round trips", () => {
    const other = { ...buff, id: "other", label: "Other", acBonus: 2 }
    const buffs = upsertCompanionBuff([buff, other], { ...buff, remaining: "1 minute" })
    expect(buffs).toHaveLength(2)
    const companion = { key: "wolf", maxHp: 20, template: { name: "Wolf" }, source: { featureName: "Companion" } } as ResolvedCompanion
    const merged = mergeCompanionState([companion], [{ key: "wolf", currentHp: 12, buffs }])
    const saved = JSON.parse(JSON.stringify(companionStateFromResolved(merged)))
    expect(mergeCompanionState([companion], saved)[0].buffs).toEqual(buffs)
  })

  it("combines recipient conditions with explicit buff advantage", () => {
    const advantage = companionBuffFromEffect({ id: "aid", kind: "check_advantage", checkCategory: "attack" }, context)
    const params = { context: { kind: "attack" as const }, exhaustionLevel: 0, classFeatures: companionBuffFeatures([advantage]) }
    expect(resolveRollMode({ ...params, activeConditions: [] }).mode).toBe("advantage")
    expect(resolveRollMode({ ...params, activeConditions: ["Poisoned"] }).mode).toBe("normal")
  })

  it("keeps unspecialized and die-based effects as reminders rather than guessing", () => {
    expect(companionBuffFromEffect({ id: "move", kind: "movement_option", movementDash: true }, context).effects).toEqual([])
    expect(companionBuffFromEffect({ id: "die", kind: "check_roll_modifier", checkCategory: "save", bonusConfig: { mode: "die", dieType: "d4" } }, context).effects).toEqual([])
  })

  it("caps healing, treats unsaved HP as full, and rejects invalid amounts", () => {
    expect(healCompanion(12, 20, 100)).toBe(20)
    expect(healCompanion(null, 20, 4)).toBe(20)
    expect(healCompanion(0, 20, 5)).toBe(5)
    expect(() => healCompanion(12, 20, NaN)).toThrow()
    expect(() => healCompanion(12, 20, -3)).toThrow()
  })
})
