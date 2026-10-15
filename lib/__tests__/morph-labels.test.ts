import { describe, expect, it } from "vitest";
import { describeMorph } from "../morph-labels";

describe("describeMorph", () => {
  it("memberi label partisip, wazan, dan kasus", () => {
    const out = describeMorph([
      { pos: "N", form: "x", features: ["ACT_PCPL", "VF:8", "ROOT:وقي", "MP", "GEN"] },
    ]);
    expect(out).toEqual(["isim fa'il", "wazan kata kerja VIII", "mudzakkar jamak", "majrur (genitif)"]);
  });
  it("mengabaikan fitur tak dikenal dan tidak menggandakan", () => {
    const out = describeMorph([
      { pos: "N", form: "a", features: ["NOM", "LEM:x"] },
      { pos: "N", form: "b", features: ["NOM"] },
    ]);
    expect(out).toEqual(["marfu' (nominatif)"]);
  });
});
