// Edge Function: impor korpus Al-Qur'an ke database (SPEC bagian 4).
// Idempoten. Berjalan di latar belakang agar tidak terkena batas waktu respons.
// Sumber: mirror GitHub morfologi QAC (aksara Arab), teks Utsmani Hafs, terjemah Kemenag.
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseMorphology, validateCorpus } from "./parse.ts";
import { GLOSSES } from "./glosses.ts";

const SOURCES = {
  morph:
    "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt",
  ara: "https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/ara-quranuthmanihaf.min.json",
  ind: "https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/ind-indonesianislam.min.json",
};

type Row = Record<string, unknown>;

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

async function log(msg: string) {
  console.log(msg);
  await db.from("import_log").insert({ msg });
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`gagal mengunduh ${url}: ${r.status}`);
  return await r.text();
}

async function upsertChunks(
  table: string,
  rows: Row[],
  onConflict: string,
  size = 1000,
) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db
      .from(table)
      .upsert(rows.slice(i, i + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function fetchAll(table: string, cols: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select(cols)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as Row[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function run() {
  await log("mulai impor");
  const [morphText, araText, indText] = await Promise.all([
    fetchText(SOURCES.morph),
    fetchText(SOURCES.ara),
    fetchText(SOURCES.ind),
  ]);

  const corpus = parseMorphology(morphText);
  const problems = validateCorpus(corpus);
  const ara = JSON.parse(araText).quran as {
    chapter: number;
    verse: number;
    text: string;
  }[];
  const ind = JSON.parse(indText).quran as {
    chapter: number;
    verse: number;
    text: string;
  }[];
  if (ara.length !== 6236) problems.push(`teks Arab ${ara.length} ayat`);
  if (ind.length !== 6236) problems.push(`terjemah ${ind.length} ayat`);
  if (problems.length > 0) {
    throw new Error("validasi gagal: " + problems.join("; "));
  }
  await log(
    `parse ok: ${corpus.words.length} kata, ${corpus.lemmas.length} lemma, ${corpus.roots.length} akar`,
  );

  // Akar
  await upsertChunks(
    "roots",
    corpus.roots.map((r) => ({ root_ar: r })),
    "root_ar",
  );
  const rootRows = await fetchAll("roots", "id,root_ar");
  const rootId = new Map(rootRows.map((r) => [r.root_ar as string, r.id as number]));

  // Lemma
  await upsertChunks(
    "lemmas",
    corpus.lemmas.map((l) => ({
      lemma_ar: l.lemmaAr,
      pos: l.pos,
      root_id: l.rootAr ? (rootId.get(l.rootAr) ?? null) : null,
      freq: l.freq,
      freq_rank: l.freqRank,
      gloss_id: GLOSSES[l.key] ?? null,
      source: "qac",
    })),
    "lemma_ar,pos",
  );
  const lemmaRows = await fetchAll("lemmas", "id,lemma_ar,pos,freq_rank");
  const lemmaId = new Map(
    lemmaRows.map((l) => [`${l.lemma_ar}|${l.pos}`, l.id as number]),
  );
  await log(`lemma tersimpan: ${lemmaRows.length}`);

  // Ayat
  const araBy = new Map(ara.map((a) => [`${a.chapter}:${a.verse}`, a.text]));
  const indBy = new Map(ind.map((a) => [`${a.chapter}:${a.verse}`, a.text]));
  const ayahKeys = [...new Set(corpus.words.map((w) => `${w.surah}:${w.ayah}`))];
  await upsertChunks(
    "ayahs",
    ayahKeys.map((k) => {
      const [s, a] = k.split(":").map(Number);
      return {
        surah: s,
        ayah: a,
        text_ar: araBy.get(k) ?? "",
        translation_id: indBy.get(k) ?? "",
      };
    }),
    "surah,ayah",
  );
  await log(`ayat tersimpan: ${ayahKeys.length}`);

  // Kata
  await upsertChunks(
    "words",
    corpus.words.map((w) => {
      const gloss = w.lemmaKey ? (GLOSSES[w.lemmaKey] ?? null) : null;
      return {
        surah: w.surah,
        ayah: w.ayah,
        position: w.position,
        text_ar: w.textAr,
        lemma_id: w.lemmaKey ? (lemmaId.get(w.lemmaKey) ?? null) : null,
        root_id: w.rootAr ? (rootId.get(w.rootAr) ?? null) : null,
        gloss_id: gloss,
        morph: w.segments,
      };
    }),
    "surah,ayah,position",
    500,
  );
  await log(`kata tersimpan: ${corpus.words.length}`);

  // Items: lemma (seq = peringkat x 10), ayat (seq besar), pelajaran (seq dari tabel)
  const lessonRows = await fetchAll("lessons", "id,seq");
  const items: Row[] = [
    ...lemmaRows.map((l) => ({
      kind: "lemma",
      ref_id: l.id,
      phase: 1,
      seq: (l.freq_rank as number) * 10,
    })),
    ...ayahKeys.map((k, i) => {
      const [s, a] = k.split(":").map(Number);
      return { kind: "ayah", ref_id: s * 1000 + a, phase: 1, seq: 1_000_000 + i };
    }),
    ...lessonRows.map((l) => ({
      kind: "lesson",
      ref_id: l.id,
      phase: 1,
      seq: l.seq,
    })),
  ];
  await upsertChunks("items", items, "kind,ref_id");
  await log(`items tersimpan: ${items.length}`);

  // Penanda selesai (dipakai view cakupan dan guard)
  await upsertChunks(
    "corpus_meta",
    [
      { key: "quran_total_words", value: corpus.words.length },
      { key: "quran_total_ayahs", value: ayahKeys.length },
      { key: "quran_total_lemmas", value: corpus.lemmas.length },
    ],
    "key",
  );
  await log("impor selesai");
}

Deno.serve(async (_req: Request) => {
  const { data } = await db
    .from("corpus_meta")
    .select("value")
    .eq("key", "quran_total_words")
    .maybeSingle();
  if (data) {
    return Response.json({ skipped: true, reason: "korpus sudah diimpor" });
  }
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime.waitUntil(
    run().catch(async (e) => {
      await log("GAGAL: " + (e instanceof Error ? e.message : String(e)));
    }),
  );
  return Response.json({ started: true }, { status: 202 });
});
