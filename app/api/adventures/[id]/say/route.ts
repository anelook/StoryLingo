import { z } from "zod";
import { createPlayerTurn } from "@/lib/story";
import { turnDTO } from "@/lib/dto";
import { fail, handle, ok } from "@/lib/api";

const Body = z.object({ text: z.string().trim().min(1).max(600) });

// Step 1: persist the player's line immediately. The client then calls /turn (story) and /analyze (grammar) in parallel.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Please write or say something first.");
  try {
    const { id } = await ctx.params;
    return ok(turnDTO(await createPlayerTurn(id, parsed.data.text)));
  } catch (e) {
    return handle(e);
  }
}
