import { Backpack, MapPin, ScrollText, Search, Users } from "lucide-react";
import type { World } from "@/lib/types";

function Block({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden /> {title}</h3>
      {children}
    </section>
  );
}

export function WorldPanel({ world }: { world: World }) {
  const quests = world.quests.filter((q) => q.status === "active");
  const empty = <p className="text-sm text-muted-foreground/70">Nothing yet.</p>;
  return (
    <div className="space-y-5 rounded-xl border border-border bg-card/70 p-4 text-sm">
      <h2 className="font-display text-lg font-semibold text-primary">Story world</h2>
      <Block icon={MapPin} title="Location"><p>{world.location || "Unknown"}</p></Block>
      <Block icon={ScrollText} title="Quests">
        {quests.length ? <ul className="space-y-1.5">{quests.map((q) => <li key={q.title}><span className="font-medium">{q.title}</span>{q.description && <span className="block text-xs text-muted-foreground">{q.description}</span>}</li>)}</ul> : empty}
      </Block>
      <Block icon={Users} title="People">
        {world.characters.length ? <ul className="space-y-1.5">{world.characters.map((c) => <li key={c.name}><span className="font-medium">{c.name}</span>{c.role && <span className="text-muted-foreground"> · {c.role}</span>}{world.relationships.filter((r) => r.a === c.name || r.b === c.name).slice(0, 1).map((r) => <span key={r.a + r.b} className="block text-xs text-muted-foreground">{r.status}</span>)}</li>)}</ul> : empty}
      </Block>
      <Block icon={Backpack} title="Inventory">{world.inventory.length ? <p>{world.inventory.join(", ")}</p> : empty}</Block>
      <Block icon={Search} title="Discoveries">{world.discoveries.length ? <ul className="list-inside list-disc space-y-1">{world.discoveries.slice(-5).map((d) => <li key={d}>{d}</li>)}</ul> : empty}</Block>
    </div>
  );
}
