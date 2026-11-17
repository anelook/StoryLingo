import OpenAI from "openai";
import type { ZodType } from "zod";

let client: OpenAI | null = null;

export class ConfigError extends Error {}

export function openai() {
  if (!process.env.OPENAI_API_KEY) {
    throw new ConfigError("OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server.");
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const MODEL = () => process.env.OPENAI_MODEL || "gpt-4.1";
export const FAST_MODEL = () => process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";

type Msg = { role: "system" | "user" | "assistant"; content: string };

/** Ask the model for a JSON object and validate it with zod. Retries once on invalid output. */
export async function jsonCall<T>(opts: {
  system: string;
  messages: Msg[];
  schema: ZodType<T>;
  fast?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openai().chat.completions.create({
      model: opts.fast ? FAST_MODEL() : MODEL(),
      temperature: opts.temperature ?? 0.8,
      max_completion_tokens: opts.maxTokens ?? 1800,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    try {
      return opts.schema.parse(JSON.parse(raw));
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`The AI returned an invalid response. ${lastErr instanceof Error ? lastErr.message.slice(0, 200) : ""}`);
}

export async function textCall(opts: { system: string; messages: Msg[]; fast?: boolean; temperature?: number; maxTokens?: number }) {
  const res = await openai().chat.completions.create({
    model: opts.fast ? FAST_MODEL() : MODEL(),
    temperature: opts.temperature ?? 0.5,
    max_completion_tokens: opts.maxTokens ?? 900,
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export function errorMessage(e: unknown) {
  if (e instanceof ConfigError) return e.message;
  if (e && typeof e === "object" && "status" in e) {
    const status = (e as { status?: number }).status;
    if (status === 401) return "The API key was rejected (401). Check your key in .env.local.";
    if (status === 429) return "Rate limit or quota reached (429). Try again shortly.";
  }
  return e instanceof Error ? e.message : "Unexpected error";
}
