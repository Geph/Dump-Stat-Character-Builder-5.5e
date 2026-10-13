import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CompactImage } from "../components/compact-image"
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : [path]
})
describe("compact UI art boundary", () => {
  it("contains no raster artwork or decorative SVG assets", () => {
    expect(walk("public").filter(p => !p.replaceAll("\\", "/").startsWith("public/icons/") && p.replaceAll("\\", "/") !== "public/icon.svg" && !p.includes("fonts"))).toEqual([])
  })
  it("never renders or requests imported, remote, or bundled portraits", () => {
    for (const src of ["https://example.com/art.png", "data:image/png;base64,test", "/images/hero.webp", "/evil/icons/a.svg?remote=true"]) {
      expect(renderToStaticMarkup(createElement(CompactImage, { src, alt: "Portrait" }))).toBe("")
    }
    expect(renderToStaticMarkup(createElement(CompactImage, { src: "/icons/sword.svg", alt: "Attack" }))).toContain("/icons/sword.svg")
  })
})
