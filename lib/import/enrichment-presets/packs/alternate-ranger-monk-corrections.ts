import type { Feature } from "@/lib/types"
import type { LinkedModifierInstance } from "@/lib/compendium/linked-modifiers"
import { characteristic, effect, notes, replaceWiring, rider, uses, wireAlternateMonkCoreFeature } from "./alternate-ranger-monk-progression"

const skill = (name: string, skills: string[], count?: number) => characteristic(name, { type: "skills", entries: skills.map((skill) => ({ skill, expertise: false })), ...(count ? { choiceCount: count } : {}) })
const dieCheck = (name: string, skills: string[], monk: boolean) => effect(name, { kind: "check_roll_modifier", checkRollMode: "bonus", checkCategory: "skill", checkSkills: skills,
  bonusConfig: { mode: "die", dieScaling: "class_resource", classResourceKey: monk ? "martial_arts_die" : "quarry_die" } })
const known = (name: string, spells: string[]) => characteristic(name, { type: "spells_known", spells: spells.map((s) => ({ spellId: `import_spell_name:${s}`, alwaysPrepared: true })) })
const active = (name: string) => [{ id: `${name}_gate`, kind: "sheet_toggle" as const, rule: "requires_active" as const, value: name }]
const SKILLS: Record<string, [string[], number?]> = {
  "Otherworldly Mystique": [["Deception", "Performance", "Persuasion"], 1], "Knowledge of the Hunt": [["Arcana", "History", "Nature", "Religion"], 1],
  "Beast Whisperer": [["Athletics", "Animal Handling"], 1], "Draconic Disciple": [["Deception", "Intimidation", "Persuasion"], 1],
  "Primal Intuition": [["Athletics", "Insight", "Intimidation", "Perception", "Stealth", "Survival"], 2],
  "Combat Ready": [["Intimidation", "Performance"], 1], "Valiant Action": [["Acrobatics", "Athletics"], 1],
}

/** Remove unsafe unconditional guesses and wire the exact skill/choice/effect scopes. */
export function correctAlternateSubclassFeature(feature: Feature): Feature {
  let f = { ...feature, linkedModifiers: [...(feature.linkedModifiers ?? [])] }
  const name = f.name
  const retainAction = (mods: LinkedModifierInstance[]) => {
    const activation = f.activation ?? undefined
    f = { ...replaceWiring(f, mods, activation), sheetDisplay: f.sheetDisplay }
  }
  if (SKILLS[name]) {
    const [skills, count] = SKILLS[name]
    // Other rules on these mixed features remain available in their overlay.
    const mods = (f.linkedModifiers ?? []).filter((m) => !m.characteristics?.some((c) => c.type === "skills" || c.type === "resource_ability_menu") && !m.activation?.effects?.some((e) => e.kind === "check_roll_modifier"))
    retainAction([...mods, skill(name, skills, count), notes(name, "Chosen proficiency and conditional benefits")])
  }
  if (["Wild Empathy", "Silent Steps", "Trapper's Craft", "Arctic Adaptation"].includes(name)) {
    f = { ...f, linkedModifiers: (f.linkedModifiers ?? []).filter((m) => !m.characteristics?.some((c) => c.type === "spells_known")) }
  }
  if (["Iron Focus", "Cunning Restraint", "Arcane Defense", "Drunken Style", "Ascendant Step", "Spirit Blade", "Wild Warrior"].includes(name)) {
    retainAction([rider(name, name === "Ascendant Step" ? ["Step of the Wind"] : name === "Wild Warrior" ? ["Wild Shape"] : ["Attack"]), notes(name, "Conditional bonuses apply only at the trigger in this feature")])
  }
  if (name === "Writhing Horde") retainAction([characteristic(name, { type: "speed", speedType: "climb", mode: "equal_to_walk", value: 0 }), notes(name, "Add Quarry Die only to Athletics checks to resist/end Grapple or Shove")])
  if (name === "Umbral Sight") retainAction([characteristic(name, { type: "vision", visionType: "darkvision", rangeFeet: 60 }), notes(name, "If another source already gives Darkvision, increase its range by 60 feet")])
  if (name === "Relentless Hunter") retainAction([rider(name, ["Ranger's Quarry"]), notes(name, "On the Quarry's death: transfer the mark without spending an action or use")])
  if (name === "Astral Visage") retainAction([known(name, ["Thaumaturgy"]), dieCheck(name, ["Insight", "Intimidation"], true), notes(name, "Normal vision through magical darkness to 120 feet while Astral Armor is active")])
  if (name === "Monastic Healer") retainAction([skill(name, ["Insight", "Medicine"]), characteristic(name, { type: "tool_proficiencies", values: ["Herbalism Kit"] }), dieCheck(name, ["Insight", "Medicine"], true), notes(name, "Also add Martial Arts Die to Herbalism Kit checks")])
  if (name === "Monastic Acrobat") retainAction([skill(name, ["Acrobatics", "Performance"]), dieCheck(name, ["Acrobatics", "Performance"], true), notes(name, "Dexterity can replace Charisma for movement-based Performance checks")])
  if (name === "Dancing Fool") retainAction([skill(name, ["Performance"]), characteristic(name, { type: "tool_proficiencies", values: [], choiceCount: 1, choiceOptions: ["Brewer's Supplies", "Bagpipes", "Drum", "Dulcimer", "Flute", "Horn", "Lute", "Lyre", "Pan Flute", "Shawm", "Viol"] }), dieCheck(name, ["Performance"], true), notes(name, "Also add Martial Arts Die to the chosen tool's checks")])
  if (name === "Starlit Navigation") retainAction([characteristic(name, { type: "tool_proficiencies", values: [], choiceOptions: ["Cartographer's Tools", "Navigator's Tools"], choiceCount: 1 }), notes(name, "Add Quarry Die to either tool's checks; navigation under visible stars")])
  if (name === "Deft Hands") retainAction([skill(name, ["Sleight of Hand"]), characteristic(name, { type: "tool_proficiencies", values: ["Thieves' Tools", "Tinker's Tools"] }), dieCheck(name, ["Sleight of Hand"], false), notes(name, "Add Quarry Die to checks with either tool; Use an Object as a bonus action")])
  if (name === "Solid Body") retainAction([characteristic(name, { type: "ac", mode: "ability_modifiers", base: 10, abilities: ["CON", "WIS"], limitations: [
    { id: "boulder_no_armor", kind: "armor_type", rule: "requires_not_wearing", value: "Any armor" }, { id: "boulder_no_shield", kind: "armor_type", rule: "requires_not_wearing", value: "Shield" },
  ] }), characteristic(name, { type: "weapon_ability_override", ability: "constitution", appliesTo: "both", scope: "specific", weaponNames: ["Unarmed Strike"] }), notes(name, "Constitution can replace Dexterity for Martial Arts; add CON to STR checks/saves free on ground or spend 1 Ki otherwise")])
  if (name === "Mighty Form") retainAction([characteristic(name, { type: "ability_scores", mode: "fixed", bonuses: { constitution: 2 } }), notes(name, "Constitution maximum increases to 22")])
  if (name === "Combat Ready") f.linkedModifiers?.push(characteristic(name, { type: "armor_proficiencies", values: ["Light armor", "Medium armor", "Shield"] }))
  if (name === "Combat Ready" || name === "Heavy Warrior") {
    const martial = wireAlternateMonkCoreFeature({ ...f, name: "Martial Arts" }).linkedModifiers ?? []
    for (const mod of martial.flatMap((m) => m.characteristics ?? [])) {
      if (!["unarmed_strike_damage", "weapon_ability_override", "weapon_damage_die_override"].includes(mod.type)) continue
      if (name === "Heavy Warrior" && !("excludedWeaponProperties" in mod)) continue
      const adjusted = { ...mod, limitations: name === "Combat Ready" ? mod.limitations?.filter((l) => l.value !== "Shield") : mod.limitations }
      if ("excludedWeaponProperties" in adjusted) adjusted.excludedWeaponProperties = adjusted.excludedWeaponProperties?.filter((p) => name !== "Heavy Warrior" || p !== "Heavy")
      f.linkedModifiers?.push(characteristic(`${name} ${mod.id}`, adjusted))
    }
    if (name === "Combat Ready") {
      const movement = wireAlternateMonkCoreFeature({ ...f, name: "Unarmored Movement" }).linkedModifiers![0].characteristics![0]
      // Two disjoint equipment cases add the bonus only when the base feature is off.
      for (const armored of [true, false]) f.linkedModifiers?.push(characteristic(`${name} movement ${armored}`, { ...movement, limitations: [
        { id: "vigilante_no_heavy", kind: "armor_type", rule: "requires_not_wearing", value: "Heavy armor" },
        { id: "vigilante_armor", kind: "armor_type", rule: armored ? "requires_wearing" : "requires_not_wearing", value: "Any armor" },
        ...(!armored ? [{ id: "vigilante_shield", kind: "armor_type" as const, rule: "requires_wearing" as const, value: "Shield" }] : []),
      ] }))
    }
  }
  if (name === "Divine Conduit") retainAction([notes(name, "Choose Divine Judgment, Divine Regeneration, or Divine Touch; spend 1 Ki for that use, not an extra Hit Die")])
  if (name === "Disciple of the Elements") retainAction([characteristic(name, { type: "spellcasting_ability", ability: "wisdom" }), notes(name, "Wu Jen spell choices and short-rest slots use the subclass's casting progression")])
  if (name === "Violent Enlightenment") retainAction([rider(name, ["Attack"], { alertSummary: "Melee Martial Arts crit on 19–20; regain 1 Ki on a qualifying crit" }), notes(name, "Apply to melee Martial Arts attacks only; restore Ki on qualifying critical hits")])
  if (name === "Eyes of Night") retainAction([characteristic(name, { type: "vision", visionType: "darkvision", rangeFeet: 60 }), notes(name, "Add 30 feet to existing Darkvision; Stealth advantage only when hiding in darkness")])
  if (name === "Heroic Persona") retainAction([notes(name, "Persona active; first transformation per long rest grants Monk-level temp HP, later 3 Ki; 1 Ki for WIS temp HP or damage rider")])
  if (name === "Winter's Blessing") retainAction([uses(name, { type: "fixed", fixedAmount: 1, recharges: [{ rest: "short_rest" }, { rest: "long_rest" }], restoreBySpellSlot: { minSpellLevel: 2, restores: 1 } }), notes(name, "Chosen allies: Quarry Die + Ranger-level temporary HP; Cold resistance/Frightened immunity only while these temporary HP remain")])
  if (name === "Mantle of the Master") retainAction([characteristic(name, { type: "damage_resistance", damageTypes: [], fromSpells: true, limitations: [
    { id: "mantle_conscious", kind: "condition", rule: "blocked_when_has", value: "Unconscious" }, { id: "mantle_capable", kind: "condition", rule: "blocked_when_has", value: "Incapacitated" },
  ] }), notes(name, "Also applies to damage from magical effects")])
  if (name === "White Walker") retainAction([uses(name, { type: "fixed", fixedAmount: 1, recharges: [{ rest: "long_rest" }], restoreBySpellSlot: { minSpellLevel: 4, restores: 1 } }), characteristic(name, { type: "damage_immunity", damageTypes: ["Cold"], limitations: active("white_walker_form") }), notes(name, "One-minute form, spectral passage, hostile aura and Frozen Revenge interaction")])
  if (name === "Faerie Guardian") retainAction([effect(name, { kind: "cast_spell", castSpellName: "Conjure Fey" }), notes(name, "No material component; optional one-minute duration without concentration; previous summon ends")])
  if (name === "Mirthful Step") f.linkedModifiers?.push(effect(name, { kind: "cast_spell", castSpellName: "Misty Step", castSpellWithoutSlot: true }))
  if (name === "Reflect Spell") retainAction([effect(name, { kind: "cast_spell", castSpellName: "Absorb Elements", castSpellWithoutSlot: true, castSpellLevel: 1 }), notes(name, "Maximize the rider against the original caster")])
  if (name === "Primal Beast") f.linkedModifiers?.push(characteristic(name, { type: "grant_creature", creatureNames: [], choiceOptions: ["Beast of the Cave", "Beast of the Land", "Beast of the Sea", "Beast of the Sky"], count: 1, pickOnRest: "long_rest" }))
  if (name === "Density of Spirit" || name === "Brine in the Blood") {
    const options = name === "Density of Spirit" ? ["Acid", "Bludgeoning", "Cold", "Fire", "Lightning", "Piercing", "Slashing", "Thunder"] : ["Waves", "Winds"]
    retainAction((f.linkedModifiers ?? []).filter((m) => !m.characteristics?.some((c) => c.type === "damage_resistance")))
    f = { ...f, isChoice: true, choices: { category: name, count: 1, swappableOnRest: true, swapRestType: "short", options: options.map((option) => ({ name: option, description: f.description, linkedModifiers: [characteristic(`${name} ${option}`, { type: "damage_resistance", damageTypes: [option === "Waves" ? "Cold" : option === "Winds" ? "Thunder" : option] })] })) } }
  }
  // Every otherwise-unmodeled improvement has a visible rules overlay and an
  // editable state note, without fabricating a permanent bonus from conditional prose.
  if (!f.linkedModifiers?.length && !f.isChoice) f = { ...f, linkedModifiers: [notes(name, "Conditional benefits and current state")] }
  return { ...f, linkedModifiers: [...new Map((f.linkedModifiers ?? []).map((m) => [m.instanceId, m])).values()] }
}
