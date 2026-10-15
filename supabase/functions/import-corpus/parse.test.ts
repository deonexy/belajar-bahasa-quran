import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  parseMorphology,
  pickStem,
  stripTashkil,
  validateCorpus,
} from "./parse";

const SAMPLE = [
  "1:1:1:1\tبِ\tP\tP|PREF|LEM:ب",
  "1:1:1:2\tسْمِ\tN\tROOT:سمو|LEM:اسْم|M|GEN",
  "1:1:2:1\tٱللَّهِ\tN\tPN|ROOT:أله|LEM:اللَّه|GEN",
  "2:3:6:1\tوَ\tP\tREM|PREF|LEM:و",
  "2:3:6:2\tمِ\tP\tP|LEM:مِن",
  "2:3:6:3\tمَّا\tN\tREL|LEM:ما",
  "2:4:1:1\tهُمْ\tN\tPRON|3MP",
  "2:4:2:1\tهُم\tN\tPRON|3MP",
].join("\n");

describe("parseMorphology (contoh kecil)", () => {
  const c = parseMorphology(SAMPLE);

  it("menyatukan segmen menjadi kata", () => {
    expect(c.words).toHaveLength(5);
    expect(c.words[0].textAr).toBe("بِسْمِ");
    expect(c.words[0].segments).toHaveLength(2);
  });

  it("memilih stem utama dan mengabaikan klitik", () => {
    expect(c.words[0].lemmaKey).toBe("اسْم|N");
    expect(c.words[1].lemmaKey).toBe("اللَّه|PN");
  });

  it("kata dengan beberapa stem memilih N/V", () => {
    const w = c.words[2];
    expect(w.lemmaKey).toBe("ما|N");
  });

  it("kata ganti tanpa LEM menyatu tanpa harakat", () => {
    const pron = c.lemmas.find((l) => l.pos === "PRON");
    expect(pron?.lemmaAr).toBe("هم");
    expect(pron?.freq).toBe(2);
  });

  it("freq_rank berurut menurun", () => {
    const freqs = c.lemmas.map((l) => l.freq);
    expect([...freqs].sort((a, b) => b - a)).toEqual(freqs);
    expect(c.lemmas[0].freqRank).toBe(1);
  });

  it("mengumpulkan akar unik", () => {
    expect(c.roots.sort()).toEqual(["أله", "سمو"].sort());
  });

  it("stripTashkil membuang harakat", () => {
    expect(stripTashkil("هُمْ")).toBe("هم");
  });

  it("pickStem null bila hanya klitik", () => {
    expect(
      pickStem([{ form: "وَ", pos: "P", features: ["PREF", "LEM:و"] }]),
    ).toBeNull();
  });
});

// Tes terhadap data nyata; dilewati bila data mentah belum diunduh.
const RAW = path.resolve(__dirname, "../../../data/raw/qac/quran-morphology.txt");
describe.skipIf(!existsSync(RAW))("korpus QAC lengkap", () => {
  const c = parseMorphology(readFileSync(RAW, "utf8"));

  it("lolos semua validasi keutuhan", () => {
    expect(validateCorpus(c)).toEqual([]);
  });

  it("77.429 kata dan 6.236 ayat", () => {
    expect(c.words).toHaveLength(77429);
    expect(c.ayahCount).toBe(6236);
  });
});
