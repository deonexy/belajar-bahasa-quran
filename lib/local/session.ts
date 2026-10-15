import {
  MAX_CARDS,
  exerciseFor,
  makeLemmaCard,
  needsExample,
  orderCards,
  pickQuizCandidates,
  shuffle,
  type BankLemma,
} from "@/lib/session-cards";
import type { AyahCard, LessonCard, SessionCard } from "@/lib/session-types";
import type { LocalDb } from "./db";
import type { LocalUserItem } from "./types";

const BANK_SIZE = 600;

/** Antrean sesi dari data lokal: review jatuh tempo (item baru dibuka server lewat mastery gate). */
export async function buildLocalSession(
  db: LocalDb,
  now: Date = new Date(),
  rng: () => number = Math.random,
): Promise<SessionCard[]> {
  const nowIso = now.toISOString();
  // Item baru yang dibuka server hari ini selalu ikut (jam perangkat bisa beda beberapa menit
  // dari jam server); selebihnya hanya yang sudah jatuh tempo.
  const due = (
    await db.userItems
      .filter((i) => i.status !== "suspended" && (i.fsrs.reps === 0 || i.dueAt <= nowIso))
      .toArray()
  )
    .sort((a, b) => (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0))
    .slice(0, MAX_CARDS);
  if (due.length === 0) return [];
  return cardsFromItems(db, due, rng);
}

/** Kuis dinamis dari kata yang pernah dijawab (sama dengan kuis server). */
export async function buildLocalQuiz(
  db: LocalDb,
  count = 10,
  now: Date = new Date(),
  rng: () => number = Math.random,
): Promise<SessionCard[]> {
  const all = await db.userItems
    .where("kind")
    .equals("lemma")
    .filter((i) => i.status !== "suspended" && i.fsrs.reps >= 1)
    .toArray();
  if (all.length === 0) return [];
  const picked = pickQuizCandidates(
    all.map((i) => ({ item: i, itemId: i.itemId, level: i.level, stability: i.fsrs.stability, dueAt: i.dueAt })),
    count,
    now.getTime(),
    rng,
  ).map((x) => x.item);
  return shuffle(await cardsFromItems(db, picked, rng), rng);
}

async function cardsFromItems(
  db: LocalDb,
  items: LocalUserItem[],
  rng: () => number,
): Promise<SessionCard[]> {
  const cards: SessionCard[] = [];

  const lemmaItems = items.filter((i) => i.kind === "lemma");
  if (lemmaItems.length > 0) {
    const lemmas = await db.lemmas.bulkGet(lemmaItems.map((i) => i.refId));
    const roots = await db.roots.bulkGet(
      lemmas.map((l) => l?.rootId).filter((r): r is number => typeof r === "number"),
    );
    const rootAr = new Map(roots.filter((r) => r !== undefined).map((r) => [r!.id, r!.rootAr]));
    const examples = await db.exampleAyahs.bulkGet(lemmaItems.map((i) => i.refId));
    const bank: BankLemma[] = (await db.lemmas.orderBy("freqRank").limit(BANK_SIZE).toArray()).map(
      (l) => ({ id: l.id, lemmaAr: l.lemmaAr, pos: l.pos, gloss: l.gloss }),
    );

    lemmaItems.forEach((it, idx) => {
      const l = lemmas[idx];
      if (!l) return;
      const reps = it.fsrs.reps;
      const exercise = exerciseFor(it.level, rng);
      const card = makeLemmaCard({
        itemId: it.itemId,
        reps,
        exercise,
        lemma: {
          id: l.id,
          lemmaAr: l.lemmaAr,
          pos: l.pos,
          gloss: l.gloss,
          rootAr: l.rootId !== null ? (rootAr.get(l.rootId) ?? null) : null,
        },
        bank,
        example: needsExample(exercise, reps) ? (examples[idx]?.example ?? null) : null,
        rng,
      });
      if (card) cards.push(card);
    });
  }

  const lessonItems = items.filter((i) => i.kind === "lesson");
  if (lessonItems.length > 0) {
    const lessons = await db.lessons.bulkGet(lessonItems.map((i) => i.refId));
    lessonItems.forEach((it, idx) => {
      const l = lessons[idx];
      if (!l) return;
      cards.push({
        kind: "lesson",
        itemId: it.itemId,
        isNew: it.fsrs.reps === 0,
        code: l.code,
        title: l.title,
        bodyMd: l.bodyMd,
        exercises: l.exercises,
      } satisfies LessonCard);
    });
  }

  const ayahItems = items.filter((i) => i.kind === "ayah");
  if (ayahItems.length > 0) {
    const ayahs = await db.ayahs.bulkGet(ayahItems.map((i) => i.refId));
    ayahItems.forEach((it, idx) => {
      const a = ayahs[idx];
      if (!a) return;
      cards.push({
        kind: "ayah",
        itemId: it.itemId,
        isNew: it.fsrs.reps === 0,
        surah: Math.floor(it.refId / 1000),
        ayah: it.refId % 1000,
        textAr: a.textAr,
        translation: a.translation,
        words: a.words,
      } satisfies AyahCard);
    });
  }

  return orderCards(cards, rng);
}
