"use client"

import { useState } from "react"
import type { CompanionBuff } from "@/lib/character/companion-buffs"
import type { FeatureEffect } from "@/lib/types"

/** Presentation only: both editions use the same persisted buff contract. */
export function CompanionBuffEditor({ initialLabel = "", initialDuration = "", sourceId, onAdd }: {
  initialLabel?: string; initialDuration?: string; sourceId?: string; onAdd: (buff: CompanionBuff) => void
}) {
  const [label, setLabel] = useState(initialLabel)
  const [remaining, setRemaining] = useState(initialDuration)
  const [acBonus, setAcBonus] = useState(0)
  const [bonus, setBonus] = useState(0)
  const [category, setCategory] = useState<"attack" | "save" | "ability">("attack")
  const [mode, setMode] = useState<"bonus" | "advantage" | "disadvantage">("bonus")
  return <details className="rounded border border-border p-2 text-xs">
    <summary className="cursor-pointer font-semibold">Add companion buff</summary>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <label className="col-span-2">Effect name<input className="w-full rounded border bg-background p-2" value={label} onChange={e => setLabel(e.target.value)} /></label>
      <label className="col-span-2">Duration / reminder<input className="w-full rounded border bg-background p-2" value={remaining} onChange={e => setRemaining(e.target.value)} /></label>
      <label>AC bonus<input type="number" className="w-full rounded border bg-background p-2" value={acBonus} onChange={e => setAcBonus(Number(e.target.value))} /></label>
      <label>Roll bonus<input type="number" className="w-full rounded border bg-background p-2" value={bonus} onChange={e => setBonus(Number(e.target.value))} /></label>
      <label>Roll type<select className="w-full rounded border bg-background p-2" value={category} onChange={e => setCategory(e.target.value as typeof category)}><option value="attack">Attacks</option><option value="save">Saves</option><option value="ability">Ability checks</option></select></label>
      <label>Roll mode<select className="w-full rounded border bg-background p-2" value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="bonus">Normal</option><option value="advantage">Advantage</option><option value="disadvantage">Disadvantage</option></select></label>
      <p className="col-span-2 text-muted-foreground">Only entered AC and roll modifiers apply automatically. Remove the buff when its duration or concentration ends.</p>
      <button type="button" disabled={!label.trim()} className="col-span-2 min-h-10 rounded border border-primary p-2 font-semibold disabled:opacity-40" onClick={() => {
        const id = sourceId ?? `manual:${label.trim().toLowerCase()}`
        const effects: FeatureEffect[] = []
        if (bonus) effects.push({ id: `${id}:bonus`, kind: "check_roll_modifier", checkCategory: category, checkRollMode: "bonus", bonusConfig: { mode: "fixed", fixed: bonus } })
        if (mode !== "bonus") effects.push({ id: `${id}:mode`, kind: "check_roll_modifier", checkCategory: category, checkRollMode: mode })
        onAdd({ id, label: label.trim(), remaining: remaining.trim(), acBonus, effects })
      }}>Save buff</button>
    </div>
  </details>
}
