import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { homebrewFixturePath } from "./homebrew-fixture-path"
import { parseImportContentJsonDetailed } from "@/lib/import/parse-import-content-json"
import { prepareImportedContent } from "@/lib/import/prepare-import"
import { applyProposalSelections, defaultProposalSelections } from "@/lib/import/import-proposals"
import { enrichImportContentModifiers } from "@/lib/import/enrich-import-modifiers"
import { attachClassDetails } from "@/lib/character/character-classes"
import { collectSheetActions } from "@/lib/character/sheet-actions"
import { wireOctoberPsionFeatures } from "@/lib/compendium/october-psion-wiring"
import { parseCompanionStatBlock } from "@/lib/character/parse-companion-stat-block"
import type { DndClass, Subclass, Feature, CustomAbility } from "@/lib/types"

it.skipIf(!homebrewFixturePath("kibbles-october-psion-subclasses.json"))("imports October Psion archetypes and exposes independent actions at each level", () => {
  const parsed = parseImportContentJsonDetailed(readFileSync(homebrewFixturePath("kibbles-october-psion-subclasses.json")!, "utf8"))
  if (!parsed.ok) throw Error(parsed.error)
  const p = prepareImportedContent(parsed.content)
  const content = enrichImportContentModifiers(p.kind === "confirm" ? applyProposalSelections(p.pendingContent, p.proposals, defaultProposalSelections(p.proposals)) : p.content)
  const base = { id: "psion", name: "Psion", hit_die: 6, features: [] } as unknown as DndClass
  const expected: Record<string, [number, string, string][]> = {
    "Warped Mind": [[1, "Rapid Evolution", "action"], [3, "Psionic Regrowth", "free"], [3, "Defensive Adaption", "free"], [10, "Regrowth Recovery", "free"], [14, "Abomination Unleashed", "free"]],
    "Illusive Mind": [[3, "Reflected Agony", "free"], [10, "Illusory Armor", "action"], [14, "Army of Illusions", "action"]],
  }
  expect(content.subclasses).toHaveLength(2)
  expect(content.abilities?.find(a => a.name === "Biokinesis Discipline")?.choices?.options).toHaveLength(17)
  expect(content.abilities?.find(a => a.name === "Mesmerism Discipline")?.choices?.options).toHaveLength(5)
  expect(content.abilities?.some(a => a.name === "General Psionic Talents")).toBe(false)
  for (const [name, count] of [["Flesh Warp", 5], ["Illusory Image", 4]] as const) {
    const ability = content.abilities?.find(a => a.name === name)
    expect((ability?.psionic_augments as { augments?: unknown[] })?.augments).toHaveLength(count)
    expect((ability as unknown as CustomAbility)?.uses?.type).not.toBe("class_resource")
  }
  for (const name of ["Projected Self", "Imaginary Ally"]) expect(content.abilities?.find(a => a.name === name)?.casting_time).toBe("1 bonus action")
  expect(content.creatures?.some(c => c.name === "Spittel Cannon")).not.toBe(true)
  for (const row of content.subclasses!) {
    const sub = { ...row, id: row.name, class_id: base.id } as unknown as Subclass
    // Import adds claim diagnostics after wiring; compare the mechanics, not that later report.
    const mechanics = sub.features.map(({ claims: _claims, ...f }) => f)
    expect(wireOctoberPsionFeatures(mechanics, "Psion", sub.name)).toEqual(mechanics)
    for (let level = 1; level <= 20; level++) {
      const classDetails = attachClassDetails([{ class_id: base.id, subclass_id: sub.id, level, order: 0 }], [base], [sub])
      const actions = collectSheetActions({ classDetails, species: null })
      for (const [unlock, name, kind] of expected[sub.name]) {
        const rows = actions.filter(a => a.name === name)
        expect(rows.length, `${sub.name} L${level}: ${name}`).toBe(level >= unlock ? 1 : 0)
        if (!rows.length) continue
        expect(rows[0].showOnCombatTab).not.toBe(false)
        if (kind === "free") expect(rows[0].spendsEconomy).toBe(false)
        else expect(rows[0].kinds).toEqual([kind])
        if (name === "Psionic Regrowth" || name === "Illusory Armor") expect(rows[0].limitedUses?.type).toBe("unlimited")
        if (name === "Regrowth Recovery") expect(rows[0].limitedUses).toMatchObject({ type: "class_resource", classResourceKey: "psi_points", classResourceAmount: 1 })
      }
    }
  }
})

it("does not charge a second point for Regrowth or impose a global per-target lock", () => {
  expect(parseCompanionStatBlock("Spittel Cannon", "Your mouth becomes a natural weapon.")).toBeNull()
  const features = wireOctoberPsionFeatures([
    { name: "Mutation Mastery", level: 3, description: "Private source" },
    { name: "Rapid Regeneration", level: 10, description: "Private source" },
  ], "Psion", "Warped Mind")
  expect(features.find(f => f.name === "Psionic Regrowth")?.limitedUses).toEqual({ type: "unlimited" })
  expect(features.find(f => f.name === "Regrowth Recovery")?.limitedUses).toMatchObject({ classResourceKey: "psi_points", classResourceAmount: 1 })
  const [armor] = wireOctoberPsionFeatures([{ name: "Illusory Armor", level: 10, description: "" }], "Psion", "Illusive Mind")
  expect(armor.limitedUses).toEqual({ type: "unlimited" })
  expect(armor.linkedModifiers?.flatMap(m => m.characteristics ?? []).some(c => c.type === "ac")).toBe(false)
  const untouched: Feature[] = [{ name: "Mutation Mastery", level: 3, description: "" }]
  expect(wireOctoberPsionFeatures(untouched, "Inventor", "Warped Mind")).toBe(untouched)
})
