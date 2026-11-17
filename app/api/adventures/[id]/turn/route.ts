import { z } from "zod";
import { prisma } from "@/lib/db";
import { storyTurn } from "@/lib/story";
import { adventureDTO, turnDTO } from "@/lib/dto";
import { fail, handle, ok } from "@/lib/api";

export const maxDuration = 120;
const Body = z.object({ turnId: z.string().min(1) });

// Step 2: the story's response to a saved player turn.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("turnId required");
  try {
    const { id } = await ctx.params;
    const { story, ideas, ended } = await storyTurn(id, parsed.data.turnId);
    const a = await adventureDTO(await prisma.adventure.findUniqueOrThrow({ where: { id } }));
    return ok({
      story: turnDTO(story),
      ideas,
      ended,
      meta: { chapter: a.chapter, sceneTitle: a.sceneTitle, status: a.status, turnCount: a.turnCount, world: a.world, voices: a.voices },
    });
  } catch (e) {
    return handle(e);
  }
}
