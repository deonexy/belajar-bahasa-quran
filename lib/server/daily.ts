import type { SupabaseClient } from "@supabase/supabase-js";
import { localDate } from "@/lib/dates";
import {
  computeQuota,
  newCard,
  pickNewItems,
  retentionOrDefault,
  type Item,
} from "@/lib/engine";

export interface Settings {
  timezone: string;
  daily_new_max: number;
  target_retention: number;
  target_token_coverage: number;
  daily_review_limit: number;
  start_date: string;
  phase1_deadline: string | null;
}

const SETTINGS_COLUMNS =
  "timezone,daily_new_max,target_retention,target_token_coverage,daily_review_limit,start_date,phase1_deadline";

export interface Plan {
  planDate: string;
  retention7d: number;
  backlog: number;
  learningPile: number;
  newQuota: number;
  reason: string;
  sessionDone: boolean;
}

export { localDate };

/** Awal hari berikutnya (UTC ISO) pada zona waktu: batas "jatuh tempo hari ini". */
function endOfLocalDayIso(tz: string): string {
  const today = localDate(tz);
  // Cari ambang: mulai dari 36 jam ke depan, mundur sampai tanggal lokal berubah.
  const base = Date.now();
  let lo = base;
  let hi = base + 36 * 3600_000;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDate(tz, new Date(mid)) === today) lo = mid;
    else hi = mid;
  }
  return new Date(hi).toISOString();
}

export async function getSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<Settings> {
  const { data } = await supabase
    .from("user_settings")
    .select(SETTINGS_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return rowToSettings(data);
  await supabase.from("user_settings").upsert({ user_id: userId });
  const { data: created } = await supabase
    .from("user_settings")
    .select(SETTINGS_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return created
    ? rowToSettings(created)
    : {
        timezone: "Asia/Jakarta",
        daily_new_max: 5,
        target_retention: 0.9,
        target_token_coverage: 0.85,
        daily_review_limit: 150,
        start_date: localDate("Asia/Jakarta"),
        phase1_deadline: null,
      };
}

function rowToSettings(r: Record<string, unknown>): Settings {
  return {
    timezone: String(r.timezone),
    daily_new_max: Number(r.daily_new_max),
    target_retention: Number(r.target_retention),
    target_token_coverage: Number(r.target_token_coverage),
    daily_review_limit: Number(r.daily_review_limit),
    start_date: String(r.start_date),
    phase1_deadline: r.phase1_deadline ? String(r.phase1_deadline) : null,
  };
}

/**
 * Menyusun rencana hari ini dan membuka item baru sesuai mastery gate.
 * Idempoten: bila rencana hari ini sudah ada, hanya dikembalikan.
 */
export async function ensureDailyPlan(
  supabase: SupabaseClient,
  userId: string,
  settings: Settings,
): Promise<Plan> {
  const planDate = localDate(settings.timezone);

  const { data: existing } = await supabase
    .from("daily_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_date", planDate)
    .maybeSingle();
  if (existing) return rowToPlan(existing);

  // R: retensi 7 hari terakhir
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: logs } = await supabase
    .from("review_logs")
    .select("correct")
    .eq("user_id", userId)
    .gte("reviewed_at", since);
  const total = logs?.length ?? 0;
  const correct = logs?.filter((l) => l.correct).length ?? 0;
  const R = retentionOrDefault(correct, total);

  // B: backlog jatuh tempo hingga akhir hari; L: tumpukan level < 2
  const { count: backlog } = await supabase
    .from("user_items")
    .select("item_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "suspended")
    .lte("due_at", endOfLocalDayIso(settings.timezone));
  const { count: pile } = await supabase
    .from("user_items")
    .select("item_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "suspended")
    .lt("level", 2);

  const { data: due7 } = await supabase.rpc("reviews_due_within", { p_days: 7 });

  const gate = computeQuota({
    R,
    B: backlog ?? 0,
    L: pile ?? 0,
    N: settings.daily_new_max,
    B7: typeof due7 === "number" ? due7 : undefined,
    reviewLimit: settings.daily_review_limit,
  });

  const opened = await openNewItems(supabase, userId, gate.quota);
  let reason = gate.reason;
  if (gate.quota > 0 && opened === 0) {
    reason += " Belum ada materi baru yang tersedia.";
  }

  const plan = {
    user_id: userId,
    plan_date: planDate,
    retention_7d: R,
    backlog: backlog ?? 0,
    learning_pile: pile ?? 0,
    new_quota: gate.quota,
    reason,
  };
  const { data: saved } = await supabase
    .from("daily_plans")
    .upsert(plan, { onConflict: "user_id,plan_date", ignoreDuplicates: true })
    .select()
    .maybeSingle();
  return rowToPlan(saved ?? { ...plan, session_done: false });
}

async function openNewItems(
  supabase: SupabaseClient,
  userId: string,
  quota: number,
): Promise<number> {
  const now = new Date();
  const rows: Record<string, unknown>[] = [];

  // Ayat terbuka otomatis (tidak memakan kuota), maksimal 3 per hari.
  if (quota > 0) {
    const { data: ayat } = await supabase.rpc("openable_ayah_items", { p_limit: 3 });
    for (const a of (ayat ?? []) as { item_id: number }[]) {
      rows.push(userItemRow(userId, a.item_id, now));
    }
  }

  const { data: cand } = await supabase.rpc("new_item_candidates", { p_limit: 40 });
  const candidates: Item[] = ((cand ?? []) as Record<string, unknown>[]).map(
    (c) => ({
      id: Number(c.id),
      kind: c.kind as Item["kind"],
      refId: Number(c.ref_id),
      phase: Number(c.phase),
      seq: Number(c.seq),
      prereqItemIds: ((c.prereq_item_ids as number[]) ?? []).map(Number),
    }),
  );

  const prereqIds = [...new Set(candidates.flatMap((c) => c.prereqItemIds))];
  const levelByItemId = new Map<number, number>();
  if (prereqIds.length > 0) {
    const { data: lv } = await supabase
      .from("user_items")
      .select("item_id,level")
      .eq("user_id", userId)
      .in("item_id", prereqIds);
    for (const l of lv ?? []) levelByItemId.set(Number(l.item_id), l.level);
  }

  const picked = pickNewItems(candidates, quota, { levelByItemId });
  for (const p of picked) rows.push(userItemRow(userId, p.id, now));

  if (rows.length > 0) {
    await supabase
      .from("user_items")
      .upsert(rows, { onConflict: "user_id,item_id", ignoreDuplicates: true });
  }
  return picked.length;
}

function userItemRow(userId: string, itemId: number, now: Date) {
  const card = newCard(now);
  return {
    user_id: userId,
    item_id: itemId,
    status: "learning",
    level: 0,
    fsrs: card,
    due_at: card.due,
  };
}

function rowToPlan(r: Record<string, unknown>): Plan {
  return {
    planDate: String(r.plan_date),
    retention7d: Number(r.retention_7d ?? 0.9),
    backlog: Number(r.backlog ?? 0),
    learningPile: Number(r.learning_pile ?? 0),
    newQuota: Number(r.new_quota ?? 0),
    reason: String(r.reason ?? ""),
    sessionDone: Boolean(r.session_done),
  };
}
