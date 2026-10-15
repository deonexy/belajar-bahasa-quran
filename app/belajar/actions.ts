"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReviewInput, ReviewResult, SessionCard } from "@/lib/session-types";
import { ensureDailyPlan, getSettings, localDate } from "@/lib/server/daily";
import { buildQuiz, buildSession } from "@/lib/server/session";
import { applyReview, type FsrsCardJson } from "@/lib/engine";

export async function submitReview(input: ReviewInput): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Belum masuk" };
  const userId = auth.user.id;

  const { data: ui } = await supabase
    .from("user_items")
    .select("level,status,fsrs,ever_reached_one,mastered_at,priority,items(kind)")
    .eq("user_id", userId)
    .eq("item_id", input.itemId)
    .maybeSingle();
  if (!ui) return { ok: false, error: "Item tidak ditemukan" };

  const settings = await getSettings(supabase, userId);
  const now = new Date();
  const card = ui.fsrs as FsrsCardJson;

  // Lapse 30 hari sebelum jawaban ini
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { count: prior } = await supabase
    .from("review_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("item_id", input.itemId)
    .eq("rating", 1)
    .gte("reviewed_at", since);

  const res = applyReview({
    itemId: input.itemId,
    state: {
      level: ui.level,
      everReachedOne: ui.ever_reached_one,
      status: ui.status,
      fsrs: card,
      priority: ui.priority,
      masteredAt: ui.mastered_at,
    },
    correct: input.correct,
    grade: input.grade,
    responseMs: input.responseMs,
    retention: settings.target_retention,
    priorLapses30: prior ?? 0,
    now,
  });
  const { rating, correct, next } = res;
  const levelAfter = next.level;
  const everReached = next.everReachedOne;
  const fsrsAfter = next.fsrs;
  const status = next.status;

  const { error: logErr } = await supabase.from("review_logs").insert({
    user_id: userId,
    item_id: input.itemId,
    exercise_type: input.exercise,
    correct,
    rating,
    response_ms: Math.round(input.responseMs),
    level_before: ui.level,
    level_after: levelAfter,
    fsrs_before: card,
    fsrs_after: fsrsAfter,
    client_id: input.clientId,
  });
  // 23505 = client_id sudah tercatat (kirim ulang): anggap berhasil.
  if (logErr) {
    if (logErr.code === "23505") return { ok: true };
    return { ok: false, error: logErr.message };
  }

  const { error: upErr } = await supabase
    .from("user_items")
    .update({
      level: levelAfter,
      ever_reached_one: everReached,
      status,
      fsrs: fsrsAfter,
      due_at: fsrsAfter.due,
      mastered_at: next.masteredAt,
    })
    .eq("user_id", userId)
    .eq("item_id", input.itemId);
  if (upErr) return { ok: false, error: upErr.message };

  return {
    ok: true,
    level: levelAfter,
    status,
    nextDue: fsrsAfter.due,
    before: res.before,
    after: res.after,
  };
}

export async function finishSession(): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const settings = await getSettings(supabase, auth.user.id);
  await supabase
    .from("daily_plans")
    .update({ session_done: true })
    .eq("user_id", auth.user.id)
    .eq("plan_date", localDate(settings.timezone));
  revalidatePath("/");
}

/**
 * Menyusun rencana hari ini dan membuka item baru sesuai mastery gate (tetap di server).
 * Dipanggil klien sebelum sinkron agar item baru ikut tertarik ke salinan lokal.
 */
export async function ensureToday(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const settings = await getSettings(supabase, auth.user.id);
  await ensureDailyPlan(supabase, auth.user.id, settings);
  return { ok: true };
}

/**
 * Cadangan bila penyimpanan lokal browser tidak tersedia: sesi dibangun di server seperti semula.
 */
export async function loadServerCards(mode: "belajar" | "kuis"): Promise<SessionCard[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  if (mode === "kuis") return buildQuiz(supabase, auth.user.id, 10);
  const settings = await getSettings(supabase, auth.user.id);
  await ensureDailyPlan(supabase, auth.user.id, settings);
  return buildSession(supabase, auth.user.id);
}
