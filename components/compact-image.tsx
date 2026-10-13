import type { ComponentPropsWithRef } from "react"

/** Only licensed interface SVG icons are rendered by the compact UI. */
export function CompactImage(props: ComponentPropsWithRef<"img">) {
  const src = typeof props.src === "string" ? props.src : ""
  if (!/^(?:\/[A-Za-z0-9_-]+)*\/icons\/[A-Za-z0-9_-]+\.svg$/.test(src)) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt ?? ""} />
}
