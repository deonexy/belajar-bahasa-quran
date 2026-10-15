import type { FsrsCardJson, ItemKind, ItemStatus, ExerciseType } from "@/lib/engine";
import type { ExampleView, WordView } from "@/lib/session-types";

/** Salinan lokal `user_items` + info item. Server tetap master. */
export interface LocalUserItem {
  itemId: number;
  kind: ItemKind;
  refId: number;
  status: ItemStatus;
  level: number;
  everReachedOne: boolean;
  fsrs: FsrsCardJson;
  dueAt: string;
  priority: boolean;
  masteredAt: string | null;
  /** Waktu (ISO) jawaban salah 30 hari terakhir; untuk syarat "tanpa lapse 30 hari". */
  lapses: string[];
}

export interface LocalSettings {
  id: 1;
  timezone: string;
  dailyNewMax: number;
  targetRetention: number;
  targetTokenCoverage: number;
  dailyReviewLimit: number;
  startDate: string;
  phase1Deadline: string | null;
}

export interface LocalPlan {
  planDate: string;
  retention7d: number;
  backlog: number;
  learningPile: number;
  newQuota: number;
  reason: string;
  sessionDone: boolean;
}

export interface LocalLemma {
  id: number;
  lemmaAr: string;
  pos: string;
  gloss: string;
  rootId: number | null;
  freq: number;
  freqRank: number | null;
}

export interface LocalRoot {
  id: number;
  rootAr: string;
}

export interface LocalLesson {
  id: number;
  code: string;
  title: string;
  bodyMd: string;
  exercises: { q: string; options: string[]; answer: number }[];
}

/** Contoh ayat per lemma (hanya untuk lemma yang sudah dibuka pengguna). `null` = tidak ada contoh. */
export interface LocalExample {
  lemmaId: number;
  example: ExampleView | null;
}

/** Ayat yang sudah dibuka pengguna sebagai item belajar (kunci `ref` = surah*1000 + ayat). */
export interface LocalAyah {
  ref: number;
  textAr: string;
  translation: string;
  words: WordView[];
}

/** Versi konten yang tersimpan lokal; berubah di server => diperbarui otomatis. */
export interface ContentVersionRow {
  key: string;
  version: string;
}

/** Catatan unduhan Tingkat 2 (diisi O2; skema disiapkan sekarang). */
export interface DownloadRow {
  id: string;
  kind: "surah" | "juz" | "all" | "audio";
  label: string;
  bytes: number;
  savedAt: string;
}

/** Penghitung review per hari (zona waktu pengguna) untuk streak dan retensi 7 hari. */
export interface ReviewDayRow {
  date: string;
  /** Jumlah jawaban; kosong bila hanya diketahui "ada review" (hari lebih lama dari 7 hari). */
  total?: number;
  correct?: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface ReviewLogPayload {
  user_id: string;
  item_id: number;
  exercise_type: ExerciseType;
  correct: boolean;
  rating: number;
  response_ms: number;
  level_before: number;
  level_after: number;
  fsrs_before: FsrsCardJson;
  fsrs_after: FsrsCardJson;
  reviewed_at: string;
  client_id: string;
}

export interface UserItemStatePayload {
  item_id: number;
  level: number;
  ever_reached_one: boolean;
  status: ItemStatus;
  fsrs: FsrsCardJson;
  due_at: string;
  mastered_at: string | null;
}

export interface PolaAttemptPayload {
  user_id: string;
  category: string;
  correct: boolean;
  answered_at: string;
  client_id: string;
}

export type OutboxEntry =
  | {
      id?: number;
      kind: "review";
      clientId: string;
      createdAt: string;
      tries: number;
      payload: { log: ReviewLogPayload; state: UserItemStatePayload };
    }
  | {
      id?: number;
      kind: "pola";
      clientId: string;
      createdAt: string;
      tries: number;
      payload: PolaAttemptPayload;
    }
  | {
      id?: number;
      kind: "session_done";
      clientId: string;
      createdAt: string;
      tries: number;
      payload: { planDate: string };
    };
