import { localDate } from "@/lib/dates";
import { applyReview } from "@/lib/engine";
import type { ReviewInput, ReviewResult } from "@/lib/session-types";
import { getMeta, type LocalDb } from "./db";
import type { OutboxEntry } from "./types";

const DAY_MS = 86400_000;

/**
 * Mencatat satu jawaban LOKAL dulu: memperbarui `userItems`, hitungan hari, dan memasukkan
 * log + keadaan baru ke `outbox` dalam satu transaksi. Pengiriman ke server dilakukan terpisah
 * (`flushOutbox`), jadi jawaban tidak hilang saat offline.
 * Aturan penilaian identik dengan server karena memakai `applyReview` yang sama.
 */
export async function submitLocalReview(
  db: LocalDb,
  input: ReviewInput,
  now: Date = new Date(),
): Promise<ReviewResult> {
  return db.transaction(
    "rw",
    [db.userItems, db.settings, db.outbox, db.reviewDays, db.meta],
    async (): Promise<ReviewResult> => {
      const userId = await getMeta<string>(db, "userId");
      if (!userId) return { ok: false, error: "Data lokal belum siap, sambungkan internet sekali." };
      const ui = await db.userItems.get(input.itemId);
      if (!ui) return { ok: false, error: "Item tidak ditemukan" };

      const settings = await db.settings.get(1);
      const tz = settings?.timezone ?? "Asia/Jakarta";
      const retention = settings?.targetRetention ?? 0.9;

      const cutoff = now.getTime() - 30 * DAY_MS;
      const recentLapses = ui.lapses.filter((t) => new Date(t).getTime() >= cutoff);

      const res = applyReview({
        itemId: ui.itemId,
        state: {
          level: ui.level,
          everReachedOne: ui.everReachedOne,
          status: ui.status,
          fsrs: ui.fsrs,
          priority: ui.priority,
          masteredAt: ui.masteredAt,
        },
        correct: input.correct,
        grade: input.grade,
        responseMs: input.responseMs,
        retention,
        priorLapses30: recentLapses.length,
        now,
      });
      const { next } = res;
      const nowIso = now.toISOString();

      await db.userItems.update(ui.itemId, {
        level: next.level,
        everReachedOne: next.everReachedOne,
        status: next.status,
        fsrs: next.fsrs,
        dueAt: new Date(next.fsrs.due).toISOString(),
        masteredAt: next.masteredAt,
        lapses: res.rating === 1 ? [...recentLapses, nowIso] : recentLapses,
      });

      const day = localDate(tz, now);
      const dayRow = (await db.reviewDays.get(day)) ?? { date: day };
      await db.reviewDays.put({
        date: day,
        total: (dayRow.total ?? 0) + 1,
        correct: (dayRow.correct ?? 0) + (res.correct ? 1 : 0),
      });

      const entry: OutboxEntry = {
        kind: "review",
        clientId: input.clientId,
        createdAt: nowIso,
        tries: 0,
        payload: {
          log: {
            user_id: userId,
            item_id: ui.itemId,
            exercise_type: input.exercise,
            correct: res.correct,
            rating: res.rating,
            response_ms: Math.round(input.responseMs),
            level_before: ui.level,
            level_after: next.level,
            fsrs_before: ui.fsrs,
            fsrs_after: next.fsrs,
            reviewed_at: nowIso,
            client_id: input.clientId,
          },
          state: {
            item_id: ui.itemId,
            level: next.level,
            ever_reached_one: next.everReachedOne,
            status: next.status,
            fsrs: next.fsrs,
            due_at: next.fsrs.due,
            mastered_at: next.masteredAt,
          },
        },
      };
      await db.outbox.add(entry);

      return {
        ok: true,
        level: next.level,
        status: next.status,
        nextDue: next.fsrs.due,
        before: res.before,
        after: res.after,
      };
    },
  );
}

/** Mencatat jawaban kuis pola ke antrean (idempoten lewat `clientId`). */
export async function enqueuePolaAttempt(
  db: LocalDb,
  category: string,
  correct: boolean,
  clientId: string,
  now: Date = new Date(),
): Promise<boolean> {
  return db.transaction("rw", [db.outbox, db.meta], async () => {
    const userId = await getMeta<string>(db, "userId");
    if (!userId) return false;
    await db.outbox.add({
      kind: "pola",
      clientId,
      createdAt: now.toISOString(),
      tries: 0,
      payload: {
        user_id: userId,
        category,
        correct,
        answered_at: now.toISOString(),
        client_id: clientId,
      },
    });
    const pola = (await getMeta<{ correct: number; total: number }>(db, "pola30")) ?? {
      correct: 0,
      total: 0,
    };
    await db.meta.put({
      key: "pola30",
      value: { correct: pola.correct + (correct ? 1 : 0), total: pola.total + 1 },
    });
    return true;
  });
}

/** Menandai sesi hari ini selesai (lokal + antrean). Satu kali per tanggal rencana. */
export async function markSessionDone(db: LocalDb, now: Date = new Date()): Promise<void> {
  await db.transaction("rw", [db.dailyPlan, db.settings, db.outbox, db.meta], async () => {
    const userId = await getMeta<string>(db, "userId");
    if (!userId) return;
    const tz = (await db.settings.get(1))?.timezone ?? "Asia/Jakarta";
    const planDate = localDate(tz, now);
    await db.dailyPlan.update(planDate, { sessionDone: true });
    try {
      await db.outbox.add({
        kind: "session_done",
        clientId: `session_done:${planDate}`,
        createdAt: now.toISOString(),
        tries: 0,
        payload: { planDate },
      });
    } catch (e) {
      if ((e as { name?: string }).name !== "ConstraintError") throw e;
    }
  });
}
