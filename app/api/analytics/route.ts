import { prisma } from "@/lib/db";
import { categoryStats } from "@/lib/learning";
import { categoryLabel } from "@/lib/constants";
import { correctionDTO } from "@/lib/dto";
import { handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: Request) {
  try {
    const category = new URL(req.url).searchParams.get("category");
    if (category) {
      const items = await prisma.correction.findMany({
        where: { category },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { attempts: { orderBy: { createdAt: "desc" } }, adventure: { select: { title: true } } },
      });
      return ok({
        category,
        label: categoryLabel(category),
        items: items.map((c) => ({
          ...correctionDTO(c),
          adventureTitle: c.adventure.title,
          attempts: c.attempts.map((a) => ({ id: a.id, transcript: a.transcript, success: a.success, feedback: a.feedback, createdAt: a.createdAt.toISOString() })),
        })),
      });
    }

    const [stats, errors, playerTurns, attempts, practicedCount, saved, adventuresCount, dueCount, recentPracticed] = await Promise.all([
      categoryStats(),
      prisma.correction.findMany({ where: { kind: "error" }, select: { createdAt: true, category: true } }),
      prisma.turn.findMany({ where: { role: "player", analyzed: true }, select: { createdAt: true } }),
      prisma.practiceAttempt.findMany({ select: { success: true } }),
      prisma.correction.count({ where: { practiced: true } }),
      prisma.correction.findMany({
        where: { saved: true },
        orderBy: { createdAt: "desc" },
        include: { attempts: { select: { success: true } } },
      }),
      prisma.adventure.count(),
      prisma.correction.count({ where: { saved: true, nextReviewAt: { lte: new Date() } } }),
      prisma.correction.findMany({
        where: { practiced: true },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { category: true },
      }),
    ]);

    // Error trend per day, relative to number of analysed player turns that day.
    const byDay = new Map<string, { errors: number; turns: number }>();
    const slot = (d: string) => byDay.get(d) ?? byDay.set(d, { errors: 0, turns: 0 }).get(d)!;
    for (const e of errors) slot(day(e.createdAt)).errors++;
    for (const t of playerTurns) slot(day(t.createdAt)).turns++;
    const trend = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, errors: v.errors, turns: v.turns, perTurn: v.turns ? +(v.errors / v.turns).toFixed(2) : null }));

    const recentTopics = [...new Set(recentPracticed.map((r) => r.category))].slice(0, 6).map((c) => ({ category: c, label: categoryLabel(c) }));

    const recommendations = stats
      .filter((s) => s.errors >= 2 && s.category !== "other")
      .sort((a, b) => (b.errorRate ?? 0) - (a.errorRate ?? 0) || b.errors - a.errors)
      .slice(0, 3)
      .map((s) => ({
        category: s.category,
        label: s.label,
        reason:
          s.errorRate !== null
            ? `${s.errors} mistakes in ${s.opportunities} tracked uses (${Math.round(s.errorRate * 100)}%).`
            : `${s.errors} mistakes so far — not enough tracked uses yet to calculate a rate.`,
      }));

    return ok({
      totals: {
        adventures: adventuresCount,
        errors: errors.length,
        analysedTurns: playerTurns.length,
        practicedCorrections: practicedCount,
        attempts: attempts.length,
        successfulAttempts: attempts.filter((a) => a.success).length,
        saved: saved.length,
        dueForReview: dueCount,
      },
      categories: stats,
      trend,
      recentTopics,
      recommendations,
      saved: saved.map((c) => ({
        ...correctionDTO(c),
        attempts: c.attempts.length,
        successes: c.attempts.filter((a) => a.success).length,
      })),
    });
  } catch (e) {
    return handle(e);
  }
}
