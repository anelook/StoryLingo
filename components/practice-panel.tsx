"use client";
import { useState } from "react";
import { Check, Loader2, Mic, RotateCcw, Square, Turtle, X } from "lucide-react";
import { Button } from "./ui/button";
import { PlayButton } from "./play-button";
import { api, audioFilename, useRecorder, useSpeech } from "@/lib/client";
import { cn } from "@/lib/utils";

type Result = { transcript: string; success: boolean; feedback: string; missing: string[] };

/** Listen to the corrected sentence, repeat it aloud, get transcript-based feedback. */
export function PracticePanel({
  correctionId,
  sentence,
  voiceId,
  review,
  onResult,
}: {
  correctionId: string;
  sentence: string;
  voiceId: string;
  review?: boolean;
  onResult?: (r: Result) => void;
}) {
  const speech = useSpeech();
  const rec = useRecorder();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const listen = (speed: number) => speech.play(`p-${correctionId}-${speed}`, sentence, voiceId, speed);
  const state = (k: string) => (speech.loadingKey === k ? "loading" : speech.playingKey === k ? "playing" : "idle");

  async function toggleRecord() {
    setError(null);
    if (rec.state === "recording") {
      const blob = await rec.stop();
      if (!blob || blob.size < 1000) return setError("That recording was empty. Hold the mic a little longer and speak clearly.");
      setBusy(true);
      try {
        const form = new FormData();
        form.append("audio", blob, audioFilename(blob));
        if (review) form.append("review", "1");
        const r = await api<Result>(`/api/corrections/${correctionId}/practice`, { method: "POST", body: form });
        setResult(r);
        setAttempts((n) => n + 1);
        onResult?.(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    } else {
      speech.stop();
      setResult(null);
      await rec.start();
    }
  }

  const err = error ?? rec.error ?? speech.error;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
      <p className="font-display text-lg leading-snug text-primary">{sentence}</p>
      <div className="flex flex-wrap items-center gap-2">
        <PlayButton state={state(`p-${correctionId}-1`)} onClick={() => (speech.playingKey ? speech.stop() : listen(1))} label="corrected sentence" />
        <Button size="sm" variant="ghost" onClick={() => listen(0.75)} aria-label="Play slowly">
          <Turtle /> Slow
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button size="sm" variant={rec.state === "recording" ? "danger" : "secondary"} onClick={toggleRecord} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : rec.state === "recording" ? <Square /> : attempts ? <RotateCcw /> : <Mic />}
          {busy ? "Checking…" : rec.state === "recording" ? "Stop" : attempts ? "Try again" : "Repeat it"}
        </Button>
        {rec.state === "recording" && <span className="recording h-2.5 w-2.5 rounded-full bg-danger" aria-label="Recording" />}
      </div>
      {result && (
        <div className={cn("animate-rise rounded-md border p-2.5 text-sm", result.success ? "border-success/40 bg-success/10" : "border-primary/30 bg-primary/5")}>
          <div className="flex items-center gap-1.5 font-medium">
            {result.success ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-primary" />}
            {result.success ? "Matched" : "Not quite yet"}
          </div>
          <p className="mt-1 text-muted-foreground">
            I heard: <span className="text-foreground">“{result.transcript}”</span>
          </p>
          <p className="mt-1">{result.feedback}</p>
        </div>
      )}
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <p className="text-xs text-muted-foreground">Feedback compares the words recognised from your speech — it can’t judge pronunciation itself.</p>
    </div>
  );
}
