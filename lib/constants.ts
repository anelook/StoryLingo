export const GENRES = [
  { id: "fantasy", label: "Fantasy", es: "Fantasía", blurb: "Castles, dragons, old magic." },
  { id: "mystery", label: "Mystery / Detective", es: "Misterio", blurb: "Clues, suspects, secrets." },
  { id: "scifi", label: "Science fiction", es: "Ciencia ficción", blurb: "Starships, androids, strange worlds." },
  { id: "historical", label: "Historical adventure", es: "Aventura histórica", blurb: "Empires, voyages, intrigue." },
  { id: "everyday", label: "Everyday life", es: "Vida cotidiana", blurb: "Markets, friends, small surprises." },
] as const;

export const LEVELS = [
  { id: "A1", label: "A1 — Beginner" },
  { id: "A2", label: "A2 — Elementary" },
  { id: "B1", label: "B1 — Intermediate" },
  { id: "B2", label: "B2 — Upper intermediate" },
  { id: "C1", label: "C1 — Advanced" },
] as const;

export const STYLES = [
  { id: "immersive", label: "Immersive", blurb: "Minimal corrections. Focus on storytelling." },
  { id: "balanced", label: "Balanced", blurb: "Occasional corrections. Short explanations when requested." },
  { id: "guided", label: "Guided", blurb: "More frequent corrections, vocabulary hints and support." },
] as const;

export const VARIETIES = [
  { id: "latam", label: "Latin American" },
  { id: "spain", label: "Spain" },
] as const;

export const LENGTHS = [
  { id: "short", label: "Short (~15 turns)", turns: 15 },
  { id: "medium", label: "Medium (~30 turns)", turns: 30 },
  { id: "long", label: "Long (~60 turns)", turns: 60 },
  { id: "open", label: "Open-ended", turns: 0 },
] as const;

export const CATEGORIES = [
  { id: "ser_estar", label: "Ser vs. estar" },
  { id: "conjugation", label: "Verb conjugation" },
  { id: "past_tense", label: "Past tense" },
  { id: "gender_agreement", label: "Gender agreement" },
  { id: "articles", label: "Articles" },
  { id: "personal_a", label: "Personal a" },
  { id: "prepositions", label: "Prepositions" },
  { id: "pronouns", label: "Pronouns" },
  { id: "word_order", label: "Word order" },
  { id: "vocabulary", label: "Vocabulary misuse" },
  { id: "other", label: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const genreLabel = (id: string) => GENRES.find((g) => g.id === id)?.label ?? id;

/** Spaced review intervals in days, indexed by review step. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30];

export const PLAYER_VOICE_NAME = "__player__";
export const NARRATOR_NAME = "Narrador";
