"use client";
import { useCallback, useEffect, useState } from "react";
import { BookmarkX, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PracticePanel } from "@/components/practice-panel";
import { api, postJson } from "@/lib/client";
import { categoryLabel } from "@/lib/constants";
import { DEFAULT_REVIEW_VOICE } from "@/lib/voice-default";
import type { Correction } from "@/lib/types";

type Data = { due: Correction[]; upcoming: Correction[] };

function Item({ c, due, onRemoved, onDone }: { c: Correction; due: boolean; onRemoved: () => void; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardContent className="space-y-2 p-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">{categoryLabel(c.category)}</Badge>
          <Badge tone={due ? "bad" : "default"}>{due ? "Due now" : `Next: ${c.nextReviewAt ? new Date(c.nextReviewAt).toLocaleDateString() : "—"}`}</Badge>
          <Button size="icon" variant="ghost" className="ml-auto" aria-label="Remove from saved" onClick={async () => { await postJson(`/api/corrections/${c.id}`, { action: "unsave" }, "PATCH"); onRemoved(); }}><BookmarkX /></Button>
        </div>
        <p className="text-sm text-muted-foreground line-through decoration-danger/50">{c.original}</p>
        <p className="font-display text-xl">{c.corrected}</p>
        {c.explanation && <p className="text-xs text-muted-foreground">{c.explanation}</p>}
        {open ? (
          <PracticePanel correctionId={c.id} sentence={c.corrected} voiceId={DEFAULT_REVIEW_VOICE} review onResult={() => onDone()} />
        ) : (
          <Button size="sm" onClick={() => setOpen(true)}>{due ? "Review it" : "Practice anyway"}</Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Review() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api<Data>("/api/review").then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (err) return <p role="alert" className="text-danger">{err}</p>;
  if (!d) return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" /> Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold">Review</h1>
        <p className="mt-1 text-muted-foreground">Saved corrections come back on a spaced schedule: 1, 3, 7, 14, then 30 days. A successful repeat pushes the next review further out; a miss brings it back tomorrow.</p>
      </div>
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold">Due now ({d.due.length})</h2>
        {!d.due.length && <p className="text-sm text-muted-foreground">Nothing due. Save corrections during adventures to build your review queue.</p>}
        {d.due.map((c) => <Item key={c.id} c={c} due onRemoved={load} onDone={() => setTimeout(load, 4000)} />)}
      </section>
      {d.upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Coming up ({d.upcoming.length})</h2>
          {d.upcoming.map((c) => <Item key={c.id} c={c} due={false} onRemoved={load} onDone={() => setTimeout(load, 4000)} />)}
        </section>
      )}
    </div>
  );
}
