import { describe, expect, it } from "vitest";
import { ayatScore, comprehensionIndex, grammarScore, INDEX_WEIGHTS, streakTier } from "../index";

describe("streakTier", () => {
  it("freeze, cold, warm, hot", () => {
    expect(streakTier(0, false)).toBe("freeze");
    expect(streakTier(0, true)).toBe("freeze");
    expect(streakTier(5, false)).toBe("cold");
    expect(streakTier(3, true)).toBe("warm");
    expect(streakTier(7, true)).toBe("hot");
  });
});

describe("comprehensionIndex", () => {
  it("bobot berjumlah 1", () => {
    expect(INDEX_WEIGHTS.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1);
  });
  it("semua 100 -> 100, semua 0 -> 0", () => {
    const all = (n: number) => ({ tokenCoverage: n, memoryStrength: n, retention: n, grammar: n, ayat: n });
    expect(comprehensionIndex(all(100)).score).toBeCloseTo(100);
    expect(comprehensionIndex(all(0)).score).toBe(0);
  });
  it("menjepit nilai di luar 0-100 dan NaN", () => {
    const r = comprehensionIndex({ tokenCoverage: 150, memoryStrength: NaN, retention: -5, grammar: 0, ayat: 0 });
    expect(r.score).toBeCloseTo(40);
  });
});

describe("grammarScore & ayatScore", () => {
  it("pelajaran belum dibuka dihitung nol", () => {
    expect(grammarScore([100, 100], 10, 0, 0)).toBeCloseTo(20);
  });
  it("kuis pola menyumbang 30%", () => {
    expect(grammarScore([100], 1, 5, 10)).toBeCloseTo(0.7 * 100 + 0.3 * 50);
  });
  it("ayat dikecilkan bila sedikit", () => {
    expect(ayatScore([])).toBe(0);
    expect(ayatScore(Array(15).fill(80))).toBeCloseTo(40);
    expect(ayatScore(Array(30).fill(80))).toBeCloseTo(80);
  });
});
