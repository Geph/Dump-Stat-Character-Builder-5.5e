"use client"

import { useId } from "react"
import { IMPORT_CONTENT_TYPE_HINTS } from "@/lib/import/content-type-hints"

type ImportContentTypeHintSelectProps = {
  value: string
  onChange: (value: string) => void
  focusRingClassName?: string
  /** Defaults to "Type:". */
  label?: string
}

export function ImportContentTypeHintSelect({
  value,
  onChange,
  focusRingClassName = "focus:ring-primary",
  label = "Type:",
}: ImportContentTypeHintSelectProps) {
  const id = useId()
  return (
    <div className="flex min-w-0 max-w-full items-center gap-2">
      <label htmlFor={id} className="shrink-0 whitespace-nowrap text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-11 min-w-0 w-full max-w-[min(100%,20rem)] truncate px-3 py-1.5 bg-muted rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 ${focusRingClassName}`}
      >
        {IMPORT_CONTENT_TYPE_HINTS.filter((hint) => hint.value !== "images").map((hint) => (
          <option key={hint.value} value={hint.value}>
            {hint.label}
          </option>
        ))}
      </select>
    </div>
  )
}
