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

describe("feat choice persistence", () => {
  beforeEach(() => {
    db.rows.clear()
    db.rows.set("spells", [{ id: "test-spell", name: "Test Spell", source: "Custom" }])
  })
  for (const [name, persist] of [["hosted", persistImportedContent], ["browser", persistImportedContentLocal]] as const) {
    it.runIf(hasHomebrewFixture("eberron-backgrounds", "eberron-dragonmark-feats", "exploringeberron-feats"))(`simulates the private Eberron pack writes in ${name} storage`, async () => {
      for (const file of ["eberron-dragonmark-feats", "exploringeberron-feats", "eberron-backgrounds"]) {
        const content = enrichImportContentModifiers(parseImportContentJson(readFileSync(homebrewFixturePath(file)!, "utf8"))!)
        await persist(content, "Custom")
      }
      expect(db.rows.get("feats")).toHaveLength(40)
      expect(db.rows.get("backgrounds")).toHaveLength(19)
      expect(db.rows.get("custom_abilities")).toHaveLength(25)
      expect(db.rows.get("feats")!.find(row => row.name === "Quori Bond")!.choices).toMatchObject({ count: 1, options: [{ name: "Du'ulora" }, { name: "Hashalaq" }, { name: "Kalaraq" }, { name: "Tsucora" }] })
      const guardian = db.rows.get("custom_abilities")!.find(row => row.name === "Mark of Sentinel — Vigilant Guardian")!
      expect(guardian.source).toBe("Eberron: Forge of the Artificer")
      expect(guardian.attached_to_type).toBe("feat")
      expect(guardian.attached_to_id).toBe(db.rows.get("feats")!.find(row => row.name === "Mark of Sentinel")!.id)
      expect(db.rows.get("backgrounds")!.find(row => row.name === "Malenti")!.feature).toMatchObject({ linkedModifiers: [{ characteristics: [{ type: "tool_proficiencies", choiceCount: 1, choiceOptions: ["Thieves' Tools", "Poisoner's Kit", "Forgery Kit"] }] }] })
    })
    it(`retains choices and resolves their spell references in ${name} storage`, async () => {
      const content: ImportContent = { feats: [{ name: "Test Choice", description: "Choose a benefit.", isChoice: true,
        choices: { category: "Benefit", count: 1, options: [{ name: "Magic", description: "Test option", linkedModifiers: [{ instanceId: "spell", catalogRefId: "cat_char_spells_known", characteristics: [{ id: "spell", type: "spells_known", spells: [{ spellId: "import_spell_name:Test Spell", alwaysPrepared: true }] }] }] }] },
      }] }
      await persist(content, "Custom")
      const stored = db.rows.get("feats")![0]
      expect(stored.is_choice).toBe(true)
      expect(stored.choices).toMatchObject({ category: "Benefit", count: 1, options: [{ name: "Magic", linkedModifiers: [{ characteristics: [{ spells: [{ spellId: "test-spell" }] }] }] }] })
    })
  }
})
