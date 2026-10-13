"use client"

import { useState } from "react"
import type { CompanionBuff } from "@/lib/character/companion-buffs"
import type { SpellHealingModifierCharacteristic } from "@/lib/compendium/characteristic-modifiers"
import { applySpellHealingModifiers, looksLikeHealingSpell, parseSpellHealingExpression, previewParsedSpellHealing } from "@/lib/character/apply-heal-modifiers"
import { CompanionBuffEditor } from "@/components/character-sheet/companion-buff-editor"

export type SpellCompanionTarget = { key: string; label: string; currentHp: number; maxHp: number }

export function SpellRecipientControls({ spellId, name, description, duration, selfOnly, selfCurrentHp, targets, spellLevel, spellcastingMod, modifiers, onSelfHeal, onCompanionHeal, onCompanionBuff }: {
  spellId: string; name: string; description: string | null; duration: string | null; selfOnly: boolean
  selfCurrentHp?: number
  targets: SpellCompanionTarget[]; spellLevel: number; spellcastingMod: number; modifiers: SpellHealingModifierCharacteristic[]
  onSelfHeal?: (amount: number) => void
  onCompanionHeal?: (key: string, amount: number) => void
  onCompanionBuff?: (key: string, buff: CompanionBuff) => void
}) {
  const [targetKey, setTargetKey] = useState("")
  const [amount, setAmount] = useState<number | null>(null)
  const [feedback, setFeedback] = useState("")
  const target = targets.find(row => row.key === targetKey)
  const valid = !targetKey || (!selfOnly && Boolean(target))
  const parsed = parseSpellHealingExpression(description)
  return <div className="rounded border border-border p-3 space-y-2 text-xs">
    <label className="block">Effect recipient
      <select className="mt-1 w-full min-h-10 rounded border bg-background p-2" value={targetKey} onChange={e => { setTargetKey(e.target.value); setAmount(null); setFeedback("") }}>
        <option value="">Self</option>
        {!selfOnly && targets.map(row => <option key={row.key} value={row.key}>{row.label} ({row.currentHp}/{row.maxHp} HP)</option>)}
      </select>
    </label>
    {looksLikeHealingSpell(description) ? <>
      <p className="text-muted-foreground">Review healing before applying, including upcasting and target eligibility. This control does not cast the spell or spend a slot.</p>
      {parsed ? <button type="button" className="min-h-9 rounded border px-2" disabled={!valid} onClick={() => {
        const atZero = (target ? target.currentHp : selfCurrentHp) === 0
        setAmount(previewParsedSpellHealing(description, spellcastingMod, modifiers, { spellLevel, targetAtZeroHp: atZero }))
      }}>Roll parsed healing ({parsed.diceCount}d{parsed.dieSides})</button> : null}
      <label className="block">HP to restore<input type="number" min={0} step={1} className="ml-2 w-20 rounded border bg-background p-2" value={amount ?? ""} onChange={e => setAmount(e.target.value === "" ? null : Number(e.target.value))} /></label>
      <button type="button" className="min-h-10 rounded border border-primary px-2 disabled:opacity-40" disabled={!valid || amount == null || !Number.isFinite(amount) || amount < 0 || (targetKey ? !onCompanionHeal : !onSelfHeal)} onClick={() => {
        if (amount == null || !valid) return
        if (target) {
          onCompanionHeal?.(target.key, amount)
          const selfHeal = applySpellHealingModifiers(amount, modifiers, { spellLevel, healingOthers: true }).selfHeal
          if (selfHeal > 0) onSelfHeal?.(selfHeal)
        } else onSelfHeal?.(amount)
        setFeedback(`Applied healing to ${target?.label ?? "self"}.`)
        setAmount(null)
      }}>Apply healing</button>
    </> : null}
    {target && !selfOnly && onCompanionBuff ? <CompanionBuffEditor key={`${spellId}:${target.key}`} initialLabel={name} initialDuration={duration ?? ""} sourceId={`spell:${spellId}`} onAdd={buff => { onCompanionBuff(target.key, buff); setFeedback(`Saved ${name} on ${target.label}.`) }} /> : null}
    {feedback ? <p role="status">{feedback}</p> : null}
  </div>
}
