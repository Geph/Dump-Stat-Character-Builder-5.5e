import { describe, expect, it } from "vitest"
import { parseFoundryInput } from "../parse-foundry-dnd5e"
import { buildFoundryUuidIndex, resolveFoundryUuid } from "../foundry-advancements"
import { prepareImportedContent } from "../prepare-import"
import { collectSheetActions } from "@/lib/character/sheet-actions"

// Synthetic documents shaped like dnd5e 6.0.6 exports; no publisher prose/art.
const feature = {
  _id: "recover", name: "Recover Stamina", type: "feat",
  system: {
    type: { value: "class" }, description: { value: "<p>Recover your strength.</p>" },
    uses: { max: "@scale.vanguard.recovery", recovery: [{ period: "sr", type: "formula", formula: "1" }, { period: "lr", type: "recoverAll" }] },
    activities: { recover: { type: "heal", activation: { type: "bonus" }, target: { affects: { type: "self" } }, healing: { number: 1, denomination: 10, bonus: "@classes.vanguard.levels" }, consumption: { targets: [{ type: "itemUses", target: "", value: "1" }] } } },
  }, effects: [],
}
const grant = (id: string, level = 1) => ({ type: "ItemGrant", level, configuration: { items: [{ uuid: `Compendium.test.features.Item.${id}` }] } })
const parent = {
  _id: "parent", name: "The Vanguard", type: "class", system: {
    identifier: "vanguard", hd: { denomination: "d10" }, spellcasting: { progression: "half", ability: "wis" },
    advancement: [grant("recover"), { type: "ScaleValue", title: "Recovery", configuration: { type: "number", identifier: "recovery", scale: { "1": { value: 2 }, "5": { value: 3 } } } }, { type: "Subclass", level: 3, configuration: {} }, { type: "AbilityScoreImprovement", level: 4, configuration: { points: 2, cap: 2 } }],
  },
}
function parse(items: unknown[]) {
  const result = parseFoundryInput(JSON.stringify(items))
  if (result.kind !== "content") throw new Error(result.kind)
  return result
}

describe("Foundry class/subclass imports", () => {
  it("reads v6 keyed advancements and name fields, including zero-filled ASI assignments", () => {
    const advancement: Record<string, Record<string, unknown>> = Object.fromEntries(parent.system.advancement.map((a, i) => [String(i), { ...a, name: "title" in a ? a.title : undefined, title: undefined }]))
    advancement["3"] = { ...advancement["3"], configuration: { points: 2, cap: 2, fixed: { str: 0, dex: 0 } } }
    const result = parse([{ ...parent, system: { ...parent.system, advancement } }, feature])
    expect(result.content.classes![0].features).toHaveLength(4)
    expect(result.content.classes![0].features.find(f => f.level === 4)?.modifierRefs).toContain("cat_char_grant_feat")
    expect(result.content.classes![0].features[0].linkedModifiers?.flatMap(m => m.characteristics ?? []).find(m => m.type === "uses")).toMatchObject({ uses: { type: "at_level" } })
  })

  it("preserves an orphan subclass feature for manual assignment", () => {
    const result = parse([{ ...feature, system: { ...feature.system, type: { value: "subclass" } } }])
    expect(result.content.feats?.[0].name).toBe(feature.name)
    expect(result.meta.review.some(r => r.label === "Standalone class/subclass features")).toBe(true)
  })

  it("wires exported spell grants by name without importing another copy as a feat", () => {
    const spell = { _id: "spell", name: "Test Light", type: "spell", system: { level: 0, school: "evo", description: { value: "A test light." } } }
    const result = parse([{ ...parent, system: { advancement: [grant("spell", 3)] } }, spell])
    expect(result.content.classes![0].features[0].modifierRefs).toContain("cat_char_spells_known")
    expect(result.content.spells?.[0].name).toBe("Test Light")
  })

  it("imports grants once, preserves numeric scales as uses, and exposes bonus actions at the right level", () => {
    const result = parse([parent, feature])
    const cls = result.content.classes![0]
    expect(result.content.feats ?? []).toHaveLength(0)
    expect(cls.spellcasting).toEqual({ ability: "Wisdom", caster_progression: "half" })
    const recovery = cls.features.find(f => f.name === feature.name)!
    const uses = recovery.linkedModifiers?.flatMap(m => m.characteristics ?? []).find(m => m.type === "uses")
    expect(uses).toMatchObject({ uses: { type: "at_level", atLevelTable: [{ level: 1, count: 2 }, { level: 5, count: 3 }], recharges: [{ rest: "short_rest", amount: 1 }, { rest: "long_rest" }] } })
    expect(cls.features.flatMap(f => f.modifierRefs ?? [])).not.toContain("cat_char_damage_roll_modifiers")
    expect(cls.features.find(f => f.level === 3)?.modifierRefs).toContain("cat_char_subclass_unlock")
    expect(cls.features.find(f => f.level === 4)?.modifierRefs).toContain("cat_char_grant_feat")
    for (let level = 1; level <= 20; level++) {
      const details = [{ row: { class_id: "vanguard", level }, class: { ...cls, id: "vanguard" }, subclass: null }] as Parameters<typeof collectSheetActions>[0]["classDetails"]
      const actions = collectSheetActions({ classDetails: details, species: null })
      expect(actions.find(a => a.name === feature.name)?.kinds).toContain("bonus")
    }
    const prepared = prepareImportedContent(result.content, { charLength: 0 })
    const content = prepared.kind === "confirm" ? prepared.pendingContent : prepared.content
    expect(content.classes![0].features.find(f => f.name === feature.name)?.linkedModifiers?.some(m => m.activation?.bonusAction)).toBe(true)
  })

  it("routes grants by the owning subclass, not the feature subtype, and resolves parent identifiers", () => {
    const subclass = { _id: "sub", type: "subclass", name: "Storm Sentinel", system: { classIdentifier: "vanguard", spellcasting: { progression: "third", ability: "int" }, advancement: [grant("recover", 3)] } }
    const result = parse([{ ...parent, system: { ...parent.system, advancement: [] } }, subclass, feature])
    expect(result.content.subclasses![0]).toMatchObject({ class_name: "The Vanguard", spellcasting: { ability: "Intelligence", caster_progression: "third" }, features: [{ name: feature.name, level: 3 }] })
    expect(result.content.feats ?? []).toHaveLength(0)
  })

  it("resolves full source UUIDs even when an exported item's local id changed, without guessing across packs", () => {
    const exported = { ...feature, _id: "new-id", _stats: { compendiumSource: "Compendium.test.features.Item.recover" } }
    expect(parse([parent, exported]).content.classes![0].features.some(f => f.name === feature.name)).toBe(true)
    const index = buildFoundryUuidIndex([exported, { ...feature, _stats: { compendiumSource: "Compendium.other.features.Item.recover" } }])
    expect(resolveFoundryUuid("Compendium.third.features.Item.recover", index)).toBeNull()
    expect(resolveFoundryUuid("recover", buildFoundryUuidIndex([feature, { ...feature }]))).toBeNull()
  })

  it("supports legacy string grants and warns about missing UUIDs instead of silently losing them", () => {
    const cls = { ...parent, system: { advancement: [{ type: "ItemGrant", level: 2, configuration: { items: ["Compendium.test.features.Item.recover", "Compendium.test.features.Item.missing"] } }] } }
    const result = parse([cls, feature])
    expect(result.content.classes![0].features[0]).toMatchObject({ name: feature.name, level: 2 })
    expect(result.meta.review.some(r => r.label === "Unresolved ItemGrant" && r.detail.includes("missing"))).toBe(true)
  })

  it("preserves explicit ItemChoice pools and both old and new count shapes at their gain levels", () => {
    const cls = { ...parent, system: { advancement: [{ type: "ItemChoice", title: "Technique", configuration: { pool: ["Compendium.test.features.Item.recover"], choices: { "2": 1, "7": { count: 1 } } } }] } }
    const result = parse([cls, feature])
    expect(result.content.classes![0].features.map(f => [f.level, f.choices?.count, f.choices?.options[0].name])).toEqual([[2, 1, feature.name], [7, 1, feature.name]])
    expect(result.content.feats ?? []).toHaveLength(0)
  })

  it("does not grant choice-pool proficiencies or later-level traits at level one", () => {
    const cls = { ...parent, system: { advancement: [{ type: "Trait", level: 1, configuration: { grants: ["saves:str"], choices: [{ count: 1, pool: ["armor:hvy", "armor:med"] }] } }, { type: "Trait", level: 10, configuration: { grants: ["saves:wis"] } }] } }
    const result = parse([cls])
    expect(result.content.classes![0].saving_throws).toEqual(["Strength"])
    expect(result.content.classes![0].armor_proficiencies).toBeNull()
    expect(result.meta.review.filter(r => r.label === "Trait advancement")).toHaveLength(2)
  })

  it("splits independent activities while keeping the shared item-use counter", () => {
    const dual = { ...feature, system: { ...feature.system, activities: { ...feature.system.activities, guard: { type: "utility", name: "Guard", activation: { type: "reaction" } } } } }
    const result = parse([parent, dual])
    const actions = result.content.classes![0].features.filter(f => f.name.startsWith("Recover Stamina:"))
    expect(actions).toHaveLength(2)
    expect(actions[0].linkedModifiers?.some(m => m.activation?.bonusAction)).toBe(true)
    expect(actions[1].linkedModifiers?.some(m => m.activation?.reaction)).toBe(true)
    expect(actions[1].linkedModifiers?.some(m => m.activation?.effects?.some(e => e.kind === "heal_self"))).toBe(false)
  })

  it("does not turn unknown formula arithmetic or dice scales into fabricated mechanics", () => {
    const result = parse([parent, { ...feature, system: { ...feature.system, uses: { max: "2 * @prof + 1" } } }])
    expect(result.meta.review.some(r => r.label === "Unresolved uses formula")).toBe(true)
    const uses = result.content.classes![0].features[0].linkedModifiers?.flatMap(m => m.characteristics ?? []).find(m => m.type === "uses")
    expect(uses).toMatchObject({ uses: { type: "special" } })
  })

  it("does not heal the owner for a self-range area heal or spend uses for a free activity", () => {
    const area = { ...feature, system: { ...feature.system, activities: { area: { ...feature.system.activities.recover, range: { units: "self" }, target: { affects: { type: "ally" } }, consumption: { targets: [] } } } } }
    const row = parse([parent, area]).content.classes![0].features[0]
    expect(row.linkedModifiers?.some(m => m.activation?.effects?.some(e => e.kind === "heal_self"))).toBe(false)
    expect(row.modifierRefs).not.toContain("cat_char_uses")
    expect(row.linkedModifiers?.some(m => m.activation?.bonusAction)).toBe(true)
  })
})
