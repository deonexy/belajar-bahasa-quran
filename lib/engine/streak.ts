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
