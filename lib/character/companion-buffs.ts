import { resolveCheckRollMode } from "@/lib/compendium/class-feature-metadata"
import type { Feature, FeatureEffect } from "@/lib/types"
import type { HealResolveContext } from "@/lib/character/resolve-feature-effect-heal"
import { computeRollBonusAmount } from "@/lib/character/collect-limited-feature-effects"

/** Received effects belong to the recipient, independently of the owner's features. */
export type CompanionBuff = {
  id: string
  label: string
  remaining: string
  acBonus: number
  effects: FeatureEffect[]
}

export function upsertCompanionBuff(current: CompanionBuff[] | null | undefined, buff: CompanionBuff): CompanionBuff[] {
  // Reapplying the same source refreshes it; it must not stack with itself.
  return [...(current ?? []).filter((row) => row.id !== buff.id), buff]
}

export function companionBuffFeatures(buffs: CompanionBuff[] = []): Feature[] {
  return buffs.map((buff) => ({
    name: buff.label, level: 1, description: buff.remaining,
    linkedModifiers: [{ instanceId: buff.id, catalogRefId: "cat_migrated_inline", activation: { effects: buff.effects } }],
  }))
}

/** Snapshot the caster's scaling at application time; never use the owner's stats later. */
export function companionBuffFromEffect(effect: FeatureEffect, context: HealResolveContext): CompanionBuff {
  const config = effect.bonusConfig ?? effect.buffBonus
  const scalable = config && config.mode !== "die" && config.mode !== "class_resource_count"
  const bonus = scalable ? computeRollBonusAmount(config, {
    characterLevel: context.characterLevel, proficiencyBonus: context.proficiencyBonus,
    abilityMods: { strength: context.abilityMods.STR ?? 0, dexterity: context.abilityMods.DEX ?? 0, constitution: context.abilityMods.CON ?? 0, intelligence: context.abilityMods.INT ?? 0, wisdom: context.abilityMods.WIS ?? 0, charisma: context.abilityMods.CHA ?? 0 },
  }) : effect.bonusAmount ?? 0
  const categories = effect.checkRollTargets?.length ? effect.checkRollTargets : effect.checkCategory ? [effect.checkCategory] : []
  const automatedCategories = config?.mode === "die" || config?.mode === "class_resource_count" ? [] : categories
  const effects: FeatureEffect[] = automatedCategories.map((checkCategory) => ({
    ...effect, kind: "check_roll_modifier", checkCategory,
    checkRollMode: resolveCheckRollMode(effect) ?? "bonus",
    bonusConfig: config?.mode === "die" && config.dieScaling !== "class_resource" ? config : { mode: "fixed", fixed: bonus },
  }))
  return { id: `ability:${effect.id}`, label: effect.label?.trim() || "Companion effect", remaining: "Until removed; check source duration", acBonus: 0, effects }
}

export function healCompanion(currentHp: number | null, maxHp: number, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a non-negative healing amount.")
  return Math.min(maxHp, Math.max(0, currentHp ?? maxHp) + Math.floor(amount))
}
