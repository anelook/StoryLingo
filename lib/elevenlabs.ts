import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { ConfigError } from "./ai";

let client: ElevenLabsClient | null = null;

function eleven() {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new ConfigError("ELEVENLABS_API_KEY is not set. Add it to .env.local and restart the dev server.");
  }
  client ??= new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  return client;
}

const TTS_MODEL = () => process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";
const STT_MODEL = () => process.env.ELEVENLABS_STT_MODEL || "scribe_v2";
const AUDIO_DIR = path.join(process.cwd(), "data", "audio");

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Text-to-speech with a local on-disk cache keyed by voice + model + speed + text. */
export async function synthesize(text: string, voiceId: string, speed = 1): Promise<{ audio: Buffer; cached: boolean }> {
  const s = Math.min(1.2, Math.max(0.7, speed));
  const key = createHash("sha256").update(`${voiceId}|${TTS_MODEL()}|${s}|${text}`).digest("hex");
  const file = path.join(AUDIO_DIR, `${key}.mp3`);
  try {
    return { audio: await fs.readFile(file), cached: true };
  } catch {
    /* cache miss */
  }
  const stream = await eleven().textToSpeech.convert(voiceId, {
    text,
    modelId: TTS_MODEL(),
    outputFormat: "mp3_44100_128",
    voiceSettings: { stability: 0.5, similarityBoost: 0.75, speed: s },
  });
  const audio = await streamToBuffer(stream);
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.writeFile(file, audio);
  return { audio, cached: false };
}

/** Speech-to-text with ElevenLabs Scribe. */
export async function transcribe(file: File): Promise<string> {
  const res = await eleven().speechToText.convert({
    file,
    modelId: STT_MODEL(),
    languageCode: "es",
    tagAudioEvents: false,
  });
  const text = "text" in res && typeof res.text === "string" ? res.text : "";
  return text.trim();
}

export function elevenErrorMessage(e: unknown) {
  if (e instanceof ConfigError) return e.message;
  const status = (e as { statusCode?: number })?.statusCode;
  if (status === 401) return "ElevenLabs rejected the API key (401). Check ELEVENLABS_API_KEY.";
  if (status === 402 || status === 429) return "ElevenLabs quota or rate limit reached. Try again later.";
  if (status === 422) return "ElevenLabs could not process that request (422). The voice or audio may be invalid.";
  return e instanceof Error ? e.message : "ElevenLabs request failed";
}
