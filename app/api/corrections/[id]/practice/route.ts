import { evaluatePractice } from "@/lib/analysis";
import { transcribe } from "@/lib/elevenlabs";
import { fail, handle, ok } from "@/lib/api";

export const maxDuration = 60;
const MAX_BYTES = 10 * 1024 * 1024;

// Accepts either multipart audio (file) or a JSON/text transcript (edited by the learner).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const form = await req.formData();
    const review = form.get("review") === "1";
    let transcript = String(form.get("transcript") ?? "").trim();
    const file = form.get("audio");
    if (!transcript) {
      if (!(file instanceof File) || file.size === 0) return fail("No audio received.");
      if (file.size > MAX_BYTES) return fail("Recording is too large.");
      try {
        transcript = await transcribe(file);
      } catch (e) {
        return handle(e, true);
      }
      if (!transcript) return fail("I couldn't hear anything. Check your microphone and try again.", 422);
    }
    const result = await evaluatePractice(id, transcript, review);
    return ok({
      transcript,
      success: result.attempt.success,
      feedback: result.attempt.feedback,
      ratio: result.ratio,
      missing: result.missing,
    });
  } catch (e) {
    return handle(e);
  }
}
