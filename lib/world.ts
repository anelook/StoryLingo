import { z } from "zod";
import { safeJson } from "./utils";

const str = (max: number) => z.string().trim().min(1).max(max);
const lenient = <T extends z.ZodTypeAny>(s: T) => s.optional().catch(undefined);

export const WorldStateSchema = z.object({
  location: z.string().max(200).default(""),
  characters: z
    .array(
      z.object({
        name: str(60),
        description: z.string().max(300).default(""),
        role: z.string().max(80).default(""),
        attitude: z.string().max(80).default(""),
      }),
    )
    .default([]),
  relationships: z.array(z.object({ a: str(60), b: str(60), status: str(120) })).default([]),
  inventory: z.array(str(80)).default([]),
  quests: z
    .array(
      z.object({
        title: str(100),
        description: z.string().max(300).default(""),
        status: z.enum(["active", "completed", "failed"]).default("active"),
      }),
    )
    .default([]),
  discoveries: z.array(str(200)).default([]),
  facts: z.array(str(200)).default([]),
  recentEvents: z.array(str(200)).default([]),
});
export type WorldState = z.infer<typeof WorldStateSchema>;

export const emptyWorld = (): WorldState => WorldStateSchema.parse({});

export function readWorld(raw: string): WorldState {
  const r = WorldStateSchema.safeParse(safeJson(raw, {}));
  return r.success ? r.data : emptyWorld();
}

/** Patch format the model is allowed to emit. Every field is optional and independently validated. */
export const StatePatchSchema = z
  .object({
    location: lenient(str(200)),
    upsertCharacters: lenient(
      z.array(z.object({ name: str(60), description: z.string().max(300).optional(), role: z.string().max(80).optional(), attitude: z.string().max(80).optional() })).max(8),
    ),
    upsertRelationships: lenient(z.array(z.object({ a: str(60), b: str(60), status: str(120) })).max(8)),
    addInventory: lenient(z.array(str(80)).max(6)),
    removeInventory: lenient(z.array(str(80)).max(6)),
    upsertQuests: lenient(
      z
        .array(z.object({ title: str(100), description: z.string().max(300).optional(), status: z.enum(["active", "completed", "failed"]).optional() }))
        .max(4),
    ),
    addDiscoveries: lenient(z.array(str(200)).max(4)),
    addFacts: lenient(z.array(str(200)).max(5)),
    recentEvents: lenient(z.array(str(200)).max(5)),
  })
  .catch({});
export type StatePatch = z.infer<typeof StatePatchSchema>;

const norm = (s: string) => s.trim().toLowerCase();
const uniq = (arr: string[]) => Array.from(new Map(arr.map((s) => [norm(s), s])).values());

/** Apply a validated patch to the world state, capping list sizes so state never grows unbounded. */
export function applyPatch(world: WorldState, patch: StatePatch | undefined): WorldState {
  if (!patch) return world;
  const w: WorldState = structuredClone(world);
  if (patch.location) w.location = patch.location;

  for (const c of patch.upsertCharacters ?? []) {
    const existing = w.characters.find((x) => norm(x.name) === norm(c.name));
    if (existing) {
      if (c.description) existing.description = c.description;
      if (c.role) existing.role = c.role;
      if (c.attitude) existing.attitude = c.attitude;
    } else {
      w.characters.push({ name: c.name, description: c.description ?? "", role: c.role ?? "", attitude: c.attitude ?? "" });
    }
  }
  for (const r of patch.upsertRelationships ?? []) {
    const existing = w.relationships.find(
      (x) => (norm(x.a) === norm(r.a) && norm(x.b) === norm(r.b)) || (norm(x.a) === norm(r.b) && norm(x.b) === norm(r.a)),
    );
    if (existing) existing.status = r.status;
    else w.relationships.push(r);
  }
  if (patch.addInventory) w.inventory = uniq([...w.inventory, ...patch.addInventory]);
  if (patch.removeInventory) {
    const rm = new Set(patch.removeInventory.map(norm));
    w.inventory = w.inventory.filter((i) => !rm.has(norm(i)));
  }
  for (const q of patch.upsertQuests ?? []) {
    const existing = w.quests.find((x) => norm(x.title) === norm(q.title));
    if (existing) {
      if (q.description) existing.description = q.description;
      if (q.status) existing.status = q.status;
    } else {
      w.quests.push({ title: q.title, description: q.description ?? "", status: q.status ?? "active" });
    }
  }
  if (patch.addDiscoveries) w.discoveries = uniq([...w.discoveries, ...patch.addDiscoveries]);
  if (patch.addFacts) w.facts = uniq([...w.facts, ...patch.addFacts]);
  if (patch.recentEvents?.length) w.recentEvents = patch.recentEvents;

  w.characters = w.characters.slice(-20);
  w.relationships = w.relationships.slice(-25);
  w.inventory = w.inventory.slice(-20);
  w.quests = w.quests.slice(-12);
  w.discoveries = w.discoveries.slice(-25);
  w.facts = w.facts.slice(-30);
  return WorldStateSchema.parse(w);
}
