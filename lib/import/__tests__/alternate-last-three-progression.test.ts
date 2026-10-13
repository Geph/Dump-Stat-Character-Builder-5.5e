import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { parseImportContentJsonDetailed } from "@/lib/import/parse-import-content-json"
import { prepareImportedContent } from "@/lib/import/prepare-import"
import { applyProposalSelections, defaultProposalSelections } from "@/lib/import/import-proposals"
import { enrichImportContentModifiers } from "@/lib/import/enrich-import-modifiers"
import { resolveHomebrewImportJsonPath } from "@/lib/import/homebrew-import-ops"
import { attachClassDetails } from "@/lib/character/character-classes"
import { collectSheetActions } from "@/lib/character/sheet-actions"
import { resolveUsesAtLevel } from "@/lib/compendium/resolve-uses-config"
import { applyCustomAbilityModifications } from "@/lib/character/modify-custom-ability"
import { metamagicOptionsFromCustomAbilities } from "@/lib/character/resolve-spell-cast-cost"
import { sanitizeAlternateSorcererImportContent } from "@/lib/import/enrichment-presets/packs/alternate-sorcerer"
import type { ImportContent } from "@/lib/import/content-schema"
import type { DndClass, Subclass, CustomAbility } from "@/lib/types"

export function importLastClass(key: string) {
  const raw = JSON.parse(readFileSync(resolveHomebrewImportJsonPath(`laserllama-${key}-class`)!, "utf8")) as ImportContent
  const library = JSON.parse(readFileSync(resolveHomebrewImportJsonPath(key === "altsorcerer" ? "laserllama-metamagic-custom" : "laserllama-exploits-custom")!, "utf8")) as ImportContent
  const parsed = parseImportContentJsonDetailed(JSON.stringify({ ...raw, import_proposals: { ...raw.import_proposals, custom_abilities: [...raw.import_proposals?.custom_abilities ?? [], ...library.import_proposals?.custom_abilities ?? []] } }))
  if (!parsed.ok) throw Error(parsed.error)
  const prepared = prepareImportedContent(parsed.content)
  const content = enrichImportContentModifiers(prepared.kind === "confirm" ? applyProposalSelections(prepared.pendingContent, prepared.proposals, defaultProposalSelections(prepared.proposals)) : prepared.content)
  const cls = { ...content.classes![0], id: key, class_resources: content.class_resources!.map((r) => ({ ...r, id: r.resource_key })) } as unknown as DndClass
  const subclasses = content.subclasses!.map((s, i) => ({ ...s, id: `${key}_${i}`, class_id: key })) as unknown as Subclass[]
  return { content, cls, subclasses }
}

describe("last three Alternate classes: import through sheet levels 1–20", () => {
  for (const [key, count] of [["altbarbarian", 19], ["altrogue", 18], ["altsorcerer", 18]] as const) {
    it.skipIf(!resolveHomebrewImportJsonPath(`laserllama-${key}-class`))(`${key}: every subclass and level`, () => {
      const { content, cls, subclasses } = importLastClass(key)
      expect(subclasses).toHaveLength(count)
      expect(content.subclasses!.every((sub) => sub.class_name === cls.name)).toBe(true)
      const keys = content.class_resources!.map((r) => `${r.class_name}:${r.subclass_name ?? ""}:${r.resource_key}`)
      expect(new Set(keys).size).toBe(keys.length)
      for (let level = 1; level <= 20; level++) {
        const detail = attachClassDetails([{ class_id: cls.id, level, order: 0 }], [cls], subclasses)
        const actions = collectSheetActions({ classDetails: detail, species: null })
        for (const [name, unlock] of key === "altbarbarian" ? [["Rage", 1], ["Savage Skill", 2]] as const : key === "altrogue" ? [["Devious Skill", 2], ["Uncanny Dodge", 5], ["Stroke of Luck", 20]] as const : [["Innate Sorcery", 1], ["Sorcery Incarnate", 7]] as const) {
          const source = cls.features.find((f) => f.name === name)!
          expect(Boolean(actions.find((a) => a.name === name)), `${name} L${level}`).toBe(level >= (source?.level ?? unlock))
        }
        if (key === "altsorcerer") {
          const limit = cls.class_resources!.find((r) => r.id === "alternate_sorcerer_spell_limit")!
          expect(resolveUsesAtLevel({ ...limit.uses, type: "at_level" }, level)).toBe([2, 3, 5, 6, 7][Math.min(4, Math.floor((level - 1) / 2))])
          expect(cls.spellcasting?.progression?.[level - 1].prepared).toBe(level + 1)
          expect(cls.spellcasting?.point_pool?.resource_key).toBe("alternate_sorcerer_sorcery_points")
        }
        for (const sub of subclasses) {
          const details = attachClassDetails([{ class_id: cls.id, subclass_id: sub.id, level, order: 0 }], [cls], subclasses)
          const subActions = collectSheetActions({ classDetails: details, species: null })
          for (const f of sub.features.filter((f) => f.level === level && !f.isChoice)) {
            if (f.activation?.action || f.activation?.bonusAction || f.activation?.reaction) expect(subActions.some((a) => a.name === f.name), `${sub.name} L${level} ${f.name}`).toBe(true)
          }
        }
      }
      if (key === "altbarbarian") {
        const mutant = subclasses.find((s) => s.name === "Path of the Mutant")!
        const catalog = mutant.features.find((f) => f.name === "Mutations (catalog)")!
        expect(catalog.linkedModifiers).toHaveLength(0)
        const choice = mutant.features.find((f) => f.name === "Aberrant Alchemy")!
        expect(choice.choices?.options.length).toBeGreaterThan(15)
        expect(choice.choices?.options.find((o) => o.name === "Monstrous Flight")?.level_requirement).toBe(14)
      }
      if (key === "altrogue") {
        const grants = subclasses.find((s) => s.name === "Assassin")!.features.filter((f) => /Exploits/.test(f.name))
        expect(grants.map((f) => f.level)).toEqual([3, 5, 9])
        expect(content.class_resources!.find((r) => r.resource_key === "psi_points")?.subclass_name).toBe("Psiknife")
      }
    })
  }
  it("does not replace another class's same-named resources", () => {
    const content = sanitizeAlternateSorcererImportContent({ classes: [{ name: "Alternate Sorcerer", features: [] }, { name: "Sorcerer", features: [] }], class_resources: [{ class_name: "Sorcerer", name: "Sorcery Points", resource_key: "sorcery_points", uses: { type: "fixed", fixedAmount: 19 } }] } as unknown as ImportContent)
    expect(content.class_resources?.find((r) => r.class_name === "Sorcerer")?.uses.fixedAmount).toBe(19)
  })
  it("discounts selected metamagic through a shared upgrade without making costs negative", () => {
    const ability = { id: "careful", name: "Careful Spell", ability_role: "knack", eligible_classes: ["Alternate Sorcerer"], description: "Spend 1 Sorcery Point. Metamagic option." } as CustomAbility
    const result = applyCustomAbilityModifications([ability], [{ id: "capstone", type: "modify_custom_ability", abilityNames: [], abilityFilter: { role: "knack", eligibleClassNames: ["Alternate Sorcerer"] }, resourceCostReduction: 1 }])
    expect(metamagicOptionsFromCustomAbilities(result, [ability.name])[0].cost).toBe(0)
    expect(metamagicOptionsFromCustomAbilities([ability], [ability.name])[0].cost).toBe(1)
  })
})
