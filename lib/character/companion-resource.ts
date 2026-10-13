import type { CharacterCompanionState } from "@/lib/character/companion-stat-block"

/** Ferocity is an existing companion-owned tracker, not a rest-recharging class pool. */
export function ferocityCompanion(states: CharacterCompanionState[], classId: string): CharacterCompanionState | undefined {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
  return states.find(row => {
    if (!row.key.startsWith(`${classId}:`) || !row.key.includes(":companion:")) return false
    const base = row.key.split(":").slice(0,3).join(":")
    const selection = states.find(s => s.key === base)?.knownForms
    return !selection?.length || selection.some(name => row.key === `${base}:${slug(name)}`)
  })
}

export function companionResourceMaximum(states: CharacterCompanionState[], resourceId: string, spent: number): number {
  const classId = resourceId.replace(/_ferocity$/, "")
  const companion = ferocityCompanion(states, classId)
  return (companion?.rampaging ? 0 : Math.max(0, companion?.ferocity ?? 0)) + Math.max(0, spent)
}

/** Apply a pool's spend delta once. Resetting spent bookkeeping must not refill combat state. */
export function applyCompanionResourceSpends(states: CharacterCompanionState[], before: Record<string, number>, after: Record<string, number>): CharacterCompanionState[] {
  let next = states
  for (const [id, spent] of Object.entries(after)) {
    if (!id.endsWith("_ferocity")) continue
    const delta = spent - (before[id] ?? 0)
    if (delta <= 0) continue
    const row = ferocityCompanion(next, id.slice(0,-"_ferocity".length))
    if (!row || row.rampaging) continue
    next = next.map(s => s === row ? { ...s, ferocity: Math.max(0, (s.ferocity ?? 0)-delta) } : s)
  }
  return next
}

export function companionActionFerocityCost(tag?: string | null): number {
  return Number(tag?.match(/\b(\d+)\s+Ferocity\b/i)?.[1] ?? 0)
}
