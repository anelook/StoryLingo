import { prisma } from "@/lib/db";
import { correctionDTO } from "@/lib/dto";
import { handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const [due, upcoming] = await Promise.all([
      prisma.correction.findMany({ where: { saved: true, nextReviewAt: { lte: now } }, orderBy: { nextReviewAt: "asc" }, take: 20 }),
      prisma.correction.findMany({ where: { saved: true, nextReviewAt: { gt: now } }, orderBy: { nextReviewAt: "asc" }, take: 20 }),
    ]);
    return ok({ due: due.map(correctionDTO), upcoming: upcoming.map(correctionDTO) });
  } catch (e) {
    return handle(e);
  }
}
