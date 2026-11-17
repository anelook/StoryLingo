"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/client";
import type { Correction } from "@/lib/types";
import { cn } from "@/lib/utils";

type Stat = { category: string; label: string; errors: number; correct: number; opportunities: number; errorRate: number | null };
type Data = {
  totals: { adventures: number; errors: number; analysedTurns: number; practicedCorrections: number; attempts: number; successfulAttempts: number; saved: number; dueForReview: number };
  categories: Stat[];
  trend: { date: string; errors: number; turns: number; perTurn: number | null }[];
  recentTopics: { category: string; label: string }[];
  recommendations: { category: string; label: string; reason: string }[];
};
type Detail = { label: string; items: (Correction & { adventureTitle: string; attempts: { id: string; transcript: string; success: boolean; feedback: string; createdAt: string }[] })[] };

const GOLD = "#e0a24a";
const TEAL = "#6fb7c9";
const AXIS = "#a29a94";
const tip = { background: "#1b1525", border: "1px solid #2f2639", borderRadius: 8, color: "#efe6d8" };

function Tile({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <Card><CardContent className="p-4 pt-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </CardContent></Card>
  );
}

export default function Progress() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => { api<Data>("/api/analytics").then(setD).catch((e) => setErr(e.message)); }, []);
  useEffect(() => {
    if (!sel) return;
    let live = true;
    api<Detail>(`/api/analytics?category=${sel}`).then((r) => live && setDetail(r)).catch(() => {});
    return () => { live = false; };
  }, [sel]);

  if (err) return <p role="alert" className="text-danger">{err}</p>;
  if (!d) return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" /> Loading…</p>;

  const bars = d.categories.filter((c) => c.errors > 0);
  const t = d.totals;
  const successRate = t.attempts ? Math.round((t.successfulAttempts / t.attempts) * 100) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold">Your progress</h1>
        <p className="mt-1 text-muted-foreground">Based only on the corrections StoryLingo has actually recorded. Mistakes shown to you depend on your learning style, so counts are a guide, not a test score.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Mistakes recorded" value={t.errors} note={`${t.analysedTurns} analysed replies`} />
        <Tile label="Practiced" value={t.practicedCorrections} note="corrections repeated aloud" />
        <Tile label="Successful repeats" value={t.successfulAttempts} note={successRate !== null ? `${successRate}% of ${t.attempts} attempts` : "no attempts yet"} />
        <Tile label="Saved / due" value={`${t.saved} / ${t.dueForReview}`} note="saved · due for review" />
      </div>

      {d.recommendations.length > 0 && (
        <Card><CardHeader><CardTitle>Worth practicing next</CardTitle></CardHeader><CardContent className="space-y-2">
          {d.recommendations.map((r) => (
            <button key={r.category} onClick={() => { setDetail(null); setSel(r.category); }} className="block w-full rounded-lg border border-border p-3 text-left hover:border-primary">
              <span className="font-medium text-primary">{r.label}</span>
              <span className="block text-sm text-muted-foreground">{r.reason}</span>
            </button>
          ))}
        </CardContent></Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Most common mistakes</CardTitle></CardHeader>
          <CardContent>
            {bars.length ? (
              <div role="img" aria-label={`Bar chart of mistakes by category: ${bars.map((b) => `${b.label} ${b.errors}`).join(", ")}`} className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bars} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="#2f2639" />
                    <XAxis type="number" allowDecimals={false} stroke={AXIS} fontSize={12} />
                    <YAxis type="category" dataKey="label" width={120} stroke={AXIS} fontSize={12} />
                    <Tooltip contentStyle={tip} cursor={{ fill: "rgba(224,162,74,0.08)" }} formatter={(v) => [v, "Mistakes"]} />
                    <Bar dataKey="errors" fill={GOLD} radius={[0, 4, 4, 0]} onClick={(b) => { setDetail(null); setSel((b as unknown as Stat).category); }} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-sm text-muted-foreground">No mistakes recorded yet — play an adventure and they’ll show up here.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mistakes over time</CardTitle></CardHeader>
          <CardContent>
            {d.trend.length >= 2 ? (
              <div role="img" aria-label="Line chart of mistakes per analysed reply by day" className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.trend} margin={{ left: 0, right: 16 }}>
                    <CartesianGrid stroke="#2f2639" />
                    <XAxis dataKey="date" stroke={AXIS} fontSize={12} />
                    <YAxis stroke={AXIS} fontSize={12} allowDecimals />
                    <Tooltip contentStyle={tip} formatter={(v, n) => [v ?? "–", n === "perTurn" ? "Mistakes per reply" : "Mistakes"]} />
                    <Line type="monotone" dataKey="perTurn" stroke={GOLD} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="errors" stroke={TEAL} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 3" />
                  </LineChart>
                </ResponsiveContainer>
                <p className="mt-1 text-xs text-muted-foreground"><span style={{ color: GOLD }}>●</span> per analysed reply &nbsp; <span style={{ color: TEAL }}>●</span> total mistakes</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">A trend needs at least two days of play. Come back after your next session.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Grammar topics</CardTitle></CardHeader>
        <CardContent>
          {d.categories.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="py-2 pr-4">Topic</th><th className="pr-4">Mistakes</th><th className="pr-4">Correct uses</th><th className="pr-4">Error rate</th><th></th></tr></thead>
                <tbody>
                  {d.categories.map((c) => (
                    <tr key={c.category} className="border-t border-border">
                      <td className="py-2 pr-4 font-medium">{c.label}</td>
                      <td className="pr-4">{c.errors}</td>
                      <td className="pr-4">{c.correct}</td>
                      <td className="pr-4 text-muted-foreground">{c.errorRate !== null ? `${Math.round(c.errorRate * 100)}%` : `not enough data (${c.opportunities}/5 uses)`}</td>
                      <td className="text-right"><Button size="sm" variant="ghost" onClick={() => { setDetail(null); setSel(c.category === sel ? null : c.category); }}>{sel === c.category ? "Hide" : "Details"}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted-foreground">Nothing tracked yet.</p>}
          {d.recentTopics.length > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">Recently practiced: {d.recentTopics.map((r) => <Badge key={r.category} tone="gold">{r.label}</Badge>)}</p>
          )}
        </CardContent>
      </Card>

      {sel && (
        <Card className="animate-rise">
          <CardHeader><CardTitle>{detail?.label ?? "…"} — your history</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!detail && <Loader2 className="animate-spin text-muted-foreground" />}
            {detail?.items.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="text-muted-foreground">You said: <span className="text-foreground">“{c.original}”</span></p>
                <p className="text-muted-foreground">Better: <span className="font-display text-base text-success">“{c.corrected}”</span></p>
                {c.explanation && <p className="mt-1 text-xs text-muted-foreground">{c.explanation}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{c.adventureTitle} · {new Date(c.createdAt).toLocaleDateString()} · {c.kind}</p>
                {c.attempts.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
                    {c.attempts.map((a) => <li key={a.id} className={cn(a.success ? "text-success" : "text-muted-foreground")}>{a.success ? "✓" : "✗"} “{a.transcript}” — {new Date(a.createdAt).toLocaleDateString()}</li>)}
                  </ul>
                )}
              </div>
            ))}
            {detail && !detail.items.length && <p className="text-sm text-muted-foreground">No entries.</p>}
          </CardContent>
        </Card>
      )}
      <p className="text-sm text-muted-foreground">Want to drill? <Link href="/review" className="text-primary underline">Open your review queue</Link>.</p>
    </div>
  );
}
