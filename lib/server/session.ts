import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemKind } from "@/lib/engine";
import {
  MAX_CARDS,
  exerciseFor,
  makeLemmaCard,
  needsExample,
  orderCards,
  pickQuizCandidates,
  shuffle,
} from "@/lib/session-cards";
import type {
  AyahCard,
  ExampleView,
  LessonCard,
  SessionCard,
  WordView,
} from "@/lib/session-types";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

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

  const picked = pickQuizCandidates(
    all.map((r) => ({
      row: r,
      itemId: Number(r.item_id),
      level: Number(r.level),
      stability: Number(r.fsrs?.stability ?? 0),
      dueAt: String(r.due_at),
    })),
    count,
    Date.now(),
    rng,
  ).map((x) => toQueueRow(x.row));

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
    const exercise = exerciseFor(r.level, rng);
    const root = Array.isArray(l.roots) ? l.roots[0] : l.roots;
    const card = makeLemmaCard({
      itemId: r.itemId,
      reps: r.reps,
      exercise,
      lemma: {
        id: l.id,
        lemmaAr: l.lemma_ar,
        pos: l.pos,
        gloss: l.gloss_id,
        rootAr: root?.root_ar ?? null,
      },
      bank: bank.map((b) => ({ id: b.id, lemmaAr: b.lemma_ar, pos: b.pos, gloss: b.gloss_id })),
      example: needsExample(exercise, r.reps) ? await exampleFor(supabase, l.id) : null,
      rng,
    });
    if (card) cards.push(card);
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

  return orderCards(cards, rng);
}
