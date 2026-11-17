import { z } from "zod";
import { prisma } from "./db";
import { jsonCall, textCall } from "./ai";
import { CATEGORIES, CATEGORY_IDS, LEVELS, categoryLabel } from "./constants";
import { safeJson } from "./utils";
import { matchRatio } from "./compare";
import { nextReviewDate } from "./learning";
import type { Segment } from "./story";

const AnalysisSchema = z.object({
  corrections: z
    .array(
      z.object({
        original: z.string().trim().min(1).max(400),
        corrected: z.string().trim().min(1).max(400),
        changes: z.array(z.object({ from: z.string().max(80), to: z.string().max(80) })).max(6).catch([]),
        category: z.enum(CATEGORY_IDS).catch("other"),
        kind: z.enum(["error", "unnatural", "style"]).catch("style"),
        explanation: z.string().trim().max(500).catch(""),
        severity: z.number().int().min(1).max(3).catch(2),
      }),
    )
    .max(6)
    .catch([]),
  usedCorrectly: z.array(z.enum(CATEGORY_IDS).catch("other")).max(8).catch([]),
});

const CAP: Record<string, number> = { immersive: 1, balanced: 2, guided: 3 };
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export async function analyzeTurn(turnId: string) {
  const turn = await prisma.turn.findUniqueOrThrow({ where: { id: turnId }, include: { adventure: true } });
  if (turn.analyzed || turn.role !== "player") {
    return prisma.correction.findMany({ where: { turnId }, orderBy: { createdAt: "asc" } });
  }
  const a = turn.adventure;
  const text = (safeJson<Segment[]>(turn.segments, [])[0]?.text ?? "").trim();
  await prisma.turn.update({ where: { id: turnId }, data: { analyzed: true } });
  // Skip trivial inputs (one-word answers rarely contain analysable grammar).
  if (text.split(/\s+/).length < 2) return [];

  const prev = await prisma.turn.findFirst({ where: { adventureId: a.id, idx: { lt: turn.idx }, role: "narrator" }, orderBy: { idx: "desc" } });
  const context = prev ? safeJson<Segment[]>(prev.segments, []).map((s) => s.text).join(" ") : "";

  const res = await jsonCall({
    fast: true,
    temperature: 0.1,
    maxTokens: 1200,
    system: `You are a precise, kind Spanish teacher analysing ONE learner utterance from an interactive story game.
Learner level: ${LEVELS.find((l) => l.id === a.level)?.label}. Preferred variety: ${a.variety === "spain" ? "Spain" : "Latin America"}.

Rules:
- Only report REAL issues. Classify each as:
  "error" = genuine grammatical error (wrong conjugation, agreement, missing personal a, ser/estar, wrong preposition...).
  "unnatural" = understandable but a native would not say it this way (word order, awkward literal translation, misused vocabulary).
  "style" = optional improvement; the original is acceptable.
- NEVER flag valid regional variation (vosotros/ustedes, vos, leísmo, coger/tomar, "carro"/"coche"/"auto", etc.) and never flag informal speech, dropped subject pronouns, or missing accents/punctuation that would not be audible when SPOKEN (this text may come from speech transcription).
- Preserve the learner's intended meaning; change as little as possible. "corrected" must be a full natural sentence (or the offending sentence/clause) the learner could say aloud.
- "original" must be an exact quote from the utterance (the sentence or clause containing the issue). "changes" lists the specific word-level edits [{from,to}] ("from" may be "" for insertions).
- One entry per distinct issue. Do not report the same mistake twice. If one clause has two separate problems, make two entries only if they are different categories.
- If the learner wrote mostly in English, return one "unnatural" entry, category "vocabulary", giving the Spanish translation as "corrected".
- explanation: ONE short English sentence stating the rule, adapted to the level.
- severity: 3 = blocks understanding or a core basic rule, 2 = clear error, 1 = minor.
- category must be one of: ${CATEGORIES.map((c) => c.id).join(", ")}.
- usedCorrectly: categories (same list) the learner clearly used CORRECTLY in this utterance (e.g. a correct ser/estar choice, a correct preterite, a correct personal a, correct gender agreement). Only include categories actually attempted; do not include categories that appear in corrections.
- If the utterance is fine, return an empty corrections array.

Respond ONLY with JSON: {"corrections":[{"original","corrected","changes":[{"from","to"}],"category","kind","explanation","severity"}],"usedCorrectly":[category,...]}`,
    messages: [{ role: "user", content: `Story context (for meaning only): ${context.slice(0, 500)}\n\nLearner utterance: ${text}` }],
    schema: AnalysisSchema,
  });

  // Dedupe issues within one utterance: the same category on the same quoted text, or the same rewrite, counts once.
  const seen = new Set<string>();
  const unique = res.corrections
    .filter((c) => norm(c.original) !== norm(c.corrected))
    .sort((x, y) => y.severity - x.severity)
    .filter((c) => {
      const keys = [`${c.category}|${norm(c.original)}`, `rw|${norm(c.original)}>${norm(c.corrected)}`];
      if (keys.some((k) => seen.has(k))) return false;
      keys.forEach((k) => seen.add(k));
      return true;
    });

  // Prioritise real errors, then severity; cap by learning style.
  const rank = { error: 0, unnatural: 1, style: 2 } as const;
  const sorted = unique.sort((x, y) => rank[x.kind] - rank[y.kind] || y.severity - x.severity);
  const style = a.style;
  const filtered = sorted.filter((c) => {
    if (style === "immersive") return c.kind === "error" && c.severity >= 2;
    if (style === "balanced") return c.kind !== "style";
    return true;
  });
  const chosen = filtered.slice(0, CAP[style] ?? 2);

  for (const c of chosen) {
    await prisma.correction.create({
      data: {
        adventureId: a.id,
        turnId,
        original: c.original,
        corrected: c.corrected,
        changes: JSON.stringify(c.changes),
        category: c.category,
        kind: c.kind,
        explanation: c.explanation,
        severity: c.severity,
      },
    });
  }
  const errorCats = new Set(chosen.filter((c) => c.kind === "error").map((c) => c.category));
  const correctCats = new Set(res.usedCorrectly.filter((c) => !errorCats.has(c)));
  if (correctCats.size) {
    await prisma.categoryObservation.createMany({ data: [...correctCats].map((category) => ({ turnId, category, correct: true })) });
  }
  return prisma.correction.findMany({ where: { turnId }, orderBy: { createdAt: "asc" } });
}

export async function explainCorrection(correctionId: string, question?: string) {
  const c = await prisma.correction.findUniqueOrThrow({ where: { id: correctionId }, include: { adventure: true } });
  const level = LEVELS.find((l) => l.id === c.adventure.level)?.label;
  const answer = await textCall({
    fast: true,
    temperature: 0.4,
    maxTokens: 700,
    system: `You are a friendly Spanish tutor explaining in English to a ${level} learner. Be concise (max ~120 words). Include one or two short Spanish examples with English translations. Topic: ${categoryLabel(c.category)}.`,
    messages: [
      {
        role: "user",
        content: question
          ? `The learner said: "${c.original}". Better: "${c.corrected}". Rule given: ${c.explanation}\nFollow-up question: ${question}`
          : `The learner said: "${c.original}". Better: "${c.corrected}". Briefly explain the grammar rule behind this correction.`,
      },
    ],
  });
  if (!question) await prisma.correction.update({ where: { id: correctionId }, data: { explanationViewed: true } });
  return answer;
}

const JudgeSchema = z.object({
  acceptable: z.boolean().catch(false),
  feedback: z.string().trim().max(400).catch(""),
});

/** Evaluate a spoken repetition (as transcribed text) against the corrected sentence. */
export async function evaluatePractice(correctionId: string, transcript: string, isReview = false) {
  const c = await prisma.correction.findUniqueOrThrow({ where: { id: correctionId } });
  const m = matchRatio(c.corrected, transcript);
  let success = m.ratio >= 0.9;
  let feedback = "";

  if (success) {
    feedback = m.ratio === 1 ? "Well done — the recognised words match the corrected sentence." : "Nicely done — that matches the corrected sentence.";
  } else {
    try {
      const j = await jsonCall({
        fast: true,
        temperature: 0.2,
        maxTokens: 300,
        schema: JudgeSchema,
        system: `You judge a Spanish learner's spoken repetition (given as speech-to-text transcription) of a corrected sentence. The transcript may contain recognition noise, so ignore capitalisation, punctuation and accents. Accept it ("acceptable": true) if it is a valid, natural Spanish equivalent that fixes the original error (${categoryLabel(c.category)}), even if the wording differs. Reject if it still contains the original error or loses the meaning. Give ONE short encouraging English "feedback" sentence naming the specific difference. Never claim to assess pronunciation. Respond only with JSON {"acceptable":boolean,"feedback":string}.`,
        messages: [
          { role: "user", content: `Original (wrong): ${c.original}\nTarget: ${c.corrected}\nLearner's transcribed repetition: ${transcript}\nWords missing from the target: ${m.missing.join(", ") || "none"}` },
        ],
      });
      success = j.acceptable;
      feedback = j.feedback || (success ? "Good — that works as a valid way to say it." : "Close — try the corrected sentence once more.");
    } catch {
      success = m.ratio >= 0.8;
      feedback = success
        ? "Good — close enough to the corrected sentence."
        : `Not quite. Missing words: ${m.missing.join(", ") || "—"}. Try again.`;
    }
  }

  const attempt = await prisma.practiceAttempt.create({
    data: { correctionId, transcript, success, matchRatio: m.ratio, feedback, isReview },
  });
  const data: Record<string, unknown> = { practiced: true };
  if (c.saved) {
    if (success) {
      const step = c.reviewStep + 1;
      data.reviewStep = step;
      data.nextReviewAt = nextReviewDate(step);
    } else {
      data.reviewStep = 0;
      data.nextReviewAt = nextReviewDate(0);
    }
  }
  await prisma.correction.update({ where: { id: correctionId }, data });
  return { attempt, ratio: m.ratio, missing: m.missing };
}
