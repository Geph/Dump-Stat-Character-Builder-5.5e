import type { UsesConfig } from "@/lib/types"
import { restoreActionWithSpellSlot } from "@/lib/character/action-slot-restore"

export function ActionSlotRestore({ conversion, usage, spend, onFeedback }: {
  conversion?: UsesConfig["restoreBySpellSlot"]
  usage?: { used: number; setUsed: (used: number) => void } | null
  spend?: (minLevel: number, pactOnly?: boolean) => string | null
  onFeedback: (message: string) => void
}) {
  if (!conversion || !usage || usage.used <= 0 || !spend) return null
  return <button type="button" className="w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted" onClick={() => {
    const result = restoreActionWithSpellSlot(conversion, usage.used, spend)
    if (result.nextUsed !== usage.used) usage.setUsed(result.nextUsed)
    onFeedback(result.message)
  }}>
    Spend {conversion.pactOnly ? "Pact Magic" : `level ${conversion.minSpellLevel}+`} slot to restore {conversion.restores} use{conversion.restores === 1 ? "" : "s"}
  </button>
}
