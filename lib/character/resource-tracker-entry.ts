import type { UsesConfig } from "@/lib/types"

export type ResourceTrackerEntry = {
  id: string
  name: string
  uses: UsesConfig
  classLevel: number
  /** Owning class icon shown to the left of the resource name. */
  icon?: string | null
}
