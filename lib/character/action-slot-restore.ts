import { spellSlotTableKey, type SpellSlotTable } from "@/lib/compendium/spell-slots"
import { spendLowestAvailableSpellSlot } from "./sheet-rest"
import type { UsesConfig } from "@/lib/types"

/** Search every eligible table; multiclass pact slots are not ordinary resource counters. */
export function spendAbilitySpellSlot(
  tables: SpellSlotTable[], usedByKey: Record<string, number[]>, minLevel: number, pactOnly = false,
) {
  const candidates = tables.filter((table) => !pactOnly || table.type === "pact").flatMap((table) => {
    const key = spellSlotTableKey(table)
    const spent = spendLowestAvailableSpellSlot(usedByKey[key] ?? [], table.slotsByLevel, minLevel)
    return spent ? [{ key, ...spent }] : []
  }).sort((a, b) => a.spentLevel - b.spentLevel)
  return candidates[0] ?? null
}

export function restoreActionWithSpellSlot(
  conversion: NonNullable<UsesConfig["restoreBySpellSlot"]>,
  used: number,
  spend: (minLevel: number, pactOnly?: boolean) => string | null,
): { nextUsed: number; message: string } {
  if (used <= 0) return { nextUsed: used, message: "No spent uses to restore" }
  const result = spend(conversion.minSpellLevel, conversion.pactOnly)
  if (!result) return { nextUsed: used, message: `No eligible ${conversion.pactOnly ? "Pact Magic " : ""}spell slot remaining` }
  const restored = Math.min(used, Math.max(1, conversion.restores))
  return { nextUsed: used - restored, message: `${result}; restored ${restored} use${restored === 1 ? "" : "s"}` }
}
