import { prisma } from "./db";
import { categoryLabel, REVIEW_INTERVALS_DAYS } from "./constants";

export type CategoryStat = {
  category: string;
  label: string;
  errors: number;
  correct: number;
  opportunities: number;
  /** errors / opportunities, or null when there is not enough data to say anything meaningful */
  errorRate: number | null;
};

const MIN_OPPORTUNITIES_FOR_RATE = 5;

export async function categoryStats(adventureId?: string): Promise<CategoryStat[]> {
  const corrWhere = { kind: "error", ...(adventureId ? { adventureId } : {}) };
  const obsWhere = { correct: true, ...(adventureId ? { turn: { adventureId } } : {}) };
  const [errs, oks] = await Promise.all([
    prisma.correction.groupBy({ by: ["category"], where: corrWhere, _count: { _all: true } }),
    prisma.categoryObservation.groupBy({ by: ["category"], where: obsWhere, _count: { _all: true } }),
  ]);
  const map = new Map<string, CategoryStat>();
  const get = (c: string) => {
    if (!map.has(c)) map.set(c, { category: c, label: categoryLabel(c), errors: 0, correct: 0, opportunities: 0, errorRate: null });
    return map.get(c)!;
  };
  for (const e of errs) get(e.category).errors = e._count._all;
  for (const o of oks) get(o.category).correct = o._count._all;
  for (const s of map.values()) {
    s.opportunities = s.errors + s.correct;
    s.errorRate = s.opportunities >= MIN_OPPORTUNITIES_FOR_RATE ? s.errors / s.opportunities : null;
  }
  return [...map.values()].sort((a, b) => b.errors - a.errors);
}

/** Grammar targets that the story engine should subtly work into upcoming scenes. */
export async function learningTargets() {
  const stats = await categoryStats();
  const weak = stats
    .filter((s) => s.errors >= 2 && s.category !== "other" && s.category !== "vocabulary")
    .sort((a, b) => (b.errorRate ?? b.errors / 10) - (a.errorRate ?? a.errors / 10))
    .slice(0, 2);
  const saved = await prisma.correction.findMany({
    where: { saved: true, kind: "error" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { corrected: true, category: true },
  });
  return { weak, saved };
}

export function nextReviewDate(step: number, from = new Date()) {
  const days = REVIEW_INTERVALS_DAYS[Math.min(step, REVIEW_INTERVALS_DAYS.length - 1)];
  return new Date(from.getTime() + days * 86400_000);
}
