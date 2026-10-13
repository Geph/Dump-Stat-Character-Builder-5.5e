import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import classes from "@/lib/srd/seed-data/classes.json"
import { parseImportContentJsonDetailed } from "@/lib/import/parse-import-content-json"
import { prepareImportedContent } from "@/lib/import/prepare-import"
import { applyProposalSelections, defaultProposalSelections } from "@/lib/import/import-proposals"
import { enrichImportContentModifiers } from "@/lib/import/enrich-import-modifiers"
import { enrichAbilityImportRows } from "@/lib/import/enrich-ability-import"
import { normalizeAbilityImportRows } from "@/lib/import/normalize-ability-import"
import { attachClassDetails } from "@/lib/character/character-classes"
import { collectSheetActions } from "@/lib/character/sheet-actions"
import { featureChoiceKey } from "@/lib/builder/choices"
import { wirePhbSubclassFeatures } from "@/lib/compendium/phb-subclass-wiring"
import { gatedClassResourcesUnlockedBySubclass } from "@/lib/compendium/subclass-gated-class-resources"
import { resolveUsesAtLevel } from "@/lib/compendium/resolve-uses-config"
import { getEffectiveRechargeRules } from "@/lib/compendium/normalize-uses-config"
import { homebrewFixturePath } from "./homebrew-fixture-path"
import type { DndClass, Subclass, CustomAbility, Feature } from "@/lib/types"
import { resolveCompanionScaledValue } from "@/lib/character/companion-stat-block"
import { buildCreaturePersistRows } from "@/lib/import/map-creature-import-v2"
import { aggregateCharacteristics } from "@/lib/compendium/characteristic-modifiers"
import { shieldEquipment } from "@/lib/character/__tests__/fixtures"

const names = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"]
// Expected rules, independently specified rather than inferred from the implementation.
const expected: Record<string, [number, string, string][]> = {
  "Path of the Berserker": [[10, "Retaliation", "reaction"], [14, "Intimidating Presence", "bonus"]],
  "Path of the World Tree": [[6, "Branches of the Tree", "reaction"], [14, "Travel along the Tree", "bonus"]],
  "Path of the Zealot": [[10, "Zealous Presence", "bonus"], [14, "Revivification", "reaction"]],
  "College of Dance": [[6, "Inspiring Movement", "reaction"]],
  "College of Glamour": [[3, "Mantle of Inspiration", "bonus"], [6, "Majestic Command", "bonus"]],
  "College of Lore": [[3, "Cutting Words", "reaction"]],
  "College of Valor": [[14, "Battle Magic", "bonus"]],
  "Life Domain": [[3, "Preserve Life", "action"]],
  "Light Domain": [[3, "Warding Flare", "reaction"], [17, "Corona of Light", "action"]],
  "Trickery Domain": [[3, "Invoke Duplicity", "bonus"], [3, "Move Duplicity", "bonus"]],
  "War Domain": [[3, "Guided Strike: Ally", "reaction"], [3, "War Priest", "bonus"]],
  "Circle of the Land": [[14, "Move Sanctuary", "bonus"]],
  "Circle of the Moon": [[10, "Moonlight Step", "bonus"]],
  "Circle of the Sea": [[3, "Wrath of the Sea", "bonus"], [3, "Wrath of the Sea: Surge", "bonus"]],
  "Circle of the Stars": [[3, "Starry Archer", "bonus"], [6, "Cosmic Omen", "reaction"]],
  "Battle Master": [[7, "Know Your Enemy", "bonus"]],
  "Champion": [[10, "Heroic Warrior", "free"]],
  "Eldritch Knight": [[3, "War Bond", "bonus"], [15, "Arcane Charge", "free"]],
  "Psi Warrior": [[3, "Protective Field", "reaction"], [3, "Psionic Strike", "free"], [3, "Telekinetic Movement", "action"], [7, "Psi-Powered Leap", "bonus"], [15, "Bulwark of Force", "bonus"]],
  "Warrior of Mercy": [[3, "Hand of Healing", "action"], [17, "Hand of Ultimate Mercy", "action"]],
  "Warrior of Shadow": [[3, "Shadow Arts: Darkness", "action"], [6, "Shadow Step", "bonus"]],
  "Warrior of the Elements": [[3, "Elemental Attunement", "free"], [6, "Elemental Burst", "action"]],
  "Warrior of the Open Hand": [[6, "Wholeness of Body", "bonus"], [17, "Quivering Palm", "free"], [17, "End Quivering Palm", "action"]],
  "Oath of Devotion": [[3, "Sacred Weapon", "free"], [20, "Holy Nimbus", "bonus"]],
  "Oath of Glory": [[3, "Inspiring Smite", "free"], [15, "Glorious Defense", "reaction"]],
  "Oath of the Ancients": [[20, "Elder Champion", "bonus"]],
  "Oath of Vengeance": [[3, "Vow of Enmity", "free"], [15, "Soul of Vengeance", "reaction"]],
  "Beast Master": [[3, "Primal Companion", "bonus"], [3, "Restore Primal Companion", "action"]],
  "Fey Wanderer": [[7, "Beguiling Twist", "reaction"], [11, "Fey Reinforcements", "action"]],
  "Gloom Stalker": [[3, "Dread Ambusher", "free"], [15, "Shadowy Dodge", "reaction"]],
  "Hunter": [[15, "Superior Hunter’s Defense", "reaction"]],
  "Arcane Trickster": [[3, "Mage Hand Legerdemain", "bonus"], [17, "Spell Thief", "reaction"]],
  "Soulknife": [[3, "Second Psychic Blade", "bonus"], [3, "Psychic Whispers", "action"], [9, "Psychic Teleportation", "bonus"], [13, "Psychic Veil", "action"]],
  "Thief": [[3, "Fast Hands", "bonus"]],
  "Aberrant Sorcery": [[3, "Telepathic Speech", "bonus"], [14, "Revelation in Flesh", "bonus"]],
  "Clockwork Sorcery": [[3, "Restore Balance", "reaction"], [6, "Bastion of Law", "action"]],
  "Draconic Sorcery": [[14, "Dragon Wings", "bonus"], [18, "Dragon Companion", "action"]],
  "Wild Magic Sorcery": [[3, "Tides of Chaos", "free"], [6, "Bend Luck", "reaction"]],
  "Archfey Patron": [[3, "Steps of the Fey", "bonus"], [6, "Misty Escape", "reaction"]],
  "Celestial Patron": [[3, "Healing Light", "bonus"], [14, "Searing Vengeance", "free"]],
  "Fiend Patron": [[6, "Dark One’s Own Luck", "free"], [14, "Hurl Through Hell", "free"]],
  "Great Old One Patron": [[3, "Awakened Mind", "bonus"], [6, "Clairvoyant Combatant", "free"]],
  "Abjurer": [[6, "Projected Ward", "reaction"], [10, "Spell Breaker", "bonus"]],
  "Diviner": [[3, "Portent", "free"], [10, "The Third Eye", "bonus"]],
  "Evoker": [[14, "Overchannel", "free"]],
  "Illusionist": [[6, "Phantasmal Beast", "action"], [6, "Phantasmal Fey", "action"], [10, "Illusory Self", "reaction"]],
}

describe("private PHB imports: all subclass progressions", () => {
  for (const name of names) it.skipIf(!homebrewFixturePath(`phb-${name}-subclasses`))(`${name}: import, choices, sheet actions, and levels 1–20`, () => {
    const parsed = parseImportContentJsonDetailed(readFileSync(homebrewFixturePath(`phb-${name}-subclasses`)!, "utf8"))
    if (!parsed.ok) throw Error(parsed.error)
    const prepared = prepareImportedContent(parsed.content)
    const content = enrichImportContentModifiers(prepared.kind === "confirm" ? applyProposalSelections(prepared.pendingContent, prepared.proposals, defaultProposalSelections(prepared.proposals)) : prepared.content)
    expect(content.subclasses).toHaveLength(4)
    const base = { ...classes.find((c) => c.name.toLowerCase() === name)!, id: name } as unknown as DndClass
    const abilities = enrichAbilityImportRows(normalizeAbilityImportRows(content.abilities ?? [])).map((a, i) => ({ ...a, id: `ability_${i}`, linked_modifiers: a.linkedModifiers ?? a.linked_modifiers })) as unknown as CustomAbility[]
    for (const row of content.subclasses!) {
      const sub = { ...row, id: row.name, class_id: base.id } as unknown as Subclass
      expect(wirePhbSubclassFeatures(sub.features, base.name, sub.name)).toEqual(wirePhbSubclassFeatures(wirePhbSubclassFeatures(sub.features, base.name, sub.name), base.name, sub.name))
      const picks: Record<string, string[]> = {}
      for (const f of sub.features) if (f.choices?.options.length) picks[featureChoiceKey(base.id, f.name, f.level)] = [f.choices.options[0].name]
      for (let level = 1; level <= 20; level++) {
        const classDetails = attachClassDetails([{ class_id: base.id, subclass_id: sub.id, level, order: 0 }], [base], [sub])
        const actions = collectSheetActions({ classDetails, species: null, featureChoicePicks: picks })
        for (const [unlock, actionName, kind] of expected[sub.name] ?? []) {
          const action = actions.find((a) => a.name === actionName)
          expect(Boolean(action), `${sub.name} L${level}: ${actionName}`).toBe(level >= unlock)
          if (!action) continue
          expect(action.showOnCombatTab, actionName).not.toBe(false)
          if (kind === "free") expect(action.spendsEconomy, actionName).toBe(false)
          else expect(action.kinds, actionName).toContain(kind)
        }
        for (const f of sub.features.filter((f) => f.level > level)) expect(actions.some((a) => a.name === f.name), `${f.name} unlocked early at ${level}`).toBe(false)
        if (level >= 3 && ["Psi Warrior", "Soulknife", "Battle Master"].includes(sub.name)) {
          const resource = gatedClassResourcesUnlockedBySubclass(base.name, sub.name)[0]
          const count = sub.name === "Battle Master" ? level >= 15 ? 6 : level >= 7 ? 5 : 4 : 2 * (2 + Math.floor((level - 1) / 4))
          expect(resolveUsesAtLevel(resource.uses, level)).toBe(count)
        }
        if (sub.name === "Battle Master" && level >= 3) {
          expect(abilities).toHaveLength(20)
          for (const ability of abilities) {
            const selected = collectSheetActions({ classDetails, species: null, customAbilities: [ability] })
            expect(selected.some((a) => a.name === ability.name), `maneuver ${ability.name} at ${level}`).toBe(true)
          }
        }
        if (sub.name === "Beast Master" && level >= 3) {
          expect(content.creatures?.filter((c) => /^Beast of the /.test(c.name))).toHaveLength(3)
          for (const creature of buildCreaturePersistRows(content.creatures!.filter((c) => /^Beast of the /.test(c.name)), "User import")) {
            const template = creature.stat_block
            const context = { classLevels: [{ className: "Ranger", level }], abilityMods: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 4, charisma: 0 }, proficiencyBonus: 2 + Math.floor((level - 1) / 4), spellAttackModifier: 6, spellSaveDc: 14 }
            expect(resolveCompanionScaledValue(template.ac, context)).toBe(17)
            const factor = creature.name.endsWith("Sky") ? 4 : 5
            expect(resolveCompanionScaledValue(template.hp, context)).toBe(factor * (level + 1))
            expect(template.actions).toHaveLength(1)
            expect(Object.keys(template.abilityScores ?? {})).toHaveLength(6)
          }
        }
        if (sub.name === "Light Domain" && level >= 3) {
          const flare = actions.find((a) => a.name === "Warding Flare")!
          expect(resolveUsesAtLevel(flare.limitedUses!, level, { abilityModifiers: { WIS: 4 } })).toBe(4)
          expect(getEffectiveRechargeRules(flare.limitedUses!, level).some((r) => "rest" in r && r.rest === "short_rest")).toBe(level >= 6)
        }
      }
      // Every selectable option retains editable wiring, including options not selected above.
      for (const f of sub.features) for (const option of f.choices?.options ?? []) {
        if (f.name === "Primal Companion") {
          expect(f.linkedModifiers?.flatMap((m) => m.characteristics ?? []).some((c) => c.type === "grant_creature" && c.creatureNames.includes(option.name))).toBe(true)
        } else expect(option.linkedModifiers?.length || option.modifierRefs?.length || 0, `${sub.name}/${f.name}/${option.name}`).toBeGreaterThan(0)
      }
      for (const f of sub.features) for (const mod of f.linkedModifiers ?? []) for (const c of mod.characteristics ?? []) if (c.type === "spells_known") {
        for (const spell of c.spells) expect(spell.spellId, `${sub.name}/${f.name}`).not.toMatch(/<|>|\bas a\b|\byou can\b/i)
      }
    }
  }, 60_000)
})

describe("PHB corrections without private book text", () => {
  const feature = (name: string, level = 3): Feature => ({ name, level, description: "" })
  it("does not apply to alternate classes or level-one subclass progressions", () => {
    const rows = [feature("Psionic Power")]
    expect(wirePhbSubclassFeatures(rows, "Alternate Fighter", "Psi Warrior")).toBe(rows)
    const old = [feature("Warding Flare", 1)]
    expect(wirePhbSubclassFeatures(old, "Cleric", "Light Domain")).toBe(old)
  })
  it("gives independent costs to sub-actions and no inherited spend for free continuation", () => {
    const rows = wirePhbSubclassFeatures([feature("Psionic Power")], "Fighter", "Psi Warrior")
    expect(rows.find((f) => f.name === "Protective Field")?.limitedUses?.classResourceKey).toBe("psionic_energy_dice")
    expect(rows.find((f) => f.name === "Telekinetic Movement")?.limitedUses?.restoreByResource?.resourceKey).toBe("psionic_energy_dice")
    const sea = wirePhbSubclassFeatures([feature("Wrath of the Sea")], "Druid", "Circle of the Sea")
    expect(sea.find((f) => f.name.endsWith("Surge"))?.limitedUses?.type).toBe("unlimited")
  })
  it("gates Dance AC with both armor and shield restrictions and doesn't grant permanent Performance Advantage", () => {
    const [dance] = wirePhbSubclassFeatures([feature("Dazzling Footwork")], "Bard", "College of Dance")
    const mods = dance.linkedModifiers!.flatMap((m) => m.characteristics ?? [])
    expect(aggregateCharacteristics(mods, { characterLevel: 3 }).acFormulaOptions.map((o) => o.abilities)).toEqual([["DEX", "CHA"]])
    expect(aggregateCharacteristics(mods, { characterLevel: 3, equippedShield: shieldEquipment }).acFormulaOptions).toEqual([])
    expect(dance.linkedModifiers!.flatMap((m) => m.activation?.effects ?? [])).toEqual([])
  })
  it("doesn't turn table outcomes into permanent Wild Magic AC", () => {
    const [surge] = wirePhbSubclassFeatures([feature("Wild Magic Surge")], "Sorcerer", "Wild Magic Sorcery")
    expect(surge.linkedModifiers!.flatMap((m) => m.characteristics ?? []).some((c) => c.type === "ac")).toBe(false)
    expect(surge.activation?.noEconomyCost).toBe(true)
  })
})
