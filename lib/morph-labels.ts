/** Label Indonesia untuk fitur morfologi QAC yang tersedia di korpus. */
export interface MorphPart {
  pos: string;
  form: string;
  features: string[];
}

const LABELS: Record<string, string> = {
  NOM: "marfu' (nominatif)",
  ACC: "manshub (akusatif)",
  GEN: "majrur (genitif)",
  PERF: "fi'il madhi",
  IMPF: "fi'il mudhari'",
  IMPV: "fi'il amr",
  ACT_PCPL: "isim fa'il",
  PASS_PCPL: "isim maf'ul",
  VN: "mashdar",
  DEF: "ma'rifah",
  INDEF: "nakirah",
  M: "mudzakkar",
  F: "mu'annats",
  MS: "mudzakkar tunggal",
  FS: "mu'annats tunggal",
  MP: "mudzakkar jamak",
  FP: "mu'annats jamak",
  DEM: "isim isyarah",
  REL: "isim maushul",
  PRON: "dhamir",
  NEG: "huruf nafi",
  DET: "alif lam",
  PASS: "mabni majhul",
};

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** Daftar label yang bisa dibaca untuk satu kata (semua segmen morfologinya). */
export function describeMorph(parts: MorphPart[]): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };
  for (const p of parts) {
    for (const f of p.features) {
      if (f.startsWith("VF:")) {
        const n = Number(f.slice(3));
        if (n >= 1 && n <= 10) push(`wazan kata kerja ${ROMAN[n]}`);
      } else if (f.startsWith("MOOD:")) {
        push(`mood ${f.slice(5).toLowerCase()}`);
      } else if (f.startsWith("FAM:")) {
        push(`saudara ${f.slice(4)}`);
      } else if (LABELS[f]) {
        push(LABELS[f]);
      }
    }
  }
  return out;
}
