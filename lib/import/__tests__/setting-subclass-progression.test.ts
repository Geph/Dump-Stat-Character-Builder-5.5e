import { readFileSync, existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import classes from "@/lib/srd/seed-data/classes.json"
import { parseImportContentJsonDetailed } from "@/lib/import/parse-import-content-json"
import { prepareImportedContent } from "@/lib/import/prepare-import"
import { applyProposalSelections, defaultProposalSelections } from "@/lib/import/import-proposals"
import { enrichImportContentModifiers } from "@/lib/import/enrich-import-modifiers"
import { enrichSrdSubclassRow } from "@/lib/compendium/enrich-srd-subclasses"
import { attachClassDetails } from "@/lib/character/character-classes"
import { collectSheetActions } from "@/lib/character/sheet-actions"
import { wireSettingSubclassFeatures } from "@/lib/compendium/setting-subclass-wiring"
import { aggregateCharacteristics, applyAcCharacteristics } from "@/lib/compendium/characteristic-modifiers"
import { getEffectiveRechargeRules } from "@/lib/compendium/normalize-uses-config"
import { aiMechanicsToDetections } from "@/lib/import/parse-ai-mechanics"
import { resolveFeatureEffectHealAmount } from "@/lib/character/resolve-feature-effect-heal"
import { buildCreaturePersistRows } from "@/lib/import/map-creature-import-v2"
import { resolveCharacterCompanions } from "@/lib/character/resolve-companions"
import { homebrewFixturePath } from "./homebrew-fixture-path"
import type { DndClass, Subclass, Feature, Creature, Equipment } from "@/lib/types"

const expected: Record<string, [number, string, string][]> = {
  Reanimator: [[3,"Jolt to Life","action"],[3,"Reanimated Companion","action"],[3,"Command Reanimated Companion","bonus"],[15,"Facilitated Revival","action"],[15,"Life Transfer","reaction"]],
  "College of Spirits": [[3,"Controlled Channeling","bonus"],[3,"Unleash Spirit","action"],[6,"Spiritual Manifestation","action"],[6,"Spiritual Guard","free"]],
  "Grave Domain": [[3,"Return to Life","bonus"],[3,"Path to the Grave","bonus"],[6,"Sentinel at Death's Door","reaction"],[17,"Enhanced Necromancy","free"],[17,"Keeper of Souls","free"]],
  "Hollow Warden": [[3,"Wrath of the Wild","bonus"],[3,"Prowling Retribution","reaction"],[15,"Persistent Wrath","free"]],
  Phantom: [[3,"Wails from the Grave","free"],[9,"Claim Soul Trinket","reaction"],[9,"Spirit Query","action"],[9,"Death's Knell","free"],[9,"Voice of Death","action"],[13,"Ghost Walk","bonus"]],
  "Shadow Sorcery": [[3,"Power of Shadow","free"],[6,"Beasts of Ill Omen","bonus"],[14,"Shadow Walk","bonus"],[18,"Umbral Form","free"]],
  "Undead Patron": [[3,"Form of Dread","bonus"],[10,"Unholy Resuscitation","free"]],
  "College of the Moon": [[3,"Inspired Eclipse","free"],[3,"Lunar Vitality","free"],[6,"Blessing of Moonlight","free"],[14,"Vibrance of the Full Moon","free"]],
  "Knowledge Domain": [[3,"Mind Magic","action"],[17,"Divine Foreknowledge","bonus"]],
  Banneret: [[3,"Group Recovery","free"],[10,"Rallying Surge","free"],[15,"Shared Resilience","reaction"]],
  "Oath of the Noble Genies": [[3,"Elemental Smite","free"],[15,"Elemental Rebuke","reaction"],[20,"Noble Scion","bonus"],[20,"Minor Wish","reaction"]],
  "Winter Walker": [[3,"Hunter's Rime","free"],[7,"Fortifying Soul","action"],[11,"Chilling Retribution","reaction"],[15,"Frozen Haunt","free"]],
  "Scion of the Three": [[3,"Bloodthirst","reaction"],[9,"Strike Fear","free"]],
  "Spellfire Sorcery": [[3,"Bolstering Flames","free"],[3,"Radiant Fire","free"],[6,"Absorb Spell Energy","free"],[18,"Crown of Spellfire","free"],[18,"Burning Life Force","free"]],
  Bladesinger: [[3,"Bladesong","bonus"],[10,"Song of Defense","reaction"],[14,"Song of Victory","bonus"]],
}

describe("private setting imports through review, enrichment and sheet progression", () => {
  for (const pack of ["ravenloft", "faerun"]) it.skipIf(!homebrewFixturePath(`${pack}-subclasses`))(`${pack}: every subclass at levels 1–20, with action timing and local art`, () => {
    const parsed = parseImportContentJsonDetailed(readFileSync(homebrewFixturePath(`${pack}-subclasses`)!, "utf8"))
    if (!parsed.ok) throw Error(parsed.error)
    const prepared = prepareImportedContent(parsed.content)
    const content = enrichImportContentModifiers(prepared.kind === "confirm" ? applyProposalSelections(prepared.pendingContent, prepared.proposals, defaultProposalSelections(prepared.proposals)) : prepared.content)
    expect(content.subclasses).toHaveLength(pack === "ravenloft" ? 7 : 8)
    for (const row of content.subclasses!) {
      const base = { ...(classes.find(c => c.name === row.class_name) ?? { name: "Artificer", hit_die: 8, features: [] }), id: row.class_name } as unknown as DndClass
      const sub = { ...enrichSrdSubclassRow(row as unknown as Record<string, unknown>, base.name), id: row.name, class_id: base.id } as unknown as Subclass
      if (existsSync("public/images/compendium")) {
        expect(sub.card_image_url, sub.name).toBeTruthy()
        expect(existsSync(`public${sub.card_image_url}`), sub.name).toBe(true)
      }
      expect(expected[sub.name], sub.name).toBeTruthy()
      expect(wireSettingSubclassFeatures(sub.features, base.name, sub.name)).toEqual(sub.features)
      for (const original of row.features) expect(sub.features.some(f => f.name === original.name && f.level === original.level), original.name).toBe(true)
      for (let level = 1; level <= 20; level++) {
        const classDetails = attachClassDetails([{ class_id: base.id, subclass_id: sub.id, level, order: 0 }], [base], [sub])
        const actions = collectSheetActions({ classDetails, species: null })
        if (sub.name === "Reanimator") {
          const companions = resolveCharacterCompanions({ classDetails,
            creatures: buildCreaturePersistRows(content.creatures ?? [], "Private fixture").map((c, i) => ({ ...c, id: `creature-${i}` })) as Creature[],
            ctx: { abilityMods: { strength: 0, dexterity: 0, constitution: 0, intelligence: 4, wisdom: 0, charisma: 0 }, proficiencyBonus: 2 + Math.floor((level - 1) / 4), spellAttackModifier: 6, spellSaveDc: 14, classLevels: [{ className: "Artificer", level }] },
          })
          const companion = companions.find(c => c.template.name === "Reanimated Companion")
          expect(Boolean(companion), `Companion L${level}`).toBe(level >= 3)
          if (companion) {
            expect(companion.maxHp).toBe(5 + 5 * level)
            expect(companion.ac).toBe(14)
            expect(companion.template.actions?.some(a => a.name === "Dreadful Swipe")).toBe(true)
          }
        }
        for (const [unlock, name, kind] of expected[sub.name]) {
          const matches = actions.filter(a => a.name === name)
          expect(matches.length, `${sub.name} L${level}: ${name}`).toBe(level >= unlock ? 1 : 0)
          if (!matches.length) continue
          expect(matches[0].showOnCombatTab, name).not.toBe(false)
          if (kind === "free") expect(matches[0].spendsEconomy, name).toBe(false)
          else expect(matches[0].kinds, name).toEqual([kind])
        }
        if (sub.name === "Scion of the Three" && level >= 3) {
          const uses = actions.find(a => a.name === "Bloodthirst")!.limitedUses!
          expect(getEffectiveRechargeRules(uses, level).some(r => "rest" in r && r.rest === "short_rest" && r.amount === 1)).toBe(level >= 17)
        }
        if (sub.name === "Shadow Sorcery" && level >= 6) expect(actions.find(a => a.name === "Beasts of Ill Omen")!.limitedUses).toMatchObject({ type: "class_resource", classResourceKey: "sorcery_points", classResourceAmount: 3 })
        if (sub.name === "Undead Patron" && level >= 3) {
          const effect = sub.features.find(f => f.name === "Form of Dread")!.linkedModifiers!.flatMap(m => m.activation?.effects ?? []).find(e => e.kind === "grant_temp_hp")!
          expect(resolveFeatureEffectHealAmount(effect, { characterLevel: 20, classLevel: level, proficiencyBonus: 6, abilityMods: {}, random: () => 0 })).toBe(1 + level)
        }
      }
    }
  }, 60_000)
})

it("ability-based AC is additive, gated and never grants a universal CON save bonus", () => {
  const parsed = aiMechanicsToDetections([{ kind: "ac", acBonusAbility: "INT", acBonusMinimum: 1, requiresSheetToggle: "bladesong_active" }], { contentKind: "class_feature", featureName: "Bladesong" })
  expect(parsed[0]?.instance.characteristics?.[0]).toMatchObject({ type: "ac", mode: "flat_bonus", flatBonusAbility: "INT", flatBonusMinimum: 1 })
  const [feature] = wireSettingSubclassFeatures([{ name: "Bladesong", level: 3, description: "" }], "Wizard", "Bladesinger")
  const mods = feature.linkedModifiers!.flatMap(m => m.characteristics ?? [])
  const scores = { strength: 0, dexterity: 2, constitution: 1, intelligence: 4, wisdom: 0, charisma: 0 }
  expect(applyAcCharacteristics(15, aggregateCharacteristics(mods), scores, 2)).toBe(15)
  const active = aggregateCharacteristics(mods, { activeSheetToggles: new Set(["bladesong_active"]) })
  expect(applyAcCharacteristics(15, active, scores, 2)).toBe(19)
  expect(applyAcCharacteristics(15, active, { ...scores, intelligence: -1 }, 2)).toBe(16)
  for (const gear of [{ equippedArmor: { name: "Leather", category: "armor" } as Equipment }, { equippedShield: { name: "Shield" } as Equipment }]) {
    const blocked = aggregateCharacteristics(mods, { activeSheetToggles: new Set(["bladesong_active"]), ...gear })
    expect(applyAcCharacteristics(15, blocked, scores, 2)).toBe(15)
  }
  expect(feature.linkedModifiers!.flatMap(m => m.activation?.effects ?? []).some(e => e.checkCategory === "save")).toBe(false)
})

it("does not rewrite older editions or alternate class names", () => {
  const old: Feature[] = [{ name: "Bladesong", description: "", level: 2 }]
  expect(wireSettingSubclassFeatures(old, "Wizard", "Bladesinger")).toBe(old)
  const alternate: Feature[] = [{ name: "Group Recovery", description: "", level: 3 }]
  expect(wireSettingSubclassFeatures(alternate, "Alternate Fighter", "Banneret")).toBe(alternate)
})
