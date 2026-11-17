"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Square, X } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/field";
import { PlayButton } from "./play-button";
import { api, postJson, transcribeBlob, useRecorder, useSpeech } from "@/lib/client";

type Msg = { id: string; role: "user" | "assistant"; content: string; spanish?: string[] };

const SUGGESTIONS = ["What's the difference between ser and estar?", "How do I say “I don't trust him”?", "Explain the last line of the story."];

export function TutorPanel({ adventureId, voiceId, onClose }: { adventureId: string; voiceId: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech();
  const rec = useRecorder();
  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    api<Msg[]>(`/api/tutor?adventureId=${adventureId}`).then(setMsgs).catch(() => {});
  }, [adventureId]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setErr(null);
    setText("");
    setMsgs((m) => [...m, { id: `u${Date.now()}`, role: "user", content: message }]);
    setBusy(true);
    try {
      const out = await postJson<{ reply: string; spanish: string[] }>("/api/tutor", { adventureId, message });
      setMsgs((m) => [...m, { id: `a${Date.now()}`, role: "assistant", content: out.reply, spanish: out.spanish }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The tutor couldn't answer");
    } finally {
      setBusy(false);
    }
  }

  async function mic() {
    if (rec.state === "recording") {
      const blob = await rec.stop();
      if (!blob) return;
      setTranscribing(true);
      try {
        setText(await transcribeBlob(blob));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Transcription failed");
      } finally {
        setTranscribing(false);
      }
    } else await rec.start();
  }

  return (
    <div role="dialog" aria-label="Tutor Mode" className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-popover shadow-2xl animate-rise">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-primary">Tutor Mode</h2>
          <p className="text-xs text-muted-foreground">Your adventure is paused. Nothing here changes the story.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Back to the adventure"><X /></Button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!msgs.length && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Ask about grammar, vocabulary, or anything in the story. In English is fine.</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary">{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={m.role === "user" ? "ml-8 rounded-xl bg-primary/15 px-3 py-2 text-sm" : "mr-4 space-y-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"}>
            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
            {!!m.spanish?.length && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {m.spanish.map((s, i) => {
                  const k = `${m.id}-${i}`;
                  return (
                    <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-2.5 pr-1 text-xs">
                      {s}
                      <PlayButton className="h-6 w-6" state={speech.loadingKey === k ? "loading" : speech.playingKey === k ? "playing" : "idle"} onClick={() => (speech.playingKey === k ? speech.stop() : speech.play(k, s, voiceId, 0.9))} label={s} />
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</p>}
        {(err || rec.error || speech.error) && <p role="alert" className="text-sm text-danger">{err ?? rec.error ?? speech.error}</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2 border-t border-border p-3">
        <Button type="button" size="icon" variant={rec.state === "recording" ? "danger" : "secondary"} onClick={mic} disabled={transcribing} aria-label={rec.state === "recording" ? "Stop recording" : "Ask by voice"}>
          {transcribing ? <Loader2 className="animate-spin" /> : rec.state === "recording" ? <Square /> : <Mic />}
        </Button>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Ask the tutor…" aria-label="Question for the tutor" maxLength={800}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send"><Send /></Button>
      </form>
    </div>
  );
}
