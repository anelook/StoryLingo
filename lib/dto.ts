import { prisma } from "./db";
import { safeJson } from "./utils";
import { readWorld } from "./world";
import { narratorVoice, playerVoice } from "./voices";
import { NARRATOR_NAME } from "./constants";
import type { Adventure, Correction, Turn } from "./generated/prisma/client";
import type { Segment, VocabItem } from "./story";

export const correctionDTO = (c: Correction) => ({
  id: c.id,
  turnId: c.turnId,
  adventureId: c.adventureId,
  original: c.original,
  corrected: c.corrected,
  changes: safeJson<{ from: string; to: string }[]>(c.changes, []),
  category: c.category,
  kind: c.kind,
  explanation: c.explanation,
  severity: c.severity,
  dismissed: c.dismissed,
  explanationViewed: c.explanationViewed,
  saved: c.saved,
  practiced: c.practiced,
  nextReviewAt: c.nextReviewAt?.toISOString() ?? null,
  createdAt: c.createdAt.toISOString(),
});

export const turnDTO = (t: Turn, corrections: Correction[] = []) => ({
  id: t.id,
  idx: t.idx,
  role: t.role as "player" | "narrator",
  segments: safeJson<Segment[]>(t.segments, []),
  vocab: safeJson<VocabItem[]>(t.vocab, []),
  chapter: t.chapter,
  corrections: corrections.map(correctionDTO),
});

export async function adventureDTO(a: Adventure) {
  const [chars, turns] = await Promise.all([
    prisma.character.findMany({ where: { adventureId: a.id } }),
    prisma.turn.findMany({ where: { adventureId: a.id }, orderBy: { idx: "asc" }, include: { corrections: { orderBy: { createdAt: "asc" } } } }),
  ]);
  const voices: Record<string, string> = { [NARRATOR_NAME]: narratorVoice(a.variety), [a.characterName]: playerVoice(a.variety) };
  for (const c of chars) voices[c.name] = c.voiceId;
  return {
    id: a.id,
    title: a.title,
    genre: a.genre,
    level: a.level,
    style: a.style,
    variety: a.variety,
    length: a.length,
    characterName: a.characterName,
    sceneTitle: a.sceneTitle,
    chapter: a.chapter,
    turnCount: a.turnCount,
    status: a.status,
    updatedAt: a.updatedAt.toISOString(),
    world: readWorld(a.worldState),
    voices,
    turns: turns.map((t) => turnDTO(t, t.corrections)),
  };
}
