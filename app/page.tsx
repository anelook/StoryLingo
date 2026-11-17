import Link from "next/link";
import { ArrowRight, BookMarked, Plus, Repeat, Swords } from "lucide-react";
import { prisma } from "@/lib/db";
import { categoryStats } from "@/lib/learning";
import { genreLabel, LEVELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteAdventure } from "@/components/delete-adventure";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [adventures, stats, savedCount, dueCount, practiced] = await Promise.all([
    prisma.adventure.findMany({ orderBy: { updatedAt: "desc" } }),
    categoryStats(),
    prisma.correction.count({ where: { saved: true } }),
    prisma.correction.count({ where: { saved: true, nextReviewAt: { lte: new Date() } } }),
    prisma.practiceAttempt.count(),
  ]);
  const current = adventures.find((a) => a.status === "active") ?? adventures[0];
  const top = stats.filter((s) => s.errors > 0).slice(0, 3);
  const keys = !!process.env.OPENAI_API_KEY && !!process.env.ELEVENLABS_API_KEY;

  return (
    <div className="space-y-8">
      {!keys && (
        <div role="status" className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
          Add your <code>OPENAI_API_KEY</code> and <code>ELEVENLABS_API_KEY</code> to <code>.env.local</code>, then restart the dev server, to start playing.
        </div>
      )}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#2a1a33] via-[#1a1224] to-[#2c1a12] p-6 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Aprende viviendo</p>
        <h1 className="mt-2 max-w-xl font-display text-4xl font-semibold leading-tight sm:text-5xl">Your Spanish is the spell that moves the story.</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">Speak or write your way through an adventure that adapts to you, with a tutor ready whenever you need one.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href="/new"><Plus /> Start a new adventure</Link></Button>
          {current && <Button asChild size="lg" variant="secondary"><Link href={`/adventure/${current.id}`}>Continue: {current.title} <ArrowRight /></Link></Button>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2" aria-label="Saved adventures">
          <h2 className="font-display text-2xl font-semibold">Saved adventures</h2>
          {!adventures.length && <Card><CardContent className="p-6 pt-5 text-muted-foreground">No adventures yet. Your first one is a few choices away.</CardContent></Card>}
          {adventures.map((a) => (
            <Card key={a.id} className="transition-colors hover:border-primary/50">
              <div className="flex items-center gap-3 p-4">
                <Link href={`/adventure/${a.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><Swords className="h-4 w-4 shrink-0 text-primary" aria-hidden /><h3 className="truncate font-display text-xl font-semibold">{a.title}</h3></div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{a.sceneTitle || "Opening scene"} · Capítulo {a.chapter} · {a.turnCount} turns</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="gold">{genreLabel(a.genre)}</Badge>
                    <Badge>{LEVELS.find((l) => l.id === a.level)?.id}</Badge>
                    <Badge>{a.style}</Badge>
                    {a.status === "completed" && <Badge tone="good">Completed</Badge>}
                    <Badge>{a.updatedAt.toLocaleDateString()}</Badge>
                  </div>
                </Link>
                <DeleteAdventure id={a.id} title={a.title} />
              </div>
            </Card>
          ))}
        </section>

        <aside className="space-y-4" aria-label="Learning summary">
          <Card>
            <CardHeader><CardTitle>Grammar focus</CardTitle></CardHeader>
            <CardContent>
              {top.length ? (
                <ul className="space-y-2 text-sm">
                  {top.map((s) => <li key={s.category} className="flex justify-between"><span>{s.label}</span><span className="text-muted-foreground">{s.errors} mistake{s.errors === 1 ? "" : "s"}</span></li>)}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Your most common mistakes will appear here once you start playing.</p>}
              <Button asChild variant="ghost" size="sm" className="mt-3 -ml-2"><Link href="/progress">Full progress <ArrowRight /></Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Practice</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><BookMarked className="h-4 w-4 text-primary" aria-hidden /> {savedCount} saved correction{savedCount === 1 ? "" : "s"}</p>
              <p className="flex items-center gap-2"><Repeat className="h-4 w-4 text-primary" aria-hidden /> {dueCount} due for review · {practiced} practice attempt{practiced === 1 ? "" : "s"}</p>
              <Button asChild variant="secondary" size="sm"><Link href="/review">{dueCount ? "Review now" : "Open review"}</Link></Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
