# Build StoryLingo — AI Spanish Adventure Learning App

You are a senior full-stack TypeScript engineer, AI engineer, game designer, and language-learning specialist.

Build a fully functional, local-first MVP called **StoryLingo**.

StoryLingo is an interactive Spanish-learning adventure game where the player and AI collaboratively create a story through natural conversation.

The player speaks Spanish, the AI responds as a narrator or fictional character, and the adventure evolves depending on what the player says.

The application also acts as an intelligent Spanish tutor: it identifies mistakes, offers optional explanations, lets users repeat corrected sentences aloud, and tracks recurring grammar issues over time.

The goal is to make learning Spanish feel like participating in an immersive, evolving adventure rather than completing traditional language exercises.

**Build the actual working application, not just a design mockup or implementation plan.**

---

## 1. Technology stack

Use the following technologies.

### Frontend and backend

- Next.js with App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Recharts for learning analytics

### AI services

**OpenAI API**

- Interactive story generation
- Character dialogue
- Story memory and world-state updates
- Spanish grammar analysis
- Grammar explanations
- Adaptive learning recommendations

**ElevenLabs API**

- Spanish text-to-speech
- Distinct character voices
- Speech-to-text using ElevenLabs Scribe
- Playback of corrected Spanish sentences
- Spoken repetition exercises

Use the official JavaScript SDKs where appropriate.

Consult current official API documentation before implementing model identifiers, request parameters, or endpoints.

### Local database

Use **SQLite with Prisma**.

- Store data locally in `prisma/dev.db`.
- Do not use Supabase.
- Do not use PostgreSQL.
- Do not require Docker.
- Do not require a cloud database.
- Do not implement authentication.
- Assume a single local user.
- Persist data across application restarts.

### External dependencies

Only two external services are required:

1. OpenAI API
2. ElevenLabs API

All other application functionality should run locally.

No external image-generation service is required for the MVP.

---

## 2. Local-first architecture

The application runs on the user's computer.

The Next.js server handles:

- API requests
- AI orchestration
- Database operations
- Story persistence
- Grammar analysis
- Audio generation requests
- Speech transcription requests

SQLite stores:

- Adventures
- Story turns
- Characters
- World state
- Grammar corrections
- Practice attempts
- Learning progress
- Vocabulary history

The browser handles:

- User interface
- Microphone recording
- Audio playback
- Text input
- Charts
- User interactions

API keys must remain server-side.

Use `.env.local`:

```env
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
DATABASE_URL="file:./dev.db"
```

Add an `.env.example` file.

Use a Prisma configuration compatible with the installed Prisma version.

Do not expose the development server publicly by default. Without authentication, this app is intended for private local use.

---

## 3. Adventure creation

Create a setup screen where the player chooses:

### Story genre

- Fantasy
- Mystery / Detective
- Science fiction
- Historical adventure
- Everyday life

### Spanish level

- A1 — Beginner
- A2 — Elementary
- B1 — Intermediate
- B2 — Upper intermediate
- C1 — Advanced

### Learning style

**Immersive**

- Minimal corrections
- Focus on storytelling

**Balanced**

- Occasional corrections
- Short explanations when requested

**Guided**

- More frequent corrections
- Additional vocabulary hints
- More learning support

### Additional preferences

- Character name
- Optional starting premise
- Spanish variety: Spain or Latin American
- Preferred story length
- Optional story title

Generate a compelling opening scene based on these choices.

Allow adventures to be saved and resumed.

---

## 4. Collaborative storytelling engine

The AI is simultaneously:

1. The narrator
2. The non-player characters
3. The story director
4. The player's collaborative storytelling partner

The player must be able to freely influence the adventure.

Examples:

- "Quiero entrar en el castillo."
- "Creo que el hombre es un mago."
- "Quiero hablar con el dragón."
- "Mi personaje tiene un perro llamado Pablo."
- "No confío en esta mujer."

The AI should incorporate creative suggestions when they fit the established world.

Do not restrict players to predefined dialogue options.

### Storytelling requirements

- Narration should match the selected Spanish proficiency level.
- Keep responses concise enough to encourage frequent speaking.
- Introduce interesting characters, mysteries, and conflicts.
- Maintain continuity.
- Remember previous decisions.
- Track relationships and discoveries.
- Avoid repetitive descriptions.
- Allow unexpected solutions.
- End scenes with natural opportunities for interaction.
- Avoid forcing the player along a rigid storyline.

### Story memory

Maintain structured world state containing:

- Current location
- Characters
- Character relationships
- Inventory
- Active quests
- Important discoveries
- Established world facts
- Recent events

Store world state separately from visible story dialogue.

Use conversation summaries to manage long-running stories without repeatedly sending the complete conversation history.

Validate AI-generated state updates before saving them.

---

## 5. ElevenLabs voice integration

Implement actual ElevenLabs API integration.

### Spanish narration

- Generate natural Spanish audio.
- Use consistent voices for recurring characters.
- Support Spanish from Spain and Latin American Spanish where suitable voices are available.
- Allow replay of individual dialogue segments.
- Provide audio playback controls.
- Support optional autoplay.
- Cache generated audio locally to avoid unnecessary API requests.

Use a current multilingual text-to-speech model supported by ElevenLabs.

### Voice input

Implement push-to-talk recording.

Workflow:

1. Player presses the microphone button.
2. Browser records their voice.
3. Player stops recording.
4. Audio is sent to a secure Next.js endpoint.
5. ElevenLabs transcribes the Spanish speech.
6. Transcript appears in an editable text field.
7. Player confirms or edits the transcript.
8. The text is submitted to the story engine.

Handle microphone permissions, unsupported recording formats, network failures, and empty transcriptions.

Do not send API keys to the browser.

Use browser MediaRecorder where supported.

### Spoken practice

When a correction is available, the player can hear and repeat the corrected sentence.

Use ElevenLabs to generate reference audio.

Use speech-to-text to transcribe the player's repetition.

Compare the recognized words with the intended sentence while accepting valid equivalent wording.

Do not claim to measure pronunciation accuracy from transcription alone.

---

## 6. Interactive grammar correction system

Every player response should be analyzed for meaningful Spanish errors.

Possible categories:

- Ser vs. estar
- Verb conjugation
- Past tense
- Gender agreement
- Articles
- Personal a
- Prepositions
- Pronouns
- Word order
- Vocabulary misuse

Distinguish:

1. Genuine grammatical errors
2. Understandable but unnatural phrasing
3. Optional stylistic improvements

Do not label valid Spanish regional variations as errors.

Preserve the player's intended meaning.

### Correction card

Display a small, unobtrusive correction card.

Example:

**You said:**

"Yo busco mi hermano."

**Better:**

"Busco a mi hermano."

Highlight the important changes.

The card includes four actions:

**Explain**

- Explain the grammar rule in English.
- Give one or two examples.
- Adapt to the learner's level.
- Allow follow-up questions.

**Practice**

- Play the corrected sentence through ElevenLabs.
- Invite the learner to repeat it.
- Record their speech.
- Transcribe the attempt.
- Provide helpful feedback.
- Allow additional attempts.

**Save for later**

- Add the correction to a practice collection.

**Dismiss**

- Close the correction card without deleting its history.

### Correction behavior

Corrections must not block the adventure.

The story should continue naturally even if the learner makes mistakes.

Run correction analysis independently where practical, allowing correction cards to appear when analysis completes.

Avoid overwhelming users with corrections.

In Balanced Mode, prioritize one or two important corrections per turn.

---

## 7. Tutor Mode

The learner can interrupt the adventure at any time.

Example questions:

- "What does desapareció mean?"
- "Explain this sentence."
- "How do I say I don't trust him?"
- "Can you translate that?"
- "Can you speak more slowly?"
- "What's the difference between ser and estar?"

Implement a dedicated Tutor Mode.

Tutor Mode must:

- Explain Spanish grammar.
- Translate words.
- Clarify sentences.
- Provide examples.
- Offer vocabulary hints.
- Support English explanations.
- Preserve the current story position.

Tutor questions must not accidentally advance the story.

When Tutor Mode closes, the player returns to the same adventure scene.

---

## 8. Grammar mistake tracking

Record meaningful grammar errors in SQLite.

For each correction, store:

- Adventure ID
- Story turn ID
- Original sentence
- Corrected sentence
- Grammar category
- Explanation
- Severity
- Timestamp
- Whether the explanation was viewed
- Whether the correction was saved
- Whether the learner practiced
- Practice attempts
- Practice outcomes

Track repeated mistakes across multiple adventures.

Avoid duplicate counting of the same issue within one utterance.

Distinguish errors from optional stylistic suggestions.

### Analytics dashboard

Create a dedicated learning dashboard.

Include:

**Most common mistakes**

- Bar chart showing grammar categories ranked by frequency.

**Progress over time**

- Line chart showing error trends.

**Practice activity**

- Number of corrections practiced.
- Number of successful repetitions.
- Recently reviewed grammar topics.

**Grammar detail view**

- Examples of previous mistakes.
- Corrected versions.
- Explanations.
- Practice history.

**Learning recommendations**

- Suggest which grammar topics deserve additional practice.

Where reliable data exists, measure errors relative to relevant opportunities rather than relying only on raw counts.

Do not fabricate learning statistics or mastery scores.

Use Recharts.

---

## 9. Adaptive learning system

Use previous mistakes to personalize future adventures.

Example:

If the learner repeatedly confuses ser and estar, the AI should naturally introduce situations involving:

- Character descriptions
- Locations
- Emotions
- Temporary conditions

If the learner struggles with past tense, introduce situations requiring them to describe past events.

Do this subtly.

The story must remain entertaining and should never feel like a disguised grammar worksheet.

### Learning cycle

1. Detect a mistake.
2. Offer a correction.
3. Explain when requested.
4. Allow spoken repetition.
5. Save the learning target.
6. Reintroduce the concept naturally.
7. Track later unprompted correct usage.

Add a simple spaced-review mechanism for saved corrections.

---

## 10. User interface

Build a polished, responsive interface.

### Visual style

- Dark fantasy-inspired theme
- Cinematic atmosphere
- Elegant typography
- Warm accent colors
- Subtle animations
- Clear dialogue bubbles
- Minimal distractions
- Mobile-friendly layout

### Main adventure screen

Include:

- Story title
- Chapter information
- Current scene
- Narrator dialogue
- Character dialogue
- Voice playback
- Microphone button
- Text input
- Tutor Mode button
- Correction cards
- Vocabulary help
- Save indicator

### Dashboard

Include:

- Start new adventure
- Continue adventure
- Saved adventures
- Grammar progress
- Most common mistakes
- Saved corrections
- Practice history

### Adventure setup

Include genre selection, Spanish level, learning style, and character preferences.

Do not add login or signup screens.

Use locally bundled visual assets, CSS gradients, or simple illustrations for the MVP.

Do not require an image-generation API.

---

## 11. SQLite database schema

Use Prisma with SQLite.

Create models for:

**Adventure**

- ID
- Title
- Genre
- Spanish level
- Learning style
- Spanish variety
- Created date
- Updated date

**StoryTurn**

- ID
- Adventure ID
- Speaker
- Text
- Timestamp
- Optional audio cache reference

**StoryState**

- Adventure ID
- Current location
- Characters
- Inventory
- Quests
- World facts
- Summary

**Correction**

- ID
- Adventure ID
- Story turn ID
- Original text
- Corrected text
- Category
- Severity
- Explanation
- Saved status
- Created date

**PracticeAttempt**

- ID
- Correction ID
- Transcript
- Result
- Timestamp

**LearningTarget**

- ID
- Grammar category
- Observed error count
- Practice history
- Last practiced date
- Next review date

**GrammarOpportunity**

- ID
- Story turn ID
- Grammar category
- Correct or incorrect usage
- Confidence or assessment status

**VocabularyItem**

- ID
- Spanish word or phrase
- Translation
- Context
- Review information

Use proper relations, constraints, and indexes.

SQLite JSON-compatible fields may be used for structured story state.

Keep the schema straightforward and extensible.

---

## 12. AI architecture

Separate the application into distinct services.

### StoryEngine

Responsible for:

- Story generation
- NPC dialogue
- Narrative continuity
- World-state updates
- Collaborative storytelling

### LanguageAnalyzer

Responsible for:

- Spanish grammar corrections
- Error classification
- Correction explanations
- Identifying relevant grammar opportunities

### TutorEngine

Responsible for:

- Grammar questions
- Translation
- Vocabulary assistance
- Learning explanations

### LearningEngine

Responsible for:

- Mistake aggregation
- Learning recommendations
- Practice scheduling
- Progress tracking
- Adaptive learning targets

Use structured model outputs validated with Zod.

Keep story generation separate from grammar analysis.

Use clear prompts and avoid unnecessary repeated model calls.


