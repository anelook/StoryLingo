import { NextResponse } from "next/server";
import { errorMessage } from "./ai";
import { elevenErrorMessage } from "./elevenlabs";

export const ok = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export function handle(e: unknown, eleven = false) {
  console.error(e);
  const msg = eleven ? elevenErrorMessage(e) : errorMessage(e);
  const notFound = e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2025";
  return fail(notFound ? "Not found" : msg, notFound ? 404 : 500);
}
