import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DataClient } from "@/lib/data/types"
import { removeSrdContent } from "@/lib/data/remove-srd-content"
import { isSrdContentRemoved, setSrdContentRemoved } from "@/lib/site-settings/srd-content"

vi.mock("@/lib/data/client", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/data/builder-compendium-cache", () => ({ invalidateBuilderCompendiumCache: vi.fn() }))

type Row = Record<string, unknown>
function memoryClient(rows: Record<string, Row[]>, failTable?: string) {
  const writes: string[] = []
  const client = { from(table: string) {
    let mode = "select"
    let patch: Row = {}
    let matches = (_row: Row) => true
    const query = {
      select() { return query },
      delete() { mode = "delete"; return query },
      update(value: Row) { mode = "update"; patch = value; return query },
      in(column: string, values: unknown[]) { matches = (row: Row) => values.includes(row[column]); return query },
      then(resolve: (value: unknown) => unknown) {
        if (table === failTable) return Promise.resolve({ data: null, error: { message: "Store unavailable" } }).then(resolve)
        const selected = (rows[table] ?? []).filter(matches)
        if (mode !== "select") writes.push(table)
        if (mode === "delete") rows[table] = (rows[table] ?? []).filter((row) => !matches(row))
        if (mode === "update") selected.forEach((row) => Object.assign(row, patch))
        return Promise.resolve({ data: selected, error: null }).then(resolve)
      },
    }
    return query
  } } as unknown as DataClient
  return { client, writes }
}

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
})
afterEach(() => vi.unstubAllGlobals())

describe("SRD content removal", () => {
  it("removes both SRD source labels, preserves other creators and characters, and detaches custom subclasses", async () => {
    const rows = {
      classes: [{ id: "fighter", source: "D&D 5.5e SRD" }, { id: "alt", source: "Laserllama" }],
      subclasses: [{ id: "custom", class_id: "fighter", source: "Custom" }, { id: "champion", class_id: "fighter", source: "SRD" }],
      spells: [{ id: "srd", source: "SRD" }, { id: "custom", source: "Laserllama" }],
      characters: [{ id: "hero", class_id: "fighter" }],
    }
    const { client, writes } = memoryClient(rows)
    await removeSrdContent(client)
    expect(rows.classes.map((row) => row.id)).toEqual(["alt"])
    expect(rows.subclasses).toEqual([{ id: "custom", class_id: null, source: "Custom" }])
    expect(rows.spells.map((row) => row.id)).toEqual(["custom"])
    expect(rows.characters).toEqual([{ id: "hero", class_id: "fighter" }])
    expect(writes).not.toContain("characters")
    expect(writes.at(-1)).toBe("classes")
    expect(isSrdContentRemoved()).toBe(true)
    setSrdContentRemoved(false)
    expect(isSrdContentRemoved()).toBe(false)
  })
  it("stops before mutations when a custom resource would be cascade-deleted", async () => {
    const { client, writes } = memoryClient({ classes: [{ id: "fighter", source: "SRD" }], class_resources: [{ id: "custom", class_id: "fighter", source: "Custom" }] })
    await expect(removeSrdContent(client)).rejects.toThrow("Move custom resources")
    expect(writes).toEqual([])
    expect(isSrdContentRemoved()).toBe(false)
  })
  it("reports storage failure and retains the opt-out so a reload cannot silently reseed", async () => {
    const { client } = memoryClient({}, "spells")
    await expect(removeSrdContent(client)).rejects.toThrow("Store unavailable")
    expect(isSrdContentRemoved()).toBe(true)
  })
})
