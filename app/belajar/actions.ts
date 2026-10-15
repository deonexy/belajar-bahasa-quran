"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSettings, localDate } from "@/lib/server/daily";
import {
  deriveRating,
  isMastered,
  nextLevel,
  ratingFromSelfGrade,
  scheduleReview,
  type ExerciseType,
  type FsrsCardJson,
  type ItemStatus,
} from "@/lib/engine";

export interface ReviewInput {
  clientId: string;
  itemId: number;
  exercise: ExerciseType;
  /** Latihan pilihan ganda. */
  correct?: boolean;
  /** Latihan terjemah: penilaian mandiri. */
  grade?: "benar" | "sebagian" | "salah";
  responseMs: number;
}

export interface ReviewResult {
  ok: boolean;
  level?: number;
  status?: ItemStatus;
  nextDue?: string;
  error?: string;
}

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

  const rating = input.grade
    ? ratingFromSelfGrade(input.grade)
    : deriveRating({ correct: !!input.correct, responseMs: input.responseMs });
  const correct = rating >= 2;

  const levelAfter = nextLevel(ui.level, rating, ui.ever_reached_one);
  const everReached = ui.ever_reached_one || levelAfter >= 1;
  const fsrsAfter = scheduleReview(card, rating, now, settings.target_retention);

  // Lapse 30 hari (termasuk jawaban ini bila salah)
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { count: prior } = await supabase
    .from("review_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("item_id", input.itemId)
    .eq("rating", 1)
    .gte("reviewed_at", since);
  const lapses30 = (prior ?? 0) + (rating === 1 ? 1 : 0);

  const mastered = isMastered(
    {
      itemId: input.itemId,
      kind: "lemma",
      status: ui.status,
      level: levelAfter,
      fsrs: fsrsAfter,
      dueAt: fsrsAfter.due,
      priority: ui.priority,
      everReachedOne: everReached,
    },
    lapses30,
  );
  const status: ItemStatus = mastered
    ? "mastered"
    : levelAfter >= 2
      ? "review"
      : "learning";

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
      mastered_at: mastered ? (ui.mastered_at ?? now.toISOString()) : null,
    })
    .eq("user_id", userId)
    .eq("item_id", input.itemId);
  if (upErr) return { ok: false, error: upErr.message };

  return { ok: true, level: levelAfter, status, nextDue: fsrsAfter.due };
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
