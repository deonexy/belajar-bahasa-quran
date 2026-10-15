// Parser korpus morfologi Al-Qur'an (format QAC dalam aksara Arab).
// Baris: "surah:ayah:kata:segmen<TAB>bentuk<TAB>POS<TAB>fitur|fitur|..."
// Modul ini murni (tanpa API Deno/Node) agar bisa diuji dengan Vitest
// dan dipakai ulang oleh Edge Function maupun script lokal.

export interface Segment {
  form: string;
  pos: string;
  features: string[];
}

export interface ParsedWord {
  surah: number;
  ayah: number;
  position: number;
  textAr: string;
  segments: Segment[];
  /** Kunci lemma `lemma_ar|pos` dari segmen stem utama, atau null. */
  lemmaKey: string | null;
  rootAr: string | null;
}

export interface ParsedLemma {
  key: string;
  lemmaAr: string;
  pos: string;
  rootAr: string | null;
  freq: number;
  freqRank: number;
}

export interface ParsedCorpus {
  words: ParsedWord[];
  lemmas: ParsedLemma[];
  roots: string[];
  ayahCount: number;
}

const TASHKIL = /[ً-ٰٟۖ-ۭـ]/g;

/** Hapus harakat dan tatwil. */
export function stripTashkil(s: string): string {
  return s.replace(TASHKIL, "");
}

function featureValue(features: string[], prefix: string): string | null {
  for (const f of features) {
    if (f.startsWith(prefix)) return f.slice(prefix.length);
  }
  return null;
}

const isClitic = (s: Segment) =>
  s.features.includes("PREF") || s.features.includes("SUFF");

/** Pilih segmen stem utama: non-klitik, utamakan N/V, selain itu yang terakhir. */
export function pickStem(segments: Segment[]): Segment | null {
  const stems = segments.filter((s) => !isClitic(s));
  if (stems.length === 0) return null;
  const content = stems.find((s) => s.pos === "N" || s.pos === "V");
  return content ?? stems[stems.length - 1];
}

/** Kategori POS yang dipakai aplikasi: V, PRON, PN, N, atau P. */
export function appPos(stem: Segment): string {
  if (stem.pos === "V") return "V";
  if (stem.features.includes("PRON")) return "PRON";
  if (stem.features.includes("PN")) return "PN";
  return stem.pos;
}

export function lemmaArOf(stem: Segment): string {
  const lem = featureValue(stem.features, "LEM:");
  // Kata ganti tanpa LEM: pakai bentuk tanpa harakat agar varian menyatu.
  return lem ?? stripTashkil(stem.form);
}

export function parseMorphology(text: string): ParsedCorpus {
  const byWord = new Map<string, ParsedWord>();
  const order: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const cols = line.split("\t");
    if (cols.length < 4) continue;
    const [loc, form, pos, feat] = cols;
    const parts = loc.split(":");
    if (parts.length !== 4) continue;
    const surah = Number(parts[0]);
    const ayah = Number(parts[1]);
    const position = Number(parts[2]);
    if (!Number.isInteger(surah) || !Number.isInteger(ayah) || !Number.isInteger(position)) {
      continue;
    }
    const key = `${surah}:${ayah}:${position}`;
    let w = byWord.get(key);
    if (!w) {
      w = {
        surah,
        ayah,
        position,
        textAr: "",
        segments: [],
        lemmaKey: null,
        rootAr: null,
      };
      byWord.set(key, w);
      order.push(key);
    }
    w.textAr += form;
    w.segments.push({ form, pos, features: feat.split("|") });
  }

  const counts = new Map<string, ParsedLemma>();
  const roots = new Set<string>();
  const words: ParsedWord[] = [];

  for (const key of order) {
    const w = byWord.get(key)!;
    const stem = pickStem(w.segments);
    if (stem) {
      const lemmaAr = lemmaArOf(stem);
      const pos = appPos(stem);
      const root = featureValue(stem.features, "ROOT:");
      w.lemmaKey = `${lemmaAr}|${pos}`;
      w.rootAr = root;
      if (root) roots.add(root);
      const existing = counts.get(w.lemmaKey);
      if (existing) {
        existing.freq += 1;
        if (!existing.rootAr && root) existing.rootAr = root;
      } else {
        counts.set(w.lemmaKey, {
          key: w.lemmaKey,
          lemmaAr,
          pos,
          rootAr: root,
          freq: 1,
          freqRank: 0,
        });
      }
    }
    words.push(w);
  }

  const lemmas = [...counts.values()].sort((a, b) => b.freq - a.freq);
  lemmas.forEach((l, i) => {
    l.freqRank = i + 1;
  });

  const ayahSet = new Set(words.map((w) => `${w.surah}:${w.ayah}`));
  return { words, lemmas, roots: [...roots], ayahCount: ayahSet.size };
}

/** Cek keutuhan hasil parse; kembalikan daftar masalah (kosong = lolos). */
export function validateCorpus(c: ParsedCorpus): string[] {
  const problems: string[] = [];
  if (c.ayahCount !== 6236) problems.push(`jumlah ayat ${c.ayahCount}, seharusnya 6236`);
  const surahs = new Set(c.words.map((w) => w.surah));
  if (surahs.size !== 114) problems.push(`jumlah surah ${surahs.size}, seharusnya 114`);
  const noLemma = c.words.filter((w) => w.lemmaKey === null).length;
  if (noLemma > 0) problems.push(`${noLemma} kata tanpa lemma`);
  const freqSum = c.lemmas.reduce((s, l) => s + l.freq, 0);
  const withLemma = c.words.length - noLemma;
  if (freqSum !== withLemma) {
    problems.push(`jumlah freq ${freqSum} != kata berlemma ${withLemma}`);
  }
  return problems;
}
