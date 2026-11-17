import { createHash } from "node:crypto";

// ElevenLabs premade voices. They work with the multilingual model and so speak Spanish,
// but their native accent is not regional. Override with env lists of voice IDs (e.g. Spanish-accent
// voices from your ElevenLabs Voice Library) to get closer to Spain / Latin American speech.
const DEFAULT_FEMALE = ["21m00Tcm4TlvDq8ikWAM", "EXAVITQu4vr4xnSDxMaL", "MF3mGyEYCl7XYWbV9V6O", "AZnzlk1XvdvUeBnXmlld"];
const DEFAULT_MALE = ["pNInz6obpgDQGcFmaJgB", "ErXwobaYiN019PkySvjV", "TxGEqnHWrfWFTfGW9XjX", "VR6AewLTigWG4xSOukaG"];

const list = (v: string | undefined, fallback: string[]) => {
  const ids = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids : fallback;
};

export type Gender = "female" | "male" | "neutral";

export function narratorVoice(variety: string): string {
  const specific = variety === "spain" ? process.env.ELEVENLABS_NARRATOR_VOICE_SPAIN : process.env.ELEVENLABS_NARRATOR_VOICE_LATAM;
  return specific || process.env.ELEVENLABS_NARRATOR_VOICE || DEFAULT_MALE[0];
}

/** Deterministic voice choice per character name, avoiding voices already used in this adventure. */
export function pickVoice(name: string, gender: Gender, variety: string, used: string[]): string {
  const pools = {
    female: list(
      variety === "spain" ? process.env.ELEVENLABS_VOICES_FEMALE_SPAIN : process.env.ELEVENLABS_VOICES_FEMALE_LATAM,
      list(process.env.ELEVENLABS_VOICES_FEMALE, DEFAULT_FEMALE),
    ),
    male: list(
      variety === "spain" ? process.env.ELEVENLABS_VOICES_MALE_SPAIN : process.env.ELEVENLABS_VOICES_MALE_LATAM,
      list(process.env.ELEVENLABS_VOICES_MALE, DEFAULT_MALE),
    ),
  };
  const pool =
    gender === "neutral" ? [...pools.female, ...pools.male] : pools[gender];
  const start = createHash("sha1").update(name.toLowerCase()).digest().readUInt16BE(0) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const v = pool[(start + i) % pool.length];
    if (!used.includes(v)) return v;
  }
  return pool[start];
}

export function playerVoice(variety: string): string {
  return process.env.ELEVENLABS_PLAYER_VOICE || (variety === "spain" ? DEFAULT_FEMALE[1] : DEFAULT_FEMALE[0]);
}
