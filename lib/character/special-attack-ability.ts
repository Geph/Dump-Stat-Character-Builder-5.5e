import type { SpecialAttackCharacteristic } from "@/lib/compendium/characteristic-modifiers"
import type { ResolveUsesContext } from "@/lib/compendium/resolve-uses-config"

/** Explicit attack ability wins over profile defaults; never infer it from class names. */
export function resolveSpecialAttackModifier(attack: SpecialAttackCharacteristic, ctx: ResolveUsesContext): number {
  const mods = ctx.abilityModifiers ?? {}
  if (attack.attackAbility) return mods[attack.attackAbility] ?? 0
  if (attack.properties.some((property) => /finesse/i.test(property))) return Math.max(mods.STR ?? 0, mods.DEX ?? 0)
  return Math.max(mods.INT ?? 0, mods.WIS ?? 0, mods.CHA ?? 0)
}
