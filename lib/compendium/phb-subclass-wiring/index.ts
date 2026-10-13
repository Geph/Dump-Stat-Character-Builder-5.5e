import type { Feature } from "@/lib/types"
import { casterFeature, gateCasterFeature } from "./casters"
import { martialFeature } from "./martial"
import { key } from "./helpers"

const SUBCLASSES: Record<string, string[]> = {
  barbarian: ["Path of the Berserker", "Path of the Wild Heart", "Path of the World Tree", "Path of the Zealot"],
  bard: ["College of Dance", "College of Glamour", "College of Lore", "College of Valor"],
  cleric: ["Life Domain", "Light Domain", "Trickery Domain", "War Domain"],
  druid: ["Circle of the Land", "Circle of the Moon", "Circle of the Sea", "Circle of the Stars"],
  fighter: ["Battle Master", "Champion", "Eldritch Knight", "Psi Warrior"],
  monk: ["Warrior of Mercy", "Warrior of Shadow", "Warrior of the Elements", "Warrior of the Open Hand"],
  paladin: ["Oath of Devotion", "Oath of Glory", "Oath of the Ancients", "Oath of Vengeance"],
  ranger: ["Beast Master", "Fey Wanderer", "Gloom Stalker", "Hunter"],
  rogue: ["Arcane Trickster", "Assassin", "Soulknife", "Thief"],
  sorcerer: ["Aberrant Sorcery", "Clockwork Sorcery", "Draconic Sorcery", "Wild Magic Sorcery"],
  warlock: ["Archfey Patron", "Celestial Patron", "Fiend Patron", "Great Old One Patron"],
  wizard: ["Abjurer", "Diviner", "Evoker", "Illusionist"],
}

/** Import/compendium boundary only: generic sheet consumers receive ordinary catalog modifiers. */
export function wirePhbSubclassFeatures(features: Feature[], parent: string, subclass: string): Feature[] {
  const cls = key(parent), sub = key(subclass)
  if (!SUBCLASSES[cls]?.some((name) => key(name) === sub)) return features
  // Earlier progression starts and recognizable legacy signatures must remain separate.
  if (features.some((f) => f.level < 3) || !features.some((f) => f.level === 3)) return features
  const has = (name: string) => features.some((f) => key(f.name) === key(name))
  if (cls === "fighter" && sub === "eldritch_knight" && has("Weapon Bond") && !has("War Bond")) return features
  if (cls === "barbarian" && sub === "path_of_the_zealot" && has("Rage Beyond Death")) return features
  if (cls === "fighter" && sub === "champion" && features.some((f) => f.name === "Additional Fighting Style" && f.level === 10)) return features
  if (cls === "rogue" && sub === "soulknife" && features.some((f) => f.name === "Psychic Blades" && f.description && !/\bVex\b/i.test(f.description))) return features
  if (cls === "paladin" && features.some((f) => (key(f.name) === "sacred_weapon" && /as an action/i.test(f.description)) || (key(f.name) === "vow_of_enmity" && /as a bonus action/i.test(f.description)))) return features
  const result = new Map<string, Feature>()
  for (const f of features) {
    if (result.has(`${f.level}:${key(f.name)}`)) continue // generated action already replaced stale copy
    for (const martial of martialFeature(cls, sub, f)) {
      for (const caster of casterFeature(cls, sub, martial)) {
        result.set(`${caster.level}:${key(caster.name)}`, gateCasterFeature(cls, sub, caster))
      }
    }
  }
  return [...result.values()]
}
