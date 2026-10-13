import Link from "next/link"
import { MainNav } from "@/components/main-nav"
import { SiteFooter } from "@/components/site-footer"
const sections = [
  ["/builder", "Create a character", "Choose your class, origin, abilities, equipment, and spells."],
  ["/characters", "Your characters", "Open a sheet, roll dice, and track resources and companions."],
  ["/compendium", "Compendium", "Browse rules and manage your homebrew content."],
  ["/import", "Import content", "Import JSON or Foundry exports, or use optional BYO LLM guidance."],
]
export default function HomePage() {
  return <div className="min-h-screen flex flex-col bg-background"><MainNav />
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      <h1 className="text-4xl font-bold">Dump Stat</h1>
      <p className="mt-4 text-lg text-muted-foreground">A compact, art-free 5E character builder and interactive character sheet.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">{sections.map(([href,title,description]) =>
        <Link key={href} href={href} className="rounded-xl border border-border bg-card p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
          <h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-muted-foreground">{description}</p>
        </Link>)}</div>
      <p className="mt-8 text-sm text-muted-foreground">Includes SRD 5.2.1 content. Browser storage works without an account; export backups from the app. Interface icons and fonts retain their licenses.</p>
    </main><SiteFooter id="home-footer" /></div>
}
