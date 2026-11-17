"use client";
import { useState } from "react";
import { Bookmark, BookmarkCheck, GraduationCap, HelpCircle, Loader2, Mic, Send, X } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/field";
import { PracticePanel } from "./practice-panel";
import { postJson } from "@/lib/client";
import { categoryLabel } from "@/lib/constants";
import type { Correction } from "@/lib/types";
import { cn } from "@/lib/utils";

function Highlight({ text, pieces, tone }: { text: string; pieces: string[]; tone: "good" | "bad" }) {
  const valid = pieces.map((p) => p.trim()).filter(Boolean);
  if (!valid.length) return <>{text}</>;
  const esc = valid.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const parts = text.split(new RegExp(`(${esc})`, "i"));
  return (
    <>
      {parts.map((part, i) =>
        valid.some((p) => p.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className={cn("rounded px-0.5", tone === "good" ? "bg-success/20 text-success" : "bg-danger/20 text-danger line-through decoration-danger/60")}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function CorrectionCard({
  c,
  voiceId,
  onChange,
}: {
  c: Correction;
  voiceId: string;
  onChange: (c: Correction) => void;
}) {
  const [open, setOpen] = useState<"explain" | "practice" | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (c.dismissed) return null;
  const isError = c.kind === "error";

  async function explain(question?: string) {
    setLoading(true);
    setErr(null);
    try {
      const { answer } = await postJson<{ answer: string }>(`/api/corrections/${c.id}/explain`, { question });
      if (question) setThread((t) => [...t, { q: question, a: answer }]);
      else {
        setExplanation(answer);
        onChange({ ...c, explanationViewed: true });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load the explanation");
    } finally {
      setLoading(false);
    }
  }

  async function act(action: "save" | "unsave" | "dismiss") {
    try {
      onChange(await postJson<Correction>(`/api/corrections/${c.id}`, { action }, "PATCH"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  return (
    <aside
      aria-label="Correction"
      className={cn("animate-rise max-w-[34rem] rounded-xl border bg-card/80 p-3.5 text-sm shadow-md", isError ? "border-primary/40" : "border-border")}
    >
      <div className="mb-2 flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
        <Badge tone={isError ? "gold" : "default"}>{isError ? categoryLabel(c.category) : c.kind === "unnatural" ? "Sounds more natural" : "Style tip"}</Badge>
        <button onClick={() => act("dismiss")} aria-label="Dismiss correction" className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-muted-foreground">
        You said: <span className="text-foreground">“<Highlight text={c.original} pieces={c.changes.map((x) => x.from)} tone="bad" />”</span>
      </p>
      <p className="mt-1 text-muted-foreground">
        Better: <span className="font-display text-lg text-foreground">“<Highlight text={c.corrected} pieces={c.changes.map((x) => x.to)} tone="good" />”</span>
      </p>
      {c.explanation && <p className="mt-1.5 text-xs text-muted-foreground">{c.explanation}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant={open === "explain" ? "default" : "secondary"} onClick={() => { setOpen(open === "explain" ? null : "explain"); if (!explanation && open !== "explain") explain(); }}>
          <HelpCircle /> Explain
        </Button>
        <Button size="sm" variant={open === "practice" ? "default" : "secondary"} onClick={() => setOpen(open === "practice" ? null : "practice")}>
          <Mic /> Practice
        </Button>
        <Button size="sm" variant="secondary" onClick={() => act(c.saved ? "unsave" : "save")} aria-pressed={c.saved}>
          {c.saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />} {c.saved ? "Saved" : "Save"}
        </Button>
      </div>

      {open === "explain" && (
        <div className="mt-3 space-y-2">
          {loading && !explanation && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</p>}
          {explanation && <p className="whitespace-pre-wrap leading-relaxed">{explanation}</p>}
          {thread.map((t, i) => (
            <div key={i} className="space-y-1 border-l-2 border-border pl-3">
              <p className="text-muted-foreground">{t.q}</p>
              <p className="whitespace-pre-wrap">{t.a}</p>
            </div>
          ))}
          {explanation && (
            <form
              onSubmit={(e) => { e.preventDefault(); if (q.trim() && !loading) { const v = q.trim(); setQ(""); explain(v); } }}
              className="flex gap-2"
            >
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a follow-up…" aria-label="Follow-up question" maxLength={500} />
              <Button type="submit" size="icon" variant="secondary" disabled={loading || !q.trim()} aria-label="Ask">
                {loading ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </form>
          )}
        </div>
      )}
      {open === "practice" && (
        <div className="mt-3">
          <PracticePanel correctionId={c.id} sentence={c.corrected} voiceId={voiceId} onResult={() => onChange({ ...c, practiced: true })} />
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-xs text-danger">{err}</p>}
    </aside>
  );
}
