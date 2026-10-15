import { describe, expect, it } from "vitest";
import {
  chooseExercise,
  comprehension,
  computeQuota,
  coverage,
  deriveRating,
  isMastered,
  newCard,
  nextLevel,
  pickNewItems,
  ratingFromSelfGrade,
  retentionOrDefault,
  understanding,
  isRetained,
  isCurrentlyMastered,
  weeklyRate,
  projectCompletion,
  defaultDeadline,
  scheduleReview,
  type Item,
  type UserItem,
} from "../index";

const NOW = new Date("2026-11-01T00:00:00Z");

function userItem(over: Partial<UserItem> & { stability?: number } = {}): UserItem {
  const card = newCard(NOW);
  card.stability = over.stability ?? card.stability;
  return {
    itemId: 1,
    kind: "lemma",
    status: "review",
    level: 3,
    fsrs: card,
    dueAt: NOW.toISOString(),
    priority: false,
    everReachedOne: true,
    ...over,
  };
}

describe("computeQuota", () => {
  it("R < 0,80 -> 0", () => {
    const r = computeQuota({ R: 0.79, B: 10, L: 0, N: 5 });
    expect(r.quota).toBe(0);
    expect(r.reason).toContain("79%");
  });
  it("0,80 <= R < 0,85 -> 2", () => {
    expect(computeQuota({ R: 0.82, B: 10, L: 0, N: 5 }).quota).toBe(2);
  });
  it("0,85 <= R < 0,90 -> 3", () => {
    expect(computeQuota({ R: 0.87, B: 10, L: 0, N: 5 }).quota).toBe(3);
  });
  it("R >= 0,90 -> N", () => {
    expect(computeQuota({ R: 0.95, B: 10, L: 0, N: 5 }).quota).toBe(5);
  });
  it("B > 100 -> 0", () => {
    expect(computeQuota({ R: 0.95, B: 101, L: 0, N: 5 }).quota).toBe(0);
  });
  it("tumpukan learning mengurangi kuota", () => {
    expect(computeQuota({ R: 0.95, B: 10, L: 23, N: 5 }).quota).toBe(2);
  });
  it("kuota tidak negatif", () => {
    expect(computeQuota({ R: 0.95, B: 10, L: 60, N: 5 }).quota).toBe(0);
  });
  it("N kecil membatasi tier bawah", () => {
    expect(computeQuota({ R: 0.82, B: 0, L: 0, N: 1 }).quota).toBe(1);
  });
  it("reason selalu terisi", () => {
    for (const R of [0.5, 0.82, 0.87, 0.95]) {
      expect(computeQuota({ R, B: 0, L: 0, N: 5 }).reason.length).toBeGreaterThan(0);
    }
  });
  it("jawaban < 20 memakai R = 0,90", () => {
    expect(retentionOrDefault(3, 10)).toBe(0.9);
    expect(retentionOrDefault(18, 20)).toBeCloseTo(0.9);
    expect(retentionOrDefault(15, 20)).toBeCloseTo(0.75);
  });
});

describe("deriveRating", () => {
  it("menurut ketepatan dan waktu", () => {
    expect(deriveRating({ correct: false, responseMs: 1000 })).toBe(1);
    expect(deriveRating({ correct: true, responseMs: 12_000 })).toBe(2);
    expect(deriveRating({ correct: true, responseMs: 5_000 })).toBe(3);
    expect(deriveRating({ correct: true, responseMs: 2_000 })).toBe(4);
  });
  it("penilaian mandiri terjemah", () => {
    expect(ratingFromSelfGrade("benar")).toBe(3);
    expect(ratingFromSelfGrade("sebagian")).toBe(2);
    expect(ratingFromSelfGrade("salah")).toBe(1);
  });
});

describe("nextLevel", () => {
  it("naik pada Good", () => {
    expect(nextLevel(0, 3, false)).toBe(1);
  });
  it("tidak lewat 3", () => {
    expect(nextLevel(3, 3, true)).toBe(3);
  });
  it("turun pada Again", () => {
    expect(nextLevel(2, 1, true)).toBe(1);
  });
  it("tidak turun di bawah 1 bila pernah level 1", () => {
    expect(nextLevel(1, 1, true)).toBe(1);
  });
  it("boleh turun ke 0 bila belum pernah level 1", () => {
    expect(nextLevel(1, 1, false)).toBe(0);
  });
  it("tetap pada Hard", () => {
    expect(nextLevel(2, 2, true)).toBe(2);
  });
});

describe("isMastered", () => {
  it("memenuhi semua syarat", () => {
    expect(isMastered(userItem({ stability: 25 }), 0)).toBe(true);
  });
  it("stabilitas kurang", () => {
    expect(isMastered(userItem({ stability: 15 }), 0)).toBe(false);
  });
  it("ada lapse dalam 30 hari", () => {
    expect(isMastered(userItem({ stability: 25 }), 1)).toBe(false);
  });
  it("level kurang dari 3", () => {
    expect(isMastered(userItem({ stability: 25, level: 2 }), 0)).toBe(false);
  });
});

describe("pickNewItems", () => {
  const mk = (id: number, seq: number, kind: Item["kind"] = "lemma", prereq: number[] = []): Item => ({
    id,
    kind,
    refId: id,
    phase: 1,
    seq,
    prereqItemIds: prereq,
  });

  it("urut seq dan dibatasi kuota", () => {
    const picked = pickNewItems([mk(3, 3), mk(1, 1), mk(2, 2)], 2);
    expect(picked.map((i) => i.id)).toEqual([1, 2]);
  });
  it("prioritas didahulukan", () => {
    const picked = pickNewItems([mk(1, 1), mk(2, 2), mk(3, 3)], 1, {
      priorityItemIds: new Set([3]),
    });
    expect(picked.map((i) => i.id)).toEqual([3]);
  });
  it("prasyarat belum terpenuhi dilewati", () => {
    const picked = pickNewItems([mk(1, 1, "lemma", [99]), mk(2, 2)], 2, {
      levelByItemId: new Map([[99, 0]]),
    });
    expect(picked.map((i) => i.id)).toEqual([2]);
  });
  it("prasyarat terpenuhi lolos", () => {
    const picked = pickNewItems([mk(1, 1, "lemma", [99])], 1, {
      levelByItemId: new Map([[99, 1]]),
    });
    expect(picked.map((i) => i.id)).toEqual([1]);
  });
  it("lesson tidak memakan kuota dan maksimal 1", () => {
    const picked = pickNewItems(
      [mk(1, 1, "lesson"), mk(2, 2, "lesson"), mk(3, 3), mk(4, 4)],
      2,
    );
    expect(picked.map((i) => i.id)).toEqual([1, 3, 4]);
  });
  it("kuota 0 tetap membuka satu lesson", () => {
    const picked = pickNewItems([mk(1, 1, "lesson"), mk(2, 2)], 0);
    expect(picked.map((i) => i.id)).toEqual([1]);
  });
});

describe("coverage & comprehension", () => {
  const freq = new Map([
    [1, 50],
    [2, 30],
    [3, 20],
  ]);
  it("0 lemma -> 0", () => {
    expect(coverage([], freq, 100)).toBe(0);
  });
  it("semua lemma -> 100", () => {
    expect(coverage([1, 2, 3], freq, 100)).toBe(100);
  });
  it("sebagian sesuai hitungan manual", () => {
    expect(coverage([1, 3], freq, 100)).toBe(70);
  });
  it("lemma ganda tidak dihitung dua kali", () => {
    expect(coverage([1, 1], freq, 100)).toBe(50);
  });
  it("total 0 aman", () => {
    expect(coverage([1], freq, 0)).toBe(0);
  });
  it("pemahaman berbobot frekuensi", () => {
    const a = { ...userItem({ stability: 21, level: 3 }), freq: 80 };
    const b = { ...userItem({ stability: 0, level: 0 }), freq: 20 };
    expect(comprehension([a, b])).toBeCloseTo(80);
  });
});

describe("chooseExercise", () => {
  it("menurut level", () => {
    expect(chooseExercise(0, "lemma", () => 0.5)).toBe("recognize");
    expect(chooseExercise(1, "lemma", () => 0.5)).toBe("recall");
    expect(chooseExercise(2, "lemma", () => 0.5)).toBe("context");
    expect(chooseExercise(1, "ayah", () => 0.5)).toBe("translate");
  });
  it("level 3 mengikuti bobot 20/30/50", () => {
    expect(chooseExercise(3, "lemma", () => 0.1)).toBe("recognize");
    expect(chooseExercise(3, "lemma", () => 0.3)).toBe("recall");
    expect(chooseExercise(3, "lemma", () => 0.9)).toBe("context");
  });
});

describe("scheduleReview (FSRS)", () => {
  it("jawaban Good menjadwalkan ke depan dan menambah reps", () => {
    const card = newCard(NOW);
    const next = scheduleReview(card, 3, NOW, 0.9);
    expect(new Date(next.due).getTime()).toBeGreaterThan(NOW.getTime());
    expect(next.reps).toBe(1);
  });
  it("Easy menjadwalkan lebih jauh daripada Again", () => {
    const card = newCard(NOW);
    const easy = scheduleReview(card, 4, NOW, 0.9);
    const again = scheduleReview(card, 1, NOW, 0.9);
    expect(new Date(easy.due).getTime()).toBeGreaterThan(new Date(again.due).getTime());
  });
  it("hasil bisa diserialisasi JSON dan dipakai lagi", () => {
    const first = scheduleReview(newCard(NOW), 3, NOW, 0.9);
    const roundTrip = JSON.parse(JSON.stringify(first));
    const later = new Date(new Date(first.due).getTime());
    const second = scheduleReview(roundTrip, 3, later, 0.9);
    expect(second.reps).toBe(2);
    expect(new Date(second.due).getTime()).toBeGreaterThan(later.getTime());
    // Setelah lulus fase learning, review hari berikutnya menaikkan stabilitas.
    const nextDay = new Date(later.getTime() + 2 * 86_400_000);
    const third = scheduleReview(second, 3, nextDay, 0.9);
    expect(third.stability).toBeGreaterThan(second.stability);
  });
});

describe("understanding", () => {
  it("0 untuk item baru, 100 untuk level 3 dengan stabilitas >= 21 hari", () => {
    expect(understanding(0, 0)).toBe(0);
    expect(understanding(3, 21)).toBeCloseTo(100);
    expect(understanding(3, 60)).toBeCloseTo(100);
  });
  it("dibatasi oleh yang terlemah antara level dan stabilitas", () => {
    expect(understanding(3, 10.5)).toBeCloseTo(50);
    expect(understanding(1, 21)).toBeCloseTo(100 / 3);
    expect(understanding(9, -5)).toBe(0);
  });
});

describe("gerbang: perkiraan 7 hari", () => {
  it("kuota 0 bila perkiraan review 7 hari melebihi 7 x batas", () => {
    const r = computeQuota({ R: 0.95, B: 10, L: 0, N: 5, B7: 1100, reviewLimit: 150 });
    expect(r.quota).toBe(0);
    expect(r.reason).toContain("1100");
  });
  it("tidak memengaruhi bila di bawah batas atau tidak diberikan", () => {
    expect(computeQuota({ R: 0.95, B: 10, L: 0, N: 5, B7: 1050, reviewLimit: 150 }).quota).toBe(5);
    expect(computeQuota({ R: 0.95, B: 10, L: 0, N: 5 }).quota).toBe(5);
  });
});

describe("dikuasai: masih terjaga (R >= 0,9)", () => {
  const card = (lastReview: string, stability: number) => ({
    stability,
    last_review: lastReview,
  });
  it("terjaga selama hari sejak review <= stabilitas", () => {
    const now = new Date("2026-11-30T00:00:00Z");
    expect(isRetained(card("2026-11-10T00:00:00Z", 21), now)).toBe(true);
    expect(isRetained(card("2026-11-01T00:00:00Z", 21), now)).toBe(false);
    expect(isRetained({ stability: 30 }, now)).toBe(false);
  });
  it("dikuasai butuh kriteria tersimpan dan terjaga", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    const fresh = userItem({ stability: 30 });
    fresh.fsrs.last_review = "2026-11-25T00:00:00Z";
    expect(isCurrentlyMastered(fresh, 0, now)).toBe(true);
    expect(isCurrentlyMastered(fresh, 1, now)).toBe(false);
    fresh.fsrs.last_review = "2026-10-01T00:00:00Z";
    expect(isCurrentlyMastered(fresh, 0, now)).toBe(false);
  });
});

describe("proyeksi", () => {
  const pts = [0, 7, 14, 21, 28].map((d, i) => ({
    date: new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10),
    coverage: i * 2,
  }));
  it("laju mingguan dari regresi linear", () => {
    expect(weeklyRate(pts)).toBeCloseTo(2);
    expect(weeklyRate([pts[0]])).toBeNull();
  });
  it("on track bila proyeksi sebelum tenggat", () => {
    const r = projectCompletion({ coverageNow: 8, target: 85, ratePerWeek: 2, today: "2026-11-29", deadline: "2028-11-01" });
    expect(r.kind).toBe("on_track");
  });
  it("tertinggal X minggu bila proyeksi lewat tenggat", () => {
    const r = projectCompletion({ coverageNow: 8, target: 85, ratePerWeek: 0.5, today: "2026-11-29", deadline: "2028-11-01" });
    expect(r.kind).toBe("behind");
    if (r.kind === "behind") expect(r.weeksBehind).toBeGreaterThan(0);
  });
  it("kasus tepi", () => {
    const base = { target: 85, today: "2026-11-29", deadline: "2028-11-01" };
    expect(projectCompletion({ ...base, coverageNow: 90, ratePerWeek: 1 }).kind).toBe("reached");
    expect(projectCompletion({ ...base, coverageNow: 10, ratePerWeek: null }).kind).toBe("no_data");
    expect(projectCompletion({ ...base, coverageNow: 10, ratePerWeek: 0 }).kind).toBe("stalled");
  });
  it("tenggat default 24 bulan", () => {
    expect(defaultDeadline("2026-10-15")).toBe("2028-10-15");
  });
});
