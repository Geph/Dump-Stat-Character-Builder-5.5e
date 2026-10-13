/** Build-time presentation policy; gameplay and stored data remain identical. */
export function isCompactEdition(): boolean {
  return process.env.NEXT_PUBLIC_UI_EDITION === "compact"
}
