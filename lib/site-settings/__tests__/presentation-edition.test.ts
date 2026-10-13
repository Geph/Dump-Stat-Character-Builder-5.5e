import { afterEach, describe, expect, it, vi } from "vitest"
import { getAppPresentationMode, areCompendiumImagesEnabled, areDecorativeBackgroundImagesEnabled, shouldAssignBundledCardArt, runWithBundledCardArtAssignment } from "../app-presentation-mode"
import { getBuilderLayout } from "../builder-layout"
afterEach(() => vi.unstubAllEnvs())
describe("compact edition boundary", () => {
  it("locks SSR and importing to compact even when a caller requests art", () => {
    vi.stubEnv("NEXT_PUBLIC_UI_EDITION", "compact")
    expect(getAppPresentationMode()).toBe("compact-only")
    expect(getBuilderLayout()).toBe("compact")
    expect(areCompendiumImagesEnabled()).toBe(false)
    expect(areDecorativeBackgroundImagesEnabled()).toBe(false)
    expect(runWithBundledCardArtAssignment(true, shouldAssignBundledCardArt)).toBe(false)
  })
})
