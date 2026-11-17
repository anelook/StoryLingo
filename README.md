# StoryLingo

An interactive Spanish adventure game with a built-in AI tutor. You speak or write Spanish, the AI narrates and plays every character, and a correction engine quietly helps you improve.

Local-first: Next.js (App Router) + TypeScript + Tailwind + SQLite/Prisma. The only external services are **OpenAI** (story, grammar analysis, tutor) and **ElevenLabs** (Spanish TTS and Scribe speech-to-text). API keys stay on the server. No auth — single local user, bound to your machine.

## Run it

```bash
npm install            # also runs `prisma generate`
cp .env-example .env.local   # then add OPENAI_API_KEY and ELEVENLABS_API_KEY
npm run db:push        # creates prisma/dev.db
npm run dev -- -H 127.0.0.1   # http://127.0.0.1:3000 — localhost only
```

Microphone recording needs `localhost`/`127.0.0.1` (a secure context). Use Chrome, Edge, Firefox or Safari.

### Optional configuration (`.env.local`)
| Variable | Default |
|---|---|
| `OPENAI_MODEL` / `OPENAI_FAST_MODEL` | `gpt-4.1` (story) / `gpt-4.1-mini` (analysis, tutor, summaries) |
| `ELEVENLABS_TTS_MODEL` | `eleven_multilingual_v2` |
| `ELEVENLABS_STT_MODEL` | `scribe_v2` |
| `ELEVENLABS_NARRATOR_VOICE_SPAIN` / `_LATAM`, `ELEVENLABS_VOICES_FEMALE[_SPAIN\|_LATAM]`, `ELEVENLABS_VOICES_MALE[_SPAIN\|_LATAM]` | built-in premade voices |

**Accents:** the default voices are ElevenLabs premade voices. They speak Spanish through the multilingual model but are not regionally accented. For Spain / Latin American voices, add Spanish voices from your ElevenLabs Voice Library and list their IDs (comma-separated) in the variables above.

## How it works
- **Story engine** (`lib/story.ts`): each turn sends the system prompt (level, style, variety, hidden learning targets), the structured **world state**, a rolling **summary**, and the last ~10 turns. Older turns are folded into the summary in the background. Model output is validated with zod; the world-state *patch* is validated field by field before being applied (`lib/world.ts`).
- **Turn flow**: the player line is saved first (`/say`), then the story reply (`/turn`) and grammar analysis (`/analyze`) run in parallel, so a correction card appears whenever analysis finishes and never blocks the story.
- **Corrections** (`lib/analysis.ts`): classified as error / unnatural / style; capped by learning style (Immersive 1 serious error, Balanced 2, Guided 3); deduplicated within an utterance. Each stores category, severity, explanation, viewed/saved/practiced flags and attempts.
- **Practice**: ElevenLabs reference audio → record → Scribe transcript → word-level comparison, with an LLM check that accepts equivalent wording. It compares recognised words only — it does **not** measure pronunciation.
- **Spaced review**: saved corrections return after 1, 3, 7, 14, 30 days; a successful repeat advances the step, a miss resets to 1 day.
- **Adaptation**: weak categories (≥2 recorded errors) are passed to the story engine as hidden targets, so scenes naturally invite those structures. Correct later use is recorded as per-category observations.
- **Analytics**: error rate is only shown when a category has ≥5 tracked uses; otherwise the dashboard says there isn't enough data. Nothing is estimated or invented.
- **Tutor Mode** never writes to turns, world state or the story summary.
- **Audio cache**: generated speech is cached in `data/audio/` (keyed by voice, model, speed and text).

## Data
SQLite at `prisma/dev.db` (gitignored). Delete it and run `npm run db:push` to reset.
