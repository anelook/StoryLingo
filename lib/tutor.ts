import { z } from "zod";
import { prisma } from "./db";
import { jsonCall } from "./ai";
import { LEVELS } from "./constants";
import { safeJson } from "./utils";
import type { Segment } from "./story";

const TutorSchema = z.object({
  reply: z.string().trim().min(1).max(2000),
  spanish: z.array(z.string().trim().min(1).max(200)).max(6).catch([]),
});

/** Tutor Mode: answers questions about Spanish. It never touches turns, world state or story summary. */
export async function tutorAsk(adventureId: string, message: string) {
  const a = await prisma.adventure.findUniqueOrThrow({ where: { id: adventureId } });
  const [recent, history] = await Promise.all([
    prisma.turn.findMany({ where: { adventureId }, orderBy: { idx: "desc" }, take: 3 }),
    prisma.tutorMessage.findMany({ where: { adventureId }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const scene = recent
    .reverse()
    .map((t) => safeJson<Segment[]>(t.segments, []).map((s) => `${s.speaker}: ${s.text}`).join("\n"))
    .join("\n");

  const out = await jsonCall({
    fast: true,
    temperature: 0.4,
    maxTokens: 900,
    schema: TutorSchema,
    system: `You are StoryLingo's Spanish tutor. The learner (${LEVELS.find((l) => l.id === a.level)?.label}, ${a.variety === "spain" ? "Spain" : "Latin American"} Spanish) paused their adventure to ask you something.
- Answer in English (Spanish examples with translations). Be concise and friendly, adapted to their level.
- You can explain grammar, translate words or sentences, clarify lines from the story, give example sentences, suggest vocabulary, or say how to express something (e.g. "How do I say I don't trust him?").
- If they ask you to speak more slowly, tell them to use the slow-speech toggle (turtle button) on audio playback and offer simpler wording.
- Do NOT continue or advance the story. Do not roleplay characters.
- "spanish": list the key Spanish phrases from your answer (max 6) so the learner can hear them.
Current scene (for reference only):
${scene}
Respond ONLY with JSON {"reply": string, "spanish": string[]}.`,
    messages: [
      ...history.reverse().map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.content })),
      { role: "user", content: message },
    ],
  });
  await prisma.tutorMessage.createMany({
    data: [
      { adventureId, role: "user", content: message },
      { adventureId, role: "assistant", content: out.reply },
    ],
  });
  return out;
}
