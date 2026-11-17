import { z } from "zod";
import { analyzeTurn } from "@/lib/analysis";
import { correctionDTO } from "@/lib/dto";
import { fail, handle, ok } from "@/lib/api";

export const maxDuration = 60;
const Body = z.object({ turnId: z.string().min(1) });

// Runs independently of the story request so correction cards can appear when ready.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("turnId required");
  try {
    const list = await analyzeTurn(parsed.data.turnId);
    return ok({ corrections: list.map(correctionDTO) });
  } catch (e) {
    return handle(e);
  }
}
