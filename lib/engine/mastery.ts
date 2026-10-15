import type { UserItem } from "./types";

export const MASTERY_STABILITY_DAYS = 21;

/** Syarat mastered (SPEC 6.4): level 3, stabilitas >= 21 hari, tanpa lapse 30 hari. */
export function isMastered(item: UserItem, lapsesLast30d: number): boolean {
  return (
    item.level >= 3 &&
    item.fsrs.stability >= MASTERY_STABILITY_DAYS &&
    lapsesLast30d === 0
  );
}

/**
 * Masih terjaga: retrievability >= 0,9. Pada retensi target 0,9, FSRS memberi R = 0,9
 * tepat saat hari-sejak-review = stabilitas, jadi R >= 0,9 setara elapsed <= S.
 */
export function isRetained(
  fsrs: { stability: number; last_review?: string | null },
  now: Date,
): boolean {
  if (!fsrs.last_review) return false;
  const elapsedDays = (now.getTime() - new Date(fsrs.last_review).getTime()) / 86_400_000;
  return elapsedDays <= fsrs.stability;
}

/** Dikuasai (SPEC_FASE1): kriteria tersimpan + masih terjaga. */
export function isCurrentlyMastered(
  item: UserItem,
  lapsesLast30d: number,
  now: Date,
): boolean {
  return isMastered(item, lapsesLast30d) && isRetained(item.fsrs, now);
}
