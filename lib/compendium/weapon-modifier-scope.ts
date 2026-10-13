import { propertiesToStringArray } from "@/lib/compendium/equipment-properties"

/** Match excluded properties without depending on combat aggregation. */
export function hasExcludedWeaponProperty(
  weapon: { properties?: unknown },
  excluded: readonly string[] | undefined,
): boolean {
  return (excluded ?? []).some((property) => propertiesToStringArray(weapon.properties).some((tag) =>
    tag.trim().toLowerCase() === property.toLowerCase()
    || tag.trim().toLowerCase().startsWith(`${property.toLowerCase()} (`)))
}
