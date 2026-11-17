"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Network problem — is the dev server still running?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const postJson = <T = unknown,>(url: string, body: unknown, method = "POST") =>
  api<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/* ---------------------------- audio playback ---------------------------- */

const blobCache = new Map<string, string>(); // browser-side cache on top of the server's disk cache

export function useSpeech() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const done = useRef<(() => void) | null>(null);

  const finish = () => {
    done.current?.();
    done.current = null;
  };

  const stop = useCallback(() => {
    reqId.current++;
    finish();
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingKey(null);
    setLoadingKey(null);
  }, []);

  const play = useCallback(
    async (key: string, text: string, voiceId: string, speed = 1): Promise<void> => {
      stop();
      const my = ++reqId.current;
      const finished = new Promise<void>((r) => (done.current = r));
      setError(null);
      setLoadingKey(key);
      try {
        const cacheKey = `${voiceId}|${speed}|${text}`;
        let url = blobCache.get(cacheKey);
        if (!url) {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voiceId, speed }),
          });
          if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not generate audio");
          url = URL.createObjectURL(await res.blob());
          blobCache.set(cacheKey, url);
        }
        if (my !== reqId.current) return;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setPlayingKey((k) => (k === key ? null : k));
          finish();
        };
        audio.onerror = () => {
          setError("Audio playback failed");
          setPlayingKey(null);
          finish();
        };
        setLoadingKey(null);
        setPlayingKey(key);
        await audio.play();
        await finished;
      } catch (e) {
        if (my !== reqId.current) return;
        setLoadingKey(null);
        setPlayingKey(null);
        setError(e instanceof Error ? e.message : "Audio failed");
        finish();
      }
    },
    [stop],
  );

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);
  return { play, stop, playingKey, loadingKey, error, clearError: () => setError(null) };
}

/* ---------------------------- microphone ---------------------------- */

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export type RecState = "idle" | "recording" | "processing";

export function useRecorder() {
  const [state, setState] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const resolver = useRef<((b: Blob | null) => void) | null>(null);

  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError("Voice recording isn't supported in this browser. Please type instead.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = chunks.current.length ? new Blob(chunks.current, { type: rec.mimeType || mimeType || "audio/webm" }) : null;
        resolver.current?.(blob);
        resolver.current = null;
      };
      rec.start();
      recRef.current = rec;
      setState("recording");
      return true;
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access was blocked. Allow it in your browser's site settings and try again."
          : name === "NotFoundError"
            ? "No microphone was found."
            : "Couldn't start recording.",
      );
      setState("idle");
      return false;
    }
  }, [supported]);

  /** Stop and resolve with the recorded audio (null if nothing was captured). */
  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const rec = recRef.current;
        if (!rec || rec.state === "inactive") return resolve(null);
        resolver.current = resolve;
        rec.stop();
        setState("idle");
      }),
    [],
  );

  const cancel = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      resolver.current = null;
      rec.stop();
    }
    setState("idle");
  }, []);

  useEffect(() => {
    return () => cancel();
  }, [cancel]);
  return { state, setState, error, setError, supported, start, stop, cancel };
}

export function audioFilename(blob: Blob) {
  const t = blob.type;
  return t.includes("mp4") ? "speech.m4a" : t.includes("ogg") ? "speech.ogg" : "speech.webm";
}

export async function transcribeBlob(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", blob, audioFilename(blob));
  const res = await api<{ text: string }>("/api/stt", { method: "POST", body: form });
  return res.text;
}
