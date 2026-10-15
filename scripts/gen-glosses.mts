// Menggabungkan daftar gloss (rank -> arti) dengan lemma hasil parse
// menjadi content/glosses_id.tsv (untuk ditinjau manual) dan
// supabase/functions/import-corpus/glosses.ts (dipakai impor).
import { readFileSync, writeFileSync } from "node:fs";
import { parseMorphology } from "../supabase/functions/import-corpus/parse";

const [, , glossFile] = process.argv;
const corpus = parseMorphology(
  readFileSync("data/raw/qac/quran-morphology.txt", "utf8"),
);
const byRank = new Map(corpus.lemmas.map((l) => [l.freqRank, l]));
const lines = readFileSync(glossFile, "utf8").split("\n").filter(Boolean);

const tsv: string[] = ["rank\tlemma_ar\tpos\tfreq\tgloss_id\treviewed"];
const map: Record<string, string> = {};
for (const line of lines) {
  const [rankStr, gloss] = line.split("\t");
  const l = byRank.get(Number(rankStr));
  if (!l || !gloss) throw new Error(`rank tidak valid: ${line}`);
  tsv.push(`${l.freqRank}\t${l.lemmaAr}\t${l.pos}\t${l.freq}\t${gloss}\tfalse`);
  map[l.key] = gloss;
}
writeFileSync("content/glosses_id.tsv", tsv.join("\n") + "\n");
writeFileSync(
  "supabase/functions/import-corpus/glosses.ts",
  "// DIHASILKAN oleh scripts/gen-glosses.mts dari content/glosses_id.tsv. Jangan edit manual.\n" +
    "// Draf kurasi arti lemma; belum ditinjau pemilik (reviewed=false).\n" +
    `export const GLOSSES: Record<string, string> = ${JSON.stringify(map, null, 1)};\n`,
);
console.log("gloss ditulis:", Object.keys(map).length);
