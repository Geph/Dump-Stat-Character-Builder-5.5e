import { describe, expect, it, vi } from "vitest"
import type { ImportContent } from "@/lib/import/content-schema"
import { finalizeImportWithPersist, type ImportPersistFn } from "@/lib/import/prepare-import"

describe("finalizing indexed import review choices", () => {
  it("keeps source skips and artwork aligned when an earlier duplicate is skipped", async () => {
    const content: ImportContent = {
      species: ["Existing", "Excluded A", "Excluded B", "Excluded C", "Keep"].map((name) => ({
        name, source: name.startsWith("Excluded") ? "Excluded source" : "Other",
        description: null, speed: 30, size: "Medium", traits: [],
      })),
    }
    const persist = vi.fn<ImportPersistFn>(async () => ({ totalImported: 1, breakdown: {}, warnings: [] }))
    await finalizeImportWithPersist(content, { classResourceIds: [], customAbilityIds: [] }, "Custom", persist,
      {}, [{ id: "species:existing", kind: "species", incomingName: "Existing", existingName: "Existing", suggestedName: "Existing copy" }],
      { "species:existing": "skip" }, { "species:4": "https://example.com/keep.png" }, undefined,
      ["species:1", "species:2", "species:3"])
    const rows = persist.mock.calls[0][0].species
    expect(rows?.map((row) => row.name)).toEqual(["Keep"])
    expect(rows?.[0].card_image_url).toBe("https://example.com/keep.png")
  })
})
