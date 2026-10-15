import { understanding } from "./coverage";
import { scheduleReview } from "./fsrs";
import { isMastered } from "./mastery";
import { deriveRating, nextLevel, ratingFromSelfGrade } from "./rating";
import type { FsrsCardJson, ItemStatus, Rating } from "./types";

/** Keadaan belajar satu item pengguna yang berubah setelah sebuah jawaban. */
export interface ReviewState {
  level: number;
  everReachedOne: boolean;
  status: ItemStatus;
  fsrs: FsrsCardJson;
  priority: boolean;
  masteredAt: string | null;
}

export interface ApplyReviewInput {
  itemId: number;
  state: ReviewState;
  /** Latihan pilihan ganda. */
  correct?: boolean;
  /** Latihan terjemah: penilaian mandiri. */
  grade?: "benar" | "sebagian" | "salah";
  responseMs: number;
  /** Retensi target FSRS dari pengaturan. */
  retention: number;
  /** Jumlah jawaban salah (rating 1) item ini dalam 30 hari terakhir, tidak termasuk jawaban ini. */
  priorLapses30: number;
  now: Date;
}

export interface ApplyReviewResult {
  rating: Rating;
  correct: boolean;
  next: ReviewState;
  /** Pemahaman item (0-100) sebelum dan sesudah jawaban ini. */
  before: number;
  after: number;
}

/**
 * Satu-satunya tempat aturan "jawaban -> keadaan baru" (SPEC 6.3-6.4).
 * Dipakai server (`submitReview`) dan klien (review lokal) agar hasilnya identik.
 */
export function applyReview(input: ApplyReviewInput): ApplyReviewResult {
  const { state, now } = input;
  const rating = input.grade
    ? ratingFromSelfGrade(input.grade)
    : deriveRating({ correct: !!input.correct, responseMs: input.responseMs });
  const correct = rating >= 2;

  const levelAfter = nextLevel(state.level, rating, state.everReachedOne);
  const everReached = state.everReachedOne || levelAfter >= 1;
  const fsrsAfter = scheduleReview(state.fsrs, rating, now, input.retention);
  const lapses30 = input.priorLapses30 + (rating === 1 ? 1 : 0);

  const mastered = isMastered(
    {
      itemId: input.itemId,
      kind: "lemma",
      status: state.status,
      level: levelAfter,
      fsrs: fsrsAfter,
      dueAt: fsrsAfter.due,
      priority: state.priority,
      everReachedOne: everReached,
    },
    lapses30,
  );
  const status: ItemStatus = mastered ? "mastered" : levelAfter >= 2 ? "review" : "learning";

  return {
    rating,
    correct,
    next: {
      level: levelAfter,
      everReachedOne: everReached,
      status,
      fsrs: fsrsAfter,
      priority: state.priority,
      masteredAt: mastered ? (state.masteredAt ?? now.toISOString()) : null,
    },
    before: understanding(state.level, state.fsrs.stability),
    after: understanding(levelAfter, fsrsAfter.stability),
  };
}
