import { z } from "zod";
import { prisma } from "./db";
import { jsonCall, textCall } from "./ai";
import { applyPatch, readWorld, StatePatchSchema, type WorldState } from "./world";
import { GENRES, LENGTHS, LEVELS, NARRATOR_NAME, categoryLabel } from "./constants";
import { learningTargets } from "./learning";
import { narratorVoice, pickVoice, playerVoice, type Gender } from "./voices";
import { safeJson } from "./utils";
import type { Adventure } from "./generated/prisma/client";

export type Segment = { speaker: string; kind: "narration" | "dialogue"; text: string };
export type VocabItem = { es: string; en: string };

const SegmentSchema = z.object({
  speaker: z.string().trim().min(1).max(60),
  kind: z.enum(["narration", "dialogue"]).catch("narration"),
  text: z.string().trim().min(1).max(900),
});

const StoryResponseSchema = z.object({
  title: z.string().trim().max(80).optional().catch(undefined),
  sceneTitle: z.string().trim().max(80).optional().catch(undefined),
  segments: z.array(SegmentSchema).min(1).max(6),
  vocab: z
    .array(z.object({ es: z.string().trim().min(1).max(60), en: z.string().trim().min(1).max(80) }))
    .max(6)
    .catch([]),
  newCharacters: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        description: z.string().trim().max(300).catch(""),
        gender: z.enum(["female", "male", "neutral"]).catch("neutral"),
      }),
    )
    .max(5)
    .catch([]),
  stateUpdate: StatePatchSchema,
  chapterAdvance: z.boolean().catch(false),
  ended: z.boolean().catch(false),
  ideas: z.array(z.string().trim().max(120)).max(3).catch([]),
});
type StoryResponse = z.infer<typeof StoryResponseSchema>;

const LEVEL_GUIDE: Record<string, string> = {
  A1: "A1: present tense almost exclusively, very short sentences (5-8 words), the 500 most common words, concrete nouns. No subjunctive.",
  A2: "A2: present, preterite and simple future (ir a + infinitive), short sentences, everyday vocabulary, simple connectors (y, pero, porque).",
  B1: "B1: past tenses (preterite/imperfect), future, simple conditional, common subjunctive in set phrases; sentences up to ~15 words; some idiomatic expressions.",
  B2: "B2: full range of tenses including present and imperfect subjunctive, compound sentences, richer descriptive vocabulary and idioms.",
  C1: "C1: natural, literary-leaning Spanish, nuanced vocabulary, complex subordination, idiomatic and figurative language, varied register.",
};

const STYLE_GUIDE: Record<string, string> = {
  immersive: "Immersive: focus purely on the story; do not add teaching asides. Offer at most 1-2 vocab items per turn.",
  balanced: "Balanced: mostly story; offer 2-3 useful vocab items per turn for words that might be new at this level.",
  guided: "Guided: offer 3-5 vocab items per turn for new words, and keep phrasing extra clear. Provide 2 'ideas' (short Spanish suggestions of what the player might say or do next).",
};

function variety(v: string) {
  return v === "spain"
    ? "Castilian Spanish from Spain (use 'vosotros' naturally among peers if it fits, 'coger', 'ordenador', etc.). The player may use either variety; never treat valid regional forms as wrong."
    : "Latin American Spanish (use 'ustedes', not 'vosotros'; neutral Latin American vocabulary).";
}

async function systemPrompt(a: Adventure, world: WorldState, mode: "opening" | "turn") {
  const genre = GENRES.find((g) => g.id === a.genre);
  const length = LENGTHS.find((l) => l.id === a.length);
  const targets = await learningTargets();
  const adaptive =
    targets.weak.length || targets.saved.length
      ? `\nHIDDEN LEARNING TARGETS (never mention these to the player, never make it feel like an exercise): the learner tends to struggle with ${targets.weak
          .map((w) => categoryLabel(w.category))
          .join(", ") || "none specific"}. Where it fits the plot naturally, create situations that invite the player to use those structures — e.g. for ser/estar: describing people, places, emotions and temporary states; for past tense: asking the player to recount what happened; for personal 'a': looking for or meeting people; for prepositions: giving or asking directions. Only do this when it serves the story.`
      : "";
  const pacing =
    length && length.turns
      ? `Target length: about ${length.turns} player turns. Current turn: ${a.turnCount + 1}. ${
          a.turnCount + 1 >= length.turns - 2 ? "The story should now be reaching a satisfying conclusion; set ended=true when it concludes." : "Build toward a climax gradually."
        }`
      : "Open-ended story: keep raising stakes and offering new threads; never conclude unless the player clearly wants to.";

  return `You are StoryLingo's story engine for a Spanish learner. You are simultaneously the NARRATOR, every NON-PLAYER CHARACTER, the STORY DIRECTOR, and the player's collaborative storytelling partner.

SETTING
- Genre: ${genre?.label ?? a.genre}. Player character: ${a.characterName}. ${a.premise ? `Premise from the player: ${a.premise}` : "No premise given; invent a compelling one."}
- Spanish variety: ${variety(a.variety)}
- Learner level: ${LEVELS.find((l) => l.id === a.level)?.label}. ${LEVEL_GUIDE[a.level]}
- Learning style: ${STYLE_GUIDE[a.style]}
- ${pacing}
${adaptive}

HARD RULES
- Everything the player reads is in Spanish at the learner's level. Vocab glosses are in English.
- Keep each reply concise: 2-4 segments, about 40-90 Spanish words total (fewer at A1/A2), so the player speaks often.
- Segments: kind "narration" uses speaker "${NARRATOR_NAME}". kind "dialogue" uses the character's exact name as speaker (same spelling every time). Never write dialogue or actions for the player character ${a.characterName}; never decide the player's choices.
- Accept and incorporate any creative suggestion from the player that fits the established world (e.g. a dog named Pablo, "the man is a wizard", "I don't trust her") — make the world respond. If something truly contradicts established facts, adapt it gracefully rather than refusing.
- Maintain continuity with the world state and facts. Avoid repeating earlier descriptions. Allow unexpected solutions. Do not force a rigid storyline.
- End every reply with a natural opening for the player to act or speak (a question, a decision, a sound, a character waiting).
- If the player's message is not Spanish or is unclear, still respond in-story in simple Spanish, interpreting the most likely meaning.
- Introduce interesting characters, mysteries and conflicts. Reward curiosity.
- stateUpdate is a PATCH of the world. Only include fields that changed this turn. recentEvents (if included) REPLACES the list: give the last 3-5 key events, one short English-or-Spanish sentence each.
- newCharacters: list any named character appearing for the FIRST time (with gender for voice casting). The narrator is not a character.
- chapterAdvance=true only when a meaningful story beat concludes and a new chapter begins (roughly every 6-10 turns).
- sceneTitle: a short evocative title (Spanish) for the current scene, update when the scene changes.
${mode === "opening" ? `- This is the OPENING scene. Also return "title" (a compelling Spanish story title unless the player supplied one: "${a.title}"). Establish the location, one intriguing character or situation, and an inciting hook. Populate stateUpdate with location, characters, quests and facts.` : ""}

Respond ONLY with a JSON object of this shape:
{"title"?: string, "sceneTitle": string, "segments": [{"speaker": string, "kind": "narration"|"dialogue", "text": string}], "vocab": [{"es": string, "en": string}], "newCharacters": [{"name": string, "description": string, "gender": "female"|"male"|"neutral"}], "stateUpdate": {"location"?: string, "upsertCharacters"?: [{"name","description"?,"role"?,"attitude"?}], "upsertRelationships"?: [{"a","b","status"}], "addInventory"?: string[], "removeInventory"?: string[], "upsertQuests"?: [{"title","description"?,"status"?: "active"|"completed"|"failed"}], "addDiscoveries"?: string[], "addFacts"?: string[], "recentEvents"?: string[]}, "chapterAdvance": boolean, "ended": boolean, "ideas": string[]}

CURRENT WORLD STATE (authoritative, stored separately from dialogue):
${JSON.stringify(world)}

STORY SO FAR (summary of earlier events):
${a.summary || "(the story is just beginning)"}`;
}

const flatten = (segs: Segment[]) => segs.map((s) => `${s.speaker}: ${s.text}`).join("\n");

async function recentMessages(a: Adventure, limit = 10, before = Infinity) {
  const turns = await prisma.turn.findMany({ where: { adventureId: a.id, ...(Number.isFinite(before) ? { idx: { lt: before } } : {}) }, orderBy: { idx: "desc" }, take: limit });
  return turns.reverse().map((t) => ({
    role: (t.role === "player" ? "user" : "assistant") as "user" | "assistant",
    content: flatten(safeJson<Segment[]>(t.segments, [])),
  }));
}

/** Make sure each speaking character has a persistent voice. Returns the adventure's speaker→voice map. */
export async function ensureVoices(adventureId: string, variety: string, speakers: string[], newChars: StoryResponse["newCharacters"] = []) {
  const existing = await prisma.character.findMany({ where: { adventureId } });
  const used = existing.map((c) => c.voiceId);
  const have = new Set(existing.map((c) => c.name.toLowerCase()));
  for (const name of new Set(speakers)) {
    if (name === NARRATOR_NAME || have.has(name.toLowerCase())) continue;
    const meta = newChars.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const voiceId = pickVoice(name, (meta?.gender ?? "neutral") as Gender, variety, used);
    used.push(voiceId);
    have.add(name.toLowerCase());
    await prisma.character.create({ data: { adventureId, name, description: meta?.description ?? "", voiceId } });
  }
  const all = await prisma.character.findMany({ where: { adventureId } });
  const voices: Record<string, string> = { [NARRATOR_NAME]: narratorVoice(variety) };
  for (const c of all) voices[c.name] = c.voiceId;
  return voices;
}

export type CreateInput = {
  genre: string;
  level: string;
  style: string;
  variety: string;
  length: string;
  characterName: string;
  premise?: string;
  title?: string;
};

export async function createAdventure(input: CreateInput) {
  const adventure = await prisma.adventure.create({
    data: {
      title: input.title?.trim() || "Nueva aventura",
      genre: input.genre,
      level: input.level,
      style: input.style,
      variety: input.variety,
      length: input.length,
      characterName: input.characterName,
      premise: input.premise?.trim() ?? "",
    },
  });
  try {
    const res = await jsonCall({
      system: await systemPrompt(adventure, readWorld(adventure.worldState), "opening"),
      messages: [{ role: "user", content: "Begin the adventure with the opening scene." }],
      schema: StoryResponseSchema,
    });
    await commitStoryTurn(adventure, res, true);
    return adventure.id;
  } catch (e) {
    await prisma.adventure.delete({ where: { id: adventure.id } }).catch(() => {});
    throw e;
  }
}

async function commitStoryTurn(a: Adventure, res: StoryResponse, opening = false) {
  const world = applyPatch(readWorld(a.worldState), res.stateUpdate);
  const chapter = a.chapter + (res.chapterAdvance && !opening ? 1 : 0);
  const speakers = res.segments.map((s) => s.speaker);
  await ensureVoices(a.id, a.variety, speakers, res.newCharacters);
  const last = await prisma.turn.findFirst({ where: { adventureId: a.id }, orderBy: { idx: "desc" } });
  const turn = await prisma.turn.create({
    data: {
      adventureId: a.id,
      idx: (last?.idx ?? -1) + 1,
      role: "narrator",
      segments: JSON.stringify(res.segments),
      vocab: JSON.stringify(res.vocab),
      chapter,
      analyzed: true,
    },
  });
  for (const v of res.vocab) {
    await prisma.vocabEntry.upsert({
      where: { es: v.es.toLowerCase() },
      create: { es: v.es.toLowerCase(), en: v.en },
      update: { seen: { increment: 1 } },
    });
  }
  await prisma.adventure.update({
    where: { id: a.id },
    data: {
      worldState: JSON.stringify(world),
      chapter,
      sceneTitle: res.sceneTitle || a.sceneTitle,
      ...(opening && res.title && (a.title === "Nueva aventura") ? { title: res.title } : {}),
      ...(res.ended ? { status: "completed" } : {}),
    },
  });
  return turn;
}

export async function createPlayerTurn(adventureId: string, text: string) {
  const a = await prisma.adventure.findUniqueOrThrow({ where: { id: adventureId } });
  const last = await prisma.turn.findFirst({ where: { adventureId }, orderBy: { idx: "desc" } });
  return prisma.turn.create({
    data: {
      adventureId,
      idx: (last?.idx ?? -1) + 1,
      role: "player",
      segments: JSON.stringify([{ speaker: a.characterName, kind: "dialogue", text }]),
      chapter: a.chapter,
    },
  });
}

/** Generate the story's reply to an already-saved player turn. */
export async function storyTurn(adventureId: string, playerTurnId: string) {
  const a = await prisma.adventure.findUniqueOrThrow({ where: { id: adventureId } });
  const player = await prisma.turn.findFirstOrThrow({ where: { id: playerTurnId, adventureId, role: "player" } });
  const text = safeJson<Segment[]>(player.segments, [])[0]?.text ?? "";
  const history = await recentMessages(a, 10, player.idx);
  const res = await jsonCall({
    system: await systemPrompt(a, readWorld(a.worldState), "turn"),
    messages: [...history, { role: "user", content: `${a.characterName}: ${text}` }],
    schema: StoryResponseSchema,
  });
  // A concurrent/duplicate request may already have answered this turn.
  const existing = await prisma.turn.findFirst({ where: { adventureId, idx: { gt: player.idx } }, orderBy: { idx: "asc" } });
  if (existing) return { story: existing, ideas: [] as string[], ended: false };
  const fresh = await prisma.adventure.update({ where: { id: adventureId }, data: { turnCount: { increment: 1 } } });
  const story = await commitStoryTurn(fresh, res);
  void maybeSummarize(adventureId).catch(() => {});
  return { story, ideas: res.ideas, ended: res.ended };
}

const KEEP_RECENT = 8;
const SUMMARIZE_AFTER = 16;

/** Roll older turns into the running summary so we never resend the full transcript. */
export async function maybeSummarize(adventureId: string) {
  const a = await prisma.adventure.findUniqueOrThrow({ where: { id: adventureId } });
  const last = await prisma.turn.findFirst({ where: { adventureId }, orderBy: { idx: "desc" } });
  if (!last) return;
  const cutoff = last.idx - KEEP_RECENT;
  if (cutoff - a.summarizedThrough < SUMMARIZE_AFTER - KEEP_RECENT) return;
  const old = await prisma.turn.findMany({
    where: { adventureId, idx: { gt: a.summarizedThrough, lte: cutoff } },
    orderBy: { idx: "asc" },
  });
  if (!old.length) return;
  const transcript = old.map((t) => flatten(safeJson<Segment[]>(t.segments, []))).join("\n");
  const summary = await textCall({
    fast: true,
    temperature: 0.2,
    maxTokens: 700,
    system:
      "You maintain a compact running summary of an interactive story, in English, max 220 words. Merge the existing summary with the new passages. Keep names, decisions the player made, promises, unresolved mysteries and relationships. Output only the summary.",
    messages: [{ role: "user", content: `EXISTING SUMMARY:\n${a.summary || "(none)"}\n\nNEW PASSAGES:\n${transcript}` }],
  });
  if (summary) await prisma.adventure.update({ where: { id: adventureId }, data: { summary, summarizedThrough: cutoff } });
}

export { playerVoice };
