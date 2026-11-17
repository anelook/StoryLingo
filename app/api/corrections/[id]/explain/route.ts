import { z } from "zod";
import { explainCorrection } from "@/lib/analysis";
import { handle, ok } from "@/lib/api";

const Body = z.object({ question: z.string().trim().max(500).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const body = Body.safeParse(await req.json().catch(() => ({})));
  try {
    const { id } = await ctx.params;
    return ok({ answer: await explainCorrection(id, body.success ? body.data.question : undefined) });
  } catch (e) {
    return handle(e);
  }
}
