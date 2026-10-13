import type { Feature } from "@/lib/types"
import { bothRests, char, child, daily, free, fx, key, known, note, omit, pool, rider, spell, state, statUses, timing, wire } from "./helpers"

export function casterFeature(className: string, subclass: string, f: Feature): Feature[] {
  const id = `${className}/${subclass}/${key(f.name)}`
  switch (id) {
    case "bard/college_of_dance/dazzling_footwork": {
      const limitations = ["Any armor", "Shield"].map((value) => ({ id: `dance_${key(value)}`, kind: "armor_type" as const, rule: "requires_not_wearing" as const, value }))
      return [wire(f, [char(f.name, { type: "ac", mode: "ability_modifiers", base: 10, abilities: ["DEX", "CHA"], limitations }),
        char(f.name, { type: "unarmed_strike_damage", die: "1d6", ability: "dexterity", limitations, dieByLevel: [{ level: 5, mode: "dice", dieCount: 1, dieType: "d8" }, { level: 10, mode: "dice", dieCount: 1, dieType: "d10" }, { level: 15, mode: "dice", dieCount: 1, dieType: "d12" }] }),
        char(f.name, { type: "weapon_ability_override", ability: "dexterity", scope: "specific", weaponNames: ["Unarmed Strike"], appliesTo: "both", treatAsFinesse: true, limitations }),
        note(f.name, "Performance Advantage applies to dancing only. Agile Strike accompanies a Bardic Inspiration expenditure; no additional action or die cost."), rider(f.name, ["Bardic Inspiration", "Unarmed Strike"])])]
    }
    case "bard/college_of_dance/tandem_footwork":
      return [timing(f, { ...free, onInitiative: true }, pool("bardic_inspiration"))]
    case "bard/college_of_glamour/beguiling_magic":
      return [timing(f, { ...free, requirements: [{ kind: "on_cast_spell" }] }, { ...daily(), restoreByResource: { resourceKey: "bardic_inspiration", restores: 1 } })]
    case "bard/college_of_glamour/mantle_of_majesty":
      return [spell(f, "Command", { bonusAction: true }, { ...daily(), restoreBySpellSlot: { minSpellLevel: 3, restores: 1 } }),
        spell(child(f, "Majestic Command"), "Command", { bonusAction: true, requirements: [{ kind: "custom", text: "While concentrating on Mantle of Majesty" }] })]
    case "cleric/light_domain/warding_flare":
      return [timing(f, { reaction: true }, { ...statUses("WIS"), useShareKey: "warding_flare", rechargeOverrides: [{ atClassLevel: 6, recharges: bothRests }] })]
    case "cleric/light_domain/improved_warding_flare":
      return [wire(f, [rider(f.name, ["Warding Flare"]), note(f.name, "Warding Flare now recharges on either rest; grant its target 2d6 + WIS temporary HP.")])]
    case "cleric/trickery_domain/invoke_duplicity":
      return [wire(f, [note(f.name, "Track illusion location and remaining duration; spell origin and distraction depend on positioning.")], { bonusAction: true }, pool("channel_divinity")),
        wire(child(f, "Move Duplicity"), [rider("Move Duplicity", ["Invoke Duplicity"])], { bonusAction: true })]
    case "cleric/trickery_domain/trickster_s_transposition":
      return [wire(f, [rider(f.name, ["Invoke Duplicity", "Move Duplicity"]), note(f.name, "Swap places as part of creating or moving the illusion; no second Bonus Action.")])]
    case "cleric/war_domain/guided_strike":
      return [wire(f, [note(f.name, "Add +10 to your missed attack roll; using it for someone else costs a Reaction.")], free, pool("channel_divinity")),
        wire(child(f, "Guided Strike: Ally"), [note("Guided Strike: Ally", "+10 to an ally's missed attack within 30 feet.")], { reaction: true }, pool("channel_divinity"))]
    case "cleric/war_domain/war_priest":
      return [timing(f, { bonusAction: true }, { ...statUses("WIS"), recharges: bothRests })]
    case "cleric/war_domain/war_god_s_blessing":
      return [wire(f, [rider(f.name, ["Shield of Faith", "Spiritual Weapon"]), note(f.name, "Use Channel Divinity instead of a slot; no Concentration, one-minute duration.")]),
        ...["Shield of Faith", "Spiritual Weapon"].map((name) => spell(child(f, `War Blessing: ${name}`), name, { bonusAction: true }, pool("channel_divinity")))]
    case "druid/circle_of_the_moon/moonlight_step":
      return [timing(f, { bonusAction: true }, { ...statUses("WIS"), restoreBySpellSlot: { minSpellLevel: 2, restores: 1 } })]
    case "druid/circle_of_the_land/nature_s_sanctuary":
      return [wire(f, [note(f.name, "Place the sanctuary cube; allies inside receive cover and Nature's Ward resistance.")], { action: true }, pool("wild_shape")),
        wire(child(f, "Move Sanctuary"), [note("Move Sanctuary", "Move the existing cube up to 60 feet, within 120 feet of you.")], { bonusAction: true })]
    case "druid/circle_of_the_sea/wrath_of_the_sea":
      return [timing(f, { bonusAction: true }, pool("wild_shape")),
        wire(child(f, "Wrath of the Sea: Surge"), [note("Wrath of the Sea: Surge", "While the emanation exists: choose a target within it; CON save, WIS-modifier d6 Cold and push on failure.")], { bonusAction: true })]
    case "druid/circle_of_the_sea/oceanic_gift":
      return [wire(f, [rider(f.name, ["Wrath of the Sea"]), note(f.name, "One Wild Shape for an ally's emanation, or two for both; each bearer uses the original caster's DC and WIS.")])]
    case "druid/circle_of_the_stars/cosmic_omen":
      return [timing(f, { reaction: true }, statUses("WIS"))]
    case "druid/circle_of_the_stars/starry_form":
      return [wire({ ...f, isChoice: false, choices: undefined }, [note(f.name, "Choose Archer, Chalice, or Dragon when transforming; switch at turn start from Druid 10. Dragon treats INT/WIS checks and Concentration saves of 9 or less as 10.")], { bonusAction: true }, pool("wild_shape")),
        wire(child(f, "Starry Archer"), [char("Starry Archer", { type: "special_attack", attackName: "Starry Archer", attackProfile: "ranged", attackAbility: "WIS", properties: ["Spell attack"], damageTypes: ["Radiant"], damageDiceCount: 1, damageDieType: "d8", damageAbilityModifier: "WIS", rangeFeet: 60,
          damageByLevel: [{ level: 3, mode: "dice", dieCount: 1, dieType: "d8" }, { level: 10, mode: "dice", dieCount: 2, dieType: "d8" }] })], { bonusAction: true, requirements: [{ kind: "custom", text: "Archer constellation active; initial shot is part of the transformation" }] }),
        wire(child(f, "Starry Chalice"), [note("Starry Chalice", "On a slot-powered healing spell: heal a chosen creature 1d8 + WIS (2d8 from Druid 10).")], { ...free, requirements: [{ kind: "custom", text: "Chalice constellation active" }] })]
    case "sorcerer/aberrant_sorcery/revelation_in_flesh":
      return [wire({ ...f, isChoice: false, choices: undefined }, [note(f.name, "Choose one distinct adaptation per Sorcery Point: aquatic, flight, invisible sight, or flexible movement. Track the selected effects for ten minutes."), char(f.name, { type: "resource_ability_menu", resourceKey: "sorcery_points", options: [1, 2, 3, 4].map((n) => ({ name: `${n} adaptation${n > 1 ? "s" : ""}`, resourceCost: n, actionKind: "bonus" })) })], { bonusAction: true })]
    case "warlock/fiend_patron/fiendish_resilience":
      return [{ ...wire(f, []), isChoice: true, choices: { category: "Damage resistance", count: 1, swappableOnRest: true, swapRestType: "short", options: ["Acid", "Bludgeoning", "Cold", "Fire", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"].map((name) => ({ name, description: "", linkedModifiers: [char(name, { type: "damage_resistance", damageTypes: [name] })] })) } }]
    case "sorcerer/clockwork_sorcery/bastion_of_law":
      return [wire(f, [char(f.name, { type: "resource_ability_menu", resourceKey: "sorcery_points", options: [1, 2, 3, 4, 5].map((n) => ({ name: `${n}d8 ward`, resourceCost: n, actionKind: "action" })) }), note(f.name, "Record ward recipient and remaining d8s; spend these dice to reduce damage, not to heal. New ward replaces the old one.")], { action: true })]
    case "sorcerer/draconic_sorcery/draconic_resilience":
      return [wire(f, [...omit(f, ["hit_points", "ac"]), char(f.name, { type: "hit_points", mode: "per_level", value: 1 }), char(f.name, { type: "ac", mode: "ability_modifiers", base: 10, abilities: ["DEX", "CHA"], limitations: [{ id: "draconic_no_armor", kind: "armor_type", rule: "requires_not_wearing", value: "Any armor" }] })])]
    case "sorcerer/draconic_sorcery/dragon_companion":
      return [spell(f, "Summon Dragon", { action: true }, daily())]
    case "sorcerer/wild_magic_sorcery/wild_magic_surge":
      return [wire(f, [note(f.name, "Roll d20 after a slot-powered Sorcerer spell, once per turn. On 20 resolve the source table; apply only the rolled result for its stated duration.")], { ...free, oncePerTurn: true, requirements: [{ kind: "on_cast_spell" }] })]
    case "sorcerer/wild_magic_sorcery/tides_of_chaos":
      return [wire(f, [note(f.name, "Advantage on one D20 Test; restore after a slot-powered Sorcerer spell and resolve its automatic surge, or on Long Rest.")], free, daily())]
    case "sorcerer/wild_magic_sorcery/controlled_chaos":
      return [wire(f, [rider(f.name, ["Wild Magic Surge"])])]
    case "sorcerer/wild_magic_sorcery/tamed_surge":
      return [wire(f, [rider(f.name, ["Wild Magic Surge"]), note(f.name, "Choose a permitted source-table outcome after a slot-powered Sorcerer spell.")], { ...free, requirements: [{ kind: "on_cast_spell" }] }, daily())]
    case "warlock/archfey_patron/steps_of_the_fey":
      return [spell(f, "Misty Step", { bonusAction: true }, { ...statUses("CHA"), useShareKey: "steps_of_the_fey" })]
    case "warlock/archfey_patron/misty_escape":
      return [spell(f, "Misty Step", { reaction: true }, { ...statUses("CHA"), useShareKey: "steps_of_the_fey" }),
        spell(child(f, "Misty Escape: Spell Slot"), "Misty Step", { reaction: true }, undefined, false)]
    case "warlock/archfey_patron/bewitching_magic":
      return [spell(f, "Misty Step", { ...free, requirements: [{ kind: "on_cast_spell" }] })]
    case "warlock/archfey_patron/beguiling_defenses":
    case "warlock/fiend_patron/hurl_through_hell":
    case "warlock/great_old_one_patron/clairvoyant_combatant":
      return [timing(f, id.includes("beguiling_defenses") ? { reaction: true } : free, { ...daily(), ...(id.includes("clairvoyant") ? { recharges: bothRests } : {}), restoreBySpellSlot: { minSpellLevel: 1, restores: 1, pactOnly: true } })]
    case "warlock/celestial_patron/searing_vengeance":
      return [timing(f, { ...free, requirements: [{ kind: "custom", text: "Before you or an ally within 60 feet makes a Death Saving Throw" }] }, daily())]
    case "warlock/fiend_patron/dark_one_s_own_luck":
      return [timing(f, free, statUses("CHA"))]
    case "warlock/great_old_one_patron/psychic_spells":
      return [wire(f, [rider(f.name, ["Spellcasting"]), note(f.name, "Warlock spell damage may become Psychic; Enchantment/Illusion Warlock spells omit verbal and somatic components.")])]
    case "warlock/great_old_one_patron/create_thrall":
      return [wire(f, [rider(f.name, ["Summon Aberration", "Hex"]), note(f.name, "Optional one-minute summon without Concentration; temporary HP = Warlock level + CHA and Hex damage rider. Still spends a spell slot.")])]
    case "wizard/diviner/portent":
      return [wire(f, [note(f.name, "Record foretelling d20s after Long Rest, choose before the target rolls, and cross off each result used.")], free, { type: "at_level", atLevelTable: [{ level: 3, count: 2 }, { level: 14, count: 3 }], recharges: [{ rest: "long_rest" }] })]
    case "wizard/abjurer/spell_breaker":
      return [wire(f, [known(f.name, ["Counterspell", "Dispel Magic"]), note(f.name, "Add proficiency to Dispel Magic checks; refund the slot if either spell fails to stop a spell."), fx(f.name, { kind: "cast_spell", castSpellName: "Dispel Magic", castSpellCastingTime: "bonus_action", castSpellWithoutSlot: false })], { bonusAction: true })]
    case "wizard/evoker/overchannel":
      return [wire(f, [rider(f.name, ["Spellcasting"]), note(f.name, "Maximize the damage of a qualifying Wizard spell. Track uses since Long Rest and apply increasing Necrotic self-damage on repeat uses; no school restriction.")], { ...free, requirements: [{ kind: "on_cast_spell" }] }, { type: "special", specialDescription: "First use safe; repeat uses cause increasing self-damage until Long Rest" })]
    case "wizard/diviner/greater_portent":
      return [wire(f, [rider(f.name, ["Portent"])])]
    case "wizard/illusionist/phantasmal_creatures":
      return [wire(f, [known(f.name, ["Summon Beast", "Summon Fey"]), note(f.name, "Each spell has its own free Illusion casting; halve the summoned creature's HP when using it.")]),
        ...["Summon Beast", "Summon Fey"].map((name) => spell(child(f, `Phantasmal ${name.slice(7)}`), name, { action: true }, daily()))]
    case "wizard/illusionist/illusory_self":
      return [wire(f, [note(f.name, "The triggering attack automatically misses; this is not Disadvantage.")], { reaction: true }, { ...daily(), recharges: bothRests, restoreBySpellSlot: { minSpellLevel: 2, restores: 1 } })]
    default: return [f]
  }
}

/** Scope transformations to their actual active state instead of permanent derived stats. */
export function gateCasterFeature(className: string, subclass: string, f: Feature): Feature {
  const gates: Record<string, [string, string[]]> = {
    "druid/circle_of_the_moon/circle_forms": ["Wild Shape", ["ac"]],
    "druid/circle_of_the_moon/improved_circle_forms": ["Wild Shape", ["check_roll_modifier"]],
    "druid/circle_of_the_sea/stormborn": ["Wrath of the Sea", ["speed", "damage_resistance"]],
    "druid/circle_of_the_stars/full_of_stars": ["Starry Form", ["damage_resistance"]],
    "druid/circle_of_the_stars/twinkling_constellations": ["Starry Dragon", ["speed"]],
    "paladin/oath_of_vengeance/avenging_angel": ["Avenging Angel", ["speed"]],
    "paladin/oath_of_glory/living_legend": ["Living Legend", ["check_roll_modifier", "failed_roll_trigger"]],
    "sorcerer/clockwork_sorcery/trance_of_order": ["Trance of Order", ["check_roll_modifier", "modify_creature"]],
  }
  const gate = gates[`${className}/${subclass}/${key(f.name)}`]
  if (!gate) return f
  const [name, types] = gate
  return { ...f, linkedModifiers: f.linkedModifiers?.map((m) => ({ ...m,
    characteristics: m.characteristics?.map((c) => types.includes(c.type) ? { ...c, requiresSheetToggle: undefined, limitations: state(name) } : c),
    activation: m.activation ? { ...m.activation, effects: m.activation.effects?.map((e) => types.includes(e.kind) ? { ...e, limitations: state(name) } : e) } : undefined,
  })) }
}
