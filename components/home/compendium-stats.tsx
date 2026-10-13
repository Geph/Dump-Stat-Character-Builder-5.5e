"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Shield, GitBranch, Users, ScrollText, Wand2, Award, PawPrint, Sparkles } from "lucide-react"
import { createClient } from "@/lib/db/client"
import { compendiumBrowseHref } from "@/lib/compendium/browse-url"

const categories = [
  { table: "classes", tab: "classes", label: "Classes", icon: Shield },
  { table: "subclasses", tab: "subclasses", label: "Subclasses", icon: GitBranch },
  { table: "species", tab: "species", label: "Species", icon: Users },
  { table: "backgrounds", tab: "backgrounds", label: "Backgrounds", icon: ScrollText },
  { table: "spells", tab: "spells", label: "Spells", icon: Wand2 },
  { table: "feats", tab: "feats", label: "Feats", icon: Award },
  { table: "creatures", tab: "creatures", label: "Creatures & companions", icon: PawPrint },
  { table: "custom_abilities", tab: "abilities", label: "Custom abilities", icon: Sparkles },
] as const

export function CompendiumStats() {
  const [counts, setCounts] = useState<(number | null)[] | null>(null)

  useEffect(() => {
    let active = true
    const db = createClient()
    // Read counts only: opening Home must not seed or modify the catalog.
    void Promise.all(categories.map(async ({ table }) => {
      try {
        const result = await db.from(table).select("*", { count: "exact", head: true })
        return result.error ? null : result.count ?? null
      } catch {
        return null
      }
    })).then((values) => { if (active) setCounts(values) })
    return () => { active = false }
  }, [])

  return (
    <section aria-labelledby="compendium-stats-title" className="mt-10 rounded-2xl bg-[#30271e] p-4 sm:p-8">
      <h2 id="compendium-stats-title" className="text-2xl font-semibold text-[#faf5e9]">Your compendium</h2>
      <p className="mt-2 text-sm text-[#d8cbb5]">Content in your library, including your imports and custom creations.</p>
      <div className="mt-6 rounded-xl border border-border bg-card p-3 shadow-[0_12px_28px_rgba(0,0,0,0.3)] sm:p-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-busy={counts === null}>
        {categories.map(({ table, tab, label, icon: Icon }, index) => (
          <Link key={table} href={compendiumBrowseHref(tab, "")} className="min-w-0 rounded-lg p-3 transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">
            <span className="flex flex-wrap items-center gap-2 text-2xl font-bold tabular-nums text-primary">
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {counts === null ? <span aria-label="Loading">…</span> : counts[index] === null ? <span aria-label="Unavailable">—</span> : counts[index].toLocaleString()}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{label}</span>
          </Link>
        ))}
      </div>
      </div>
      {counts?.some((count) => count === null) ? <p className="mt-3 text-sm text-[#d8cbb5]" role="status">Some counts are unavailable. Open the compendium to try again.</p> : null}
    </section>
  )
}
