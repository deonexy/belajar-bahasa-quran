import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeStreak,
  ayatScore,
  comprehension,
  grammarScore,
  understanding,
  type UserItemWithFreq,
  type FsrsCardJson,
} from "@/lib/engine";
import { localDate } from "@/lib/dates";
import { fetchLemmas } from "./lemmas";

export { computeStreak };

export async function getHomeStats(
  supabase: SupabaseClient,
  userId: string,
  tz: string,
) {
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ data: days }, { data: cov }, { data: totals }, { data: ui }, lessonCount, polaRows] =
    await Promise.all([
      supabase.rpc("review_days", { p_tz: tz }),
      supabase.from("v_user_coverage").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("corpus_meta").select("key,value"),
      supabase
        .from("user_items")
        .select("level,status,fsrs,items!inner(kind,ref_id)")
        .eq("user_id", userId),
      supabase.from("items").select("id", { count: "exact", head: true }).eq("kind", "lesson"),
      supabase.from("pola_attempts").select("correct").eq("user_id", userId).gte("answered_at", since30),
    ]);

  const dayList = ((days ?? []) as unknown as (string | Record<string, string>)[]).map(
    (d) => (typeof d === "string" ? d : Object.values(d)[0]),
  );

  type Row = {
    level: number;
    status: string;
    fsrs: FsrsCardJson;
    items: { kind: string; ref_id: number } | { kind: string; ref_id: number }[];
  };
  const rows = (ui ?? []) as unknown as Row[];
  const lemmaRows = rows
    .map((r) => ({ ...r, item: Array.isArray(r.items) ? r.items[0] : r.items }))
    .filter((r) => r.item.kind === "lemma");

  const lemmaInfo = await fetchLemmas(supabase, lemmaRows.map((r) => r.item.ref_id));
  const freqById = new Map<number, number>(
    [...lemmaInfo.values()].map((l) => [l.id, l.freq]),
  );
  const withFreq: UserItemWithFreq[] = lemmaRows.map((r) => ({
    itemId: 0,
    kind: "lemma",
    status: r.status as UserItemWithFreq["status"],
    level: r.level,
    fsrs: r.fsrs,
    dueAt: r.fsrs.due,
    priority: false,
    everReachedOne: true,
    freq: freqById.get(r.item.ref_id) ?? 0,
  }));

  const underOf = (r: Row) => understanding(r.level, r.fsrs.stability);
  const rowsOfKind = (k: string) =>
    rows.filter((r) => (Array.isArray(r.items) ? r.items[0] : r.items).kind === k);
  const lessonUnder = rowsOfKind("lesson").map(underOf);
  const ayatUnder = rowsOfKind("ayah").map(underOf);
  const polaList = (polaRows.data ?? []) as { correct: boolean }[];
  const polaCorrect = polaList.filter((p) => p.correct).length;
  const totalLessons = lessonCount.count ?? 0;
  const lemmaUnder = lemmaRows.map(underOf);
  const totalLemmas = Number(totals?.find((t) => t.key === "quran_total_lemmas")?.value ?? 0);
  const today = localDate(tz, new Date());

  const totalWords = Number(totals?.find((t) => t.key === "quran_total_words")?.value ?? 0);
  return {
    streak: computeStreak(dayList, tz),
    coveragePct: Number(cov?.coverage_pct ?? 0),
    lemmasMastered: Number(cov?.lemmas_mastered ?? 0),
    lemmasOpened: lemmaRows.length,
    comprehension: comprehension(withFreq),
    studiedToday: dayList.includes(today),
    learnedTokens: withFreq.reduce((a, w) => a + w.freq, 0),
    avgMastery: lemmaUnder.length ? lemmaUnder.reduce((a, b) => a + b, 0) / lemmaUnder.length : 0,
    totalLemmas,
    learnedUniquePct: totalLemmas > 0 ? (lemmaRows.length / totalLemmas) * 100 : 0,
    grammar: grammarScore(lessonUnder, totalLessons, polaCorrect, polaList.length),
    grammarDetail: { lessonsOpened: lessonUnder.length, totalLessons, polaCorrect, polaTotal: polaList.length },
    ayat: ayatScore(ayatUnder),
    ayatOpened: ayatUnder.length,
    totalWords,
  };
}
