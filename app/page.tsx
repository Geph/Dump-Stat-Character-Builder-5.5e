import Link from "next/link"
import { BookOpen, Download, NotebookText, Users } from "lucide-react"
import { MainNav } from "@/components/main-nav"
import { SiteFooter } from "@/components/site-footer"
import { WelcomeSplashOverlay } from "@/components/home/welcome-splash-overlay"
import { CompendiumStats } from "@/components/home/compendium-stats"
const sections = [
  { href: "/builder", title: "Character Builder", description: "Choose your class, origin, abilities, equipment, and spells.", icon: NotebookText },
  { href: "/characters", title: "Manage Characters", description: "Open a sheet, roll dice, and track resources and companions.", icon: Users },
  { href: "/compendium", title: "Content Compendium", description: "Browse rules and manage your homebrew content.", icon: BookOpen },
  { href: "/import", title: "Import content", description: "Import JSON or Foundry exports, or use optional BYO LLM guidance.", icon: Download },
]
export default function HomePage() {
  return <WelcomeSplashOverlay><div className="min-h-screen flex flex-col bg-background"><MainNav />
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      <h1 className="text-4xl font-bold">Dump Stat</h1>
      <p className="mt-4 text-lg text-muted-foreground">A compact, art-free 5E character builder and interactive character sheet.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">{sections.map(({ href, title, description, icon: Icon }) =>
        <Link key={href} href={href} className="rounded-xl border border-border bg-card p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-6" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold">{title}</h2>
          </div>
          <p className="mt-3 text-muted-foreground">{description}</p>
        </Link>)}</div>
      <CompendiumStats />
    </main><SiteFooter id="home-footer" /></div></WelcomeSplashOverlay>
}
