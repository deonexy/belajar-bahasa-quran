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
