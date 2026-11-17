import { transcribe } from "@/lib/elevenlabs";
import { fail, handle, ok } from "@/lib/api";

export const maxDuration = 60;
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof File) || file.size === 0) return fail("No audio received.");
    if (file.size > MAX_BYTES) return fail("Recording is too large (10 MB max).");
    const text = await transcribe(file);
    if (!text) return fail("I couldn't hear any speech. Try again, closer to the microphone.", 422);
    return ok({ text });
  } catch (e) {
    return handle(e, true);
  }
}
