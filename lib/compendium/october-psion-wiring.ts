import type { Feature } from "@/lib/types"
import { bothRests, char, child, daily, free, fx, key, known, note, pool, rider, wire } from "./phb-subclass-wiring/helpers"

/** October/June playtest Psion archetypes; never supplies their copyrighted descriptions. */
export function wireOctoberPsionFeatures(features: Feature[], parent: string, subclass: string): Feature[] {
  if (!/^(?:kibbles\s*tasty\s+)?psion$/i.test(parent) || !["warped_mind", "illusive_mind"].includes(key(subclass))) return features
  const result = new Map<string, Feature>()
  for (const f of features) {
    const identity = `${f.level}:${key(f.name)}`
    if (result.has(identity)) continue
    let rows: Feature[] = [f]
    switch (key(f.name)) {
      case "metamorphic_mind":
        rows = [wire(f, [char(f.name, { type: "grant_custom_ability", abilityNames: ["Biokinesis Discipline"] }),
          char(f.name, { type: "weapon_ability_override", ability: "intelligence", appliesTo: "both", scope: "specific", weaponNames: ["Bone Spike", "Flesh Club", "Sinew Whip", "Viscera Cannon"] })])]; break
      case "psychic_manipulation":
        rows = [wire(f, [char(f.name, { type: "grant_custom_ability", abilityNames: ["Mesmerism Discipline"] })])]; break
      case "rapid_evolution":
        rows = [wire({ ...f, isChoice: false, choices: undefined }, [note(f.name, "Choose one adaptation. A qualifying Long Rest is free; this activation forces an adaptation for ten minutes. Track only the selected benefit.")], { action: true }, pool("psi_points"))]; break
      case "mutation_mastery":
        rows = [wire(f, [char(f.name, { type: "grant_custom_ability", abilityNames: ["Flexible Flesh"] }), rider(f.name, ["Weapon Morph", "Flesh Warp"])]),
          wire(child(f, "Psionic Regrowth"), [note("Psionic Regrowth", "Heal 1 HP per Psi Point actually spent; from Psion 10, roll 1d4 per point instead. Mastery/free augments do not trigger it. Do not pay again.")], free),
          wire(child(f, "Defensive Adaption"), [rider("Defensive Adaption", ["Flesh Warp"])], free)]; break
      case "voracious_absorbation":
        rows = [wire(f, [rider(f.name, ["Weapon Morph"]), note(f.name, "Record one absorbed magic bonus; replace the old value. Applies only to morphed weapons; destroy the eligible weapon during the Long Rest.")])]; break
      case "rapid_regeneration":
        rows = [wire(f, [rider(f.name, ["Psionic Regrowth"])]), wire(child(f, "Regrowth Recovery"), [fx("Regrowth Recovery", { kind: "heal_self", healTarget: "self", healMode: "dice", healDiceCount: 1, healDieType: "d4" })], { ...free, requirements: [{ kind: "custom", text: "At 0 HP after succeeding on your start-of-turn Death Saving Throw" }] }, pool("psi_points"))]; break
      case "abomination_unleashed":
        rows = [wire(f, [rider(f.name, ["Flesh Warp", "Weapon Morph"])], free, { ...daily(), recharges: bothRests })]; break
      case "influential_imagery":
        rows = [wire(f, [known(f.name, ["Minor Illusion"]), note(f.name, "Add INT only to the specified check using your distracting illusion; not permanent skill Expertise or a global check bonus.")])]; break
      case "reflected_agony":
        rows = [wire(f, [note(f.name, "Track one reflection per eligible target, duration and destruction. On your turn start it deals PB Psychic damage; no resource spend.")], free)]; break
      case "empowered_psionics":
        rows = [wire(f, [char(f.name, { type: "modify_custom_ability", abilityNames: [], abilityFilter: { role: "psionic_power", eligibleClassNames: ["Psion", "KibblesTasty Psion"] }, addendum: "Add your Intelligence modifier when this discipline power deals damage. Apply the bonus when the damage resolves, including delayed damage; it is not a bonus to ordinary weapon attacks." })])]; break
      case "illusory_armor":
        rows = [wire(f, [note(f.name, "One recipient at a time: AC floor 22 + your INT until hit. Each recipient can receive it once per Long Rest; track targets, not a caster daily-use pool.")], { action: true })]; break
      case "army_of_illusions":
        rows = [wire(f, [note(f.name, "Track selected doubles, their temporary attack benefits and 1d4 Psychic rider. Remove each when hit by a weapon attack or after one minute.")], { action: true }, daily())]; break
    }
    for (const row of rows) result.set(`${row.level}:${key(row.name)}`, row)
  }
  return [...result.values()]
}
