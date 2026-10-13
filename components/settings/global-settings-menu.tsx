"use client"

import { useState } from "react"
import { Settings, ExternalLink, Bug } from "lucide-react"
import Link from "next/link"
import {
  getAppVersion,
  getDeployMode,
  getStorageLabel,
} from "@/lib/config/deploy-mode"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ClearCompendiumSection } from "@/components/settings/clear-compendium-section"
import { useGmDashboardNav } from "@/components/settings/use-gm-dashboard-nav"
import { useResumeLastCharacter } from "@/components/settings/use-resume-last-character"
import { useManualSkillAbility } from "@/components/settings/use-manual-skill-ability"
import { useSearchAutocomplete } from "@/components/settings/use-search-autocomplete"
import { useDisplayNonCombatActions } from "@/components/settings/use-display-non-combat-actions"

const GITHUB_ISSUES_URL = "https://github.com/Geph/Dump-Stat-Character-Builder-5.5e/issues"

const TAB_TRIGGER_CLASS =
  "rounded-lg border border-transparent px-2 py-2 text-xs sm:px-3 sm:text-sm data-[state=active]:border-border data-[state=active]:bg-muted data-[state=active]:shadow-none"

export function GlobalSettingsMenu() {
  const { enabled: gmDashboardNavEnabled, setEnabled: setGmDashboardNavEnabled } = useGmDashboardNav()
  const { enabled: resumeLastCharacter, setEnabled: setResumeLastCharacter } = useResumeLastCharacter()
  const { enabled: manualSkillAbility, setEnabled: setManualSkillAbility } = useManualSkillAbility()
  const { enabled: searchAutocomplete, setEnabled: setSearchAutocomplete } =
    useSearchAutocomplete()
  const { enabled: displayNonCombatActions, setEnabled: setDisplayNonCombatActions } =
    useDisplayNonCombatActions()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 rounded-xl border-2 border-border bg-card hover:bg-muted"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Preferences and about.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="options" className="gap-0">
          <div className="border-b border-border px-4 pt-3 sm:px-6">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-transparent p-0">
              <TabsTrigger value="options" className={TAB_TRIGGER_CLASS}>
                Options
              </TabsTrigger>
              <TabsTrigger value="about" className={TAB_TRIGGER_CLASS}>
                About
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-6 py-4 lg:max-h-[min(80vh,42rem)]">
            <TabsContent value="options" className="mt-0 space-y-6">
              <div>
                <p className="text-sm font-semibold text-foreground">Navigation</p>
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                  <input
                    type="checkbox"
                    checked={searchAutocomplete}
                    onChange={(event) => setSearchAutocomplete(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
                  />
                  <span className="text-sm leading-snug">
                    <span className="font-semibold text-foreground">
                      Show autocomplete suggestions
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Shows ranked matches and recent searches while typing. Turn this off to keep
                      search fields as plain text filters.
                    </span>
                  </span>
                </label>
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                  <input
                    type="checkbox"
                    checked={gmDashboardNavEnabled}
                    onChange={(event) => setGmDashboardNavEnabled(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
                  />
                  <span className="text-sm leading-snug">
                    <span className="font-semibold text-foreground">
                      Show GM Dashboard{" "}
                      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        (beta)
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Adds a GM Dashboard link to the header for multi-character table tools.
                    </span>
                  </span>
                </label>
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                  <input
                    type="checkbox"
                    checked={resumeLastCharacter}
                    onChange={(event) => setResumeLastCharacter(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
                  />
                  <span className="text-sm leading-snug">
                    <span className="font-semibold text-foreground">Resume last character on Home</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      After the first visit, opening the home page jumps to the last character sheet
                      you viewed.
                    </span>
                  </span>
                </label>
                
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">Character sheet</p>
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                  <input
                    type="checkbox"
                    checked={displayNonCombatActions}
                    onChange={(event) => setDisplayNonCombatActions(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
                  />
                  <span className="text-sm leading-snug">
                    <span className="font-semibold text-foreground">Display non-combat actions</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Shows Help, Influence, Search, and other out-of-combat standard actions on the
                      Abilities tab. Click a card for the rules text.
                    </span>
                  </span>
                </label>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">House rules</p>
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                  <input
                    type="checkbox"
                    checked={manualSkillAbility}
                    onChange={(event) => setManualSkillAbility(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
                  />
                  <span className="text-sm leading-snug">
                    <span className="font-semibold text-foreground">
                      Allow manual ability selection for skills
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      On the character sheet, tap the ability next to a skill name (for example INT on
                      Arcana) to use a different ability modifier.
                    </span>
                  </span>
                </label>
              </div>

              <ClearCompendiumSection onStatus={setStatus} />
            </TabsContent>

            <TabsContent value="about" className="mt-0 space-y-6">
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 space-y-1">
                <p className="text-xs font-semibold text-foreground">Deployment</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] leading-tight">
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="font-medium text-foreground tabular-nums">{getAppVersion()}</dd>
                  <dt className="text-muted-foreground">Mode</dt>
                  <dd className="font-medium text-foreground">{getDeployMode()}</dd>
                  <dt className="text-muted-foreground">Storage</dt>
                  <dd className="font-medium text-foreground">{getStorageLabel()}</dd>
                </dl>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">Attribution</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open licenses and third-party credits for bundled content.
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => setOpen(false)}
                >
                  <Link href="/#home-footer" onClick={() => window.dispatchEvent(new Event("dumpstat:open-attribution"))}>
                    <ExternalLink className="h-4 w-4" />
                    Licenses &amp; attribution
                  </Link>
                </Button>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">Feedback</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Report bugs or request features on GitHub.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3 gap-2">
                  <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer">
                    <Bug className="h-4 w-4" />
                    Report an issue on GitHub
                  </a>
                </Button>
              </div>
            </TabsContent>
          </div>

          {status ? (
            <div className="border-t border-border px-6 py-3 text-xs text-foreground bg-muted/30">
              {status}
            </div>
          ) : null}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
