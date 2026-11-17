import { z } from "zod";
import { synthesize } from "@/lib/elevenlabs";
import { fail, handle } from "@/lib/api";

export const maxDuration = 60;
const Body = z.object({
  text: z.string().trim().min(1).max(1200),
  voiceId: z.string().regex(/^[A-Za-z0-9]{10,40}$/),
  speed: z.number().min(0.7).max(1.2).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid speech request");
  try {
    const { audio, cached } = await synthesize(parsed.data.text, parsed.data.voiceId, parsed.data.speed ?? 1);
    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400", "X-Audio-Cache": cached ? "hit" : "miss" },
    });
  } catch (e) {
    return handle(e, true);
  }
}
