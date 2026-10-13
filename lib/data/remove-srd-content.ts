import { createClient } from "@/lib/data/client"
import { COMPENDIUM_TABLES } from "@/lib/db/tables"
import { LEGACY_SRD_SOURCES, isSrdSource } from "@/lib/srd/source"
import { asCompendiumRows, type DataClient } from "@/lib/data/types"
import { setSrdContentRemoved } from "@/lib/site-settings/srd-content"
import { invalidateBuilderCompendiumCache } from "@/lib/data/builder-compendium-cache"

/** Remove only SRD creator rows; never clear characters or the modifier catalog. */
export async function removeSrdContent(client: DataClient = createClient()): Promise<void> {
  // Inspect dependencies before deleting: hosted class deletion cascades to its children.
  const classes = await client.from("classes").select("id").in("source", [...LEGACY_SRD_SOURCES])
  if (classes.error) throw new Error(classes.error.message)
  const ids = asCompendiumRows(classes.data).map((row) => row.id)
  const detach: unknown[] = []
  if (ids.length) {
    for (const table of ["subclasses", "class_resources"] as const) {
      const result = await client.from(table).select("*").in("class_id", ids)
      if (result.error) throw new Error(result.error.message)
      const custom = asCompendiumRows(result.data).filter((row) => !isSrdSource(row.source as string))
      if (table === "class_resources" && custom.length) {
        throw new Error("Move custom resources attached to SRD classes before removing SRD content.")
      }
      detach.push(...custom.map((row) => row.id))
    }
  }
  setSrdContentRemoved(true)
  try {
    if (detach.length) {
      const result = await client.from("subclasses").update({ class_id: null }).in("id", detach)
      if (result.error) throw new Error(result.error.message)
    }
    // Delete child rows first, classes last, using exact creator labels.
    for (const table of [...COMPENDIUM_TABLES.filter((table) => table !== "classes"), "classes"]) {
      const result = await client.from(table).delete().in("source", [...LEGACY_SRD_SOURCES])
      if (result.error) throw new Error(result.error.message)
    }
  } finally {
    invalidateBuilderCompendiumCache()
  }
}
