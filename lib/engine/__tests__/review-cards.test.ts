import { describe, expect, it } from "vitest";
import {
  applyReview,
  computeStreak,
  newCard,
  type ReviewState,
} from "../index";
import {
  makeLemmaCard,
  needsExample,
  orderCards,
  pickQuizCandidates,
} from "../../session-cards";
import type { SessionCard } from "../../session-types";

const NOW = new Date("2026-10-16T05:00:00Z");

function state(over: Partial<ReviewState> = {}): ReviewState {
  return {
    level: 0,
    everReachedOne: false,
    status: "learning",
    fsrs: newCard(new Date(NOW.getTime() - 3600_000)),
    priority: false,
    masteredAt: null,
    ...over,
  };
}

const base = { itemId: 1, retention: 0.9, priorLapses30: 0, now: NOW };

describe("applyReview", () => {
  it("benar cepat: rating 4, level naik, pemahaman naik, jadwal maju", () => {
    const r = applyReview({ ...base, state: state(), correct: true, responseMs: 1000 });
    expect(r.rating).toBe(4);
    expect(r.correct).toBe(true);
    expect(r.next.level).toBe(1);
    expect(r.next.everReachedOne).toBe(true);
    expect(r.next.status).toBe("learning");
    expect(new Date(r.next.fsrs.due).getTime()).toBeGreaterThan(NOW.getTime());
    expect(r.after).toBeGreaterThan(r.before);
  });

  it("benar lambat (>10 dtk): rating 2, level tetap tetapi dianggap benar", () => {
    const r = applyReview({ ...base, state: state({ level: 1, everReachedOne: true }), correct: true, responseMs: 12_000 });
    expect(r.rating).toBe(2);
    expect(r.correct).toBe(true);
    expect(r.next.level).toBe(1);
  });

  it("salah: rating 1, level turun tetapi tidak di bawah 1 setelah pernah mencapai 1", () => {
    const r = applyReview({ ...base, state: state({ level: 1, everReachedOne: true }), correct: false, responseMs: 1000 });
    expect(r.rating).toBe(1);
    expect(r.correct).toBe(false);
    expect(r.next.level).toBe(1);
  });

  it("penilaian mandiri terjemah dipetakan ke rating", () => {
    const grade = (g: "benar" | "sebagian" | "salah") =>
      applyReview({ ...base, state: state(), grade: g, responseMs: 5000 }).rating;
    expect([grade("benar"), grade("sebagian"), grade("salah")]).toEqual([3, 2, 1]);
  });

  it("dikuasai bila level 3, stabilitas >= 21 hari, tanpa lapse 30 hari; mastered_at tetap", () => {
    const strong = {
      ...newCard(new Date(NOW.getTime() - 86400_000)),
      stability: 40,
      difficulty: 5,
      reps: 9,
      state: 2,
      last_review: new Date(NOW.getTime() - 86400_000).toISOString(),
    };
    const s = state({ level: 2, everReachedOne: true, status: "review", fsrs: strong });
    const ok = applyReview({ ...base, state: s, correct: true, responseMs: 1000 });
    expect(ok.next.level).toBe(3);
    expect(ok.next.status).toBe("mastered");
    expect(ok.next.masteredAt).toBe(NOW.toISOString());

    // lapse dalam 30 hari menghalangi status dikuasai
    const lapsed = applyReview({ ...base, priorLapses30: 1, state: s, correct: true, responseMs: 1000 });
    expect(lapsed.next.status).toBe("review");
    expect(lapsed.next.masteredAt).toBeNull();

    // mastered_at yang sudah ada dipertahankan
    const again = applyReview({
      ...base,
      state: { ...s, level: 3, status: "mastered", masteredAt: "2026-09-01T00:00:00.000Z" },
      correct: true,
      responseMs: 1000,
    });
    expect(again.next.masteredAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("tidak mengubah keadaan masukan", () => {
    const s = state();
    const copy = JSON.parse(JSON.stringify(s));
    applyReview({ ...base, state: s, correct: true, responseMs: 1000 });
    expect(s).toEqual(copy);
  });
});

describe("computeStreak", () => {
  it("menghitung hari beruntun; hari ini boleh belum", () => {
    const days = ["2026-10-15", "2026-10-14", "2026-10-13", "2026-10-10"];
    expect(computeStreak(days, "Asia/Jakarta", NOW)).toBe(3);
    expect(computeStreak(["2026-10-16", ...days], "Asia/Jakarta", NOW)).toBe(4);
    expect(computeStreak(["2026-10-10"], "Asia/Jakarta", NOW)).toBe(0);
  });
});

/** mulberry32: PRNG kecil dengan sebaran baik untuk seed berurutan. */
const rngFrom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const bank = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  lemmaAr: `ع${i}`,
  pos: i % 2 ? "N" : "V",
  gloss: `arti ${i}`,
}));
const lemma = { id: 1, lemmaAr: "ع0", pos: "V", gloss: "arti 0", rootAr: "كتب" };

describe("makeLemmaCard", () => {
  it("recognize/context: pilihan berupa arti, jawaban benar ada di opsi", () => {
    const c = makeLemmaCard({ itemId: 1, reps: 2, exercise: "recognize", lemma, bank, example: null, rng: rngFrom(3) })!;
    expect(c.options).toHaveLength(4);
    expect(c.options[c.answer]).toBe("arti 0");
    expect(new Set(c.options).size).toBe(4);
  });

  it("recall: pilihan berupa tulisan Arab", () => {
    const c = makeLemmaCard({ itemId: 1, reps: 2, exercise: "recall", lemma, bank, example: null, rng: rngFrom(4) })!;
    expect(c.options[c.answer]).toBe("ع0");
    expect(c.isNew).toBe(false);
  });

  it("tanpa arti: tidak membuat kartu; reps 0 = kartu baru", () => {
    expect(makeLemmaCard({ itemId: 1, reps: 0, exercise: "recognize", lemma: { ...lemma, gloss: null }, bank, example: null, rng: rngFrom(1) })).toBeNull();
    expect(makeLemmaCard({ itemId: 1, reps: 0, exercise: "recognize", lemma, bank, example: null, rng: rngFrom(1) })!.isNew).toBe(true);
  });

  it("pengecoh tidak memakai arti yang sama dengan jawaban", () => {
    const dupBank = [...bank, { id: 99, lemmaAr: "x", pos: "V", gloss: "arti 0" }];
    for (let s = 1; s < 30; s++) {
      const c = makeLemmaCard({ itemId: 1, reps: 1, exercise: "recognize", lemma, bank: dupBank, example: null, rng: rngFrom(s) })!;
      expect(c.options.filter((o) => o === "arti 0")).toHaveLength(1);
    }
  });

  it("contoh ayat hanya dimuat untuk konteks atau kartu baru", () => {
    expect(needsExample("context", 5)).toBe(true);
    expect(needsExample("recognize", 0)).toBe(true);
    expect(needsExample("recall", 3)).toBe(false);
  });
});

describe("orderCards & pickQuizCandidates", () => {
  const lesson = (id: number, isNew: boolean): SessionCard => ({
    kind: "lesson", itemId: id, isNew, code: "c", title: "t", bodyMd: "", exercises: [],
  });
  it("pelajaran baru selalu di depan", () => {
    const cards = [lesson(1, false), lesson(2, true), lesson(3, false), lesson(4, true)];
    const out = orderCards(cards, rngFrom(9));
    expect(out.slice(0, 2).map((c) => c.itemId).sort()).toEqual([2, 4]);
    expect(out).toHaveLength(4);
  });

  it("kata lemah dan terlambat lebih sering terpilih", () => {
    const weak = { itemId: 1, level: 0, stability: 0, dueAt: "2026-10-01T00:00:00Z" };
    const strong = { itemId: 2, level: 3, stability: 30, dueAt: "2027-01-01T00:00:00Z" };
    let weakFirst = 0;
    for (let s = 1; s <= 200; s++) {
      const [first] = pickQuizCandidates([weak, strong], 1, NOW.getTime(), rngFrom(s));
      if (first.itemId === 1) weakFirst += 1;
    }
    expect(weakFirst).toBeGreaterThan(140);
  });

  it("tidak melebihi jumlah yang diminta dan tanpa pengulangan", () => {
    const all = Array.from({ length: 6 }, (_, i) => ({ itemId: i, level: 1, stability: 3, dueAt: "2026-10-01T00:00:00Z" }));
    const out = pickQuizCandidates(all, 4, NOW.getTime(), rngFrom(5));
    expect(out).toHaveLength(4);
    expect(new Set(out.map((o) => o.itemId)).size).toBe(4);
  });
});
