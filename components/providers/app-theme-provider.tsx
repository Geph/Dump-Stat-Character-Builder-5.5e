"use client"

import type { ReactNode } from "react"

/** Compact presentation is always parchment; never overwrite shared theme preferences. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  return <div className="relative z-[2] min-h-screen bg-background">{children}</div>
}

export function useAppTheme() {
  return { theme: "parchment" as const }
}
