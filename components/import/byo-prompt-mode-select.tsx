"use client"

import { useCallback, useEffect, useState } from "react"
import type { ByoPromptMode } from "@/lib/import/byo-import-kit"

const STORAGE_KEY = "dump-stat-byo-prompt-mode"

const MODE_OPTIONS: { value: ByoPromptMode; label: string; description: string }[] = [
  {
    value: "lite",
    label: "Lite",
    description: "Short prompt for free or base-tier ChatGPT, Gemini, Copilot, and Claude.",
  },
  {
    value: "full",
    label: "Full",
    description: "Complete wiring guide for paid / large-context models. More mechanics come pre-wired.",
  },
]

export function useByoPromptMode(): [ByoPromptMode, (mode: ByoPromptMode) => void] {
  const [mode, setMode] = useState<ByoPromptMode>("full")

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "lite" || stored === "full") setMode(stored)
  }, [])

  const update = useCallback((next: ByoPromptMode) => {
    setMode(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  return [mode, update]
}

type ByoPromptModeSelectProps = {
  value: ByoPromptMode
  onChange: (mode: ByoPromptMode) => void
}

export function ByoPromptModeSelect({ value, onChange }: ByoPromptModeSelectProps) {
  const active = MODE_OPTIONS.find((option) => option.value === value) ?? MODE_OPTIONS[1]
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-primary/30 bg-card p-4">
      <span className="text-sm font-bold text-foreground">LLM prompt size</span>
      <div role="radiogroup" aria-label="Prompt size" className="inline-flex rounded-xl border-2 border-primary bg-background p-1 shadow-sm">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-11 min-w-20 rounded-lg px-5 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              value === option.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{active.description}</span>
    </div>
  )
}
