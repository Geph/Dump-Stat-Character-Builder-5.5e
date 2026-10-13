"use client"

import { useRef, type ReactNode } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { GameIcon } from "@/components/game-icon-picker"
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import type { CompendiumCardImageCrop, CompendiumCardVisual } from "@/lib/compendium/card-image"
import { compendiumAccentColorStyles, type CompendiumThemeColorId } from "@/lib/compendium/theme-colors"
import { cn } from "@/lib/utils"

export type CompendiumDetailTag = {
  label: string
  emphasis?: boolean
  themeColor?: CompendiumThemeColorId
}

type CompendiumDetailOverlayProps = {
  open: boolean
  onClose: () => void
  item: CompendiumCardVisual & { name: string }
  subtitle?: string
  tagline?: string
  tags?: CompendiumDetailTag[]
  accentColor?: CompendiumThemeColorId | null
  headerActions?: ReactNode
  children: ReactNode
  /** Legacy presentation props remain accepted; compact details always scroll without an art region. */
  detailScroll?: boolean
  enableCardImage?: boolean
  imageCrop?: CompendiumCardImageCrop
  panelWidth?: "default" | "narrow" | "slim" | "widescreen" | "compact" | "portrait" | "portrait-species" | "portrait-spell"
  heroLayout?: "default" | "balanced" | "widescreen"
  /** Keep nested details above the level-up wizard. */
  backdropClassName?: string
}

export function CompendiumDetailOverlay({
  open,
  onClose,
  item,
  subtitle,
  tagline,
  tags = [],
  accentColor = null,
  headerActions,
  children,
  backdropClassName,
}: CompendiumDetailOverlayProps) {
  const accent = compendiumAccentColorStyles(accentColor)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogPortal>
        <DialogOverlay className={cn("bg-black/80", backdropClassName)} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocusRef.current?.isConnected) {
              event.preventDefault()
              returnFocusRef.current.focus()
            }
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,48rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border-2 shadow-2xl",
            accent.detailStripBg,
            accent.detailStripBorder,
            backdropClassName,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/15 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              {item.icon ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/35 bg-black/40">
                  <GameIcon name={item.icon} className={cn("h-5 w-5", accent.imageCardIconText)} />
                </div>
              ) : null}
              <div className="min-w-0">
                {subtitle ? <p className={cn("text-[10px] font-bold uppercase tracking-widest", accent.cardFooterText)}>{subtitle}</p> : null}
                <DialogTitle className="mt-0.5 break-words font-serif text-xl font-black leading-tight text-white">{item.name}</DialogTitle>
              </div>
            </div>
            <DialogClose asChild>
              <button type="button" aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 hover:bg-black/60 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3 text-sm text-white/90 sm:px-5 sm:py-4 [&_.text-muted-foreground]:text-white/70 [&_.text-foreground]:text-white">
            {tagline ? <p className="mb-3 text-xs font-medium text-white/75">{tagline}</p> : null}
            {tags.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const tagAccent = tag.themeColor ? compendiumAccentColorStyles(tag.themeColor) : accent
                  return <span key={tag.label} className={cn("rounded border bg-black/35 px-2 py-1 text-xs font-bold", tag.emphasis || tag.themeColor ? cn(tagAccent.cardFooterBorder, tagAccent.cardFooterText) : "border-white/35 text-white")}>{tag.label}</span>
                })}
              </div>
            ) : null}
            {headerActions ? <div className="mb-3 flex flex-wrap gap-2">{headerActions}</div> : null}
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
