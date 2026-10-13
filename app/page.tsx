import Link from "next/link"
import { ArrowRight, BookOpen, Download, NotebookText, Users } from "lucide-react"
import { MainNav } from "@/components/main-nav"
import { SiteFooter } from "@/components/site-footer"
import { WelcomeSplashOverlay } from "@/components/home/welcome-splash-overlay"
import { CompendiumStats } from "@/components/home/compendium-stats"
const sections = [
  { href: "/characters", title: "Manage Characters", description: "Your sheets and parties.", icon: Users },
  { href: "/compendium", title: "Content Compendium", description: "Browse base content. Add your own.", icon: BookOpen },
  { href: "/import", title: "Import Content", description: "Bring your homebrew with JSON or optional LLM guidance.", icon: Download },
]
export default function HomePage() {
  return <WelcomeSplashOverlay><div className="min-h-screen flex flex-col bg-background"><MainNav />
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary sm:text-base">Your rules. Custom Content. Ready to play.</p>
      <h1 className="mt-5 max-w-3xl text-5xl leading-tight font-bold sm:text-6xl lg:text-7xl">ANY class you can dream up</h1>
      <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">A compact 5.5e character builder and interactive character sheet.</p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <Link href="/builder" className="group flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-card p-5 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary sm:col-span-2 sm:p-7">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <NotebookText className="size-7" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <h2 className="text-3xl font-semibold sm:text-4xl">Character Builder</h2>
            <p className="mt-2 text-lg text-muted-foreground">From level one to twenty.</p>
          </div>
          <span className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground group-hover:bg-primary/90 sm:w-auto">
            Build a character <ArrowRight className="size-5" aria-hidden="true" />
          </span>
        </Link>
        {sections.map(({ href, title, description, icon: Icon }) =>
        <Link key={href} href={href} className={`flex items-start gap-5 rounded-2xl border border-border bg-card p-5 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary sm:p-7 ${href === "/import" ? "sm:col-span-2" : ""}`}>
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-6" aria-hidden="true" />
            </span>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
            <p className="mt-2 text-lg leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </Link>)}</div>
      <CompendiumStats />
    </main><SiteFooter id="home-footer" /></div></WelcomeSplashOverlay>
}
