import {
  maybeFilterDefaultCardImageUrl,
  type DefaultCardImageAvailability,
} from "@/lib/compendium/available-card-art"
import { withBasePath } from "@/lib/config/deploy-mode"
import {
  isHostedDumpstatCardImageUrl,
  isBundledCompendiumCardImagePath,
  normalizeCardImageUrl,
} from "@/lib/compendium/card-image"
import { shouldAssignBundledCardArt } from "@/lib/site-settings/app-presentation-mode"

/**
 * Default card art for subclasses — files live under
 * `public/images/compendium/subclasses/{class-slug}/{subclass-slug}.png`
 * so same-named subclasses from different parent classes do not collide
 * (e.g. Artificer Reanimator vs Necromancer Reanimator).
 *
 * Masters live in origin folders under `scripts/subclass-card-sources`
 * (`PHB/Bard Dance.png`, `SRD/Cleric Life.png`, `kibbles/Psion Knowing.png`).
 * Output stays `{class-slug}/{subclass-slug}.png`.
 */

export function subclassClassSlug(className: string): string {
  return className
    .trim()
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/\s+/g, "-")
}

const subclassCardImage = (className: string, itemSlug: string) =>
  withBasePath(
    `/images/compendium/subclasses/${subclassClassSlug(className)}/${itemSlug}.png`,
  )

type SubclassCardImageEntry = {
  className: string
  name: string
  /** Filename slug under the class folder. */
  slug: string
  /** Folder under subclasses/; defaults to the slug of className. */
  imageClassName?: string
}

const SUBCLASS_CARD_IMAGE_ENTRIES: SubclassCardImageEntry[] = [
  // Original generated Alternate Ranger and Monk portraits.
  { className: "Alternate Barbarian", name: "Path of the Ancestors", slug: "path-of-the-ancestors" },
  { className: "Alternate Barbarian", name: "Path of the Beast Heart", slug: "path-of-the-beast-heart" },
  { className: "Alternate Barbarian", name: "Path of the Berserker", slug: "path-of-the-berserker" },
  { className: "Alternate Barbarian", name: "Path of Blood & Iron", slug: "path-of-blood-and-iron" },
  { className: "Alternate Barbarian", name: "Path of the Brute", slug: "path-of-the-brute" },
  { className: "Alternate Barbarian", name: "Path of the Champion", slug: "path-of-the-champion" },
  { className: "Alternate Barbarian", name: "Path of Elemental Chaos", slug: "path-of-elemental-chaos" },
  { className: "Alternate Barbarian", name: "Path of the Lycan", slug: "path-of-the-lycan" },
  { className: "Alternate Barbarian", name: "Path of Sorcery", slug: "path-of-sorcery" },
  { className: "Alternate Barbarian", name: "Path of the Zealot", slug: "path-of-the-zealot" },
  { className: "Alternate Barbarian", name: "Path of the Deep", slug: "path-of-the-deep" },
  { className: "Alternate Barbarian", name: "Path of the Favored", slug: "path-of-the-favored" },
  { className: "Alternate Barbarian", name: "Path of the Inferno", slug: "path-of-the-inferno" },
  { className: "Alternate Barbarian", name: "Path of the Mutant", slug: "path-of-the-mutant" },
  { className: "Alternate Barbarian", name: "Path of the Packleader", slug: "path-of-the-packleader" },
  { className: "Alternate Barbarian", name: "Path of the Reaver", slug: "path-of-the-reaver" },
  { className: "Alternate Barbarian", name: "Path of the Titan", slug: "path-of-the-titan" },
  { className: "Alternate Barbarian", name: "Path of the Warden", slug: "path-of-the-warden" },
  { className: "Alternate Barbarian", name: "Path of the Wyrmblood", slug: "path-of-the-wyrmblood" },
  { className: "Alternate Rogue", name: "Arcane Trickster", slug: "arcane-trickster" },
  { className: "Alternate Rogue", name: "Assassin", slug: "assassin" },
  { className: "Alternate Rogue", name: "Burglar", slug: "burglar" },
  { className: "Alternate Rogue", name: "Investigator", slug: "investigator" },
  { className: "Alternate Rogue", name: "Mastermind", slug: "mastermind" },
  { className: "Alternate Rogue", name: "Phantom", slug: "phantom" },
  { className: "Alternate Rogue", name: "Psiknife", slug: "psiknife" },
  { className: "Alternate Rogue", name: "Scout", slug: "scout" },
  { className: "Alternate Rogue", name: "Swashbuckler", slug: "swashbuckler" },
  { className: "Alternate Rogue", name: "Acrobat", slug: "acrobat" },
  { className: "Alternate Rogue", name: "Avenger", slug: "avenger" },
  { className: "Alternate Rogue", name: "Bloodknife", slug: "bloodknife" },
  { className: "Alternate Rogue", name: "Gambler", slug: "gambler" },
  { className: "Alternate Rogue", name: "Ruffian", slug: "ruffian" },
  { className: "Alternate Rogue", name: "Saboteur", slug: "saboteur" },
  { className: "Alternate Rogue", name: "Seeker", slug: "seeker" },
  { className: "Alternate Rogue", name: "Skinchanger", slug: "skinchanger" },
  { className: "Alternate Rogue", name: "Surgeon", slug: "surgeon" },
  { className: "Alternate Sorcerer", name: "Draconic Sorcery", slug: "draconic-sorcery" },
  { className: "Alternate Sorcerer", name: "Flame Sorcery", slug: "flame-sorcery" },
  { className: "Alternate Sorcerer", name: "Oceanic Sorcery", slug: "oceanic-sorcery" },
  { className: "Alternate Sorcerer", name: "Stone Sorcery", slug: "stone-sorcery" },
  { className: "Alternate Sorcerer", name: "Storm Sorcery", slug: "storm-sorcery" },
  { className: "Alternate Sorcerer", name: "Wild Sorcery", slug: "wild-sorcery" },
  { className: "Alternate Sorcerer", name: "Divine Sorcery", slug: "divine-sorcery" },
  { className: "Alternate Sorcerer", name: "Prime Sorcery", slug: "prime-sorcery" },
  { className: "Alternate Sorcerer", name: "Shadow Sorcery", slug: "shadow-sorcery" },
  { className: "Alternate Sorcerer", name: "Cosmic Sorcery", slug: "cosmic-sorcery" },
  { className: "Alternate Sorcerer", name: "Elder Sorcery", slug: "elder-sorcery" },
  { className: "Alternate Sorcerer", name: "Entropic Sorcery", slug: "entropic-sorcery" },
  { className: "Alternate Sorcerer", name: "Fey Sorcery", slug: "fey-sorcery" },
  { className: "Alternate Sorcerer", name: "Infernal Sorcery", slug: "infernal-sorcery" },
  { className: "Alternate Sorcerer", name: "Iron Sorcery", slug: "iron-sorcery" },
  { className: "Alternate Sorcerer", name: "Royal Sorcery", slug: "royal-sorcery" },
  { className: "Alternate Sorcerer", name: "Vampiric Sorcery", slug: "vampiric-sorcery" },
  { className: "Alternate Sorcerer", name: "Verdant Sorcery", slug: "verdant-sorcery" },
  { className: "Alternate Ranger", name: "Beast Master", slug: "beast-master" },
  { className: "Alternate Ranger", name: "Deep Stalker", slug: "deep-stalker" },
  { className: "Alternate Ranger", name: "Drake Guard", slug: "drake-guard" },
  { className: "Alternate Ranger", name: "Fey Wanderer", slug: "fey-wanderer" },
  { className: "Alternate Ranger", name: "Hunter", slug: "hunter" },
  { className: "Alternate Ranger", name: "Monster Slayer", slug: "monster-slayer" },
  { className: "Alternate Ranger", name: "Planar Warden", slug: "planar-warden" },
  { className: "Alternate Ranger", name: "Spellbreaker", slug: "spellbreaker" },
  { className: "Alternate Ranger", name: "Swarm Keeper", slug: "swarm-keeper" },
  { className: "Alternate Ranger", name: "Bounty Hunter", slug: "bounty-hunter" },
  { className: "Alternate Ranger", name: "Buccaneer", slug: "buccaneer" },
  { className: "Alternate Ranger", name: "Elder Haunt", slug: "elder-haunt" },
  { className: "Alternate Ranger", name: "Grim Warden", slug: "grim-warden" },
  { className: "Alternate Ranger", name: "Nomad", slug: "nomad" },
  { className: "Alternate Ranger", name: "Shifter", slug: "shifter" },
  { className: "Alternate Ranger", name: "Stargazer", slug: "stargazer" },
  { className: "Alternate Ranger", name: "Trapper", slug: "trapper" },
  { className: "Alternate Ranger", name: "Wastelander", slug: "wastelander" },
  { className: "Alternate Ranger", name: "Winter Wight", slug: "winter-wight" },
  { className: "Alternate Ranger", name: "Wrangler", slug: "wrangler" },
  { className: "Alternate Monk", name: "Way of the Astral Warrior", slug: "way-of-the-astral-warrior" },
  { className: "Alternate Monk", name: "Way of the Drunken Fist", slug: "way-of-the-drunken-fist" },
  { className: "Alternate Monk", name: "Way of Harmony", slug: "way-of-harmony" },
  { className: "Alternate Monk", name: "Way of the Open Hand", slug: "way-of-the-open-hand" },
  { className: "Alternate Monk", name: "Way of Radiance", slug: "way-of-radiance" },
  { className: "Alternate Monk", name: "Way of the Sacred Inks", slug: "way-of-the-sacred-inks" },
  { className: "Alternate Monk", name: "Way of the Reaper", slug: "way-of-the-reaper" },
  { className: "Alternate Monk", name: "Way of the Rising Dragon", slug: "way-of-the-rising-dragon" },
  { className: "Alternate Monk", name: "Way of the Shadow Arts", slug: "way-of-the-shadow-arts" },
  { className: "Alternate Monk", name: "Way of Shining Steel", slug: "way-of-shining-steel" },
  { className: "Alternate Monk", name: "Way of the Wu Jen", slug: "way-of-the-wu-jen" },
  { className: "Alternate Monk", name: "Way of the Boulder", slug: "way-of-the-boulder" },
  { className: "Alternate Monk", name: "Way of the Brawler", slug: "way-of-the-brawler" },
  { className: "Alternate Monk", name: "Way of Ferocity", slug: "way-of-ferocity" },
  { className: "Alternate Monk", name: "Way of the Flowing River", slug: "way-of-the-flowing-river" },
  { className: "Alternate Monk", name: "Way of the Hurricane", slug: "way-of-the-hurricane" },
  { className: "Alternate Monk", name: "Way of the Vigilante", slug: "way-of-the-vigilante" },
  { className: "Alternate Monk", name: "Way of the Void", slug: "way-of-the-void" },
  // Original generated Alternate Fighter portraits.
  { className: "Alternate Fighter", name: "Arcane Knight", slug: "arcane-knight" },
  { className: "Alternate Fighter", name: "Captain", slug: "captain" },
  { className: "Alternate Fighter", name: "Champion", slug: "champion" },
  { className: "Alternate Fighter", name: "Knight Errant", slug: "knight-errant" },
  { className: "Alternate Fighter", name: "Marksman", slug: "marksman" },
  { className: "Alternate Fighter", name: "Master at Arms", slug: "master-at-arms" },
  { className: "Alternate Fighter", name: "Ronin", slug: "ronin" },
  { className: "Alternate Fighter", name: "Runecarver", slug: "runecarver" },
  { className: "Alternate Fighter", name: "Shadowdancer", slug: "shadowdancer" },
  { className: "Alternate Fighter", name: "Sylvan Archer", slug: "sylvan-archer" },
  { className: "Alternate Fighter", name: "Crusader", slug: "crusader" },
  { className: "Alternate Fighter", name: "Guardian", slug: "guardian" },
  { className: "Alternate Fighter", name: "Guerrilla", slug: "guerrilla" },
  { className: "Alternate Fighter", name: "Hound Master", slug: "hound-master" },
  { className: "Alternate Fighter", name: "Pugilist", slug: "pugilist" },
  { className: "Alternate Fighter", name: "Quartermaster", slug: "quartermaster" },
  { className: "Alternate Fighter", name: "Swordsage", slug: "swordsage" },
  { className: "Alternate Fighter", name: "Tinker", slug: "tinker" },
  { className: "Alternate Fighter", name: "Witchblade", slug: "witchblade" },
  // SRD
  { className: "Barbarian", name: "Path of the Berserker", slug: "path-of-the-berserker" },
  { className: "Bard", name: "College of Lore", slug: "college-of-lore" },
  { className: "Cleric", name: "Life Domain", slug: "life-domain" },
  { className: "Druid", name: "Circle of the Land", slug: "circle-of-the-land" },
  { className: "Fighter", name: "Champion", slug: "champion" },
  { className: "Monk", name: "Warrior of the Open Hand", slug: "warrior-of-the-open-hand" },
  { className: "Paladin", name: "Oath of Devotion", slug: "oath-of-devotion" },
  { className: "Ranger", name: "Hunter", slug: "hunter" },
  { className: "Rogue", name: "Thief", slug: "thief" },
  { className: "Sorcerer", name: "Draconic Sorcery", slug: "draconic-sorcery" },
  { className: "Sorcerer", name: "Aberrant Sorcery", slug: "aberrant-sorcery" },
  { className: "Sorcerer", name: "Clockwork Sorcery", slug: "clockwork-sorcery" },
  { className: "Sorcerer", name: "Wild Magic Sorcery", slug: "wild-magic-sorcery" },
  { className: "Warlock", name: "Fiend Patron", slug: "fiend-patron" },
  { className: "Warlock", name: "Celestial Patron", slug: "celestial-patron" },
  { className: "Wizard", name: "Evoker", slug: "evoker" },

  // PHB
  { className: "Barbarian", name: "Path of the Wild Heart", slug: "path-of-the-wild-heart" },
  { className: "Barbarian", name: "Path of the World Tree", slug: "path-of-the-world-tree" },
  { className: "Barbarian", name: "Path of the Zealot", slug: "path-of-the-zealot" },
  { className: "Bard", name: "College of Dance", slug: "college-of-dance" },
  { className: "Bard", name: "College of Glamour", slug: "college-of-glamour" },
  { className: "Bard", name: "College of Valor", slug: "college-of-valor" },
  { className: "Cleric", name: "Light Domain", slug: "light-domain" },
  { className: "Cleric", name: "Trickery Domain", slug: "trickery-domain" },
  { className: "Cleric", name: "Trickster Domain", slug: "trickery-domain" },
  { className: "Cleric", name: "War Domain", slug: "war-domain" },
  { className: "Druid", name: "Circle of the Moon", slug: "circle-of-the-moon" },
  { className: "Druid", name: "Circle of the Sea", slug: "circle-of-the-sea" },
  { className: "Druid", name: "Circle of the Stars", slug: "circle-of-the-stars" },
  { className: "Fighter", name: "Battle Master", slug: "battle-master" },
  { className: "Fighter", name: "Eldritch Knight", slug: "eldritch-knight" },
  { className: "Fighter", name: "Psi Warrior", slug: "psi-warrior" },
  { className: "Monk", name: "Warrior of the Elements", slug: "warrior-of-the-elements" },
  { className: "Monk", name: "Warrior of Mercy", slug: "warrior-of-mercy" },
  { className: "Monk", name: "Warrior of Shadow", slug: "warrior-of-shadow" },
  { className: "Paladin", name: "Oath of the Ancients", slug: "oath-of-the-ancients" },
  { className: "Paladin", name: "Oath of Glory", slug: "oath-of-glory" },
  { className: "Paladin", name: "Oath of Vengeance", slug: "oath-of-vengeance" },
  { className: "Ranger", name: "Beast Master", slug: "beast-master" },
  { className: "Ranger", name: "Beastmaster", slug: "beast-master" },
  { className: "Ranger", name: "Fey Wanderer", slug: "fey-wanderer" },
  { className: "Ranger", name: "Gloom Stalker", slug: "gloom-stalker" },
  { className: "Rogue", name: "Assassin", slug: "assassin" },
  { className: "Rogue", name: "Arcane Trickster", slug: "arcane-trickster" },
  { className: "Rogue", name: "Soulknife", slug: "soulknife" },
  { className: "Rogue", name: "Soul Knife", slug: "soulknife" },

  // Heroes of Faerûn
  { className: "Bard", name: "College of the Moon", slug: "college-of-the-moon" },
  { className: "Cleric", name: "Knowledge Domain", slug: "knowledge-domain" },
  { className: "Fighter", name: "Banneret", slug: "banneret" },
  { className: "Paladin", name: "Oath of the Noble Genies", slug: "oath-of-the-noble-genies" },
  { className: "Ranger", name: "Winter Walker", slug: "winter-walker" },
  { className: "Rogue", name: "Scion of the Three", slug: "scion-of-the-three" },
  { className: "Sorcerer", name: "Spellfire Sorcery", slug: "spellfire-sorcery" },
  { className: "Wizard", name: "Bladesinging", slug: "bladesinging" },
  { className: "Wizard", name: "Bladesinger", slug: "bladesinging" },

  // Eberron
  { className: "Artificer", name: "Alchemist", slug: "alchemist" },
  { className: "Artificer", name: "Armorer", slug: "armorer" },
  { className: "Artificer", name: "Artillerist", slug: "artillerist" },
  { className: "Artificer", name: "Battle Smith", slug: "battle-smith" },
  { className: "Artificer", name: "Cartographer", slug: "cartographer" },
  { className: "Artificer", name: "Forge Adept", slug: "forge-adept" },
  { className: "Artificer", name: "Maverick", slug: "maverick" },
  { className: "Bard", name: "Dirge Singer", slug: "dirge-singer" },
  { className: "Cleric", name: "Mind Domain", slug: "mind-domain" },
  { className: "Druid", name: "Circle of the Forged", slug: "circle-of-the-forged" },
  { className: "Monk", name: "Warrior of the Living Weapon", slug: "warrior-of-the-living-weapon" },
  { className: "Monk", name: "Living Weapon", slug: "warrior-of-the-living-weapon" },

  // Arcana Unleashed
  { className: "Cleric", name: "Arcana Domain", slug: "arcana-domain" },
  { className: "Fighter", name: "Arcane Archer", slug: "arcane-archer" },
  { className: "Monk", name: "Mystic Arts", slug: "mystic-arts" },
  { className: "Monk", name: "Way of the Mystic Arts", slug: "mystic-arts" },
  { className: "Warlock", name: "Vestige Patron", slug: "vestige-patron" },
  { className: "Wizard", name: "Abjurer", slug: "abjurer" },
  { className: "Wizard", name: "Conjurer", slug: "conjurer" },
  { className: "Wizard", name: "Diviner", slug: "diviner" },
  { className: "Wizard", name: "Enchanter", slug: "enchanter" },
  { className: "Wizard", name: "Illusionist", slug: "illusionist" },
  { className: "Wizard", name: "Necromancer", slug: "necromancer" },
  { className: "Wizard", name: "Transmuter", slug: "transmuter" },

  // PHB patrons / schools (remaining)
  { className: "Warlock", name: "Archfey Patron", slug: "archfey-patron" },
  { className: "Warlock", name: "Arch Fey Patron", slug: "archfey-patron" },
  { className: "Warlock", name: "Great Old One Patron", slug: "great-old-one-patron" },

  // Ravenloft
  { className: "Artificer", name: "Reanimator", slug: "reanimator" },
  { className: "Bard", name: "College of Spirits", slug: "college-of-spirits" },
  { className: "Cleric", name: "Grave Domain", slug: "grave-domain" },
  { className: "Ranger", name: "Warden", slug: "warden" },
  { className: "Ranger", name: "Hollow Warden", slug: "warden" },
  { className: "Rogue", name: "Phantom", slug: "phantom" },
  { className: "Sorcerer", name: "Shadow Sorcery", slug: "shadow-sorcery" },
  { className: "Warlock", name: "Undead Patron", slug: "undead-patron" },

  // KibblesTasty Inventor
  { className: "Inventor", name: "Cursesmith", slug: "cursesmith" },
  { className: "Inventor", name: "Fleshsmith", slug: "fleshsmith" },
  { className: "Inventor", name: "Gadgetsmith", slug: "gadgetsmith" },
  { className: "Inventor", name: "Golemsmith", slug: "golemsmith" },
  { className: "Inventor", name: "Infusionsmith", slug: "infusionsmith" },
  { className: "Inventor", name: "Potionsmith", slug: "potionsmith" },
  { className: "Inventor", name: "Relicsmith", slug: "relicsmith" },
  { className: "Inventor", name: "Runesmith", slug: "runesmith" },
  { className: "Inventor", name: "Thundersmith", slug: "thundersmith" },
  { className: "Inventor", name: "Warsmith", slug: "warsmith" },

  // KibblesTasty Psion
  { className: "Psion", name: "Awakened Mind", slug: "awakened-mind" },
  { className: "Psion", name: "Consuming Mind", slug: "consuming-mind" },
  { className: "Psion", name: "Elemental Mind", slug: "elemental-mind" },
  { className: "Psion", name: "Knowing Mind", slug: "knowing-mind" },
  { className: "Psion", name: "Shaper's Mind", slug: "shapers-mind" },
  { className: "Psion", name: "Shaper’s Mind", slug: "shapers-mind" },
  { className: "Psion", name: "Transcended Mind", slug: "transcended-mind" },
  { className: "Psion", name: "Unleashed Mind", slug: "unleashed-mind" },
  { className: "Psion", name: "Wandering Mind", slug: "wandering-mind" },

  // KibblesTasty extras
  { className: "Rogue", name: "Gadgeteer", slug: "gadgeteer" },

  // KibblesTasty Occultist
  { className: "Occultist", name: "Hedge Mage", slug: "hedge-mage" },
  { className: "Occultist", name: "Oracle", slug: "oracle" },
  { className: "Occultist", name: "Shaman", slug: "shaman" },
  { className: "Occultist", name: "Spiritualist", slug: "spiritualist" },
  { className: "Occultist", name: "Voidwatcher", slug: "voidwatcher" },
  { className: "Occultist", name: "Witch", slug: "witch" },

  // KibblesTasty Warden
  { className: "Warden", name: "Astral Guardian", slug: "astral-guardian" },
  { className: "Warden", name: "Beasthide", slug: "beasthide" },
  { className: "Warden", name: "Bone Binder", slug: "bone-binder" },
  { className: "Warden", name: "Dreadwing", slug: "dreadwing" },
  { className: "Warden", name: "Dread Wing", slug: "dreadwing" },
  { className: "Warden", name: "Elderheart", slug: "elderheart" },
  { className: "Warden", name: "Elemental Soul", slug: "elemental-soul" },
  { className: "Warden", name: "Gravity Binder", slug: "gravity-binder" },
  { className: "Warden", name: "Ironbound", slug: "ironbound" },
  { className: "Warden", name: "Stoneblood", slug: "stoneblood" },
  { className: "Warden", name: "Sunwatcher", slug: "sunwatcher" },
  { className: "Warden", name: "Timetwister", slug: "timetwister" },
  { className: "Warden", name: "Time Twister", slug: "timetwister" },

  // Mage Hand Press Alchemist (free subclasses ship; others local-only)
  { className: "Alchemist", name: "Amorist", slug: "amorist" },
  { className: "Alchemist", name: "Apothecary", slug: "apothecary" },
  { className: "Alchemist", name: "Dynamo Engineer", slug: "dynamo-engineer" },
  { className: "Alchemist", name: "Mad Bomber", slug: "mad-bomber" },
  { className: "Alchemist", name: "Mutagenist", slug: "mutagenist" },
  { className: "Alchemist", name: "Ooze Rancher", slug: "ooze-rancher" },
  { className: "Alchemist", name: "Slime Rancher", slug: "ooze-rancher" },
  { className: "Alchemist", name: "Venomsmith", slug: "venomsmith" },
  { className: "Alchemist", name: "Xenoalchemist", slug: "xenoalchemist" },

  // Mage Hand Press Dancer (free: Acrobat / Courtesan / Fencer ship)
  { className: "Dancer", name: "Acrobat", slug: "acrobat" },
  { className: "Dancer", name: "Cheerleader", slug: "cheerleader" },
  { className: "Dancer", name: "Contortionist", slug: "contortionist" },
  { className: "Dancer", name: "Courtesan", slug: "courtesan" },
  { className: "Dancer", name: "Danseur Macabre", slug: "danseur-macabre" },
  { className: "Dancer", name: "Dramaturge", slug: "dramaturge" },
  { className: "Dancer", name: "Fencer", slug: "fencer" },
  { className: "Dancer", name: "Fey Ballerina", slug: "fey-ballerina" },
  { className: "Dancer", name: "Fire Dancer", slug: "fire-dancer" },
  { className: "Dancer", name: "Harlequin", slug: "harlequin" },
  { className: "Dancer", name: "Marionettist", slug: "marionettist" },
  { className: "Dancer", name: "Mime", slug: "mime" },
  { className: "Dancer", name: "Moonwalker", slug: "moonwalker" },
  { className: "Dancer", name: "Shadow Dancer", slug: "shadow-dancer" },
  { className: "Dancer", name: "Steelsinger", slug: "steelsinger" },

  // Mage Hand Press Captain (free: Lion / Jolly Roger / Eagle Banner ship)
  { className: "Captain", name: "Daggermark", slug: "daggermark" },
  { className: "Captain", name: "Dragon Banner", slug: "dragon-banner" },
  { className: "Captain", name: "Eagle Banner", slug: "eagle-banner" },
  { className: "Captain", name: "Holy Icon", slug: "holy-icon" },
  { className: "Captain", name: "Jolly Roger", slug: "jolly-roger" },
  { className: "Captain", name: "Lion Banner", slug: "lion-banner" },
  { className: "Captain", name: "Tower Banner", slug: "tower-banner" },

  // Mage Hand Press Warmage (free houses ship; Cards / Dice / Darts local-only)
  { className: "Warmage", name: "House of Bishops", slug: "house-of-bishops" },
  { className: "Warmage", name: "House of Cards", slug: "house-of-cards" },
  { className: "Warmage", name: "House of Darts", slug: "house-of-darts" },
  { className: "Warmage", name: "House of Dice", slug: "house-of-dice" },
  { className: "Warmage", name: "House of Kings", slug: "house-of-kings" },
  { className: "Warmage", name: "House of Knights", slug: "house-of-knights" },
  { className: "Warmage", name: "House of Pawns", slug: "house-of-pawns" },
  { className: "Warmage", name: "House of Rooks", slug: "house-of-rooks" },

  // Mage Hand Press Craftsman (free guilds ship)
  { className: "Craftsman", name: "Arcane Maesters' Guild", slug: "arcane-maesters-guild" },
  { className: "Craftsman", name: "Armigers' Guild", slug: "armigers-guild" },
  { className: "Craftsman", name: "Bladeworkers' Guild", slug: "bladeworkers-guild" },
  { className: "Craftsman", name: "Calibarons' Guild", slug: "calibarons-guild" },
  { className: "Craftsman", name: "Forgeknights' Guild", slug: "forgeknights-guild" },
  { className: "Craftsman", name: "Mechanauts' Guild", slug: "mechanauts-guild" },
  { className: "Craftsman", name: "Thunderlords' Guild", slug: "thunderlords-guild" },
  { className: "Craftsman", name: "Trappers' Guild", slug: "trappers-guild" },

  // Mage Hand Press Gunslinger (free: Pistolero / Gun Tank / Deadeye ship)
  { className: "Gunslinger", name: "Deadeye", slug: "deadeye" },
  { className: "Gunslinger", name: "Gun Ko Master", slug: "gun-ko-master" },
  { className: "Gunslinger", name: "Gun-Ko Master", slug: "gun-ko-master" },
  { className: "Gunslinger", name: "Gun Tank", slug: "gun-tank" },
  { className: "Gunslinger", name: "High Roller", slug: "high-roller" },
  { className: "Gunslinger", name: "Musketeer", slug: "musketeer" },
  { className: "Gunslinger", name: "Pistolero", slug: "pistolero" },
  { className: "Gunslinger", name: "Spellslinger", slug: "spellslinger" },
  { className: "Gunslinger", name: "Trick Shot", slug: "trick-shot" },
  { className: "Gunslinger", name: "White Hat", slug: "white-hat" },

  // Mage Hand Press Investigator (free: Occultist / Exterminator / Detective ship)
  { className: "Investigator", name: "Antiquarian", slug: "antiquarian" },
  { className: "Investigator", name: "Archivist", slug: "archivist" },
  { className: "Investigator", name: "Detective", slug: "detective" },
  { className: "Investigator", name: "Exterminator", slug: "exterminator" },
  { className: "Investigator", name: "Inquisitor", slug: "inquisitor" },
  { className: "Investigator", name: "Medium", slug: "medium" },
  { className: "Investigator", name: "Occultist", slug: "occultist" },
  { className: "Investigator", name: "Spy", slug: "spy" },

  // Mage Hand Press Martyr (free burdens ship)
  { className: "Martyr", name: "Burden of Atonement", slug: "burden-of-atonement" },
  { className: "Martyr", name: "Burden of Discord", slug: "burden-of-discord" },
  { className: "Martyr", name: "Burden of Mercy", slug: "burden-of-mercy" },
  { className: "Martyr", name: "Burden of Rebirth", slug: "burden-of-rebirth" },
  { className: "Martyr", name: "Burden of Revolution", slug: "burden-of-revolution" },
  { className: "Martyr", name: "Burden of the End", slug: "burden-of-the-end" },
  { className: "Martyr", name: "Burden of Truth", slug: "burden-of-truth" },
  { className: "Martyr", name: "Burden of Tyranny", slug: "burden-of-tyranny" },

  // Mage Hand Press Vagabond (free: Ronin / Mage Brand / Houndmaster ship)
  { className: "Vagabond", name: "Adrenaline Junkie", slug: "adrenaline-junkie" },
  { className: "Vagabond", name: "Brigand", slug: "brigand" },
  { className: "Vagabond", name: "Experiment X", slug: "experiment-x" },
  { className: "Vagabond", name: "Feylost", slug: "feylost" },
  { className: "Vagabond", name: "Gourmand", slug: "gourmand" },
  { className: "Vagabond", name: "Houndmaster", slug: "houndmaster" },
  { className: "Vagabond", name: "Knight Errant", slug: "knight-errant" },
  { className: "Vagabond", name: "Mage Brand", slug: "mage-brand" },
  { className: "Vagabond", name: "Plague Doctor", slug: "plague-doctor" },
  { className: "Vagabond", name: "Pugilist", slug: "pugilist" },
  { className: "Vagabond", name: "Ronin", slug: "ronin" },
  { className: "Vagabond", name: "Rōnin", slug: "ronin" },
  { className: "Vagabond", name: "Troubadour", slug: "troubadour" },

  // Mage Hand Press Witch (free colors ship)
  { className: "Witch", name: "Black Magic", slug: "black-magic" },
  { className: "Witch", name: "Blood Magic", slug: "blood-magic" },
  { className: "Witch", name: "Green Magic", slug: "green-magic" },
  { className: "Witch", name: "Purple Magic", slug: "purple-magic" },
  { className: "Witch", name: "Red Magic", slug: "red-magic" },
  { className: "Witch", name: "Steel Magic", slug: "steel-magic" },
  { className: "Witch", name: "Tea Magic", slug: "tea-magic" },
  { className: "Witch", name: "Technicolor Magic", slug: "technicolor-magic" },
  { className: "Witch", name: "White Magic", slug: "white-magic" },

  // Mage Hand Press Necromancer (free ship except Cyberghoul — no art yet)
  { className: "Necromancer", name: "Blood Ascendant", slug: "blood-ascendant" },
  { className: "Necromancer", name: "Death Knight", slug: "death-knight" },
  { className: "Necromancer", name: "Overlord", slug: "overlord" },
  { className: "Necromancer", name: "Pale Master", slug: "pale-master" },
  { className: "Necromancer", name: "Pharaoh", slug: "pharaoh" },
  { className: "Necromancer", name: "Plague Lord", slug: "plague-lord" },
  { className: "Necromancer", name: "Reanimator", slug: "reanimator" },
  { className: "Necromancer", name: "Reaper", slug: "reaper" },

  // Mage Hand Press Warden (free: Verdant / Grey Watchman / Beastblood ship)
  { className: "Warden", name: "Beastblood Guardian", slug: "beastblood-guardian" },
  { className: "Warden", name: "Drake-blooded", slug: "drake-blooded" },
  { className: "Warden", name: "Godsworn", slug: "godsworn" },
  { className: "Warden", name: "Gray Watchman", slug: "grey-watchman" },
  { className: "Warden", name: "Grey Watchman", slug: "grey-watchman" },
  { className: "Warden", name: "Nightgaunt", slug: "nightgaunt" },
  { className: "Warden", name: "Stoneheart", slug: "stoneheart-defender" },
  { className: "Warden", name: "Stoneheart Defender", slug: "stoneheart-defender" },
  { className: "Warden", name: "Storm Sentinel", slug: "storm-sentinel" },
  { className: "Warden", name: "Verdant Protector", slug: "verdant-protector" },
  {
    className: "Warden (Mage Hand Press)",
    name: "Beastblood Guardian",
    slug: "beastblood-guardian",
    imageClassName: "Warden",
  },
  {
    className: "Warden (Mage Hand Press)",
    name: "Drake-blooded",
    slug: "drake-blooded",
    imageClassName: "Warden",
  },
  {
    className: "Warden (Mage Hand Press)",
    name: "Godsworn",
    slug: "godsworn",
    imageClassName: "Warden",
  },
  {
    className: "Warden (Mage Hand Press)",
    name: "Gray Watchman",
    slug: "grey-watchman",
    imageClassName: "Warden",
  },
  {
    className: "Warden (Mage Hand Press)",
    name: "Grey Watchman",
    slug: "grey-watchman",
    imageClassName: "Warden",
  },
  {
    className: "Warden (Mage Hand Press)",
    name: "Nightgaunt",
    slug: "nightgaunt",
    imageClassName: "Warden",
  },
  {
    className: "Warden (Mage Hand Press)",
    name: "Stoneheart",
    slug: "stoneheart-defender",
    imageClassName: "Warden",
  },
  {
    className: "Warden (Mage Hand Press)",
    name: "Stoneheart Defender",
    slug: "stoneheart-defender",
    imageClassName: "Warden",
  },
  {
    className: "Warden (Mage Hand Press)",
    name: "Storm Sentinel",
    slug: "storm-sentinel",
    imageClassName: "Warden",
  },
  {
    className: "Warden (Mage Hand Press)",
    name: "Verdant Protector",
    slug: "verdant-protector",
    imageClassName: "Warden",
  },
]

export function subclassCardImageLookupKey(className: string, subclassName: string): string {
  return `${className.trim()}::${subclassName.trim()}`
}

/**
 * Seed/import may rename colliding classes (`Warden (Kibbles Tasty)`).
 * Mage Hand Press Warden must not receive Kibbles bond art.
 */
export function subclassCardParentClassMatches(actual: string, mapped: string): boolean {
  const a = actual.trim()
  const m = mapped.trim()
  if (!a || !m) return false
  if (a.toLowerCase() === m.toLowerCase()) return true
  // Alternate classes are separate publications, not decorated aliases of the SRD class.
  if (/^alternate\s/i.test(a) !== /^alternate\s/i.test(m)) return false
  if (/\bwarden\b/i.test(m) && /\bmage\s*hand|\bmhp\b/i.test(a)) return false
  if (/\bwarden\b/i.test(a) && /\bmage\s*hand|\bmhp\b/i.test(m)) return false
  const an = a.toLowerCase()
  const mn = m.toLowerCase()
  if (an.startsWith(`${mn} (`) || an.startsWith(`${mn} `)) return true
  if (mn.startsWith(`${an} (`) || mn.startsWith(`${an} `)) return true
  if (an.endsWith(` ${mn}`) || mn.endsWith(` ${an}`)) return true
  return false
}

/** Keyed `ClassName::SubclassName` → bundled URL. */
export const SUBCLASS_CARD_IMAGES_BY_CLASS_AND_NAME: Record<string, string> = Object.fromEntries(
  SUBCLASS_CARD_IMAGE_ENTRIES.map((entry) => [
    subclassCardImageLookupKey(entry.className, entry.name),
    subclassCardImage(entry.imageClassName ?? entry.className, entry.slug),
  ]),
)

/**
 * Name-only map for unique subclass names (legacy / tests).
 * Ambiguous names like Reanimator are omitted — use class-aware lookup.
 */
export const SRD_SUBCLASS_CARD_IMAGES_BY_NAME: Record<string, string> = (() => {
  const byName = new Map<string, string[]>()
  for (const entry of SUBCLASS_CARD_IMAGE_ENTRIES) {
    const url = subclassCardImage(entry.className, entry.slug)
    const list = byName.get(entry.name) ?? []
    if (!list.includes(url)) list.push(url)
    byName.set(entry.name, list)
  }
  const unique: Record<string, string> = {}
  for (const [name, urls] of byName) {
    if (urls.length === 1) unique[name] = urls[0]!
  }
  return unique
})()

export function defaultSubclassCardImageUrl(
  subclassName: string,
  className?: string | null,
  options?: DefaultCardImageAvailability,
): string | null {
  const trimmed = subclassName.trim()
  if (!trimmed) return null

  let resolved: string | null = null
  const cls = className?.trim()
  if (cls) {
    const lowerKey = subclassCardImageLookupKey(cls, trimmed).toLowerCase()
    for (const [key, url] of Object.entries(SUBCLASS_CARD_IMAGES_BY_CLASS_AND_NAME)) {
      if (key.toLowerCase() === lowerKey) {
        resolved = url
        break
      }
    }
    if (!resolved) {
      const lowerName = trimmed.toLowerCase()
      for (const [key, url] of Object.entries(SUBCLASS_CARD_IMAGES_BY_CLASS_AND_NAME)) {
        const sep = key.indexOf("::")
        if (sep < 0) continue
        const mappedClass = key.slice(0, sep)
        const mappedName = key.slice(sep + 2)
        if (mappedName.toLowerCase() === lowerName && subclassCardParentClassMatches(cls, mappedClass)) {
          resolved = url
          break
        }
      }
    }
  } else {
    resolved = SRD_SUBCLASS_CARD_IMAGES_BY_NAME[trimmed] ?? null
  }

  return maybeFilterDefaultCardImageUrl(resolved, options?.requireAvailable !== false)
}

function isUpgradeableDefaultCardImage(url: string): boolean {
  return isBundledCompendiumCardImagePath(url) || isHostedDumpstatCardImageUrl(url)
}

/** Apply bundled subclass card art using parent class + name (avoids cross-class collisions). */
export function applyBundledSubclassCardImage(
  row: Record<string, unknown>,
  parentClassName: string,
): Record<string, unknown> {
  const existing = normalizeCardImageUrl(row.card_image_url)
  if (!shouldAssignBundledCardArt()) {
    if (existing && isUpgradeableDefaultCardImage(existing)) {
      return { ...row, card_image_url: null }
    }
    return existing ? { ...row, card_image_url: existing } : row
  }

  const card_image_url = defaultSubclassCardImageUrl(String(row.name ?? ""), parentClassName)
  if (existing && !isUpgradeableDefaultCardImage(existing)) {
    return { ...row, card_image_url: existing }
  }
  if (card_image_url) return { ...row, card_image_url }
  if (existing && isHostedDumpstatCardImageUrl(existing)) {
    return { ...row, card_image_url: null }
  }
  // Clear stale flat bundled paths that no longer match this class (e.g. wrong Reanimator).
  if (existing && isBundledCompendiumCardImagePath(existing)) {
    return { ...row, card_image_url: null }
  }
  return existing ? { ...row, card_image_url: existing } : row
}

/** Relative paths under subclasses/ for every mapped image (for migrate/optimize tests). */
export function listSubclassCardImageRelativePaths(): string[] {
  return [
    ...new Set(
      SUBCLASS_CARD_IMAGE_ENTRIES.map(
        (entry) => `${subclassClassSlug(entry.imageClassName ?? entry.className)}/${entry.slug}.png`,
      ),
    ),
  ].sort()
}

/** Pre-nesting bundled URL: `/images/compendium/subclasses/{slug}.png` (no class folder). */
export function isLegacyFlatSubclassCardImagePath(url: string): boolean {
  return /\/images\/compendium\/subclasses\/[^/]+\.png$/i.test(url.trim())
}

/**
 * First PHB drop used the filename remainder as the output slug (`cleric/light.png`).
 * Canonical files now use the full display-name slug (`cleric/light-domain.png`).
 */
const SHORT_NESTED_SUBCLASS_SLUG_ALIASES: Record<string, string> = {
  "cleric/arcana": "cleric/arcana-domain",
  "cleric/grave": "cleric/grave-domain",
  "cleric/knowledge": "cleric/knowledge-domain",
  "cleric/light": "cleric/light-domain",
  "cleric/mind": "cleric/mind-domain",
  "cleric/trickery": "cleric/trickery-domain",
  "cleric/trickster": "cleric/trickery-domain",
  "cleric/war": "cleric/war-domain",
  "druid/forged": "druid/circle-of-the-forged",
  "druid/moon": "druid/circle-of-the-moon",
  "druid/sea": "druid/circle-of-the-sea",
  "druid/stars": "druid/circle-of-the-stars",
}

/**
 * Rewrite stale flat subclass card URLs to `{class}/{slug}` paths after the nesting migration.
 * Returns null when the flat file no longer exists and no nested mapping is known.
 */
export function rewriteLegacyFlatSubclassCardImageUrl(
  url: string | null | undefined,
  subclassName?: string | null,
  className?: string | null,
): string | null {
  const existing = normalizeCardImageUrl(url)
  if (!existing) return null

  const nested = existing.match(/\/images\/compendium\/subclasses\/([^/]+\/[^/]+)\.png$/i)
  const nestedAlias = nested?.[1] ? SHORT_NESTED_SUBCLASS_SLUG_ALIASES[nested[1].toLowerCase()] : null
  if (nestedAlias) {
    return withBasePath(`/images/compendium/subclasses/${nestedAlias}.png`)
  }

  if (!isLegacyFlatSubclassCardImagePath(existing)) return existing

  const fromClass = defaultSubclassCardImageUrl(String(subclassName ?? ""), className)
  if (fromClass) return fromClass

  const fromNameOnly = defaultSubclassCardImageUrl(String(subclassName ?? ""))
  if (fromNameOnly) return fromNameOnly

  const match = existing.match(/\/images\/compendium\/subclasses\/([^/]+)\.png$/i)
  const slug = match?.[1]?.toLowerCase()
  if (!slug) return null
  for (const entry of SUBCLASS_CARD_IMAGE_ENTRIES) {
    if (entry.slug === slug) return subclassCardImage(entry.className, entry.slug)
  }
  return null
}
