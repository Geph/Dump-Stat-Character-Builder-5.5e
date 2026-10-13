import { beforeEach, describe, expect, it, vi } from "vitest"
import { persistImportedContent } from "@/lib/import/persist-import-content"
import { persistImportedContentLocal } from "@/lib/data/persist-import-content-local"
import type { ImportContent } from "@/lib/import/content-schema"
import { readFileSync } from "node:fs"
import { hasHomebrewFixture, homebrewFixturePath } from "./homebrew-fixture-path"
import { parseImportContentJson } from "@/lib/import/parse-import-content-json"
import { enrichImportContentModifiers } from "@/lib/import/enrich-import-modifiers"

const db = vi.hoisted(() => {
  const rows = new Map<string, Record<string, unknown>[]>()
  return {
    rows,
    list: async (table: string) => rows.get(table) ?? [],
    upsert: async (table: string, incoming: Record<string, unknown>[]) => {
      const saved = rows.get(table) ?? []
      for (const row of incoming) {
        const i = saved.findIndex(r => r.name === row.name)
        if (i < 0) saved.push({ id: `${table}-${saved.length}`, ...row })
        else saved[i] = { ...saved[i], ...row }
      }
      rows.set(table, saved)
    },
  }
})
vi.mock("@/lib/db/repository", () => ({ listRows: db.list, upsertByName: db.upsert, insertRows: db.upsert, deleteWhere: vi.fn() }))
vi.mock("@/lib/data/indexed-db-store", () => ({ upsertByName: db.upsert }))
vi.mock("@/lib/import/detect-import-collisions-local", () => ({ listRowsLocal: db.list, insertRowsLocal: db.upsert, deleteWhereLocal: vi.fn() }))
vi.mock("@/lib/data/builder-compendium-cache", () => ({ invalidateBuilderCompendiumCache: vi.fn() }))

import { prepareImportedContent } from "@/lib/import/prepare-import"
import { applyProposalSelections, defaultProposalSelections } from "@/lib/import/import-proposals"
import type { Feature } from "@/lib/types"

describe("private Beastheart persistence", () => {
  beforeEach(() => db.rows.clear())
  for (const [name, persist] of [["hosted", persistImportedContent], ["browser", persistImportedContentLocal]] as const) {
    it.runIf(hasHomebrewFixture("mcdm-beastheart", "mcdm-companions"))(`keeps companion formulas, exploit costs and subclass choices in ${name} storage`, async () => {
      for (const file of ["mcdm-companions", "mcdm-beastheart"]) {
        const input = parseImportContentJson(readFileSync(homebrewFixturePath(file)!, "utf8"))!
        const prepared = prepareImportedContent(input)
        const selected = prepared.kind === "confirm" ? applyProposalSelections(prepared.pendingContent, prepared.proposals, defaultProposalSelections(prepared.proposals)) : prepared.content
        const result = await persist(enrichImportContentModifiers(selected), "Custom")
        expect(result.warnings).toEqual([])
      }
      expect(db.rows.get("classes")).toHaveLength(1)
      expect(db.rows.get("subclasses")).toHaveLength(5)
      expect(db.rows.get("creatures")).toHaveLength(15)
      expect(db.rows.get("custom_abilities")).toHaveLength(21)
      const cls = db.rows.get("classes")![0]
      const features = cls.features as Feature[]
      expect(features.find(f => f.name === "Primal Exploits")?.choices?.optionsSource).toBe("class_knacks")
      const infernal = db.rows.get("subclasses")!.find(s => s.name === "Infernal Bond")!
      const choices = (infernal.features as Feature[]).find(f => f.name === "Infernal Exploits")!.choices!
      expect(choices.options).toHaveLength(9)
      expect(choices.optionsSource).toBeUndefined()
      expect(db.rows.get("custom_abilities")!.some(a => a.name === "Infernal Teleport")).toBe(false)
      expect(JSON.stringify(choices.options.find(o => o.name === "Infernal Teleport")!.linkedModifiers)).toContain('"classResourceKey":"ferocity"')
      const ferocity = db.rows.get("class_resources")!.find(r => r.resource_key === "ferocity")!
      expect(ferocity.uses).toMatchObject({ type: "special" })
      expect(ferocity.class_id).toBe(cls.id)
    })
  }
})
