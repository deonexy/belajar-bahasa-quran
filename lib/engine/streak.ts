import { localDate } from "../dates";

export type StreakTier = "freeze" | "cold" | "warm" | "hot";

/**
 * Tingkat streak ala Duolingo:
 * - freeze: streak 0 (beku, mulai lagi)
 * - cold: streak masih ada tetapi hari ini belum belajar (terancam putus)
 * - warm: 1-6 hari beruntun dan hari ini sudah belajar
 * - hot: 7 hari atau lebih dan hari ini sudah belajar
 */
export function streakTier(streak: number, studiedToday: boolean): StreakTier {
  if (streak <= 0) return "freeze";
  if (!studiedToday) return "cold";
  return streak >= 7 ? "hot" : "warm";
}

/** Streak: hari beruntun (zona waktu pengguna) yang punya review. Hari ini boleh belum. */
export function computeStreak(days: string[], tz: string, now: Date = new Date()): number {
  const set = new Set(days);
  const day = (offset: number) => localDate(tz, new Date(now.getTime() - offset * 86400_000));
  let offset = set.has(day(0)) ? 0 : 1;
  let streak = 0;
  while (set.has(day(offset))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}
