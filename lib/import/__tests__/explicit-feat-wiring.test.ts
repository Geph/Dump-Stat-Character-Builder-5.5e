import { describe, expect, it } from "vitest"
import { parseImportContentJson } from "@/lib/import/parse-import-content-json"
import { enrichImportContentModifiers } from "@/lib/import/enrich-import-modifiers"
import { parseAiMechanics } from "@/lib/import/parse-ai-mechanics"
import { buildByoExtractionPrompt } from "@/lib/import/byo-import-kit"
import { enrichAbilityImportRow } from "@/lib/import/enrich-ability-import"

describe("authored feat wiring", () => {
  const linkedModifiers = [{ instanceId: "note", catalogRefId: "cat_char_player_note", characteristics: [{ id: "note", type: "player_note", prompt: "Only during this effect.", target: "feature" }] }]
  it("retains persisted modifiers, options and opt-in explicit wiring through parsing and enrichment", () => {
    const row = { name: "Aquatic Adaptation", description: "While the spell is active, you gain a Fly Speed of 60 feet.", modifierWiring: "explicit", linkedModifiers, modifierRefs: ["cat_char_player_note"], isChoice: true,
      choices: { category: "Test", count: 1, options: [{ name: "One", description: "Your Speed increases by 10 feet.", linkedModifiers }] } }
    const parsed = parseImportContentJson(JSON.stringify({ feats: [row], abilities: [{ ...row, source_type: "feat", source_name: row.name, level_requirement: 1 }] }))!
    expect(parsed.feats![0].linkedModifiers).toEqual(linkedModifiers)
    const enriched = enrichImportContentModifiers(parsed)
    expect(enriched.feats![0].linkedModifiers).toEqual(linkedModifiers)
    expect(enriched.feats![0].choices!.options[0].linkedModifiers).toEqual(linkedModifiers)
    expect(enriched.abilities![0].linkedModifiers).toEqual(linkedModifiers)
    const persistedAbility = enrichAbilityImportRow(enriched.abilities![0])
    expect(persistedAbility.linked_modifiers).toEqual(linkedModifiers)
    expect(persistedAbility.is_choice).toBe(true)
  })
  it("keeps automatic wiring enabled for ordinary BYO rows", () => {
    const content = parseImportContentJson(JSON.stringify({ feats: [{ name: "Test Resistance", description: "You have resistance to Fire damage." }] }))!
    expect(enrichImportContentModifiers(content).feats![0].linkedModifiers?.some(m => m.characteristics?.some(c => c.type === "damage_resistance"))).toBe(true)
  })
  it("parses named list additions and upgrades without inventing a second pool", () => {
    const parsed = parseAiMechanics([
      { kind: "spell_list_access", spellNames: ["Test Spell"] },
      { kind: "modify_custom_ability", abilityNames: ["Test Guard"], checkBonusDieOverride: "d6", usesFixed: 1, usesRecharge: "both" },
    ], { contentKind: "feat", sourceName: "Test", featureName: "Test" })
    expect(parsed.unresolved).toEqual([])
    expect(parsed.detections[0].instance.characteristics?.[0]).toMatchObject({ type: "spell_list_access", spellNames: ["Test Spell"], classNames: [] })
    expect(parsed.detections[1].instance.characteristics?.[0]).toMatchObject({ type: "modify_custom_ability", checkBonusDieOverride: "d6", usesOverride: { fixedAmount: 1, recharges: [{ rest: "short_rest" }, { rest: "long_rest" }] } })
    for (const promptMode of ["full", "lite"] as const) {
      const prompt = buildByoExtractionPrompt("feats", { promptMode })
      expect(prompt).toContain("checkBonusDieOverride")
      expect(prompt).toContain("expands caster lists without preparing spells")
    }
  })
})
