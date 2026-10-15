import { localDate } from "@/lib/dates";
import {
  ayatScore,
  comprehension,
  comprehensionIndex,
  computeStreak,
  coverage,
  grammarScore,
  isRetained,
  streakTier,
  understanding,
  type StreakTier,
  type UserItemWithFreq,
} from "@/lib/engine";
import { getMeta, type LocalDb } from "./db";

export interface LocalStats {
  streak: number;
  streakTier: StreakTier;
  studiedToday: boolean;
  dueNow: number;
  lemmasOpened: number;
  /** % token Al-Qur'an dikuasai dan masih terjaga (R >= 0,9). */
  coveragePct: number;
  /** Kata dipelajari (jumlah kemunculan dari lemma yang dibuka). */
  learnedTokens: number;
  /** Retensi 7 hari (0..1); perkiraan dari hitungan per hari lokal. */
  retention7d: number;
  indexScore: number;
}

/**
 * Ringkasan belajar dari data lokal memakai `lib/engine` yang sama dengan server, sehingga
 * streak, pemahaman, cakupan, dan indeks tetap bisa ditampilkan saat offline.
 * Mengembalikan null bila data lokal belum pernah disinkron.
 */
export async function getLocalStats(db: LocalDb, now: Date = new Date()): Promise<LocalStats | null> {
  const settings = await db.settings.get(1);
  if (!settings) return null;
  const tz = settings.timezone;

  const items = await db.userItems.toArray();
  const days = await db.reviewDays.toArray();
  const totals = (await getMeta<{ totalWords: number }>(db, "totals")) ?? { totalWords: 0 };
  const pola = (await getMeta<{ correct: number; total: number }>(db, "pola30")) ?? {
    correct: 0,
    total: 0,
  };

  const today = localDate(tz, now);
  const dayList = days.map((d) => d.date);
  const streak = computeStreak(dayList, tz, now);
  const studiedToday = dayList.includes(today);

  const lemmaItems = items.filter((i) => i.kind === "lemma");
  const lemmas = await db.lemmas.bulkGet(lemmaItems.map((i) => i.refId));
  const freqById = new Map<number, number>();
  const withFreq: UserItemWithFreq[] = [];
  lemmaItems.forEach((it, idx) => {
    const freq = lemmas[idx]?.freq ?? 0;
    freqById.set(it.refId, freq);
    withFreq.push({
      itemId: it.itemId,
      kind: "lemma",
      status: it.status,
      level: it.level,
      fsrs: it.fsrs,
      dueAt: it.dueAt,
      priority: it.priority,
      everReachedOne: it.everReachedOne,
      freq,
    });
  });

  // Dikuasai = status tersimpan "mastered" DAN masih terjaga (sama dengan v_user_coverage).
  const masteredIds = lemmaItems
    .filter((i) => i.status === "mastered" && isRetained(i.fsrs, now))
    .map((i) => i.refId);
  const coveragePct = coverage(masteredIds, freqById, totals.totalWords);

  const under = (kind: string) =>
    items.filter((i) => i.kind === kind).map((i) => understanding(i.level, i.fsrs.stability));
  const totalLessons = await db.lessons.count();
  const grammar = grammarScore(under("lesson"), totalLessons, pola.correct, pola.total);
  const ayat = ayatScore(under("ayah"));

  // Retensi 7 hari: hari lokal hari ini dan 6 hari sebelumnya.
  const recent = new Set(
    Array.from({ length: 7 }, (_, k) => localDate(tz, new Date(now.getTime() - k * 86400_000))),
  );
  let total = 0;
  let correct = 0;
  for (const d of days) {
    if (!recent.has(d.date)) continue;
    total += d.total ?? 0;
    correct += d.correct ?? 0;
  }
  const retention7d = total < 20 ? 0.9 : correct / total;

  const index = comprehensionIndex({
    tokenCoverage: coveragePct,
    memoryStrength: comprehension(withFreq),
    retention: lemmaItems.length > 0 ? retention7d * 100 : 0,
    grammar,
    ayat,
  });

  const nowIso = now.toISOString();
  return {
    streak,
    streakTier: streakTier(streak, studiedToday),
    studiedToday,
    dueNow: items.filter((i) => i.status !== "suspended" && i.dueAt <= nowIso).length,
    lemmasOpened: lemmaItems.length,
    coveragePct,
    learnedTokens: withFreq.reduce((a, w) => a + w.freq, 0),
    retention7d,
    indexScore: index.score,
  };
}
