import { chooseExercise, understanding, type ExerciseType } from "@/lib/engine";
import type { ExampleView, LemmaCard, SessionCard } from "@/lib/session-types";

/**
 * Pembuat kartu sesi yang murni (tanpa akses data). Dipakai bersama oleh pembangun sesi di
 * server (`lib/server/session.ts`) dan pembangun sesi lokal (`lib/local/session.ts`) agar
 * perilakunya tidak bergeser.
 */

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const MAX_CARDS = 40;

/** Data lemma minimum yang dibutuhkan untuk membuat kartu. */
export interface LemmaForCard {
  id: number;
  lemmaAr: string;
  pos: string;
  gloss: string | null;
  rootAr: string | null;
}

/** Pengecoh diambil dari bank lemma ber-gloss. */
export interface BankLemma {
  id: number;
  lemmaAr: string;
  pos: string;
  gloss: string | null;
}

/** Contoh ayat hanya dimuat untuk latihan konteks atau kartu yang baru dibuka. */
export function needsExample(exercise: ExerciseType, reps: number): boolean {
  return exercise === "context" || reps === 0;
}

export function makeLemmaCard(args: {
  itemId: number;
  reps: number;
  exercise: ExerciseType;
  lemma: LemmaForCard;
  bank: BankLemma[];
  example: ExampleView | null;
  rng: () => number;
}): LemmaCard | null {
  const { lemma: l, bank, rng, exercise } = args;
  if (!l.gloss) return null;
  const samePos = bank.filter((b) => b.id !== l.id && b.pos === l.pos && b.gloss !== l.gloss);
  const pool =
    samePos.length >= 3 ? samePos : bank.filter((b) => b.id !== l.id && b.gloss !== l.gloss);
  const distractors = shuffle(pool, rng).slice(0, 3);
  // recognize: Arab -> arti; recall: arti -> Arab; context: ayat -> arti
  const forward = exercise !== "recall";
  const correctLabel = forward ? l.gloss : l.lemmaAr;
  const labels = shuffle(
    [correctLabel, ...distractors.map((d) => (forward ? (d.gloss as string) : d.lemmaAr))],
    rng,
  );
  return {
    kind: "lemma",
    itemId: args.itemId,
    isNew: args.reps === 0,
    exercise,
    lemmaAr: l.lemmaAr,
    gloss: l.gloss,
    pos: l.pos,
    rootAr: l.rootAr,
    options: labels,
    answer: labels.indexOf(correctLabel),
    example: args.example,
  };
}

export function exerciseFor(level: number, rng: () => number): ExerciseType {
  return chooseExercise(level, "lemma", rng);
}

/** Urutan: pelajaran baru dulu, lalu campur acak review dan item baru. */
export function orderCards(cards: SessionCard[], rng: () => number): SessionCard[] {
  const first = cards.filter((c) => c.kind === "lesson" && c.isNew);
  const rest = shuffle(cards.filter((c) => !(c.kind === "lesson" && c.isNew)), rng);
  return [...first, ...rest];
}

export interface QuizCandidate {
  itemId: number;
  level: number;
  stability: number;
  dueAt: string;
}

/**
 * Pengambilan acak berbobot tanpa pengembalian (Efraimidis-Spirakis): kata yang pemahamannya
 * rendah atau sudah lewat jatuh tempo lebih mungkin terpilih.
 */
export function pickQuizCandidates<T extends QuizCandidate>(
  all: T[],
  count: number,
  nowMs: number,
  rng: () => number,
): T[] {
  return all
    .map((row) => {
      const u = understanding(row.level, row.stability) / 100;
      const overdue = new Date(row.dueAt).getTime() <= nowMs ? 0.3 : 0;
      const weight = 0.1 + (1 - u) + overdue;
      return { row, key: Math.pow(rng(), 1 / weight) };
    })
    .sort((x, y) => y.key - x.key)
    .slice(0, count)
    .map((x) => x.row);
}
