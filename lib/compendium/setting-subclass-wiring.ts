import type { Feature, FeatureActivation, UsesConfig } from "@/lib/types"
import { wireOctoberPsionFeatures } from "./october-psion-wiring"
import { bothRests, char, child, daily, free, fx, key, known, note, omit, pool, rider, spell, state, statUses, timing, wire } from "./phb-subclass-wiring/helpers"

// Import/compendium boundary only. Book descriptions remain in private imports.
const families: Record<string, string[]> = {
  artificer: ["Reanimator"], bard: ["College of Spirits", "College of the Moon"],
  cleric: ["Grave Domain", "Knowledge Domain"], fighter: ["Banneret"],
  paladin: ["Oath of the Noble Genies"], ranger: ["Hollow Warden", "Winter Walker"],
  rogue: ["Phantom", "Scion of the Three"], sorcerer: ["Shadow Sorcery", "Spellfire Sorcery"],
  warlock: ["Undead Patron"], wizard: ["Bladesinger"],
}
const passive = (f: Feature, mods = omit(f, ["uses"])) => ({ ...wire(f, mods.length ? mods : [note(f.name, "See the separate actions and imported feature description.")]), sheetDisplay: { ...f.sheetDisplay, featuresTab: true, combatActions: false } })
const action = (f: Feature, name: string, activation: FeatureActivation, uses?: UsesConfig, mods = [note(name, "Resolve the imported rule, including its trigger, range, and target restrictions.")]) => wire(child(f, name), mods, activation, uses)
const spellRestore = (level: number): UsesConfig => ({ ...daily(), restoreBySpellSlot: { minSpellLevel: level, restores: 1 } })
const levelBonus = Array.from({ length: 20 }, (_, i) => ({ level: i + 1, mode: "fixed" as const, fixed: i + 1 }))
const skills = (name: string, names: string[], count = 1, grantExpertise = false) => char(name, { type: "skills", entries: names.map(skill => ({ skill, expertise: false })), choiceCount: count, allowAnySkill: false, grantExpertise })

function settingFeature(cls: string, sub: string, f: Feature): Feature[] {
  switch (`${cls}/${sub}/${key(f.name)}`) {
    case "artificer/reanimator/reanimator_s_skill_set":
      return [passive(f, omit(f, ["uses", "special_attack", "heal_self", "force_save_control"])), action(f, "Jolt to Life", { action: true }, statUses("INT"))]
    case "artificer/reanimator/reanimated_companion":
      return [timing(f, { action: true }, spellRestore(1)), action(f, "Command Reanimated Companion", { bonusAction: true })]
    case "artificer/reanimator/strange_modifications":
      return [{ ...f, choices: f.choices ? { ...f.choices, applyTo: "companion", applyToCompanionFeature: "Reanimated Companion", options: f.choices.options.map(o => ({ ...o,
        prerequisite: ["Bloated", "Gaunt", "Moist"].includes(o.name) ? "Artificer level 9" : o.prerequisite,
        linkedModifiers: o.name === "Gaunt" ? [char(o.name, { type: "speed", speedType: "walk", mode: "set", value: 45 }), char(`${o.name} climb`, { type: "speed", speedType: "climb", mode: "equal_to_walk", value: 0 })]
          : o.name === "Moist" ? [char(o.name, { type: "speed", speedType: "swim", mode: "equal_to_walk", value: 0 })] : o.linkedModifiers,
      })) } : undefined }]
    case "artificer/reanimator/refined_reanimation":
      return [passive(f, [rider(f.name, ["Reanimated Companion"])]), spell(child(f, "Facilitated Revival"), "Raise Dead", { action: true }, daily()), action(f, "Life Transfer", { reaction: true })]
    case "bard/college_of_spirits/spirits_from_beyond":
      return [passive({ ...f, isChoice: false, choices: undefined }, [rider(f.name, ["Bardic Inspiration"])]),
        action(f, "Controlled Channeling", { bonusAction: true }, pool("bardic_inspiration")),
        action(f, "Unleash Spirit", { action: true })]
    case "bard/college_of_spirits/empowered_channeling":
      return [passive(f, [rider(f.name, ["Spellcasting"]), known(f.name, ["Spirit Guardians"])]),
        spell(child(f, "Spiritual Manifestation"), "Spirit Guardians", { action: true }, daily()),
        action(f, "Spiritual Guard", free, { ...daily(), recharges: bothRests })]
    case "cleric/grave_domain/circle_of_mortality":
      return [passive(f), spell(child(f, "Return to Life"), "Spare the Dying", { bonusAction: true })]
    case "cleric/grave_domain/divine_reaper":
      return [passive(f, []), action(f, "Enhanced Necromancy", free, pool("channel_divinity")),
        action(f, "Keeper of Souls", free, { ...spellRestore(6), recharges: bothRests })]
    case "ranger/hollow_warden/wrath_of_the_wild":
      return [timing(f, { bonusAction: true }, { type: "at_level", atLevelMode: "tier", useShareKey: "favored_enemy", recharges: [{ rest: "long_rest" }], atLevelTable: [{ level: 1, count: 2 }, { level: 5, count: 3 }, { level: 9, count: 4 }, { level: 13, count: 5 }, { level: 17, count: 6 }] }),
        action(f, "Prowling Retribution", { reaction: true, requirements: [{ kind: "custom", text: "Wrath of the Wild active; qualifying damage within 5 feet" }] }),
        passive({ ...child(f, "Ancient Armor Improvement"), level: 11 }, [char("Ancient Armor Improvement", { type: "ac", mode: "flat_bonus", flatBonus: 1, limitations: state("Wrath of the Wild") })])]
    case "ranger/hollow_warden/ancient_might":
      return [passive(f, omit(f, ["uses"])), action(f, "Persistent Wrath", { ...free, onDropToZeroHp: true }, spellRestore(4))]
    case "rogue/phantom/tokens_of_the_departed":
      return [passive(f, [note(f.name, "Track soul trinkets: cap 2, then 3 at Rogue 13, 4 at Rogue 17. Long Rest raises holdings to at least 2; it does not fill a larger cap. Apply Life Essence only while holding a trinket.")]),
        action(f, "Claim Soul Trinket", { reaction: true }),
        action(f, "Spirit Query", { action: true }), action(f, "Death's Knell", free)]
    case "rogue/phantom/voice_of_death":
      return [spell(f, "Speak with Dead", { action: true }, { ...daily(), recharges: bothRests })]
    case "rogue/phantom/ghost_walk":
      return [timing(f, { bonusAction: true }, { ...daily(), specialDescription: "Destroy a held soul trinket to restore one use (manual inventory adjustment)." })]
    case "sorcerer/shadow_sorcery/beasts_of_ill_omen":
      return [spell(f, "Summon Beast", { bonusAction: true }, pool("sorcery_points", 3))]
    case "warlock/undead_patron/necrotic_husk":
      return [passive(f, omit(f, ["uses", "heal_self", "force_save_control"])), action(f, "Unholy Resuscitation", { ...free, onDropToZeroHp: true }, { ...daily(), recharges: bothRests })]
    case "warlock/undead_patron/form_of_dread":
      return [wire(f, [...omit(f, ["uses", "grant_temp_hp"]), fx(f.name, { kind: "grant_temp_hp", tempHpTrigger: "bonus_action", healMode: "dice", healDiceCount: 1, healDieType: "d10", bonusByLevel: levelBonus })], { bonusAction: true }, statUses("CHA"))]
    case "bard/college_of_the_moon/moon_s_inspiration":
      return [passive(f, [rider(f.name, ["Bardic Inspiration"])]), action(f, "Inspired Eclipse", free), action(f, "Lunar Vitality", free, pool("bardic_inspiration"))]
    case "bard/college_of_the_moon/primal_lore":
      return [wire(f, [char(f.name, { type: "languages", values: ["Druidic"] }), skills(f.name, ["Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Survival"]), char(f.name, { type: "spells_known", spells: [], choiceGrants: [{ level: 0, count: 1 }], spellListClassOptions: ["Druid"], castingAbility: "charisma" })])]
    case "bard/college_of_the_moon/blessing_of_moonlight":
      return [wire(f, [known(f.name, ["Moonbeam"]), rider(f.name, ["Moonbeam"])], free, daily())]
    case "bard/college_of_the_moon/eventide_s_splendor":
      return [passive(f, [rider(f.name, ["Inspired Eclipse", "Lunar Vitality"])]), action(f, "Vibrance of the Full Moon", free)]
    case "cleric/knowledge_domain/mind_magic":
      return [timing(f, { action: true }, pool("channel_divinity"))]
    case "cleric/knowledge_domain/blessings_of_knowledge":
      return [wire(f, [skills(f.name, ["Arcana", "History", "Nature", "Religion"], 2, true), char(f.name, { type: "tool_proficiencies", values: [], choiceCount: 1, toolChoicePool: "artisans" })])]
    case "fighter/banneret/knightly_envoy":
      return [wire(f, [skills(f.name, ["Insight", "Intimidation", "Persuasion", "Performance"]), char(f.name, { type: "languages", values: [], choiceCount: 1 }), char(f.name, { type: "spells_known", castingAbility: "charisma", spells: [{ spellId: "import_spell_name:Comprehend Languages", castAsRitual: true }] })])]
    case "fighter/banneret/group_recovery":
      return [timing(f, free, { ...daily(), recharges: bothRests })]
    case "fighter/banneret/rallying_surge":
      return [wire(f, [rider(f.name, ["Action Surge"]), note(f.name, "The chosen ally spends their Reaction; the Fighter does not spend a Reaction or a second Action Surge.")], free)]
    case "paladin/oath_of_the_noble_genies/elemental_smite":
      return [wire({ ...f, isChoice: false, choices: undefined }, [rider(f.name, ["Divine Smite"]), note(f.name, "Choose a genie effect on each activation after Divine Smite; apply only that option's temporary benefits.")], free, pool("channel_divinity"))]
    case "paladin/oath_of_the_noble_genies/genie_s_splendor":
      return [wire(f, [skills(f.name, ["Acrobatics", "Intimidation", "Performance", "Persuasion"]), char(f.name, { type: "ac", mode: "ability_modifiers", base: 10, abilities: ["DEX", "CHA"], limitations: [{ id: "genie_no_armor", kind: "armor_type", rule: "requires_not_wearing", value: "Any armor" }] })])]
    case "paladin/oath_of_the_noble_genies/noble_scion":
      return [wire(f, [char(f.name, { type: "speed", speedType: "fly", mode: "set", value: 60, limitations: state(f.name) })], { bonusAction: true }, spellRestore(5)), action(f, "Minor Wish", { reaction: true, requirements: [{ kind: "custom", text: "Noble Scion active; self or ally in Aura of Protection fails a D20 Test" }] })]
    case "ranger/winter_walker/fortifying_soul":
      return [wire(f, [fx(f.name, { kind: "heal_self", healTarget: "choose_ally", healMode: "dice", healDiceCount: 1, healDieType: "d10", bonusByLevel: levelBonus }), note(f.name, "Choose up to WIS recipients (minimum one); track their one-hour fear-save Advantage.")], { action: true }, daily())]
    case "rogue/scion_of_the_three/bloodthirst":
      return [timing(f, { reaction: true }, { ...statUses("INT"), rechargeOverrides: [{ atClassLevel: 17, recharges: [{ rest: "long_rest" }, { rest: "short_rest", amount: 1 }] }] })]
    case "rogue/scion_of_the_three/dread_incarnate":
      return [passive(f, [rider(f.name, ["Bloodthirst", "Sneak Attack"]), note(f.name, "Treat Sneak Attack damage dice of 1 or 2 as 3; Bloodthirst restores one use on Short Rest.")])]
    case "sorcerer/spellfire_sorcery/spellfire_burst":
      return [passive(f, [rider(f.name, ["Font of Magic", "Metamagic"])]),
        action(f, "Bolstering Flames", { ...free, oncePerTurn: true }), action(f, "Radiant Fire", { ...free, oncePerTurn: true })]
    case "sorcerer/spellfire_sorcery/absorb_spells":
      return [passive(f, [known(f.name, ["Counterspell"]), rider(f.name, ["Counterspell"])]), action(f, "Absorb Spell Energy", free)]
    case "sorcerer/spellfire_sorcery/crown_of_spellfire":
      return [timing(f, free, { ...daily(), restoreByResource: { resourceKey: "sorcery_points", resourceAmount: 5, restores: 1 } }), action(f, "Burning Life Force", { ...free, oncePerTurn: true, requirements: [{ kind: "custom", text: "Crown of Spellfire active; hit by an attack; spend up to CHA Hit Dice" }] })]
    case "wizard/bladesinger/bladesong": {
      const limitations = [...state("Bladesong"), ...["Any armor", "Shield"].map(value => ({ id: `bladesong_${key(value)}`, kind: "armor_type" as const, rule: "requires_not_wearing" as const, value }))]
      return [wire(f, [char(f.name, { type: "ac", mode: "flat_bonus", flatBonus: 0, flatBonusAbility: "INT", flatBonusMinimum: 1, limitations }),
        char(f.name, { type: "speed", speedType: "walk", mode: "add", value: 10, limitations }),
        fx(f.name, { kind: "check_roll_modifier", checkCategory: "skill", checkSkills: ["Acrobatics"], checkRollMode: "advantage", limitations }),
        note(f.name, "INT replaces STR/DEX only for proficient weapon attacks. Add INT only to Concentration saves, not all CON saves. Arcane Recovery restores one use; end the form after a two-handed weapon attack.")], { bonusAction: true }, statUses("INT"))]
    }
    case "wizard/bladesinger/training_in_war_and_song":
      return [wire(f, [skills(f.name, ["Acrobatics", "Athletics", "Performance", "Persuasion"]), char(f.name, { type: "weapon_proficiencies", mode: "specific", values: ["Battleaxe", "Flail", "Longsword", "Morningstar", "Rapier", "Scimitar", "Shortsword", "Trident", "War Pick", "Warhammer", "Whip"] })])]
  }
  return [f]
}

/** Keep edition-specific repairs out of generic sheet consumers and namesake subclasses. */
export function wireSettingSubclassFeatures(features: Feature[], parent: string, subclass: string): Feature[] {
  features = wireOctoberPsionFeatures(features, parent, subclass)
  const cls = key(parent), sub = key(subclass)
  if (!families[cls]?.some(s => key(s) === sub) || features.some(f => f.level < 3) || !features.some(f => f.level === 3)) return features
  const result = new Map<string, Feature>()
  for (const feature of features) {
    if (result.has(`${feature.level}:${key(feature.name)}`)) continue
    for (const f of settingFeature(cls, sub, feature)) result.set(`${f.level}:${key(f.name)}`, f)
  }
  return [...result.values()]
}
