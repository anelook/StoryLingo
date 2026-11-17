export type Segment = { speaker: string; kind: "narration" | "dialogue"; text: string };
export type Vocab = { es: string; en: string };
export type Correction = {
  id: string;
  turnId: string;
  adventureId: string;
  original: string;
  corrected: string;
  changes: { from: string; to: string }[];
  category: string;
  kind: "error" | "unnatural" | "style";
  explanation: string;
  severity: number;
  dismissed: boolean;
  explanationViewed: boolean;
  saved: boolean;
  practiced: boolean;
  nextReviewAt: string | null;
  createdAt: string;
};
export type Turn = { id: string; idx: number; role: "player" | "narrator"; segments: Segment[]; vocab: Vocab[]; chapter: number; corrections: Correction[] };
export type World = {
  location: string;
  characters: { name: string; description: string; role: string; attitude: string }[];
  relationships: { a: string; b: string; status: string }[];
  inventory: string[];
  quests: { title: string; description: string; status: string }[];
  discoveries: string[];
  facts: string[];
  recentEvents: string[];
};
export type AdventureData = {
  id: string; title: string; genre: string; level: string; style: string; variety: string; length: string;
  characterName: string; sceneTitle: string; chapter: number; turnCount: number; status: string; updatedAt: string;
  world: World; voices: Record<string, string>; turns: Turn[];
};
export type AdventureSummary = Omit<AdventureData, "world" | "voices" | "turns" | "length">;
