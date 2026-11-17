import { z } from "zod";
import { prisma } from "@/lib/db";
import { tutorAsk } from "@/lib/tutor";
import { fail, handle, ok } from "@/lib/api";

const Body = z.object({ adventureId: z.string().min(1), message: z.string().trim().min(1).max(800) });

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("adventureId");
  if (!id) return fail("adventureId required");
  const msgs = await prisma.tutorMessage.findMany({ where: { adventureId: id }, orderBy: { createdAt: "asc" }, take: 60 });
  return ok(msgs.map((m) => ({ id: m.id, role: m.role, content: m.content })));
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Please type a question.");
  try {
    return ok(await tutorAsk(parsed.data.adventureId, parsed.data.message));
  } catch (e) {
    return handle(e);
  }
}
