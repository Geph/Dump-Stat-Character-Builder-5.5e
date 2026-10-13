import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { hasHomebrewFixture, homebrewFixturePath } from "./homebrew-fixture-path"
import { parseImportContentJson } from "@/lib/import/parse-import-content-json"
import { enrichImportContentModifiers } from "@/lib/import/enrich-import-modifiers"
import { normalizeBackgroundRow } from "@/lib/compendium/normalize-backgrounds"
import { getBackgroundAbilityGrant } from "@/lib/builder/background-asi"
import { collectSheetActions } from "@/lib/character/sheet-actions"
import type { Background, CustomAbility } from "@/lib/types"

import type { CharacterClassDetail } from "@/lib/character/character-classes"
import { applyCustomAbilityModifications } from "@/lib/character/modify-custom-ability"
import { aggregateCharacteristics } from "@/lib/compendium/characteristic-modifiers"
import { normalizeLinkedModifiers } from "@/lib/compendium/linked-modifiers"
const files = ["eberron-backgrounds", "eberron-dragonmark-feats", "exploringeberron-feats"]
const available = hasHomebrewFixture(...files)
const load = (file: string) => {
  const content = parseImportContentJson(readFileSync(homebrewFixturePath(file)!, "utf8"))
  expect(content).not.toBeNull()
  return enrichImportContentModifiers(content!)
}

describe("private Eberron background and feat imports", () => {
  it.runIf(available)("preserves all real backgrounds and their origin selections", () => {
    const content = load(files[0])
    expect(content.backgrounds).toHaveLength(19)
    expect(content.backgrounds?.some(b => b.name === "Dhakaani Goblinoids")).toBe(false)
    expect(content.backgrounds?.map(b => b.name)).toContain("House Cannith Heir")
    for (const row of content.backgrounds!) {
      expect(row.name.length).toBeLessThan(40)
      const bg = normalizeBackgroundRow(row as never) as unknown as Background
      expect(getBackgroundAbilityGrant(bg).eligible).toHaveLength(3)
      expect(bg.feat_granted).toBeTruthy()
      expect(row.skill_proficiencies).toHaveLength(2)
      expect(row.starting_equipment_groups?.[0].options).toHaveLength(2)
    }
  })
  it.runIf(available)("retains 28 dragonmark and 12 Exploring feats with catalog wiring", () => {
    for (const [file, count] of [[files[1], 28], [files[2], 12]] as const) {
      const content = load(file)
      expect(content.feats).toHaveLength(count)
      for (const feat of content.feats!) {
        const wired = feat as typeof feat & { linkedModifiers?: unknown[] }
        expect(wired.linkedModifiers?.length, feat.name).toBeGreaterThan(0)
        expect(feat.linkedModifiers).toEqual(parseImportContentJson(readFileSync(homebrewFixturePath(file)!, "utf8"))!.feats!.find(f => f.name === feat.name)!.linkedModifiers)
      }
    }
  })
  it.runIf(available)("exposes independent feat actions with correct action economies", () => {
    const content = load(files[1])
    const abilities = content.abilities!.map((row, i) => ({ ...row, id: `ability-${i}`, linked_modifiers: normalizeLinkedModifiers(row.linkedModifiers, []) })) as unknown as CustomAbility[]
    const classDetails = [{ row: { level: 20, class_id: "test" }, class: { id: "test", name: "Test", features: [] } }] as unknown as CharacterClassDetail[]
    const actions = collectSheetActions({ classDetails, species: null, customAbilities: abilities })
    expect(actions.some(a => a.name.includes("Vigilant Guardian"))).toBe(true)
    expect(actions.some(a => a.name.includes("Subdue Animal"))).toBe(true)
    const atLevel = (level: number) => collectSheetActions({ classDetails: [{ ...classDetails[0], row: { ...classDetails[0].row, level } }], species: null, customAbilities: abilities })
    expect(atLevel(1).some(a => a.name.includes("Subdue Animal"))).toBe(false)
    expect(atLevel(4).some(a => a.name.includes("Subdue Animal"))).toBe(true)
    expect(atLevel(18).some(a => a.name.includes("Siberys free cast"))).toBe(false)
    expect(atLevel(19).some(a => a.name.includes("Siberys free cast"))).toBe(true)
    const modifications = content.feats!.flatMap(f => f.linkedModifiers ?? []).flatMap(m => m.characteristics ?? []).filter(m => m.type === "modify_custom_ability")
    const upgraded = applyCustomAbilityModifications(abilities, modifications)
    for (const a of upgraded.filter(a => a.name.endsWith(" — Intuition"))) {
      const effects = a.linked_modifiers!.flatMap(m => m.activation?.effects ?? [])
      expect(effects.filter(e => e.kind === "check_roll_modifier")).toHaveLength(1)
      expect(effects[0].bonusConfig?.dieType).toBe("d6")
    }
    const fortitude = upgraded.find(a => a.name === "Aberrant Dragonmark — Aberrant Fortitude")!
    expect(fortitude.uses?.recharges).toEqual([{ rest: "short_rest" }, { rest: "long_rest" }])
    expect(abilities.find(a => a.id === fortitude.id)?.linked_modifiers?.[0].activation?.effects?.[0].bonusConfig?.dieType).toBe("d4")
  })
  it.runIf(available)("expands Dragonmark spell lists without preparing table spells", () => {
    const mark = load(files[1]).feats!.find(f => f.name === "Mark of Detection")!
    const derived = aggregateCharacteristics(normalizeLinkedModifiers(mark.linkedModifiers, []).flatMap(m => m.characteristics ?? []))
    expect(derived.spellListAccessNames).toContain("Legend Lore")
    expect(JSON.stringify(derived.spellsKnown)).not.toContain("Legend Lore")
    expect(mark.linkedModifiers?.flatMap(m => m.characteristics ?? []).filter(m => m.type === "spells_known").flatMap(m => m.spells).find(s => s.spellId.endsWith("See Invisibility"))?.unlocksAtClassLevel).toBe(3)
    const storm = load(files[1]).feats!.find(f => f.name === "Greater Mark of Storm")!
    expect(storm.linkedModifiers?.flatMap(m => m.characteristics ?? []).map(m => m.type)).not.toContain("speed")
  })
})
