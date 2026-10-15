import type { Item } from "./types";

export const MAX_LESSONS_PER_DAY = 1;

/**
 * Memilih item baru (SPEC 6.6).
 * - kandidat = belum terbuka, semua prasyarat sudah level >= 1
 * - prioritas didahulukan, lalu urut seq
 * - lesson tidak memakan kuota, maksimal 1 per hari
 */
export function pickNewItems(
  candidates: Item[],
  quota: number,
  opts: {
    priorityItemIds?: ReadonlySet<number>;
    levelByItemId?: ReadonlyMap<number, number>;
  } = {},
): Item[] {
  const priority = opts.priorityItemIds ?? new Set<number>();
  const levels = opts.levelByItemId ?? new Map<number, number>();

  const eligible = candidates
    .filter((c) => c.prereqItemIds.every((p) => (levels.get(p) ?? 0) >= 1))
    .sort((a, b) => {
      const pa = priority.has(a.id) ? 0 : 1;
      const pb = priority.has(b.id) ? 0 : 1;
      return pa - pb || a.seq - b.seq;
    });

  const picked: Item[] = [];
  let lessons = 0;
  let used = 0;
  for (const item of eligible) {
    if (item.kind === "lesson") {
      if (lessons < MAX_LESSONS_PER_DAY) {
        picked.push(item);
        lessons += 1;
      }
      continue;
    }
    if (used < quota) {
      picked.push(item);
      used += 1;
    }
    if (used >= quota && lessons >= MAX_LESSONS_PER_DAY) break;
  }
  return picked;
}
