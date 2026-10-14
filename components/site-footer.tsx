"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronUp } from "lucide-react"
import { FontAttribution } from "@/components/font-attribution"
import { CC_BY_SA_4_URL } from "@/lib/fonts/solbera-attribution"
import { SrdAttribution } from "@/components/srd-attribution"
import { cn } from "@/lib/utils"

const GITHUB_REPO_URL = "https://github.com/Geph/Dump-Stat-Character-Builder-5.5e"

type SiteFooterProps = {
  id?: string
  className?: string
}

export function SiteFooter({ id = "site-footer", className }: SiteFooterProps) {
  const [open, setOpen] = useState(false)
  const footerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout>
    const reveal = () => {
      setOpen(true)
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => footerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 220)
    }
    const revealHash = () => {
      if (window.location.hash === `#${id}`) reveal()
    }
    const revealFromOptions = () => {
      if (id === "home-footer") reveal()
    }
    revealHash()
    window.addEventListener("hashchange", revealHash)
    window.addEventListener("dumpstat:open-attribution", revealFromOptions)
    return () => {
      clearTimeout(scrollTimer)
      window.removeEventListener("hashchange", revealHash)
      window.removeEventListener("dumpstat:open-attribution", revealFromOptions)
    }
  }, [id])

  return (
    <footer ref={footerRef} id={id} style={{ scrollMarginTop: "5rem" }} className={className ?? "mt-auto shrink-0 w-full py-5 px-4 border-t border-border bg-card"}>
      <div className="max-w-6xl mx-auto flex flex-col">
        <div
          id={`${id}-content`}
          inert={!open}
          aria-hidden={!open}
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className="mx-auto max-w-4xl text-left text-muted-foreground text-sm leading-relaxed space-y-3 pb-4 [&_p]:text-sm [&_div]:text-sm [&_a]:underline [&_a]:underline-offset-2">
              <p className="font-medium text-foreground/80">
                Game content
              </p>
              <SrdAttribution showCompatibility={false} />
              <p className="text-xs leading-snug">
                Logo icon:{" "}
                <a
                  href="https://game-icons.net/1x1/delapouite/spiked-dragon-head.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Spiked Dragon Head
                </a>{" "}
                by{" "}
                <a
                  href="https://delapouite.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Delapouite
                </a>{" "}
                under{" "}
                <a
                  href="https://creativecommons.org/licenses/by/3.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  CC BY 3.0
                </a>
              </p>
              <FontAttribution />
              <p className="text-xs leading-snug">
                Not affiliated with or endorsed by Wizards of the Coast. &ldquo;Dungeons &amp; Dragons&rdquo; and
                related marks are trademarks of Wizards of the Coast LLC.
              </p>
              <p className="text-xs leading-snug">
                Other product names and logos belong to their respective owners and are used for identification,
                without implying endorsement.
              </p>
              <p className="text-xs leading-snug">
                Dump Stat does not collect personal identification data. Character and compendium data stay in
                your browser or your own database when you host the app yourself.
              </p>
              <p className="text-xs leading-snug pt-1">
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Dump Stat source on GitHub
                </a>
                {" · "}<a href={`${GITHUB_REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Application code: MIT license</a>
              </p>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-1 py-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={`${id}-content`}
            className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Attribution and Legal
            <ChevronUp
              className={cn(
                "size-3.5 shrink-0 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>
          {!open ? (
            <p className="text-sm font-normal leading-snug text-muted-foreground">
              <a href="https://www.dndbeyond.com/srd" className="text-primary hover:underline">SRD 5.2.1</a>{" "}
              (<a href="https://creativecommons.org/licenses/by/4.0/" className="text-primary hover:underline">CC BY 4.0</a>) · Solbera&apos;s D&amp;D Fonts (
              <a
                href={CC_BY_SA_4_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                CC BY-SA 4.0
              </a>
              )
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
