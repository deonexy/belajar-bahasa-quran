export interface IndexInput {
  /** % token Al-Qur'an yang dikuasai (tidak unik): jumlah kemunculan lemma dikuasai / total kata. */
  tokenCoverage: number;
  /** Kekuatan ingatan 0-100: pemahaman rata-rata lemma yang dibuka, dibobot frekuensi. */
  memoryStrength: number;
  /** Retensi 7 hari 0-100 (akurasi review). */
  retention: number;
  /** Tata bahasa 0-100 (pelajaran + kuis pola). */
  grammar: number;
  /** Membaca ayat 0-100 (pemahaman ayat yang dipelajari). */
  ayat: number;
}

export interface IndexPart {
  key: keyof IndexInput;
  label: string;
  weight: number;
  value: number;
}

/** Bobot indeks pemahaman; jumlahnya 1. Pencapaian target Fase 1 dominan di cakupan token. */
export const INDEX_WEIGHTS: { key: keyof IndexInput; label: string; weight: number }[] = [
  { key: "tokenCoverage", label: "Cakupan kata (token)", weight: 0.4 },
  { key: "memoryStrength", label: "Kekuatan ingatan", weight: 0.2 },
  { key: "retention", label: "Retensi 7 hari", weight: 0.15 },
  { key: "grammar", label: "Tata bahasa", weight: 0.15 },
  { key: "ayat", label: "Membaca ayat", weight: 0.1 },
];

const clamp = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

/** Indeks tingkat pemahaman 0-100 beserta rincian komponennya. */
export function comprehensionIndex(input: IndexInput): { score: number; parts: IndexPart[] } {
  const parts = INDEX_WEIGHTS.map((w) => ({ ...w, value: clamp(input[w.key]) }));
  const score = parts.reduce((s, p) => s + p.value * p.weight, 0);
  return { score, parts };
}

/**
 * Skor tata bahasa 0-100. Pelajaran dihitung terhadap SEMUA pelajaran (yang belum dibuka = 0);
 * akurasi kuis pola 30 hari terakhir menyumbang 30% bila sudah ada jawaban.
 */
export function grammarScore(
  lessonUnderstandings: number[],
  totalLessons: number,
  polaCorrect: number,
  polaTotal: number,
): number {
  const lessonAvg = totalLessons > 0 ? lessonUnderstandings.reduce((a, b) => a + b, 0) / totalLessons : 0;
  if (polaTotal <= 0) return lessonAvg;
  const acc = (polaCorrect / polaTotal) * 100;
  return 0.7 * lessonAvg + 0.3 * acc;
}

/** Skor ayat 0-100: rata-rata pemahaman ayat dibuka, dikecilkan bila baru sedikit (penuh di 30 ayat). */
export function ayatScore(ayatUnderstandings: number[]): number {
  if (ayatUnderstandings.length === 0) return 0;
  const avg = ayatUnderstandings.reduce((a, b) => a + b, 0) / ayatUnderstandings.length;
  return avg * Math.min(1, ayatUnderstandings.length / 30);
}
