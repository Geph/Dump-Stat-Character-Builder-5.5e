import type { Feature } from "@/lib/types"
import { relentlessManeuvers } from "./maneuvers"
import { bothRests, char, child, daily, free, fx, key, note, omit, pool, rider, spell, state, statUses, timing, wire } from "./helpers"

/** 2024 mechanical corrections; descriptions remain in the user's source import. */
export function martialFeature(className: string, subclass: string, f: Feature): Feature[] {
  const id = `${className}/${subclass}/${key(f.name)}`
  switch (id) {
    case "barbarian/path_of_the_wild_heart/nature_speaker":
      return [wire(f, [char(f.name, { type: "spells_known", castingAbility: "wisdom", spells: [{ spellId: "import_spell_name:Commune with Nature", alwaysPrepared: true, castAsRitual: true }] }), note(f.name, "Ritual casting only; use WIS.")])]
    case "fighter/battle_master/relentless":
      return [wire(f, [relentlessManeuvers(), rider(f.name, ["Combat Superiority"])])]
    case "barbarian/path_of_the_zealot/zealous_presence":
      return [wire(f, [note(f.name, "Grant the chosen allies Advantage on attacks and saves until your next turn; this does not grant yourself permanent Advantage.")], { bonusAction: true }, { ...daily(), restoreByResource: { resourceKey: "rage", restores: 1 } })]
    case "barbarian/path_of_the_wild_heart/rage_of_the_wilds":
    case "barbarian/path_of_the_wild_heart/power_of_the_wilds":
      return [{ ...f, choices: f.choices ? { ...f.choices, options: f.choices.options.map((o) => {
        if (["Wolf", "Lion", "Ram"].includes(o.name)) return { ...o, linkedModifiers: [rider(o.name, o.name === "Ram" ? ["Attack"] : ["Rage"]), note(o.name, "Apply the source option while raging; resolve nearby creatures and positioning at the table.")] }
        if (o.name === "Falcon") return { ...o, linkedModifiers: [char(o.name, { type: "speed", speedType: "fly", mode: "equal_to_walk", value: 0, limitations: [...state("Rage"), { id: "falcon_no_armor", kind: "armor_type", rule: "requires_not_wearing", value: "Any armor" }] })] }
        if (o.name === "Bear") return { ...o, linkedModifiers: [char(o.name, { type: "damage_resistance", damageTypes: ["Acid", "Bludgeoning", "Cold", "Fire", "Lightning", "Piercing", "Poison", "Slashing", "Thunder"], requiresSheetToggle: "while_raging" })] }
        return o
      }) } : undefined }]
    case "barbarian/path_of_the_world_tree/vitality_of_the_tree":
      return [wire(f, [rider(f.name, ["Rage"]), note(f.name, "On Rage: self temporary HP = class level. On turn start while raging: choose an ally and roll Rage Damage bonus d6s.")], free)]
    case "barbarian/path_of_the_zealot/fanatical_focus":
      return [wire(f, [rider(f.name, ["Rage"]), note(f.name, "One failed-save reroll per active Rage, adding Rage Damage bonus; reset when a new Rage begins.")], { ...free, onFailedSave: true }, { type: "special", specialDescription: "Once per active Rage; no additional Rage cost" })]
    case "barbarian/path_of_the_zealot/rage_of_the_gods": {
      const mods = omit(f, ["uses", "power_rider"]).map((m) => ({ ...m, characteristics: m.characteristics?.map((c) => ({ ...c, limitations: [...(c.limitations ?? []).filter((l) => l.id !== state(f.name)[0].id), ...state(f.name)] })) }))
      return [wire(f, [...mods, rider(f.name, ["Rage"])], { ...free, requirements: [{ kind: "custom", text: "When activating Rage" }] }, daily()),
        wire(child(f, "Revivification"), [note("Revivification", "While divine form is active: prevent an ally dropping to 0 HP; set their HP to Barbarian level.")], { reaction: true }, pool("rage"))]
    }
    case "fighter/champion/heroic_warrior":
      return [timing(f, { ...free, requirements: [{ kind: "custom", text: "Start your combat turn without Heroic Inspiration" }] })]
    case "fighter/eldritch_knight/war_bond":
      return [wire(f, [note(f.name, "Summon one bonded weapon on the same plane; record up to two bonds.")], { bonusAction: true })]
    case "fighter/eldritch_knight/war_magic":
    case "fighter/eldritch_knight/improved_war_magic":
      return [wire(f, [rider(f.name, ["Attack"]), note(f.name, "Replace attacks with the eligible Wizard spell described here; pay the spell's normal slot cost.")])]
    case "fighter/eldritch_knight/arcane_charge":
      return [wire(f, [...omit(f, ["uses"]), rider(f.name, ["Action Surge"])], free)]
    case "fighter/psi_warrior/psionic_power":
      return [wire(f, [rider(f.name, ["Attack"]), note(f.name, "Psionic Energy Dice belong to this subclass; Short Rest restores one, Long Rest restores all.")]),
        wire(child(f, "Protective Field"), [fx("Protective Field", { kind: "damage_reduction", bonusConfig: { mode: "die", dieScaling: "class_resource", classResourceKey: "psionic_energy_dice" } }), note("Protective Field", "Reduce target damage by the die + INT (minimum 1).")], { reaction: true }, pool("psionic_energy_dice")),
        wire(child(f, "Psionic Strike"), [rider("Psionic Strike", ["Attack"]), note("Psionic Strike", "Weapon hit within 30 feet: die + INT Force damage, once on your turn.")], { ...free, oncePerTurn: true, requirements: [{ kind: "on_hit" }] }, pool("psionic_energy_dice")),
        wire(child(f, "Telekinetic Movement"), [note("Telekinetic Movement", "Move the eligible object or willing creature within 30 feet.")], { action: true }, { ...daily(), recharges: bothRests, restoreByResource: { resourceKey: "psionic_energy_dice", restores: 1 } })]
    case "fighter/psi_warrior/guarded_mind":
      return [timing(f, { ...free, requirements: [{ kind: "custom", text: "Start of turn while Charmed or Frightened" }] }, pool("psionic_energy_dice"))]
    case "fighter/psi_warrior/telekinetic_adept":
      return [wire(f, [rider("Telekinetic Thrust", ["Psionic Strike"])]),
        wire(child(f, "Psi-Powered Leap"), [note("Psi-Powered Leap", "Until this turn ends, Fly Speed is twice your Speed.")], { bonusAction: true }, { ...daily(), recharges: bothRests, restoreByResource: { resourceKey: "psionic_energy_dice", restores: 1 } })]
    case "fighter/psi_warrior/bulwark_of_force":
      return [timing(f, { bonusAction: true }, { ...daily(), restoreByResource: { resourceKey: "psionic_energy_dice", restores: 1 } })]
    case "fighter/psi_warrior/telekinetic_master":
      return [spell(f, "Telekinesis", { action: true }, { ...daily(), restoreByResource: { resourceKey: "psionic_energy_dice", restores: 1 } }),
        wire(child(f, "Telekinetic Master Attack"), [fx("Telekinetic Master Attack", { kind: "weapon_attack" })], { bonusAction: true, requirements: [{ kind: "custom", text: "While concentrating on this feature's Telekinesis" }] })]
    case "monk/warrior_of_mercy/hand_of_healing": {
      const healing = fx(f.name, { kind: "heal_self", healTarget: "choose_ally", healMode: "dice", healDiceCount: 1, healDieType: "d6", healAbility: "WIS", bonusByLevel: [{ level: 5, mode: "dice", dieCount: 1, dieType: "d8" }, { level: 11, mode: "dice", dieCount: 1, dieType: "d10" }, { level: 17, mode: "dice", dieCount: 1, dieType: "d12" }] })
      return [wire(f, [healing], { action: true }, pool("focus_points")),
        wire(child(f, "Flurry Healing"), [healing, note("Flurry Healing", "Replace a Flurry of Blows strike; its Focus and Bonus Action have already been spent.")], { ...free, requirements: [{ kind: "custom", text: "Replace a Flurry of Blows strike" }] })]
    }
    case "monk/warrior_of_mercy/implements_of_mercy":
      return [wire(f, [char(f.name, { type: "skills", entries: ["Insight", "Medicine"].map((skill) => ({ skill, expertise: false })) }), char(f.name, { type: "tool_proficiencies", values: ["Herbalism Kit"] })])]
    case "monk/warrior_of_mercy/flurry_of_healing_and_harm":
      return [wire(f, [rider(f.name, ["Flurry of Blows", "Hand of Harm", "Hand of Healing"])], free, statUses("WIS"))]
    case "monk/warrior_of_mercy/hand_of_ultimate_mercy":
      return [wire(f, [note(f.name, "Revive an eligible corpse; roll 4d10 + WIS for its HP. This costs 5 Focus Points as well as the daily use.")], { action: true }, { ...daily(), classResourceKey: "focus_points", classResourceAmount: 5 })]
    case "monk/warrior_of_shadow/shadow_arts":
      return [wire(f, omit(f, ["uses"])), spell(child(f, "Shadow Arts: Darkness"), "Darkness", { action: true }, pool("focus_points"))]
    case "monk/warrior_of_the_elements/elemental_attunement":
      return [wire(f, omit(f, ["uses"]).map((m) => ({ ...m, characteristics: m.characteristics?.map((c) => ({ ...c, limitations: state("Elemental Attunement") })) })), { ...free, requirements: [{ kind: "custom", text: "At the start of your turn" }] }, pool("focus_points"))]
    case "monk/warrior_of_the_elements/stride_of_the_elements":
      return [wire(f, ["fly", "swim"].map((speedType) => char(`${f.name} ${speedType}`, { type: "speed", speedType: speedType as "fly", mode: "equal_to_walk", value: 0, limitations: state("Elemental Attunement") })))]
    case "monk/warrior_of_the_elements/elemental_epitome":
      return [wire(f, [rider(f.name, ["Elemental Attunement", "Step of the Wind", "Unarmed Strike"]), note(f.name, "Choose the active resistance; resolve Step of the Wind damage and once-per-turn bonus damage only while attuned.")], free)]
    case "monk/warrior_of_the_open_hand/quivering_palm":
      return [wire(f, [rider(f.name, ["Unarmed Strike"]), note(f.name, "Track the single affected target and expiry; setting vibrations costs Focus, ending them does not.")], { ...free, requirements: [{ kind: "on_hit" }] }, pool("focus_points", 4)),
        wire(child(f, "End Quivering Palm"), [note("End Quivering Palm", "Existing target on the same plane: CON save versus 10d12 Force, half on success. May replace one Attack-action attack instead.")], { action: true })]
    case "monk/warrior_of_the_open_hand/wholeness_of_body":
      return [wire(f, [fx(f.name, { kind: "heal_self", healMode: "dice", healDiceCount: 1, healDieType: "d8", healAbility: "WIS", bonusByLevel: [{ level: 11, mode: "dice", dieCount: 1, dieType: "d10" }, { level: 17, mode: "dice", dieCount: 1, dieType: "d12" }] })], { bonusAction: true }, statUses("WIS"))]
    case "paladin/oath_of_devotion/sacred_weapon":
    case "paladin/oath_of_vengeance/vow_of_enmity":
      return [timing(f, { ...free, requirements: [{ kind: "on_attack" }] }, pool("channel_divinity"))]
    case "paladin/oath_of_glory/inspiring_smite":
      return [timing(f, { ...free, requirements: [{ kind: "on_cast_spell" }] }, pool("channel_divinity"))]
    case "ranger/fey_wanderer/otherworldly_glamour":
      return [wire({ ...f, isChoice: false, choices: undefined }, [...omit(f, ["skills"]), char(f.name, { type: "skills", entries: ["Deception", "Performance", "Persuasion"].map((skill) => ({ skill, expertise: false })), choiceCount: 1 })])]
    case "ranger/fey_wanderer/fey_reinforcements":
      return [spell(f, "Summon Fey", { action: true }, daily())]
    case "ranger/beast_master/primal_companion":
      return [wire({ ...f, isChoice: false, choices: undefined }, [...omit(f, ["uses"]), note(f.name, "Choose the beast on the Companion tab. Command with a Bonus Action, or replace one Attack-action attack.")], { bonusAction: true }),
        wire(child(f, "Restore Primal Companion"), [fx("Restore Primal Companion", { kind: "class_resource", classResourceKey: "spell_slots", classResourceChange: "reduce", spellSlotMinLevel: 1 }), note("Restore Primal Companion", "Touch the recently deceased beast; it returns after one minute with full HP.")], { action: true })]
    case "ranger/beast_master/exceptional_training":
      return [wire(f, [rider(f.name, ["Primal Companion"]), note(f.name, "Your command also grants the beast a Bonus Action; no additional owner Bonus Action. Choose Force or normal damage on its attacks.")])]
    case "ranger/fey_wanderer/dreadful_strikes":
      return [wire(f, [char(f.name, { type: "power_rider", parentPowerNames: ["Attack"], selectable: true, weaponDamageMenu: true, bonusDice: "1d4", bonusDiceType: "Psychic", dieByLevel: [{ level: 11, die: "1d6" }], menuConditionLabel: "Once per target per turn" })])]
    case "ranger/gloom_stalker/dread_ambusher":
      return [wire(f, [...omit(f, ["uses", "on_hit_trigger", "extra_damage_on_hit", "damage_roll_modifiers", "power_rider"]),
        char(f.name, { type: "power_rider", parentPowerNames: ["Attack"], selectable: true, weaponDamageMenu: true, bonusDice: "2d6", bonusDiceType: "Psychic", dieByLevel: [{ level: 11, die: "2d8" }], menuConditionLabel: "Once per turn; mark Dread Ambusher use" })], { ...free, oncePerTurn: true, requirements: [{ kind: "on_hit" }] }, statUses("WIS"))]
    case "ranger/gloom_stalker/stalker_s_flurry":
      return [wire({ ...f, isChoice: false, choices: undefined }, [rider(f.name, ["Dread Ambusher"]), note(f.name, "After Dreadful Strike, choose the extra weapon attack or the area fear save. Its damage is now 2d8; don't add the old 2d6 again.")])]
    case "ranger/hunter/defensive_tactics":
      return [{ ...f, choices: f.choices ? { ...f.choices, swappableOnRest: true, swapRestType: "short", options: f.choices.options.filter((o) => ["escape_the_horde", "multiattack_defense"].includes(key(o.name))) } : undefined }]
    case "ranger/hunter/hunter_s_lore":
      return [wire(f, [rider(f.name, ["Hunter's Mark"]), note(f.name, "Record the marked target's defenses revealed by the GM.")])]
    case "rogue/soulknife/psychic_blades": {
      const blade = (name: string, die: "d6" | "d4") => char(name, { type: "special_attack", attackName: name, attackProfile: "melee", attackAbility: "DEX", properties: ["Finesse", "Thrown", "Vex"], damageTypes: ["Psychic"], damageDiceCount: 1, damageDieType: die, damageAbilityModifier: "attack", rangeFeet: 60 })
      return [wire(f, [blade(f.name, "d6"), note(f.name, "Simple melee weapon; Finesse permits STR instead of DEX. Thrown range 60/120; free hand required. Also available for Opportunity Attacks.")], { action: true }),
        wire(child(f, "Second Psychic Blade"), [blade("Second Psychic Blade", "d4")], { bonusAction: true, requirements: [{ kind: "custom", text: "After a Psychic Blade attack this turn, with the other hand free" }] })]
    }
    case "rogue/soulknife/psionic_power":
      return [wire(f, [note(f.name, "Subclass Psionic Energy Dice: recover one on Short Rest and all on Long Rest.")]),
        wire(child(f, "Psi-Bolstered Knack"), [note("Psi-Bolstered Knack", "Add one Psionic Energy Die to a failed proficient skill/tool check; spend it only if this succeeds.")], free, { ...pool("psionic_energy_dice"), resourceCostWaiver: "The check still fails after adding the die" }),
        wire(child(f, "Psychic Whispers"), [note("Psychic Whispers", "First use per Long Rest is free; later uses expend a die. Roll for duration; choose up to PB creatures.")], { action: true }, { ...pool("psionic_energy_dice"), resourceCostWaiver: "First use since the last Long Rest" })]
    case "rogue/soulknife/soul_blades":
      return [wire(f, [note(f.name, "Choose Homing Strikes after a miss, or Psychic Teleportation as a Bonus Action.")]),
        wire(child(f, "Homing Strikes"), [note("Homing Strikes", "Add a Psionic Energy Die to a missed Psychic Blade attack; expend it only if the attack hits.")], free, { ...pool("psionic_energy_dice"), resourceCostWaiver: "The attack still misses" }),
        wire(child(f, "Psychic Teleportation"), [fx("Psychic Teleportation", { kind: "movement_option", movementTeleport: true }), note("Psychic Teleportation", "Teleport distance = 10 × the Psionic Energy Die roll.")], { bonusAction: true }, pool("psionic_energy_dice"))]
    default: return [f]
  }
}
