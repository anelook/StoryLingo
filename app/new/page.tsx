"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { postJson } from "@/lib/client";
import { GENRES, LENGTHS, LEVELS, STYLES, VARIETIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

function Choice<T extends string>({ value, onChange, options, cols = "sm:grid-cols-2" }: { value: T; onChange: (v: T) => void; options: readonly { id: T; label: string; blurb?: string }[]; cols?: string }) {
  return (
    <div role="radiogroup" className={cn("grid gap-2", cols)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value === o.id ? "border-primary bg-primary/10" : "border-border bg-card/60 hover:border-primary/40")}
        >
          <span className="block font-medium">{o.label}</span>
          {o.blurb && <span className="block text-xs text-muted-foreground">{o.blurb}</span>}
        </button>
      ))}
    </div>
  );
}

export default function NewAdventure() {
  const router = useRouter();
  const [genre, setGenre] = useState("fantasy");
  const [level, setLevel] = useState("A2");
  const [style, setStyle] = useState("balanced");
  const [variety, setVariety] = useState("latam");
  const [length, setLength] = useState("medium");
  const [characterName, setName] = useState("");
  const [premise, setPremise] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { id } = await postJson<{ id: string }>("/api/adventures", { genre, level, style, variety, length, characterName: characterName.trim() || "Aventurero", premise, title });
      router.push(`/adventure/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't create the adventure");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold">Begin a new adventure</h1>
        <p className="mt-1 text-muted-foreground">Choose the world and how much help you want. You can always ask the tutor mid-story.</p>
      </div>
      <section><Label>Story genre</Label><Choice value={genre} onChange={setGenre} options={GENRES.map((g) => ({ id: g.id, label: `${g.label}`, blurb: g.blurb }))} /></section>
      <section><Label>Spanish level</Label><Choice value={level} onChange={setLevel} cols="grid-cols-2 sm:grid-cols-5" options={LEVELS.map((l) => ({ id: l.id, label: l.id, blurb: l.label.split("— ")[1] }))} /></section>
      <section><Label>Learning style</Label><Choice value={style} onChange={setStyle} cols="sm:grid-cols-3" options={STYLES} /></section>
      <div className="grid gap-6 sm:grid-cols-2">
        <section><Label>Spanish variety</Label><Choice value={variety} onChange={setVariety} cols="grid-cols-2" options={VARIETIES} /></section>
        <section><Label>Story length</Label><Choice value={length} onChange={setLength} options={LENGTHS} /></section>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><Label hint="optional">Your character’s name</Label><Input value={characterName} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lucía" maxLength={40} /></label>
        <label className="block"><Label hint="optional">Story title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Let the story name itself" maxLength={80} /></label>
      </div>
      <label className="block"><Label hint="optional">Starting premise</Label><Textarea rows={3} value={premise} onChange={(e) => setPremise(e.target.value)} placeholder="e.g. I arrive in a mountain village where every clock has stopped." maxLength={500} /></label>
      {err && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</p>}
      <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">
        {busy ? <><Loader2 className="animate-spin" /> Weaving your opening scene…</> : <><Sparkles /> Start the adventure</>}
      </Button>
    </form>
  );
}
