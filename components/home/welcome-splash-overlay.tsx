"use client"

import { useEffect, useState, type ReactNode } from "react"

const ACCEPTED_KEY = "dump-stat-compact-ai-disclosure-accepted"

/** Show once per tab session, without changing the visual edition's preferences. */
export function WelcomeSplashOverlay({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    try { setAccepted(sessionStorage.getItem(ACCEPTED_KEY) === "yes") } catch { /* Still allow entry when storage is unavailable. */ }
  }, [])

  const proceed = () => {
    try { sessionStorage.setItem(ACCEPTED_KEY, "yes") } catch { /* Acceptance still works for this visit. */ }
    setAccepted(true)
  }

  if (accepted) return children

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <section aria-labelledby="welcome-title" className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        <h1 id="welcome-title" className="text-3xl font-bold">Welcome to Dump Stat</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          A 5E character builder with support for any custom class you can dream up. Create or import your homebrew, build your character, and play with an interactive character sheet.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Dump Stat was made with{" "}
          <a href="https://cursor.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">Cursor</a>
          {" and "}
          <a href="https://openai.com/codex/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">Codex</a>
          , AI-assisted coding tools. It also invites users to use their own LLM to process content for import.
        </p>
        <p className="mt-4 font-semibold">Would you like to proceed?</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={proceed} className="min-h-11 flex-1 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Yes, continue</button>
          <a href="https://noai.duckduckgo.com/" rel="noreferrer" className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border px-5 py-3 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">No, take me away</a>
        </div>
      </section>
    </main>
  )
}
