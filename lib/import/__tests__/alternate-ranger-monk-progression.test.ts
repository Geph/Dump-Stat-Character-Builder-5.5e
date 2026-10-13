import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { parseImportContentJsonDetailed } from "@/lib/import/parse-import-content-json"
import { prepareImportedContent } from "@/lib/import/prepare-import"
import { applyProposalSelections, defaultProposalSelections } from "@/lib/import/import-proposals"
import { enrichImportContentModifiers } from "@/lib/import/enrich-import-modifiers"
import { enrichAbilityImportRows } from "@/lib/import/enrich-ability-import"
import { normalizeAbilityImportRows } from "@/lib/import/normalize-ability-import"
import { resolveHomebrewImportJsonPath } from "@/lib/import/homebrew-import-ops"
import { attachClassDetails } from "@/lib/character/character-classes"
import { collectSheetActions } from "@/lib/character/sheet-actions"
import { attacksPerAttackAction } from "@/lib/character/action-economy"
import { resolveUsesAtLevel } from "@/lib/compendium/resolve-uses-config"
import { featureChoiceKey } from "@/lib/builder/choices"
import { wireAlternateMonkTechnique } from "@/lib/import/enrichment-presets/packs/alternate-monk-techniques"
import { mergeTableParsedClassResources } from "@/lib/import/enrich-import-classes"
import { wireAlternateRangerKnack } from "@/lib/import/enrichment-presets/packs/alternate-ranger-knacks"
import { aggregateCharacteristics } from "@/lib/compendium/characteristic-modifiers"
import { wireAlternateMonkCoreFeature } from "@/lib/import/enrichment-presets/packs/alternate-ranger-monk-progression"
import { correctAlternateSubclassFeature } from "@/lib/import/enrichment-presets/packs/alternate-ranger-monk-corrections"
import { getSpellSlotTable } from "@/lib/compendium/spell-slots"
import { shieldEquipment, chainMailEquipment } from "@/lib/character/__tests__/fixtures"
import type { ImportContent } from "@/lib/import/content-schema"
import type { DndClass, CustomAbility, Subclass, UsesConfig, Feature } from "@/lib/types"

function imported(key: string, includeLibrary = true) {
  const raw = JSON.parse(readFileSync(resolveHomebrewImportJsonPath(`laserllama-${key}-class`)!, "utf8")) as ImportContent
  const library = JSON.parse(readFileSync(resolveHomebrewImportJsonPath("laserllama-exploits-custom")!, "utf8")) as ImportContent
  const parsed = parseImportContentJsonDetailed(JSON.stringify({ ...raw, import_proposals: { ...raw.import_proposals,
    custom_abilities: [...(raw.import_proposals?.custom_abilities ?? []), ...(includeLibrary ? library.import_proposals?.custom_abilities ?? [] : [])],
  } }))
  if (!parsed.ok) throw new Error(parsed.error)
  const prepared = prepareImportedContent(parsed.content)
  const content = enrichImportContentModifiers(prepared.kind === "confirm"
    ? applyProposalSelections(prepared.pendingContent, prepared.proposals, defaultProposalSelections(prepared.proposals)) : prepared.content)
  const cls = { ...content.classes![0], id: key, class_resources: content.class_resources!.map((r) => ({ ...r, id: r.resource_key })) } as unknown as DndClass
  const subclasses = content.subclasses!.map((s, i) => ({ ...s, id: `sub_${i}`, class_id: key })) as unknown as Subclass[]
  const abilities = enrichAbilityImportRows(normalizeAbilityImportRows(content.abilities ?? [])).map((a, i) => ({ ...a, id: `ability_${i}`, linked_modifiers: a.linkedModifiers ?? a.linked_modifiers })) as unknown as (CustomAbility & { source_name: string })[]
  return { cls, subclasses, abilities, content }
}

describe("Alternate Ranger/Monk real import and levels 1–20", () => {
  for (const [key, subclassCount, libraryCount] of [["altranger", 20, 41], ["altmonk", 18, 43]] as const) {
    it.skipIf(!resolveHomebrewImportJsonPath(`laserllama-${key}-class`))(`${key}: progression, every subclass unlock, and selected library abilities`, () => {
      const { cls, subclasses, abilities } = imported(key)
      expect(subclasses).toHaveLength(subclassCount)
      const own = abilities.filter((a) => a.source_name === cls.name)
      expect(own).toHaveLength(libraryCount)
      const pool = cls.features.find((f) => f.name === (key === "altmonk" ? "Mystic Techniques" : "Knacks"))!
      expect(pool.choices?.swappableOnLevelUp).toBe(true)
      expect(pool.choices?.swappableOnRest).toBe(false)
      expect(cls.features.some((f) => f.name === "Subclass")).toBe(false)
      for (let level = 1; level <= 20; level++) {
        const detail = attachClassDetails([{ class_id: cls.id, level, order: 0 }], [cls], subclasses)
        const active = detail[0].class!.features.filter((f) => f.level <= level)
        expect(attacksPerAttackAction(active), `base ${level}`).toBe(level >= 5 ? 2 : 1)
        const actions = collectSheetActions({ classDetails: detail, species: null })
        if (key === "altmonk") {
          if (level >= 2) {
            const ki = cls.class_resources!.find((r) => r.id === "alternate_monk_ki_points")!
            expect(resolveUsesAtLevel(ki.uses, level)).toBe(level + 3 + Math.floor((level - 1) / 4))
          }
          expect(Boolean(actions.find((a) => a.name === "Flurry of Blows")), `Flurry ${level}`).toBe(level >= 2)
          if (level >= 2) expect(actions.find((a) => a.name === "Flurry of Blows")?.limitedUses?.classResourceKey).toBe("alternate_monk_ki_points")
          const spirit = actions.find((a) => a.name === "Spirit of Tranquility")
          expect(Boolean(spirit), `Spirit ${level}`).toBe(level >= 9)
          if (spirit) expect(spirit.limitedUses?.classResourceAmount).toBe(1)
        } else {
          const expected = [1, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10][level - 1]
          const resource = cls.class_resources!.find((r) => r.id === "knacks_known")!
          expect(resolveUsesAtLevel({ ...resource.uses, type: "at_level" }, level)).toBe(expected)
          expect(JSON.stringify(active.filter((f) => /Feral Senses|Tireless|Foe Slayer/.test(f.name)))).not.toMatch(/blindsight|grant_temp_hp|markDamageDie/)
        }
        for (const sub of subclasses) {
          const details = attachClassDetails([{ class_id: cls.id, subclass_id: sub.id, level, order: 0 }], [cls], subclasses)
          const subFeatures = (details[0].subclass?.features ?? []).filter((f) => f.level <= level)
          const subActions = collectSheetActions({ classDetails: details, species: null })
          for (const f of subFeatures) {
            if (f.level !== level || f.isChoice || / Spells$|Techniques/.test(f.name)) continue
            if (/\b(?:as|use) (?:an?|your) (?:action|bonus action|reaction)\b/i.test(f.description))
              expect(subActions.some((a) => a.name === f.name), `${sub.name} L${level}: ${f.name}`).toBe(true)
          }
          // Companion upgrades must not give the Ranger extra attacks.
          if (["Beast Master", "Drake Guard"].includes(sub.name)) expect(attacksPerAttackAction([...active, ...subFeatures])).toBe(level >= 5 ? 2 : 1)
        }
        // Each legal selected technique/Knack gets evaluated separately; do not give
        // every library entry to a character just to make the test see an action.
        for (const ability of own.filter((a) => (a.level_requirement ?? 1) <= level && level >= pool.level)) {
          const selected = collectSheetActions({ classDetails: detail, species: null, customAbilities: [ability] })
          if (/^(Action|Bonus Action|Reaction|Special)$/.test(ability.casting_time ?? ""))
            expect(selected.some((a) => a.name === ability.name), `${ability.name} L${level}`).toBe(true)
          expect(JSON.stringify(ability.linked_modifiers)).not.toMatch(/"(?:ki_points|focus_points|martial_arts_dice|quarry_dice)"/)
        }
      }
      const exploitSub = subclasses.find((s) => s.name === (key === "altmonk" ? "Way of the Brawler" : "Bounty Hunter"))!
      const picker = exploitSub.features.find((f) => /^(Savage|Martial) Exploits$/.test(f.name))!
      expect(picker.choices!.options.length).toBeGreaterThan(35)
      for (const option of picker.choices!.options) expect(option.linkedModifiers?.length, option.name).toBeGreaterThan(0)
      const option = picker.choices!.options.find((o) => o.name === "Feat of Strength")!
      const details = attachClassDetails([{ class_id: cls.id, subclass_id: exploitSub.id, level: 3, order: 0 }], [cls], subclasses)
      const actions = collectSheetActions({ classDetails: details, species: null, featureChoicePicks: { [featureChoiceKey(cls.id, picker.name, picker.level)]: [option.name] } })
      expect(actions.some((a) => a.name.includes(option.name)), actions.map((a) => a.name).join(", ")).toBe(true)
      if (key === "altmonk") {
        const wuJen = subclasses.find((s) => s.name === "Way of the Wu Jen")!
        for (let level = 1; level <= 20; level++) {
          const slots = getSpellSlotTable(cls.name, level, wuJen.spellcasting)!
          expect(slots.slotsByLevel.reduce((a, b) => a + b, 0)).toBe(level < 3 ? 0 : level === 3 ? 1 : 2)
          if (level >= 3) expect(slots.pactSlotLevel).toBe(level >= 19 ? 4 : level >= 13 ? 3 : level >= 7 ? 2 : 1)
        }
        for (const sub of subclasses.filter((s) => !["Way of the Brawler", "Way of the Wu Jen", "Way of the Open Hand"].includes(s.name))) {
          const grants = sub.features.filter((f) => /Techniques/.test(f.name)).flatMap((f) => (f.linkedModifiers ?? []).flatMap((m) => m.characteristics ?? []).filter((c) => c.type === "grant_custom_ability").map((c) => ({ level: f.level, names: c.abilityNames })))
          expect(grants.map((g) => g.level), sub.name).toEqual([3, 5, 9])
          for (const grant of grants) expect(own.some((a) => grant.names.includes(a.name))).toBe(true)
        }
        const open = subclasses.find((s) => s.name === "Way of the Open Hand")!
        const picks = open.features.filter((f) => /^Open Hand Techniques/.test(f.name))
        expect(picks.map((f) => f.level)).toEqual([3, 5, 9])
        for (const pick of picks) {
          expect(pick.choices?.swappableOnLevelUp).toBe(true)
          expect(pick.choices?.options.some((o) => o.name === "Tremor Strike")).toBe(false)
          expect(pick.choices?.options.some((o) => o.name === "Stunning Strike")).toBe(true)
        }
      }
    })
  }
  it("repairs nested technique costs and namesake collisions without needing Drive fixtures", () => {
    const row = wireAlternateMonkTechnique({ name: "Quivering Palm", source_name: "Alternate Monk", linkedModifiers: [{ characteristics: [{ type: "on_hit_trigger", spendResourceKey: "focus_points", spendResourceAmount: 4 }] }] })
    expect((row.uses as UsesConfig).classResourceAmount).toBe(5)
    expect(JSON.stringify(row)).not.toContain("focus_points")
    const wind = wireAlternateMonkTechnique({ name: "Step of the Wind", source_name: "Alternate Monk" })
    expect(wind.uses).toBeNull()
    expect(wind.casting_time).toBe("Bonus Action")
  })
  it.skipIf(!resolveHomebrewImportJsonPath("laserllama-altmonk-class") || !resolveHomebrewImportJsonPath("laserllama-altranger-class"))("preserves wired secondary pools when importing either class alone", () => {
    for (const key of ["altranger", "altmonk"]) {
      const { subclasses } = imported(key, false)
      const sub = subclasses.find((s) => s.name === (key === "altmonk" ? "Way of the Brawler" : "Bounty Hunter"))!
      const pool = sub.features.find((f) => /^(Martial|Savage) Exploits$/.test(f.name))!
      expect(pool.choices?.options.length).toBeGreaterThan(35)
      for (const option of pool.choices!.options) {
        expect(option.linkedModifiers?.length, `${key}: ${option.name} wiring`).toBeGreaterThan(0)
        expect(option.level_requirement, `${key}: ${option.name} gate`).toBeGreaterThanOrEqual(3)
      }
    }
  })
  it("preserves unrelated explicit Ranger resources and custom user Knacks", () => {
    const resources = mergeTableParsedClassResources({ classes: [{ name: "Alternate Ranger", features: [] }],
      class_resources: ["quarry", "knacks_known", "quarry_die", "exploit_dice"].map((resource_key) => ({ class_name: "Alternate Ranger", resource_key, name: resource_key, uses: { type: "fixed" as const, fixedAmount: 2 } })) })
    expect(resources.map((r) => r.resource_key)).toEqual(["quarry", "knacks_known", "quarry_die", "exploit_dice"])
    const custom = { name: "My New Knack", source_name: "Alternate Ranger", ability_role: "knack", mechanics: [{ kind: "speed", speedFeet: 10 }] }
    expect(wireAlternateRangerKnack(custom)).toBe(custom)
  })
  it("keeps Vigilante movement with armor or a shield without stacking it twice", () => {
    const seed = { name: "Combat Ready", level: 3, description: "", linkedModifiers: [] } as Feature
    const combat = correctAlternateSubclassFeature(seed)
    const again = correctAlternateSubclassFeature(combat)
    expect(again.linkedModifiers?.length).toBe(combat.linkedModifiers?.length)
    const base = wireAlternateMonkCoreFeature({ ...seed, name: "Unarmored Movement", level: 2 })
    const mods = [...base.linkedModifiers!, ...combat.linkedModifiers!].flatMap((m) => m.characteristics ?? [])
    const medium = { ...chainMailEquipment, subcategory: "Medium Armor" }
    for (const [equippedArmor, equippedShield, expected] of [[null, null, 15], [medium, null, 15], [medium, shieldEquipment, 15], [null, shieldEquipment, 15], [chainMailEquipment, null, 0]] as const) {
      expect(aggregateCharacteristics(mods, { characterLevel: 6, equippedArmor, equippedShield }).speedAdd.walk ?? 0).toBe(expected)
    }
  })
})
