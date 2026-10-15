export type Rating = 1 | 2 | 3 | 4;

export type ItemKind =
  | "lemma"
  | "lesson"
  | "ayah"
  | "text_word"
  | "sentence"
  | "audio"
  | "dialog";

export type ExerciseType =
  | "recognize"
  | "recall"
  | "context"
  | "translate"
  | "listen"
  | "speak";

export type ItemStatus = "learning" | "review" | "mastered" | "suspended";

export interface Item {
  id: number;
  kind: ItemKind;
  refId: number;
  phase: number;
  seq: number;
  prereqItemIds: number[];
}

/** Kartu FSRS dalam bentuk JSON (tanggal sebagai string ISO). */
export interface FsrsCardJson {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string | null;
  learning_steps?: number;
}

export interface UserItem {
  itemId: number;
  kind: ItemKind;
  status: ItemStatus;
  level: number;
  fsrs: FsrsCardJson;
  dueAt: string;
  priority: boolean;
  everReachedOne: boolean;
}

export interface UserItemWithFreq extends UserItem {
  freq: number;
}

export interface ReviewOutcome {
  correct: boolean;
  responseMs: number;
}
