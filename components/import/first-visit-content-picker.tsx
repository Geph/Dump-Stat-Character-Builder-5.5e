"use client"

import { useEffect, useState } from "react"
import { Check, Download, LoaderCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EXAMPLE_SEED_PACKS, type ExampleSeedPackId } from "@/lib/seed-packs/pack-ids"
import { removeSrdContent } from "@/lib/data/remove-srd-content"

const VISITED_KEY = "dump-stat.import-content-picker.v1"
const choices = [{ id: "srd" as const, label: "D&D SRD", description: "Default open rules, classes, species, equipment, and spells." }, ...EXAMPLE_SEED_PACKS]
type ChoiceId = "srd" | ExampleSeedPackId

/** One explicit opt-in per browser. Seeding uses the same pipeline as the dropdown. */
export function FirstVisitContentPicker({ importContent }: { importContent: (id: ChoiceId) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ChoiceId[]>(["srd"])
  const [removalResult, setRemovalResult] = useState<string | null>(null)
  const [running, setRunning] = useState<ChoiceId | null>(null)
  const [results, setResults] = useState<Partial<Record<ChoiceId, boolean>>>({})
  useEffect(() => {
    try { setOpen(localStorage.getItem(VISITED_KEY) !== "seen") } catch { setOpen(true) }
  }, [])
  const close = () => {
    if (running) return
    try { localStorage.setItem(VISITED_KEY, "seen") } catch { /* Storage may be disabled. */ }
    setOpen(false)
  }
  const loadSelected = async () => {
    setRemovalResult(null)
    for (const item of choices.filter((item) => selected.includes(item.id) && results[item.id] !== true)) {
      setRunning(item.id)
      let success = false
      try { success = await importContent(item.id) } catch { /* Keep the failed creator available for retry. */ }
      setResults((previous) => ({ ...previous, [item.id]: success }))
    }
    // Remove last: creator packs can also include SRD spell dependencies.
    if (!selected.includes("srd")) {
      setRunning("srd")
      try {
        await removeSrdContent()
        setResults((previous) => ({ ...previous, srd: undefined }))
        setRemovalResult("SRD content removed. You can restore it from Seed Example Content.")
      } catch (error) {
        setRemovalResult(error instanceof Error ? error.message : "Could not remove SRD content. Please retry.")
      }
    }
    setRunning(null)
  }
  const pending = selected.filter((id) => results[id] !== true)
  return <Dialog open={open} onOpenChange={(value) => { if (!value) close() }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={!running}>
      <DialogHeader>
        <DialogTitle>Choose your compendium content</DialogTitle>
        <DialogDescription>SRD is included by default. Uncheck it and choose Import selected to remove its compendium entries. Other unchecked creators are left alone. You can restore content later from Seed Example Content. Characters using removed rules may need those rules imported again.</DialogDescription>
      </DialogHeader>
      <div className="flex gap-2">
        <button type="button" disabled={!!running} onClick={() => setSelected(choices.map((item) => item.id))} className="rounded-lg border px-4 py-2 text-sm">Select all</button>
        <button type="button" disabled={!!running} onClick={() => setSelected([])} className="rounded-lg border px-4 py-2 text-sm">Select none</button>
      </div>
      <div className="space-y-2">
        {choices.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
          <input type="checkbox" className="mt-1 size-5 shrink-0" checked={selected.includes(item.id)} disabled={!!running}
            onChange={(e) => setSelected((previous) => e.target.checked ? [...previous, item.id] : previous.filter((id) => id !== item.id))} />
          <span className="min-w-0 flex-1"><span className="block font-semibold">{item.label}</span><span className="block text-xs text-muted-foreground">{item.description}</span>
            {results[item.id] === false && <span className="block text-sm text-destructive">Some content failed. Retry this creator, or close to view the import report.</span>}
          </span>
          {running === item.id ? <LoaderCircle className="size-5 animate-spin" aria-label="Working" /> : results[item.id] === true && selected.includes(item.id) ? <Check className="size-5 text-green-600" aria-label="Imported" /> : null}
        </label>)}
      </div>
      <div className="flex flex-wrap justify-end gap-2" aria-live="polite">
        {removalResult && <p className="w-full text-sm">{removalResult}</p>}
        <button type="button" disabled={!!running} onClick={close} className="rounded-lg border px-4 py-3">{Object.keys(results).length ? "Done" : "Not now"}</button>
        <button type="button" disabled={!!running || (!pending.length && selected.includes("srd"))} onClick={() => void loadSelected()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50"><Download className="size-4" />{running ? "Applying…" : "Import selected"}</button>
      </div>
    </DialogContent>
  </Dialog>
}
