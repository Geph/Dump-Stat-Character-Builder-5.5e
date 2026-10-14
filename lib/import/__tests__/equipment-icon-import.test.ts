import { describe, expect, it } from "vitest"
import { parseImportContentJsonDetailed } from "../parse-import-content-json"
import { EquipmentImportSchema } from "../content-schema"
import { sanitizeImportContentForPersist } from "../sanitize-import-content"
import { normalizeEquipmentRows } from "../normalize-equipment"
import { buildImportContentAiSchema, buildImportContentAiOutputSchema, normalizeAiImportContent } from "../import-content-ai-schema"

describe("equipment import icons", () => {
  it("retains AI equipment icons through normalization", () => {
    const parsed = buildImportContentAiSchema({ contentTypeHint: "equipment" }).parse({
      equipment: [{ name: "Test Chain", icon: "crossed-chains", source: null,
        category: "Weapon", subcategory: null, description: null, prerequisite_rules: null,
        cost: null, weight: null, properties: null, requires_attunement: null,
        magic_item_category: null, rarity: null }],
    })
    const content = normalizeAiImportContent(parsed as Parameters<typeof normalizeAiImportContent>[0])
    const rows = normalizeEquipmentRows(sanitizeImportContentForPersist(content).equipment as unknown as Record<string, unknown>[])
    expect(rows[0].icon).toBe("crossed-chains")
  })
  it("includes icon in the required nullable AI output fields", async () => {
    const schema = await buildImportContentAiOutputSchema({ contentTypeHint: "equipment" }).jsonSchema
    const equipment = (schema as { properties: { equipment: { anyOf: { items: { required: string[] } }[] } } }).properties.equipment
    expect(equipment.anyOf[0].items.required).toContain("icon")
  })
  it("retains explicit icons through parsing and persistence normalization", () => {
    const equipment = { name: "Test Chain", category: "Weapon", subcategory: null, description: null, icon: "crossed-chains" }
    expect(EquipmentImportSchema.parse(equipment).icon).toBe("crossed-chains")
    const parsed = parseImportContentJsonDetailed(JSON.stringify({ equipment: [equipment] }))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.error)
    const sanitized = sanitizeImportContentForPersist(parsed.content)
    const rows = normalizeEquipmentRows(sanitized.equipment as unknown as Record<string, unknown>[])
    expect(rows[0].icon).toBe("crossed-chains")
  })
  it("accepts legacy files without an icon and explicit null icons", () => {
    const equipment = { name: "Test Item", category: "Adventuring Gear", subcategory: null, description: null }
    expect(EquipmentImportSchema.safeParse(equipment).success).toBe(true)
    expect(EquipmentImportSchema.safeParse({ ...equipment, icon: null }).success).toBe(true)
    for (const icon of [undefined, null]) {
      expect(parseImportContentJsonDetailed(JSON.stringify({ equipment: [{ ...equipment, icon }] })).ok).toBe(true)
    }
  })
})
