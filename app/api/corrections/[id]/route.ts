import { z } from "zod";
import { prisma } from "@/lib/db";
import { correctionDTO } from "@/lib/dto";
import { nextReviewDate } from "@/lib/learning";
import { fail, handle, ok } from "@/lib/api";

const Body = z.object({ action: z.enum(["save", "unsave", "dismiss"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid action");
  try {
    const { id } = await ctx.params;
    const c = await prisma.correction.findUniqueOrThrow({ where: { id } });
    const data =
      parsed.data.action === "save"
        ? { saved: true, nextReviewAt: c.nextReviewAt ?? nextReviewDate(0), reviewStep: c.nextReviewAt ? c.reviewStep : 0 }
        : parsed.data.action === "unsave"
          ? { saved: false, nextReviewAt: null }
          : { dismissed: true };
    return ok(correctionDTO(await prisma.correction.update({ where: { id }, data })));
  } catch (e) {
    return handle(e);
  }
}
