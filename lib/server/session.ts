import type { SupabaseClient } from "@supabase/supabase-js";
import { chooseExercise, understanding, type ItemKind } from "@/lib/engine";
import type {
  AyahCard,
  ExampleView,
  LemmaCard,
  LessonCard,
  SessionCard,
  WordView,
} from "@/lib/session-types";

const MAX_CARDS = 40;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function wordsOfAyah(
  supabase: SupabaseClient,
  surah: number,
  ayah: number,
  targetLemmaId?: number,
): Promise<WordView[]> {
  const { data } = await supabase
    .from("words")
    .select("position,text_ar,gloss_id,lemma_id")
    .eq("surah", surah)
    .eq("ayah", ayah)
    .order("position");
  return (data ?? []).map((w) => ({
    text: w.text_ar,
    gloss: w.gloss_id,
    target: targetLemmaId !== undefined && w.lemma_id === targetLemmaId,
  }));
}

/** Contoh ayat terpendek yang memuat lemma. */
async function exampleFor(
  supabase: SupabaseClient,
  lemmaId: number,
): Promise<ExampleView | null> {
  const { data: occ } = await supabase
    .from("words")
    .select("surah,ayah")
    .eq("lemma_id", lemmaId)
    .limit(12);
  if (!occ || occ.length === 0) return null;
  const keys = [...new Map(occ.map((o) => [`${o.surah}:${o.ayah}`, o])).values()];
  const { data: ayahs } = await supabase
    .from("ayahs")
    .select("surah,ayah,text_ar,translation_id")
    .or(keys.map((k) => `and(surah.eq.${k.surah},ayah.eq.${k.ayah})`).join(","));
  if (!ayahs || ayahs.length === 0) return null;
  const best = [...ayahs].sort((a, b) => a.text_ar.length - b.text_ar.length)[0];
  return {
    surah: best.surah,
    ayah: best.ayah,
    translation: best.translation_id,
    words: await wordsOfAyah(supabase, best.surah, best.ayah, lemmaId),
  };
}

interface QueueRow {
  itemId: number;
  level: number;
  reps: number;
  kind: ItemKind;
  refId: number;
}

function toQueueRow(r: Row): QueueRow {
  const it = Array.isArray(r.items) ? r.items[0] : r.items;
  return {
    itemId: Number(r.item_id),
    level: Number(r.level),
    reps: Number(r.fsrs?.reps ?? 0),
    kind: it.kind as ItemKind,
    refId: Number(it.ref_id),
  };
}

/** Membangun antrean kartu sesi: review jatuh tempo + item baru hari ini. */
export async function buildSession(
  supabase: SupabaseClient,
  userId: string,
  rng: () => number = Math.random,
): Promise<SessionCard[]> {
  const { data: due } = await supabase
    .from("user_items")
    .select("item_id,level,fsrs,due_at,items!inner(kind,ref_id)")
    .eq("user_id", userId)
    .neq("status", "suspended")
    .lte("due_at", new Date().toISOString())
    .order("due_at")
    .limit(MAX_CARDS);
  const rows = ((due ?? []) as Row[]).map(toQueueRow);
  if (rows.length === 0) return [];
  return cardsFromRows(supabase, rows, rng);
}

/**
 * Kuis latihan dinamis: memilih kata yang sudah dipelajari (pernah direview),
 * dengan peluang lebih besar untuk kata yang pemahamannya rendah atau sudah
 * lewat jatuh tempo. Setiap panggilan menghasilkan soal berbeda.
 */
export async function buildQuiz(
  supabase: SupabaseClient,
  userId: string,
  count = 10,
  rng: () => number = Math.random,
): Promise<SessionCard[]> {
  const { data } = await supabase
    .from("user_items")
    .select("item_id,level,fsrs,due_at,status,items!inner(kind,ref_id)")
    .eq("user_id", userId)
    .eq("items.kind", "lemma")
    .neq("status", "suspended");
  const all = ((data ?? []) as Row[]).filter((r) => Number(r.fsrs?.reps ?? 0) >= 1);
  if (all.length === 0) return [];

  const now = Date.now();
  const weighted = all.map((r) => {
    const u = understanding(Number(r.level), Number(r.fsrs?.stability ?? 0)) / 100;
    const overdue = new Date(r.due_at).getTime() <= now ? 0.3 : 0;
    return { row: r, weight: 0.1 + (1 - u) + overdue };
  });

  // Pengambilan acak berbobot tanpa pengembalian (Efraimidis-Spirakis).
  const picked = weighted
    .map((w) => ({ w, key: Math.pow(rng(), 1 / w.weight) }))
    .sort((x, y) => y.key - x.key)
    .slice(0, count)
    .map((x) => toQueueRow(x.w.row));

  const cards = await cardsFromRows(supabase, picked, rng);
  return shuffle(cards, rng);
}

async function cardsFromRows(
  supabase: SupabaseClient,
  rows: QueueRow[],
  rng: () => number,
): Promise<SessionCard[]> {
  const lemmaRows = rows.filter((r) => r.kind === "lemma");
  const lessonRows = rows.filter((r) => r.kind === "lesson");
  const ayahRows = rows.filter((r) => r.kind === "ayah");

  // Data lemma + bank pengecoh
  const lemmaMap = new Map<number, Row>();
  let bank: Row[] = [];
  if (lemmaRows.length > 0) {
    const { data: lem } = await supabase
      .from("lemmas")
      .select("id,lemma_ar,pos,gloss_id,root_id,roots(root_ar)")
      .in("id", lemmaRows.map((r) => r.refId));
    for (const l of (lem ?? []) as Row[]) lemmaMap.set(l.id, l);
    const { data: b } = await supabase
      .from("lemmas")
      .select("id,lemma_ar,pos,gloss_id")
      .not("gloss_id", "is", null)
      .order("freq_rank")
      .limit(600);
    bank = (b ?? []) as Row[];
  }

  const cards: SessionCard[] = [];

  for (const r of lemmaRows) {
    const l = lemmaMap.get(r.refId);
    if (!l || !l.gloss_id) continue;
    const exercise = chooseExercise(r.level, "lemma", rng);
    const samePos = bank.filter((b) => b.id !== l.id && b.pos === l.pos && b.gloss_id !== l.gloss_id);
    const pool = samePos.length >= 3 ? samePos : bank.filter((b) => b.id !== l.id && b.gloss_id !== l.gloss_id);
    const distractors = shuffle(pool, rng).slice(0, 3);
    // recognize: Arab -> arti; recall: arti -> Arab; context: ayat -> arti
    const forward = exercise !== "recall";
    const correctLabel = forward ? l.gloss_id : l.lemma_ar;
    const labels = shuffle(
      [correctLabel, ...distractors.map((d) => (forward ? d.gloss_id : d.lemma_ar))],
      rng,
    );
    const root = Array.isArray(l.roots) ? l.roots[0] : l.roots;
    const needExample = exercise === "context" || r.reps === 0;
    cards.push({
      kind: "lemma",
      itemId: r.itemId,
      isNew: r.reps === 0,
      exercise,
      lemmaAr: l.lemma_ar,
      gloss: l.gloss_id,
      pos: l.pos,
      rootAr: root?.root_ar ?? null,
      options: labels,
      answer: labels.indexOf(correctLabel),
      example: needExample ? await exampleFor(supabase, l.id) : null,
    } satisfies LemmaCard);
  }

  if (lessonRows.length > 0) {
    const { data: ls } = await supabase
      .from("lessons")
      .select("id,code,title,body_md,exercises")
      .in("id", lessonRows.map((r) => r.refId));
    for (const r of lessonRows) {
      const l = (ls ?? []).find((x) => x.id === r.refId);
      if (!l) continue;
      cards.push({
        kind: "lesson",
        itemId: r.itemId,
        isNew: r.reps === 0,
        code: l.code,
        title: l.title,
        bodyMd: l.body_md,
        exercises: l.exercises,
      } satisfies LessonCard);
    }
  }

  for (const r of ayahRows) {
    const s = Math.floor(r.refId / 1000);
    const a = r.refId % 1000;
    const { data: ay } = await supabase
      .from("ayahs")
      .select("text_ar,translation_id")
      .eq("surah", s)
      .eq("ayah", a)
      .maybeSingle();
    if (!ay) continue;
    cards.push({
      kind: "ayah",
      itemId: r.itemId,
      isNew: r.reps === 0,
      surah: s,
      ayah: a,
      textAr: ay.text_ar,
      translation: ay.translation_id,
      words: await wordsOfAyah(supabase, s, a),
    } satisfies AyahCard);
  }

  // Urutan: pelajaran baru dulu, lalu campur acak review dan item baru.
  const first = cards.filter((c) => c.kind === "lesson" && c.isNew);
  const rest = shuffle(cards.filter((c) => !(c.kind === "lesson" && c.isNew)), rng);
  return [...first, ...rest];
}
