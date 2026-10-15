import type { ExerciseType, Rating } from "./types";

/** Rating otomatis dari ketepatan dan waktu jawab (SPEC 6.3). */
export function deriveRating(input: {
  correct: boolean;
  responseMs: number;
}): Rating {
  if (!input.correct) return 1;
  if (input.responseMs > 10_000) return 2;
  if (input.responseMs >= 3_000) return 3;
  return 4;
}

/** Penilaian mandiri untuk latihan terjemah: Benar=3, Sebagian=2, Salah=1. */
export function ratingFromSelfGrade(grade: "benar" | "sebagian" | "salah"): Rating {
  if (grade === "benar") return 3;
  if (grade === "sebagian") return 2;
  return 1;
}

/** Aturan kenaikan level (SPEC 6.3). Level 0 baru, 1 kenal, 2 ingat, 3 konteks. */
export function nextLevel(
  level: number,
  rating: Rating,
  everReachedOne: boolean,
): number {
  if (rating >= 3) return Math.min(3, level + 1);
  if (rating === 1) {
    const lowered = level - 1;
    return Math.max(everReachedOne ? 1 : 0, lowered);
  }
  return level;
}

/** Jenis latihan menurut level; level 3 memakai bobot 20/30/50 (SPEC 6.2). */
export function chooseExercise(
  level: number,
  kind: string,
  rng: () => number,
): ExerciseType {
  if (kind === "ayah") return "translate";
  if (level <= 0) return "recognize";
  if (level === 1) return "recall";
  if (level === 2) return "context";
  const r = rng();
  if (r < 0.2) return "recognize";
  if (r < 0.5) return "recall";
  return "context";
}
