import { prisma } from "@/lib/db";
import { adventureDTO } from "@/lib/dto";
import { handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return ok(await adventureDTO(await prisma.adventure.findUniqueOrThrow({ where: { id } })));
  } catch (e) {
    return handle(e);
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await prisma.adventure.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return handle(e);
  }
}
