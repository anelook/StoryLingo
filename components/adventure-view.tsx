"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CircleAlert, Compass, GraduationCap, Languages, Loader2, Map as MapIcon, Mic, Send, Square, Turtle, Volume2, VolumeX } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/field";
import { CorrectionCard } from "./correction-card";
import { PlayButton } from "./play-button";
import { TutorPanel } from "./tutor-panel";
import { WorldPanel } from "./world-panel";
import { api, postJson, transcribeBlob, useRecorder, useSpeech } from "@/lib/client";
import { NARRATOR_NAME, genreLabel } from "@/lib/constants";
import type { AdventureData, Correction, Turn, Vocab } from "@/lib/types";
import { cn } from "@/lib/utils";

const pref = (k: string, d: boolean) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : v === "1";
  } catch {
    return d;
  }
};
const setPref = (k: string, v: boolean) => {
  try {
    localStorage.setItem(k, v ? "1" : "0");
  } catch {}
};

function VocabChips({ vocab }: { vocab: Vocab[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!vocab.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Vocabulary help">
      <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {vocab.map((v) => (
        <button
          key={v.es}
          onClick={() => setOpen(open === v.es ? null : v.es)}
          className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", open === v.es ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
          aria-expanded={open === v.es}
        >
          {open === v.es ? `${v.es} = ${v.en}` : v.es}
        </button>
      ))}
    </div>
  );
}

export function AdventureView({ id }: { id: string }) {
  const [adv, setAdv] = useState<AdventureData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [retry, setRetry] = useState<string | null>(null); // saved player turn that still needs a story reply
  const [err, setErr] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [tutor, setTutor] = useState(false);
  const [world, setWorld] = useState(false);
  const [autoplay, setAutoplay] = useState(() => (typeof window === "undefined" ? false : pref("sl-autoplay", false)));
  const [slow, setSlow] = useState(() => (typeof window === "undefined" ? false : pref("sl-slow", false)));
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptNote, setTranscriptNote] = useState(false);
  const speech = useSpeech();
  const rec = useRecorder();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<AdventureData>(`/api/adventures/${id}`).then(setAdv).catch((e) => setLoadErr(e.message));
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [adv?.turns.length, thinking]);

  const speed = slow ? 0.8 : 1;
  const voiceFor = useCallback((speaker: string) => adv?.voices[speaker] ?? adv?.voices[NARRATOR_NAME] ?? "", [adv]);

  const patchTurn = (turnId: string, fn: (t: Turn) => Turn) => setAdv((a) => (a ? { ...a, turns: a.turns.map((t) => (t.id === turnId ? fn(t) : t)) } : a));
  const updateCorrection = (c: Correction) => patchTurn(c.turnId, (t) => ({ ...t, corrections: t.corrections.map((x) => (x.id === c.id ? c : x)) }));

  async function playSequence(turn: Turn, voices: Record<string, string>) {
    for (let i = 0; i < turn.segments.length; i++) {
      const s = turn.segments[i];
      await speech.play(`${turn.id}-${i}`, s.text, voices[s.speaker] ?? voices[NARRATOR_NAME], speed);
      if (!pref("sl-autoplay", false)) break;
    }
  }

  async function requestStory(playerTurnId: string) {
    setThinking(true);
    setErr(null);
    setRetry(null);
    try {
      const res = await postJson<{ story: Turn; ideas: string[]; ended: boolean; meta: Pick<AdventureData, "chapter" | "sceneTitle" | "status" | "turnCount" | "world" | "voices"> }>(
        `/api/adventures/${id}/turn`,
        { turnId: playerTurnId },
      );
      setAdv((a) => (a ? { ...a, ...res.meta, turns: a.turns.some((t) => t.id === res.story.id) ? a.turns : [...a.turns, res.story] } : a));
      setIdeas(res.ideas ?? []);
      setSave("saved");
      if (pref("sl-autoplay", false)) void playSequence(res.story, res.meta.voices);
    } catch (e) {
      setRetry(playerTurnId);
      setErr(e instanceof Error ? e.message : "The story couldn't continue");
      setSave("error");
    } finally {
      setThinking(false);
    }
  }

  async function submit() {
    const line = text.trim();
    if (!line || thinking || !adv) return;
    setText("");
    setIdeas([]);
    setTranscriptNote(false);
    speech.stop();
    setSave("saving");
    setErr(null);
    try {
      const player = await postJson<Turn>(`/api/adventures/${id}/say`, { text: line });
      setAdv((a) => (a ? { ...a, turns: [...a.turns, player] } : a));
      // Story and grammar analysis run independently; correction cards appear whenever analysis finishes.
      void requestStory(player.id);
      postJson<{ corrections: Correction[] }>(`/api/adventures/${id}/analyze`, { turnId: player.id })
        .then((r) => r.corrections.length && patchTurn(player.id, (t) => ({ ...t, corrections: r.corrections })))
        .catch(() => {});
    } catch (e) {
      setText(line);
      setErr(e instanceof Error ? e.message : "Couldn't send");
      setSave("error");
    }
  }

  async function toggleMic() {
    setErr(null);
    if (rec.state === "recording") {
      const blob = await rec.stop();
      if (!blob || blob.size < 1000) return setErr("That recording was empty — try again and speak for a little longer.");
      setTranscribing(true);
      try {
        const t = await transcribeBlob(blob);
        setText((prev) => (prev ? `${prev} ${t}` : t));
        setTranscriptNote(true);
        inputRef.current?.focus();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Transcription failed");
      } finally {
        setTranscribing(false);
      }
    } else {
      speech.stop();
      await rec.start();
    }
  }

  if (loadErr) return <p role="alert" className="p-8 text-danger">{loadErr} <Link href="/" className="underline">Back to adventures</Link></p>;
  if (!adv) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="animate-spin" /> Opening your adventure…</div>;

  const segState = (k: string) => (speech.loadingKey === k ? "loading" : speech.playingKey === k ? "playing" : "idle");
  const micErr = rec.error;

  return (
    <div className="-mx-4 flex min-h-[100dvh] flex-col sm:-mx-6">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link href="/" aria-label="Back to adventures" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-semibold leading-tight">{adv.title}</h1>
            <p className="truncate text-xs text-muted-foreground">
              Capítulo {adv.chapter}{adv.sceneTitle ? ` · ${adv.sceneTitle}` : ""} · {genreLabel(adv.genre)} · {adv.level}
            </p>
          </div>
          <span className={cn("hidden items-center gap-1 text-xs sm:flex", save === "error" ? "text-danger" : "text-muted-foreground")} aria-live="polite">
            {save === "saving" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : save === "error" ? <><CircleAlert className="h-3.5 w-3.5" /> Not saved</> : <><Check className="h-3.5 w-3.5 text-success" /> Saved</>}
          </span>
          <Button size="icon" variant={autoplay ? "default" : "ghost"} aria-pressed={autoplay} aria-label="Autoplay narration" title="Autoplay narration" onClick={() => { setAutoplay(!autoplay); setPref("sl-autoplay", !autoplay); }}>
            {autoplay ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button size="icon" variant={slow ? "default" : "ghost"} aria-pressed={slow} aria-label="Slow speech" title="Slower speech" onClick={() => { setSlow(!slow); setPref("sl-slow", !slow); }}>
            <Turtle />
          </Button>
          <Button size="icon" variant="ghost" className="lg:hidden" aria-label="Story world" onClick={() => setWorld(!world)}><MapIcon /></Button>
          <Button variant="secondary" onClick={() => { speech.stop(); setTutor(true); }}><GraduationCap /> <span className="hidden sm:inline">Tutor</span></Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 sm:px-6">
        <section className="flex min-w-0 flex-1 flex-col" aria-label="Story">
          <div className="flex-1 space-y-5 py-6">
            {adv.turns.map((t, ti) => {
              const newChapter = ti > 0 && t.chapter !== adv.turns[ti - 1].chapter;
              return (
                <div key={t.id} className="animate-rise">
                  {newChapter && (
                    <div className="my-8 flex items-center gap-3 text-center text-primary" role="separator">
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-primary/50" />
                      <span className="font-display text-lg tracking-widest">Capítulo {t.chapter}</span>
                      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-primary/50" />
                    </div>
                  )}
                  {t.role === "player" ? (
                    <div className="flex flex-col items-end gap-2">
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-primary/30 bg-primary/10 px-4 py-2.5">
                        <p className="mb-0.5 text-xs text-primary/80">{adv.characterName}</p>
                        <p className="leading-relaxed">{t.segments[0]?.text}</p>
                      </div>
                      {t.corrections.map((c) => (
                        <CorrectionCard key={c.id} c={c} voiceId={adv.voices[NARRATOR_NAME]} onChange={updateCorrection} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {t.segments.map((s, i) => {
                        const key = `${t.id}-${i}`;
                        const narr = s.kind === "narration";
                        return (
                          <div key={key} className={cn("flex items-start gap-2.5", narr ? "" : "max-w-[92%]")}>
                            <PlayButton className="mt-1" state={segState(key)} label={`${s.speaker} line`} onClick={() => (speech.playingKey === key ? speech.stop() : speech.play(key, s.text, voiceFor(s.speaker), speed))} />
                            {narr ? (
                              <p className={cn("font-display text-[1.28rem] leading-[1.6] text-foreground/95 transition-colors", speech.playingKey === key && "text-primary")}>{s.text}</p>
                            ) : (
                              <div className={cn("rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 transition-colors", speech.playingKey === key && "border-primary/60")}>
                                <p className="mb-0.5 text-xs font-medium text-accent">{s.speaker}</p>
                                <p className="leading-relaxed">“{s.text}”</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <VocabChips vocab={t.vocab} />
                    </div>
                  )}
                </div>
              );
            })}
            {thinking && (
              <p className="animate-flicker flex items-center gap-2 font-display text-lg text-muted-foreground"><Compass className="h-4 w-4" aria-hidden /> La historia continúa…</p>
            )}
            {adv.status === "completed" && <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center font-display text-lg text-primary">Fin — you can keep playing if you like.</p>}
            <div ref={endRef} />
          </div>

          <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/90 px-4 pb-4 pt-3 backdrop-blur sm:-mx-0 sm:rounded-t-xl sm:px-4">
            {adv.style === "guided" && ideas.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {ideas.map((i) => <button key={i} onClick={() => { setText(i); inputRef.current?.focus(); }} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">{i}</button>)}
              </div>
            )}
            {(err || micErr || speech.error) && (
              <div role="alert" className="mb-2 flex flex-wrap items-center gap-2 text-sm text-danger">
                <CircleAlert className="h-4 w-4" /> {err ?? micErr ?? speech.error}
                {retry && <Button size="sm" variant="secondary" onClick={() => requestStory(retry)} disabled={thinking}>Try again</Button>}
              </div>
            )}
            {transcriptNote && <p className="mb-1.5 text-xs text-muted-foreground">Check the transcript, edit if needed, then send.</p>}
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2">
              <Button type="button" size="icon" className={cn("h-11 w-11 shrink-0 rounded-full", rec.state === "recording" && "recording")} variant={rec.state === "recording" ? "danger" : "secondary"} onClick={toggleMic} disabled={transcribing} aria-label={rec.state === "recording" ? "Stop recording" : "Speak"} title={rec.state === "recording" ? "Stop recording" : "Speak (push to talk)"}>
                {transcribing ? <Loader2 className="animate-spin" /> : rec.state === "recording" ? <Square /> : <Mic />}
              </Button>
              <Textarea ref={inputRef} value={text} onChange={(e) => { setText(e.target.value); setTranscriptNote(false); }} rows={1} maxLength={600} disabled={transcribing}
                placeholder={rec.state === "recording" ? "Listening… press the mic to stop" : transcribing ? "Transcribing…" : `¿Qué haces o dices, ${adv.characterName}?`}
                aria-label="Your reply in Spanish" className="max-h-32 min-h-11 py-2.5 text-base"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
              <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!text.trim() || thinking} aria-label="Send"><Send /></Button>
            </form>
          </div>
        </section>

        <aside className="hidden w-72 shrink-0 py-6 lg:block"><div className="sticky top-20"><WorldPanel world={adv.world} /></div></aside>
      </div>

      {world && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setWorld(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-popover p-4" onClick={(e) => e.stopPropagation()}>
            <WorldPanel world={adv.world} />
          </div>
        </div>
      )}
      {tutor && <TutorPanel adventureId={id} voiceId={adv.voices[NARRATOR_NAME]} onClose={() => { setTutor(false); inputRef.current?.focus(); }} />}
    </div>
  );
}
