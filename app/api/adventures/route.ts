import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAdventure } from "@/lib/story";
import { fail, handle, ok } from "@/lib/api";
import { GENRES, LENGTHS, LEVELS, STYLES, VARIETIES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ids = <T extends readonly { id: string }[]>(list: T) => list.map((x) => x.id) as [string, ...string[]];
const Body = z.object({
  genre: z.enum(ids(GENRES)),
  level: z.enum(ids(LEVELS)),
  style: z.enum(ids(STYLES)),
  variety: z.enum(ids(VARIETIES)),
  length: z.enum(ids(LENGTHS)),
  characterName: z.string().trim().min(1).max(40),
  premise: z.string().trim().max(500).optional(),
  title: z.string().trim().max(80).optional(),
});

export async function GET() {
  const list = await prisma.adventure.findMany({ orderBy: { updatedAt: "desc" } });
  return ok(
    list.map((a) => ({
      id: a.id, title: a.title, genre: a.genre, level: a.level, style: a.style, variety: a.variety,
      characterName: a.characterName, sceneTitle: a.sceneTitle, chapter: a.chapter, turnCount: a.turnCount,
      status: a.status, updatedAt: a.updatedAt.toISOString(),
    })),
  );
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Please complete the adventure setup (invalid or missing fields).");
  try {
    const id = await createAdventure(parsed.data);
    return ok({ id });
  } catch (e) {
    return handle(e);
  }
}
