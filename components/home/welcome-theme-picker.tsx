"use client"

import { CompactImage } from "@/components/compact-image"


import { Check } from "lucide-react"
import { APP_THEMES, useAppTheme } from "@/components/providers/app-theme-provider"
import { cn } from "@/lib/utils"
import { SwipeVisualPicker } from "@/components/builder/swipe-visual-picker"
import { getCinematicSpellPickerContainerClass } from "@/lib/builder/picker-pagination"
import { themePageBackgroundAssetPath } from "@/lib/site-settings/theme-page-backgrounds"

export function WelcomeThemePicker({ onDone, onBack, graphical }: { onDone: () => void; onBack: () => void; graphical: boolean }) {
  const { theme, setTheme } = useAppTheme()
  return <section className="space-y-4">
    <header className="text-center">
      <h2 id="welcome-splash-title" className="text-3xl font-bold">Choose your visual theme</h2>
      <p id="welcome-splash-description" className="mt-2 text-sm text-muted-foreground">Select a theme to preview it. You can change it anytime in Settings.</p>
    </header>
    <SwipeVisualPicker enabled={graphical} className={graphical ? cn(getCinematicSpellPickerContainerClass(), "sm:grid-cols-5") : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
      {APP_THEMES.map((option) => <button key={option.id} type="button" aria-pressed={theme === option.id} onClick={() => setTheme(option.id)}
        className={cn("relative w-full overflow-hidden rounded-xl border-2 text-left focus-visible:outline-2 focus-visible:outline-primary", graphical ? "aspect-[2/3] text-white" : "p-4", theme === option.id ? "border-primary bg-primary/10" : "border-border bg-card")}>
        {graphical && <>
          {/* Bundled decorative previews retain their full portrait composition. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <CompactImage src={themePageBackgroundAssetPath(option.id)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" aria-hidden />
        </>}
        <span className={cn("block", graphical && "absolute inset-x-0 bottom-0 p-3")}>
        <span className="mb-3 flex gap-2" aria-hidden>{option.swatches.map((color) => <span key={color} className="h-8 flex-1 rounded-md border border-black/10" style={{ backgroundColor: color }} />)}</span>
        <span className="flex items-center justify-between font-semibold">{option.label}{theme === option.id && <Check className="size-4" />}</span>
        <span className={cn("mt-1 block text-sm", graphical ? "text-white/85" : "text-muted-foreground")}>{option.description}</span>
        </span>
      </button>)}
    </SwipeVisualPicker>
    <div className="flex justify-between gap-3">
      <button type="button" onClick={onBack} className="rounded-lg border px-4 py-3">Back</button>
      <button type="button" onClick={onDone} className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">Use this theme</button>
    </div>
  </section>
}
