import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { hasHomebrewFixture, homebrewFixturePath } from "./homebrew-fixture-path"
import { parseImportContentJson } from "@/lib/import/parse-import-content-json"
import { prepareImportedContent } from "@/lib/import/prepare-import"
import { applyProposalSelections, defaultProposalSelections } from "@/lib/import/import-proposals"
import { enrichImportContentModifiers } from "@/lib/import/enrich-import-modifiers"
import { normalizeAbilityImportRows } from "@/lib/import/normalize-ability-import"
import { enrichAbilityImportRows } from "@/lib/import/enrich-ability-import"
import { mapCreatureImportV2ToTemplate } from "@/lib/import/map-creature-import-v2"
import { attachClassDetails } from "@/lib/character/character-classes"
import { collectSheetActions } from "@/lib/character/sheet-actions"
import { resolveCharacterCompanionsDetailed } from "@/lib/character/resolve-companions"
import { featureChoiceKey } from "@/lib/builder/choices"
import { resolveUsesAtLevel } from "@/lib/compendium/resolve-uses-config"
import { inferCompanionAttackFromText } from "@/lib/character/infer-companion-attack"
import { resolveCompanionAttack, type CompanionResolveContext } from "@/lib/character/companion-stat-block"
import { applyCompanionResourceSpends, companionResourceMaximum } from "@/lib/character/companion-resource"
import { collectBuilderModifierRefIds } from "@/lib/compendium/builder-modifier-refs"
import { aggregateCharacteristics } from "@/lib/compendium/characteristic-modifiers"
import { filterUnlockedCustomAbilities } from "@/lib/builder/picked-custom-abilities"
import type { ModifierCatalogEntry } from "@/lib/compendium/modifier-catalog"
import type { DndClass, Subclass, CustomAbility, Creature } from "@/lib/types"
import type { CreatureImportV2 } from "@/lib/import/creature-import-v2-schema"

const available = hasHomebrewFixture("mcdm-beastheart", "mcdm-companions")
function imported() {
  const load = (name: string) => parseImportContentJson(readFileSync(homebrewFixturePath(name)!, "utf8"))!
  const prepared = prepareImportedContent({ ...load("mcdm-beastheart"), creatures: load("mcdm-companions").creatures })
  const content = enrichImportContentModifiers(prepared.kind === "confirm" ? applyProposalSelections(prepared.pendingContent, prepared.proposals, defaultProposalSelections(prepared.proposals)) : prepared.content)
  const cls = { ...content.classes![0], id: "bh", class_resources: content.class_resources!.map(r => ({ ...r, id: r.resource_key })) } as unknown as DndClass
  const subclasses = content.subclasses!.map((s,i) => ({ ...s, id: `sub${i}`, class_id: "bh" })) as unknown as Subclass[]
  const abilities = enrichAbilityImportRows(normalizeAbilityImportRows(content.abilities ?? [])).map((a,i) => ({ ...a, id: `a${i}`, attached_to_type: a.source_type, attached_to_id: a.source_name === "Beastheart" ? cls.id : subclasses.find(s => s.name === a.source_name)?.id, linked_modifiers: a.linkedModifiers ?? a.linked_modifiers })) as unknown as CustomAbility[]
  const creatures = content.creatures!.map((c,i) => ({ ...c, id: `c${i}`, stat_block: mapCreatureImportV2ToTemplate(c as CreatureImportV2) })) as unknown as Creature[]
  return { content, cls, subclasses, abilities, creatures }
}
const context = (level: number): CompanionResolveContext => ({ abilityMods: { strength: 2, dexterity: 1, constitution: 2, intelligence: 0, wisdom: 3, charisma: 0 }, proficiencyBonus: 2+Math.floor((level-1)/4), spellAttackModifier: null, spellSaveDc: null, classLevels: [{ className: "Beastheart", level }] })

describe("companion formulas and shared combat resource", () => {
  it("preserves PB in attack, damage and save formulas", () => {
    const attack = inferCompanionAttackFromText("Melee Weapon Attack: +3 plus PB to hit, reach 5 ft., one target. Hit: 1d6 plus PB slashing damage.")!
    expect(resolveCompanionAttack(attack,context(9))).toMatchObject({ toHitBonus: 7, damage: [{ formula: "1d6+4" }] })
    const save = inferCompanionAttackFromText("DC 10 plus PB Dexterity saving throw, taking PBd10 slashing damage or half as much damage on a success.")!
    expect(resolveCompanionAttack(save,context(9))).toMatchObject({ saveDc: 14, damage: [{ formula: "4d10" }] })
    const mixed = inferCompanionAttackFromText("Melee Weapon Attack: +3 plus PB to hit. Hit: 1d6 plus PB slashing damage plus 1d4 fire damage.")!
    expect(resolveCompanionAttack(mixed,context(9)).damage).toMatchObject([{ formula: "1d6+4" }, { formula: "1d4" }])
  })
  it("spends only the active companion's pool once, survives pool resets, and never goes negative", () => {
    const states = [{ key: "bh:none:companion", currentHp: null, knownForms: ["Test Companion"] }, { key: "bh:none:companion:test_companion", currentHp: 20, ferocity: 9 }, { key: "other:none:companion:other", currentHp: 20, ferocity: 6 }]
    const next = applyCompanionResourceSpends(states, { bh_ferocity: 3 }, { bh_ferocity: 7 })
    expect(next[1].ferocity).toBe(5)
    expect(next[2].ferocity).toBe(6)
    expect(companionResourceMaximum(next,"bh_ferocity",7)).toBe(12)
    expect(applyCompanionResourceSpends(next,{ bh_ferocity: 7 },{ bh_ferocity: 0 })).toBe(next)
    expect(applyCompanionResourceSpends(next,{},{ bh_ferocity: 100 })[1].ferocity).toBe(0)
    const raging = next.map((s,i) => i === 1 ? { ...s, rampaging: true } : s)
    expect(companionResourceMaximum(raging,"bh_ferocity",7)).toBe(7)
    expect(applyCompanionResourceSpends(raging,{}, { bh_ferocity: 2 })).toBe(raging)
  })
})

describe("private Beastheart imports", () => {
  it.runIf(available)("retains all content and paid option wiring through actual review/proposal selection", () => {
    const { cls, subclasses, abilities, creatures } = imported()
    expect(subclasses).toHaveLength(5); expect(abilities).toHaveLength(21); expect(creatures).toHaveLength(15)
    expect(cls.features.filter(f => f.linkedModifiers?.some(m => m.characteristics?.some(c => c.type === "subclass_unlock")))).toHaveLength(1)
    expect(cls.spellcasting).toBeFalsy()
    expect(filterUnlockedCustomAbilities(abilities, [])).toHaveLength(0)
    expect(filterUnlockedCustomAbilities(abilities, ["Aid Us, Friend"]).map(a => a.name)).toEqual(["Aid Us, Friend"])
    for (const a of abilities) expect(a.linked_modifiers?.flatMap(m => m.characteristics ?? []).some(m => m.type === "uses" && m.uses.classResourceKey === "ferocity"), a.name).toBe(true)
    for (const sc of subclasses) for (const f of sc.features ?? []) if (/^(Infernal|Nature) Exploits$/.test(f.name)) {
      expect(f.choices?.options).toHaveLength(9)
      expect(f.choices?.optionsSource).toBeUndefined()
      for (const o of f.choices!.options) expect(o.linkedModifiers?.some(m => m.characteristics?.some(c => c.type === "uses" && c.uses.classResourceKey === "ferocity")),o.name).toBe(true)
    }
  })
  it.runIf(available)("keeps companion upgrades off the caregiver and scopes vitality to its class", () => {
    const { cls, subclasses } = imported()
    const protector = subclasses.find(s => s.name === "Protector Bond")!
    const catalog = [{ id: "cat_char_ac", name: "AC", characteristics: [{ id: "ac", type: "ac", mode: "flat_bonus", flatBonus: 2 }] }] as ModifierCatalogEntry[]
    const mods = collectBuilderModifierRefIds({ catalog, speciesTraitPicks: {}, feats: [], selectedFeatIds: [], classLevels: [{ classId: cls.id, level: 7 }, { classId: "other", level: 5 }], classes: [cls], subclasses, subclassByClassId: { [cls.id]: protector.id }, featureChoicePicks: {} })
    const aggregated = aggregateCharacteristics(mods, { characterLevel: 12 })
    expect(aggregated.hpFlatBonus).toBe(7)
    expect(aggregated.hpPerLevel).toBe(0)
    expect(mods.some(m => m.type === "ac" && m.mode === "flat_bonus" && m.flatBonus === 2)).toBe(false)
  })
  it.runIf(available)("shows only the chosen subclass exploit once and resolves caregiver-level companion gates", () => {
    const { cls, subclasses, abilities, creatures } = imported()
    const infernal = subclasses.find(s => s.name === "Infernal Bond")!
    const details = attachClassDetails([{ class_id: cls.id, subclass_id: infernal.id, level: 3, order: 0 }], [cls], subclasses)
    const actions = collectSheetActions({ classDetails: details, species: null, featureChoicePicks: { [featureChoiceKey(cls.id,"Infernal Exploits",3)]: ["Infernal Teleport"] }, customAbilities: filterUnlockedCustomAbilities(abilities, ["Infernal Teleport"]) })
    expect(actions.filter(a => /Infernal Teleport/.test(a.name))).toHaveLength(1)
    expect(actions.some(a => /Poison Rain/.test(a.name))).toBe(false)
    const companion = resolveCharacterCompanionsDetailed({ classDetails: details, creatures, ctx: { ...context(8), classLevels: [{ className: "Beastheart", level: 3 }, { className: "Other", level: 5 }] }, formSelections: { "bh:none:companion": ["Basilisk Companion"] } }).companions[0]
    expect(companion.maxHp).toBe(63)
    expect(companion.actions.filter(a => /Ferocity/.test(a.tag ?? ""))).toHaveLength(3)
    expect(companion.actions.find(a => a.name === "Poison Gaze")?.resolvedAttack?.saveDc).toBe(14)
  })
  it.runIf(available)("checks every subclass and companion at levels 1–20", () => {
    const { cls, subclasses, creatures } = imported()
    for (const sc of subclasses) for (let level=1;level<=20;level++) {
      const details = attachClassDetails([{ class_id: cls.id, subclass_id: level >= 3 ? sc.id : null, level, order: 0 }], [cls], subclasses)
      const picks = { [featureChoiceKey(cls.id,"Infernal Exploits",3)]: ["Infernal Teleport"], [featureChoiceKey(cls.id,"Nature Exploits",3)]: ["Elemental Shield"] }
      const actions = collectSheetActions({ classDetails: details, species: null, featureChoicePicks: picks })
      expect(actions.some(a => a.name === "Rejuvenating Ferocity"),`${sc.name} L${level}`).toBe(level>=6)
      expect(actions.some(a => a.name === "Summon the Wilds")).toBe(level>=18)
      const known = cls.class_resources!.find(r => r.id === "primal_exploits_known")!
      expect(resolveUsesAtLevel({ ...known.uses, type: "at_level" },level)).toBe(level<2 ? 0 : level<10 ? 3 : level<17 ? 5 : 7)
      for (const creature of creatures) {
        const companion = resolveCharacterCompanionsDetailed({ classDetails: details, creatures, ctx: context(level), formSelections: { "bh:none:companion": [creature.name] } }).companions[0]
        expect(companion,`${sc.name} ${creature.name} L${level}`).toBeDefined()
        const sig = companion.actions.find(a => a.tag === "Signature Attack")!
        expect(sig.resolvedAttack?.toHitBonus).toBe(3+context(level).proficiencyBonus)
        expect(sig.resolvedAttack?.damage.length).toBe(level>=5 ? 2 : 1)
        expect(companion.actions.filter(a => /Ferocity/.test(a.tag ?? ""))).toHaveLength(level<3 ? 1 : level<5 ? 2 : 3)
        const printedAC = Number(String((creature as unknown as {ac: string}).ac).match(/\d+/)?.[0])
        expect(companion.ac).toBe(printedAC+context(level).proficiencyBonus+(sc.name === "Protector Bond" && level>=7 ? 2 : 0))
      }
    }
  })
})
