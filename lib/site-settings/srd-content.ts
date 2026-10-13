/** Explicit removal must survive automatic static seed/version refreshes. */
const SRD_REMOVED_KEY = "dump-stat.srd-content-removed"

export function isSrdContentRemoved(): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem(SRD_REMOVED_KEY) === "1"
}

export function setSrdContentRemoved(removed: boolean): void {
  if (typeof localStorage === "undefined") return
  if (removed) localStorage.setItem(SRD_REMOVED_KEY, "1")
  else localStorage.removeItem(SRD_REMOVED_KEY)
}
