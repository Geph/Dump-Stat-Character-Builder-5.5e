import type { ImportContent } from "@/lib/import/content-schema"
import type { Feature, FeatureActivation } from "@/lib/types"
import { syncModifierRefs } from "@/lib/compendium/linked-modifiers"
import { ensureSubclassUnlockFeature } from "@/lib/compendium/subclass-unlock-modifier"
import { action, characteristic, effect, notes, replaceWiring, rider, uses } from "./alternate-ranger-monk-progression"

const free: FeatureActivation = { action: true, noEconomyCost: true }
export const raging = [{ id: "alt_raging", kind: "sheet_toggle" as const, rule: "requires_active" as const, value: "while_raging" }]
const innate = [{ ...raging[0], id: "alt_innate", value: "while_innate_sorcery_active" }]
const exploitDie = { mode: "die" as const, dieCount: 1, dieScaling: "class_resource" as const, classResourceKey: "exploit_dice" }
const longRest = [{ rest: "long_rest" as const }]

function barbarian(f: Feature): Feature {
  switch (f.name) {
    case "Rage": return action(replaceWiring(f, [
      uses(f.name, { type: "class_resource", classResourceKey: "rage", classResourceAmount: 1 }),
      characteristic(f.name, { type: "damage_resistance", damageTypes: ["Bludgeoning", "Piercing", "Slashing"], limitations: raging }),
      ...["Strength", "Constitution"].map((ability) => effect(`${f.name} ${ability}`, { kind: "check_roll_modifier", checkCategory: "ability", checkAbility: ability, checkRollMode: "advantage", limitations: raging })),
      effect(`${f.name} save`, { kind: "check_roll_modifier", checkCategory: "save", checkAbility: "Strength", checkRollMode: "advantage", limitations: raging }),
      rider(f.name, ["Attack"], { weaponDamageMenu: true, selectable: true, bonusDice: "1d4", dieByLevel: [{ level: 1, die: "1d4" }, { level: 5, die: "1d6" }, { level: 11, die: "1d8" }, { level: 17, die: "1d10" }], defaultSelectedWhenToggle: "while_raging", menuConditionLabel: "Strength attack while Raging", limitations: raging }),
      notes(f.name, "No heavy armor unless a feature permits it. Strength attacks only; cannot cast or concentrate. Maintain/end Rage using its sheet toggle."),
    ]), { bonusAction: true })
    case "Savage Exploits": return syncModifierRefs({ ...f, choices: { ...f.choices!, swappableOnLevelUp: true, swappableOnRest: false }, linkedModifiers: [] })
    case "Savage Skill": return action(replaceWiring(f, [uses(f.name, { type: "class_resource", classResourceKey: "exploit_dice", classResourceAmount: 1 }), notes(f.name, "Add one Exploit Die to a check using a Barbarian class skill, after rolling but before the result")]), free)
    case "Danger Sense": return replaceWiring(f, [effect(f.name, { kind: "check_roll_modifier", checkCategory: "initiative", checkRollMode: "advantage" }), rider(f.name, ["Rage"], { alertSummary: "May Rage when rolling initiative, including when surprised" })])
    case "Extra Attack": return action(replaceWiring(f, [effect(f.name, { kind: "extra_attack", extraAttackCount: 1 }), effect(`${f.name} follow-up`, { kind: "bonus_action_attack" }, { bonusAction: true })]), { bonusAction: true, requirements: [{ kind: "custom", text: "After taking the Dash or Disengage action while Raging" }] })
    case "Feral Instinct": return replaceWiring(f, [effect(f.name, { kind: "check_roll_modifier", checkCategory: "save", checkAbility: "Dexterity", checkRollMode: "advantage", disabledWhenConditions: ["Blinded", "Deafened", "Incapacitated"], label: "Against effects you can see" }), rider(f.name, ["Rage"], { alertSummary: "Rage lasts its maximum duration unless ended or Unconscious" })])
    case "Critical Strike": return replaceWiring(f, [rider(f.name, ["Attack"], { alertSummary: "While Raging: a critical hit permits one free Savage Exploit on that attack" })])
    case "Unstoppable": return action(replaceWiring(f, [
      ...["Intelligence", "Wisdom", "Charisma"].map((ability) => effect(`${f.name} ${ability}`, { kind: "check_roll_modifier", checkCategory: "save", checkAbility: ability, checkRollMode: "bonus", bonusConfig: { mode: "ability_modifier", ability: "CON", resultFloor: { mode: "fixed", fixed: 1 } }, limitations: raging })),
      notes(f.name, "When reduced to 0 HP but not killed outright: end Rage and set HP to 1"),
    ]), { ...free, requirements: [{ kind: "custom", text: "Reduced to 0 HP while Raging, but not killed outright" }] })
    case "Persistent Rage": return replaceWiring(f, [rider(f.name, ["Rage"], { alertSummary: "Rage duration increases to 1 hour" })])
    case "Primal Champion": return replaceWiring(f, [characteristic(f.name, { type: "ability_scores", mode: "fixed", bonuses: { strength: 4, constitution: 4 } }), notes(f.name, "Strength and Constitution maximums increase to 24")])
    default: return f
  }
}

function rogue(f: Feature): Feature {
  switch (f.name) {
    case "Devious Skill": return action(replaceWiring(f, [uses(f.name, { type: "class_resource", classResourceKey: "exploit_dice", classResourceAmount: 1 }), notes(f.name, "Add the rolled Exploit Die to this ability check")]), free)
    case "Expertise": return replaceWiring(f, [
      characteristic(f.name, { type: "skills", entries: [], allowAnySkill: true, expertiseIfProficient: true, sharedChoiceGroup: `alt_rogue_expertise_${f.level}`, sharedChoiceCount: f.level === 1 ? 2 : 1, choiceCount: 0 }),
      characteristic(f.name, { type: "tool_proficiencies", values: [], sharedChoiceGroup: `alt_rogue_expertise_${f.level}`, sharedChoiceCount: f.level === 1 ? 2 : 1, choiceCount: 0 }),
      notes(f.name, "An already-proficient selected tool gains Expertise; mark that tool's expertise in the sheet proficiency editor. New tools gain proficiency only."),
    ])
    case "Devious Exploits": return syncModifierRefs({ ...f, choices: { ...f.choices!, swappableOnLevelUp: true, swappableOnRest: false }, linkedModifiers: [] })
    case "Cunning Action": return action(replaceWiring(f, [effect(f.name, { kind: "movement_option", movementDash: true, movementDisengage: true, movementHide: true }, { bonusAction: true }), notes(f.name, "May also Use an Object. From level 11, two different bonus actions per turn; track the second manually.")]), { bonusAction: true })
    case "Cunning Strike": return replaceWiring(f, [rider(f.name, ["Sneak Attack", "Attack"], { alertSummary: "Reduce Sneak Attack by the Exploit's degree in d6s to waive its Exploit Dice cost; attack Exploits only" })])
    case "Ruthless": return replaceWiring(f, [rider(f.name, ["Sneak Attack", "Attack"], { alertSummary: "Reduce Sneak Attack by 2d6 for disadvantage on this Devious Exploit's save" })])
    case "Uncanny Dodge": return action(replaceWiring(f, [effect(f.name, { kind: "damage_reduction", mitigation: "resistance" }, { reaction: true }), notes(f.name, "Halve this visible attack's damage. At level 14, may move half speed without opportunity attacks.")]), { reaction: true })
    case "Blindsense": return replaceWiring(f, [notes(f.name, "While able to hear, locate hidden/invisible creatures within 10 feet; 20 feet at level 17 and 30 at level 20. This is not blindsight.")])
    case "Slippery Mind": return replaceWiring(f, [ ...["Intelligence", "Wisdom", "Charisma"].map((ability) => effect(`${f.name} ${ability}`, { kind: "check_roll_modifier", checkCategory: "save", checkAbility: ability, checkRollMode: "bonus", bonusConfig: exploitDie })) ])
    case "Stroke of Luck": return action(replaceWiring(f, [uses(f.name, { type: "fixed", fixedAmount: 1, recharges: [{ rest: "short_rest" }, ...longRest] }), notes(f.name, "Treat this attack, ability check, or saving throw's d20 result as 20, after seeing its outcome")]), free)
    default: return f
  }
}

function sorcerer(f: Feature): Feature {
  switch (f.name) {
    case "Metamagic": return syncModifierRefs({ ...f, choices: { ...f.choices!, swappableOnLevelUp: true, swappableOnRest: false }, linkedModifiers: [], mechanics: [] })
    case "Innate Sorcery": return action(replaceWiring(f, [uses(f.name, { type: "fixed", fixedAmount: 2, useShareKey: "innate_sorcery", recharges: longRest }),
      effect(f.name, { kind: "self_buff_caster", casterBuffLabel: "Innate Sorcery" }, { bonusAction: true }),
      effect(`${f.name} attacks`, { kind: "check_roll_modifier", checkCategory: "spell_attack", checkRollMode: "advantage", limitations: innate }),
      effect(`${f.name} DC`, { kind: "check_roll_modifier", checkCategory: "spell_save_dc", checkRollMode: "bonus", bonusConfig: { mode: "fixed", fixed: 1 }, limitations: innate }),
    ]), { bonusAction: true })
    case "Sorcery Incarnate": return action(replaceWiring(f, [uses(f.name, { type: "class_resource", classResourceKey: "alternate_sorcerer_sorcery_points", classResourceAmount: 3 }), effect(f.name, { kind: "self_buff_caster", casterBuffLabel: "Innate Sorcery" }), rider(f.name, ["Metamagic"], { alertSummary: "While Innate Sorcery is active, may apply two Metamagics; pay both costs" })]), { bonusAction: true, requirements: [{ kind: "custom", text: "No free uses of Innate Sorcery remaining" }] })
    case "Sorcerous Regeneration": return replaceWiring(f, [effect(f.name, { kind: "class_resource", classResourceKey: "alternate_sorcerer_sorcery_points", classResourceChange: "increase", resourceRefreshOnRest: "short_rest", resourceRefreshFormula: "half_level", resourceRefreshOncePerLongRest: true })])
    case "Magic Incarnate": return replaceWiring(f, [characteristic(f.name, { type: "modify_custom_ability", abilityNames: [], abilityFilter: { role: "knack", eligibleClassNames: ["Alternate Sorcerer"] }, resourceCostReduction: 1, addendum: "May combine any number of Metamagics on a spell." })])
    default: return f
  }
}

/** Mechanical corrections stay in import presets; sheet runtime consumes common modifiers. */
export function wireAlternateLastThreeProgression(content: ImportContent): ImportContent {
  return { ...content, classes: content.classes?.map((cls) => {
    const wire = cls.name === "Alternate Barbarian" ? barbarian : cls.name === "Alternate Rogue" ? rogue : cls.name === "Alternate Sorcerer" ? sorcerer : null
    if (!wire) return cls
    let features = cls.features.map((f) => wire(f as Feature))
    if (cls.name === "Alternate Rogue") for (const level of [6, 10, 15, 18]) if (!features.some((f) => f.name === "Expertise" && f.level === level)) features.push(rogue({ name: "Expertise", level, description: "Choose one additional skill or tool: gain proficiency, or Expertise if already proficient." } as Feature))
    if (cls.name === "Alternate Rogue" && !features.some((f) => f.name === "Devious Skill")) features.push(action(replaceWiring({ name: "Devious Skill", level: 2, description: "After rolling an ability check, before the result, spend an Exploit Die and add it to the roll." } as Feature, [uses("Devious Skill", { type: "class_resource", classResourceKey: "exploit_dice", classResourceAmount: 1 }), notes("Devious Skill", "Add the rolled Exploit Die to this ability check")]), free))
    features = ensureSubclassUnlockFeature({ name: cls.name, features }, 3)
    return { ...cls, features: features as typeof cls.features }
  }) }
}
