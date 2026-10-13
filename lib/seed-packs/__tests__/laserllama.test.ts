import { describe, expect, it } from "vitest"
import { EXAMPLE_SEED_PACKS, isExampleSeedPackId } from "../pack-ids"

describe("bundled creator selection", () => {
  it("excludes user-import-only Laserllama content", () => {
    expect(isExampleSeedPackId("laserllama")).toBe(false)
    expect(EXAMPLE_SEED_PACKS.map(pack => pack.id)).toEqual(["kibbles-tasty", "mage-hand-press"])
  })
})
