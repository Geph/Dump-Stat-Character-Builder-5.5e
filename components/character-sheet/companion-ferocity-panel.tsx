"use client"

import { useState } from "react"
import type { CharacterCompanionState } from "@/lib/character/companion-stat-block"

/** Combat tracker shared by imported companions with a Ferocity pool. */
export function CompanionFerocityPanel({ value, rampaging, currentHp, maxHp, onChange }: {
  value: number; rampaging: boolean; currentHp: number; maxHp: number
  onChange: (patch: Partial<CharacterCompanionState>) => void
}) {
  const [nearby, setNearby] = useState(0)
  const [bonus, setBonus] = useState(0)
  const [resetTo, setResetTo] = useState(0)
  const button = "min-h-11 rounded border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
  return <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
    <label className="flex items-center justify-between gap-2 text-sm font-bold">Ferocity
      <input aria-label="Current ferocity" type="number" min={0} value={value} onChange={e => onChange({ ferocity: Math.max(0, Number(e.target.value) || 0) })} className="w-20 rounded border border-border bg-background px-2 py-2" />
    </label>
    {value >= 10 && !rampaging && <p className="text-xs text-destructive">Check for rampage: Animal Handling DC {5 + value}. Apply any feature that changes this check.</p>}
    <div className="flex flex-wrap gap-3 text-xs">
      <label>Nearby hostiles <input aria-label="Nearby hostile count" type="number" min={0} value={nearby} onChange={e => setNearby(Math.max(0, Number(e.target.value) || 0))} className="ml-1 w-14 rounded border border-border bg-background p-2" /></label>
      <label>Turn bonus <input aria-label="Ferocity turn bonus" type="number" min={0} value={bonus} onChange={e => setBonus(Math.max(0, Number(e.target.value) || 0))} className="ml-1 w-14 rounded border border-border bg-background p-2" /></label>
    </div>
    <p className="text-xs text-muted-foreground">Set the bonus from your companion features. Count hostiles it can see or hear within 5 feet.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={rampaging} onClick={() => onChange({ ferocity: value + 1 + Math.floor(Math.random()*4) + nearby + bonus })}>Start turn · gain 1d4 + {nearby + bonus}</button>
      <button type="button" className={button} disabled={rampaging} onClick={() => onChange({ rampaging: true })}>Begin rampage</button>
      <button type="button" className={button} onClick={() => onChange({ ferocity: 0, rampaging: false, currentHp: Math.min(maxHp, currentHp + value) })}>End combat · recover {Math.min(value, maxHp-currentHp)} HP</button>
    </div>
    {rampaging && <div className="space-y-2 text-xs">
      <p>Resolve the forced signature attack and its damage using your companion features. Ferocity spends are blocked during the rampage.</p>
      <label>Ferocity after rampage <input aria-label="Ferocity after rampage" type="number" min={0} value={resetTo} onChange={e => setResetTo(Math.max(0, Number(e.target.value) || 0))} className="ml-1 w-14 rounded border border-border bg-background p-2" /></label>
      <button type="button" className={button} onClick={() => onChange({ rampaging: false, ferocity: resetTo })}>End rampage</button>
    </div>}
  </div>
}
