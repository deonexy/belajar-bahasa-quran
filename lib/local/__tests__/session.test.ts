import { describe, expect, it } from "vitest";
import { buildLocalQuiz, buildLocalSession } from "../session";
import { getLocalStats } from "../stats";
import { setMeta } from "../db";
import { newCard } from "@/lib/engine";
import { EXAMPLE, NOW, SETTINGS, lemma, localItem, makeDb } from "./helpers";

const seqRng = () => {
  let seed = 7;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

async function seedContent(db: ReturnType<typeof makeDb>) {
  await db.lemmas.bulkPut(Array.from({ length: 12 }, (_, i) => lemma(i + 1)));
  await db.roots.put({ id: 1, rootAr: "كتب" });
  await db.lessons.put({
    id: 5,
    code: "L1",
    title: "Pelajaran satu",
    bodyMd: "isi",
    exercises: [{ q: "q", options: ["a", "b"], answer: 0 }],
  });
  await db.ayahs.put({ ref: 1002, textAr: "ayat", translation: "tr", words: [] });
  await db.exampleAyahs.put({ lemmaId: 1, example: EXAMPLE });
}

const past = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const future = (min: number) => new Date(NOW.getTime() + min * 60_000).toISOString();

function reviewedCard(stability = 5) {
  const c = newCard(new Date(NOW.getTime() - 86400_000));
  return { ...c, reps: 3, stability, last_review: past(60 * 24) };
}

describe("buildLocalSession", () => {
  it("hanya item jatuh tempo dan tidak ditangguhkan; semua jenis kartu terbentuk", async () => {
    const db = makeDb();
    await seedContent(db);
    await db.userItems.bulkPut([
      localItem({ itemId: 1, refId: 1, dueAt: past(10) }), // lemma baru, jatuh tempo
      localItem({ itemId: 2, refId: 2, fsrs: reviewedCard(), dueAt: future(60) }), // sudah pernah direview, belum jatuh tempo
      localItem({ itemId: 3, refId: 3, dueAt: past(10), status: "suspended" }),
      localItem({ itemId: 4, kind: "lesson", refId: 5, dueAt: past(5) }),
      localItem({ itemId: 5, kind: "ayah", refId: 1002, dueAt: past(5) }),
    ]);
    const cards = await buildLocalSession(db, NOW, seqRng());

    expect(cards.map((c) => c.itemId).sort()).toEqual([1, 4, 5]);
    // pelajaran baru didahulukan
    expect(cards[0].kind).toBe("lesson");

    const lemmaCard = cards.find((c) => c.kind === "lemma")!;
    if (lemmaCard.kind === "lemma") {
      expect(lemmaCard.isNew).toBe(true);
      expect(lemmaCard.rootAr).toBe("كتب");
      expect(lemmaCard.example).toEqual(EXAMPLE); // kartu baru memuat contoh
      expect(lemmaCard.options).toHaveLength(4);
      const forward = lemmaCard.exercise !== "recall";
      expect(lemmaCard.options[lemmaCard.answer]).toBe(forward ? lemmaCard.gloss : lemmaCard.lemmaAr);
    }
    const ayah = cards.find((c) => c.kind === "ayah")!;
    if (ayah.kind === "ayah") {
      expect([ayah.surah, ayah.ayah, ayah.textAr]).toEqual([1, 2, "ayat"]);
    }
  });

  it("item baru dari server selalu ikut walau jam perangkat tertinggal dari jam server", async () => {
    const db = makeDb();
    await seedContent(db);
    // dibuka server "sekarang" menurut jam server yang 3 menit lebih maju dari perangkat
    await db.userItems.put(localItem({ itemId: 1, refId: 1, dueAt: future(3) }));
    expect((await buildLocalSession(db, NOW)).map((c) => c.itemId)).toEqual([1]);
  });

  it("kosong bila tidak ada yang jatuh tempo, dan item tanpa data konten dilewati", async () => {
    const db = makeDb();
    await seedContent(db);
    expect(await buildLocalSession(db, NOW)).toEqual([]);
    await db.userItems.put(localItem({ itemId: 9, refId: 999, dueAt: past(1) })); // lemma tak ada lokal
    expect(await buildLocalSession(db, NOW)).toEqual([]);
  });

  it("dibatasi 40 kartu", async () => {
    const db = makeDb();
    await db.lemmas.bulkPut(Array.from({ length: 60 }, (_, i) => lemma(i + 1)));
    await db.userItems.bulkPut(
      Array.from({ length: 60 }, (_, i) => localItem({ itemId: i + 1, refId: i + 1, dueAt: past(60 - i) })),
    );
    expect(await buildLocalSession(db, NOW)).toHaveLength(40);
  });
});

describe("buildLocalQuiz", () => {
  it("memakai kata yang pernah dijawab saja dan membatasi jumlah soal", async () => {
    const db = makeDb();
    await seedContent(db);
    await db.userItems.bulkPut([
      ...Array.from({ length: 8 }, (_, i) =>
        localItem({ itemId: i + 1, refId: i + 1, fsrs: reviewedCard(), dueAt: future(500) }),
      ),
      localItem({ itemId: 20, refId: 9 }), // belum pernah dijawab (reps 0)
    ]);
    const cards = await buildLocalQuiz(db, 5, NOW, seqRng());
    expect(cards).toHaveLength(5);
    expect(cards.every((c) => c.itemId !== 20)).toBe(true);
  });

  it("kosong bila belum ada kata yang pernah dijawab", async () => {
    const db = makeDb();
    await seedContent(db);
    await db.userItems.put(localItem({ itemId: 1, refId: 1 }));
    expect(await buildLocalQuiz(db, 5, NOW)).toEqual([]);
  });
});

describe("getLocalStats", () => {
  it("null bila belum pernah sinkron", async () => {
    expect(await getLocalStats(makeDb(), NOW)).toBeNull();
  });

  it("streak, jatuh tempo, cakupan, dan indeks dihitung dari data lokal", async () => {
    const db = makeDb();
    await seedContent(db);
    await db.settings.put({ id: 1, ...SETTINGS });
    await setMeta(db, "totals", { totalWords: 1000, totalLemmas: 100 });
    await setMeta(db, "pola30", { correct: 0, total: 0 });
    await db.reviewDays.bulkPut([
      { date: "2026-10-16", total: 30, correct: 27 },
      { date: "2026-10-15", total: 10, correct: 9 },
      { date: "2026-10-14" },
      { date: "2026-10-12" }, // memutus streak
    ]);
    // lemma 1 (freq 99) dikuasai dan masih terjaga; lemma 2 belum
    const mastered = {
      ...newCard(NOW),
      stability: 30,
      reps: 8,
      last_review: new Date(NOW.getTime() - 5 * 86400_000).toISOString(),
    };
    await db.userItems.bulkPut([
      localItem({ itemId: 1, refId: 1, status: "mastered", level: 3, fsrs: mastered, dueAt: future(1000) }),
      localItem({ itemId: 2, refId: 2, dueAt: past(5) }),
    ]);

    const st = (await getLocalStats(db, NOW))!;
    expect(st.streak).toBe(3);
    expect(st.studiedToday).toBe(true);
    expect(st.streakTier).toBe("warm");
    expect(st.dueNow).toBe(1);
    expect(st.lemmasOpened).toBe(2);
    expect(st.coveragePct).toBeCloseTo((99 / 1000) * 100, 5);
    expect(st.learnedTokens).toBe(99 + 98);
    expect(st.retention7d).toBeCloseTo(36 / 40, 5);
    expect(st.indexScore).toBeGreaterThan(0);
    expect(st.indexScore).toBeLessThanOrEqual(100);
  });

  it("lemma yang sudah lama tidak diulang tidak dihitung dikuasai", async () => {
    const db = makeDb();
    await seedContent(db);
    await db.settings.put({ id: 1, ...SETTINGS });
    await setMeta(db, "totals", { totalWords: 1000, totalLemmas: 100 });
    const stale = {
      ...newCard(NOW),
      stability: 10,
      last_review: new Date(NOW.getTime() - 40 * 86400_000).toISOString(),
    };
    await db.userItems.put(localItem({ itemId: 1, refId: 1, status: "mastered", level: 3, fsrs: stale }));
    expect((await getLocalStats(db, NOW))!.coveragePct).toBe(0);
  });
});
