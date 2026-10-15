import type { UserItemWithFreq } from "./types";
import { MASTERY_STABILITY_DAYS } from "./mastery";

/** % kata Al-Qur'an dipahami: bobot frekuensi lemma yang dikuasai (SPEC 8). */
export function coverage(
  masteredLemmaIds: number[],
  freqById: ReadonlyMap<number, number>,
  totalWords: number,
): number {
  if (totalWords <= 0) return 0;
  const seen = new Set<number>();
  let sum = 0;
  for (const id of masteredLemmaIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    sum += freqById.get(id) ?? 0;
  }
  return (sum / totalWords) * 100;
}

/** Pemahaman satu item, 0-100: (level/3) x min(1, stabilitas/21 hari). */
export function understanding(level: number, stability: number): number {
  const l = Math.max(0, Math.min(3, level)) / 3;
  const st = Math.max(0, Math.min(1, stability / MASTERY_STABILITY_DAYS));
  return l * st * 100;
}

/** Tingkat pemahaman 0-100, dibobot frekuensi (SPEC 8). */
export function comprehension(items: UserItemWithFreq[]): number {
  let weighted = 0;
  let totalFreq = 0;
  for (const it of items) {
    const s = understanding(it.level, it.fsrs.stability) / 100;
    weighted += s * it.freq;
    totalFreq += it.freq;
  }
  if (totalFreq === 0) return 0;
  return (weighted / totalFreq) * 100;
}
