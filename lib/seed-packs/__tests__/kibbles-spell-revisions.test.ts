import { describe, expect, it } from "vitest"
import pack from "@/lib/seed-packs/kibbles-tasty/kibbles-spells.json"
import { SpellImportSchema } from "@/lib/import/content-schema"
import { resolveSpellNamesToIds } from "@/lib/import/subclass-spell-table"
import { defaultSpellCardImageUrl } from "@/lib/compendium/spell-card-images-defaults"

const spells = pack.spells
const byName = new Map(spells.map((spell) => [spell.name, spell]))

describe("Kibbles bundled spell revisions", () => {
  it("loads complete schema-valid rows with unique current names", () => {
    expect(spells).toHaveLength(381)
    expect(byName.size).toBe(spells.length)
    for (const spell of spells) expect(SpellImportSchema.safeParse(spell).success, spell.name).toBe(true)
    for (const name of [
      "Dancing Object (Animate Object)", "Dancing Objects (Animate Object)",
      "Chromatic Breaths", "Divine Judgement", "Martial Steel Wind Strike",
      "Blood Explosion", "Transfuse Life",
    ]) expect(byName.has(name), name).toBe(false)
  })

  it("keeps Animate Objects grants separate from the second-level Dancing Object", () => {
    const catalog = [
      { id: "srd", name: "Animate Objects", source: "D&D 5.5e SRD" },
      ...spells.map((spell) => ({ ...spell, id: spell.name })),
    ]
    const { resolved, missing } = resolveSpellNamesToIds(
      ["Animate Objects", "Dancing Objects (Animate Object)", "Blood Explosion", "Transfuse Life"],
      catalog, "Kibbles Tasty",
    )
    expect(missing).toEqual([])
    expect(resolved.map((spell) => spell.spellId)).toEqual([
      "srd", "Dancing Object", "Corpse Explosion", "Blood Transfusion",
    ])
    expect(byName.get("Dancing Object")?.level).toBe(2)
    expect(defaultSpellCardImageUrl("Dancing Object", { requireAvailable: false })).toMatch(
      /\/dancing-object-animate-object\.png$/,
    )
  })

  it("uses the revised corpse save and Flickering Strikes weapon damage", () => {
    const corpse = byName.get("Corpse Explosion")!
    expect(corpse.level).toBe(3)
    expect(corpse.description).toMatch(/15 feet.*Dexterity saving throw/)
    expect(corpse.description).toMatch(/3d8 necrotic damage and 3d8 thunder damage/)
    expect(corpse.description).not.toMatch(/spell attack/)
    const strikes = byName.get("Flickering Strikes")!
    expect(strikes.level).toBe(5)
    expect(strikes.description).toContain("up to 5 targets")
    expect(strikes.description).toContain("6d6 force")
    expect(byName.get("Blood Transfusion")?.level).toBe(1)
  })

  it("includes all 54 October spell entries with playtest status and original credits", () => {
    const names = [
      "Avatar Slam", "Avatar Punch", "Avatar Slash", "Avatar Thrust", "Avatar Palm",
      "Bloated Bomb", "Bombard", "Boil", "Bone Spear", "Bone Spur", "Bouncing Wave",
      "Chaotic Bombardment", "Dirge of Discordant Disruption", "Divine Armor", "Despair Cascade",
      "Enforced Empathy", "Field of Rot", "Fleeting Image", "Fulminating Cascade", "Guardian Spirit",
      "Gravitronic Bolt", "Gravitational Slingshot", "Gravity Storm", "Gravity Lance", "Heavenly Ascent",
      "Healing Ray", "Hell Lash", "Lunar Wrath", "Mage Punch", "Mass Shove", "March of Lively Steps",
      "March of Meandering Marionettes", "Medusa's Sigh", "Melody of Restless Spirits", "Miasmic Bolt",
      "Orbital Storm", "Phantom Encore", "Phreatic Eruption", "Power Launch", "Punishing Bolt", "Ragdoll",
      "Raven's Wings", "Reality Refraction", "Resounding Roar", "Roiling Cloud", "Screaming Skull",
      "Scalding Burst", "Soul Hook", "Steam Explosion", "Steamblast", "Thunderbolt", "Time Keeper",
      "Twist Fortune", "Unstable Shield",
    ]
    expect(names).toHaveLength(54)
    for (const name of names) expect(byName.get(name)?.description, name).toContain("October 2026 playtest.")
    for (const name of ["Bone Spear", "Field of Rot", "Raven's Wings", "Screaming Skull", "Wall of Blood"]) {
      expect(byName.get(name)?.source, name).toBe("somanyrobots")
      expect(byName.get(name)?.creator_url, name).toContain("gmbinder.com")
    }
    // Blank class fields in the playtest are not invented general spell-list grants.
    expect(byName.get("Despair Cascade")?.classes).toEqual([])
    expect(byName.get("Reality Refraction")?.classes).toEqual([])
  })

  it("includes blood magic, crafting rituals and subclass-only Glyph spells", () => {
    for (const name of [
      "Blood Slash", "Blood Storm", "Hungry Blood", "Vampiric Brand", "Vampiric Mosquito",
      "Hemorrhaging Curse", "Wall of Blood",
      "Forge Fire", "Process Hide", "Change Material", "Conjure Tool", "Unseen Crafter",
      "Dimensional Toolbox", "Dimensional Workshop",
    ]) expect(byName.has(name), name).toBe(true)
    expect(byName.get("Forge Fire")?.casting_time).toContain("ritual")
    for (const name of ["Absorption", "Fire", "Frost", "Gravity", "Nullification", "Translocation"]) {
      expect(byName.get(`Glyph of ${name}`)?.classes, name).toEqual([])
    }
    expect(byName.has("Glyph of Force")).toBe(false)
  })
})
