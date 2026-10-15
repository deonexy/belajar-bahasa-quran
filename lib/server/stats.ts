import type { SupabaseClient } from "@supabase/supabase-js";
import { comprehension, type UserItemWithFreq, type FsrsCardJson } from "@/lib/engine";
import { localDate } from "./daily";
import { fetchLemmas } from "./lemmas";

/** Streak: hari beruntun (zona waktu pengguna) yang punya review. Hari ini boleh belum. */
export function computeStreak(days: string[], tz: string): number {
  const set = new Set(days);
  const day = (offset: number) =>
    localDate(tz, new Date(Date.now() - offset * 86400_000));
  let offset = set.has(day(0)) ? 0 : 1;
  let streak = 0;
  while (set.has(day(offset))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

export async function getHomeStats(
  supabase: SupabaseClient,
  userId: string,
  tz: string,
) {
  const [{ data: days }, { data: cov }, { data: totals }, { data: ui }] =
    await Promise.all([
      supabase.rpc("review_days", { p_tz: tz }),
      supabase.from("v_user_coverage").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("corpus_meta").select("key,value"),
      supabase
        .from("user_items")
        .select("level,status,fsrs,items!inner(kind,ref_id)")
        .eq("user_id", userId),
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

  const totalWords = Number(totals?.find((t) => t.key === "quran_total_words")?.value ?? 0);
  return {
    streak: computeStreak(dayList, tz),
    coveragePct: Number(cov?.coverage_pct ?? 0),
    lemmasMastered: Number(cov?.lemmas_mastered ?? 0),
    lemmasOpened: lemmaRows.length,
    comprehension: comprehension(withFreq),
    totalWords,
  };
}
