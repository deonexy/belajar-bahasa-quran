import { getMeta, setMeta, type LocalDb } from "./db";
import { RemoteUnreachableError, type Remote } from "./remote";
import type { OutboxEntry } from "./types";

/** Setelah sekian kali ditolak server (bukan karena offline), entri dibuang ke `deadLetters`. */
export const MAX_TRIES = 8;
const CHUNK = 50;
const MAX_DEAD_LETTERS = 50;

export interface DeadLetter {
  entry: OutboxEntry;
  error: string;
  at: string;
}

export interface FlushResult {
  sent: number;
  remaining: number;
  deadLettered: number;
  /** True bila berhenti karena server tidak terjangkau. */
  unreachable: boolean;
}

/** Menambah entri ke antrean. `clientId` unik: entri yang sama tidak masuk dua kali. */
export async function enqueue(
  db: LocalDb,
  entry: Omit<OutboxEntry, "id" | "tries" | "createdAt"> & { createdAt?: string },
): Promise<boolean> {
  try {
    await db.outbox.add({
      ...entry,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      tries: 0,
    } as OutboxEntry);
    return true;
  } catch (e) {
    if ((e as { name?: string }).name === "ConstraintError") return false;
    throw e;
  }
}

export function pendingCount(db: LocalDb): Promise<number> {
  return db.outbox.count();
}

const inflight = new WeakMap<LocalDb, Promise<FlushResult>>();

/**
 * Mengirim antrean ke server secara berurutan dan idempoten.
 * - Log review dikirim dengan `client_id` unik (duplikat diabaikan server), lalu keadaan
 *   `user_items` terakhir tiap item dikirim.
 * - Entri baru dihapus HANYA setelah server menerimanya; gagal = tetap di antrean.
 * - Server tidak terjangkau: berhenti tanpa menambah hitungan percobaan.
 */
export function flushOutbox(db: LocalDb, remote: Remote, userId: string): Promise<FlushResult> {
  const running = inflight.get(db);
  if (running) return running;
  const p = doFlush(db, remote, userId).finally(() => inflight.delete(db));
  inflight.set(db, p);
  return p;
}

async function doFlush(db: LocalDb, remote: Remote, userId: string): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, remaining: 0, deadLettered: 0, unreachable: false };
  const all = await db.outbox.orderBy("id").toArray();

  // Entri milik akun lain tidak bisa dikirim dengan sesi ini (RLS menolaknya): buang.
  const foreign = all.filter((e) => ownerOf(e) !== null && ownerOf(e) !== userId);
  for (const e of foreign) await deadLetter(db, e, "Milik akun lain");
  result.deadLettered += foreign.length;
  const mine = all.filter((e) => !foreign.includes(e));

  const groups: Record<OutboxEntry["kind"], OutboxEntry[]> = {
    review: [],
    pola: [],
    session_done: [],
  };
  for (const e of mine) groups[e.kind].push(e);

  try {
    for (const chunk of chunks(groups.review, CHUNK)) {
      await settle(db, chunk, result, async () => {
        const reviews = chunk as Extract<OutboxEntry, { kind: "review" }>[];
        await remote.pushReviewLogs(reviews.map((e) => e.payload.log));
        // Keadaan terakhir tiap item dalam potongan ini (urutan antrean = urutan waktu).
        const last = new Map<number, (typeof reviews)[number]>();
        for (const e of reviews) last.set(e.payload.state.item_id, e);
        for (const e of last.values()) await remote.pushUserItemState(userId, e.payload.state);
      });
    }
    for (const chunk of chunks(groups.pola, CHUNK)) {
      await settle(db, chunk, result, async () => {
        const polas = chunk as Extract<OutboxEntry, { kind: "pola" }>[];
        await remote.pushPolaAttempts(polas.map((e) => e.payload));
      });
    }
    for (const e of groups.session_done) {
      await settle(db, [e], result, async () => {
        await remote.pushSessionDone(userId, (e as Extract<OutboxEntry, { kind: "session_done" }>).payload.planDate);
      });
    }
  } catch (e) {
    if (e instanceof RemoteUnreachableError) result.unreachable = true;
    else throw e;
  }

  result.remaining = await db.outbox.count();
  return result;
}

function ownerOf(e: OutboxEntry): string | null {
  if (e.kind === "review") return e.payload.log.user_id;
  if (e.kind === "pola") return e.payload.user_id;
  return null;
}

function* chunks<T>(arr: T[], n: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += n) yield arr.slice(i, i + n);
}

/** Menjalankan pengiriman satu potongan; sukses = hapus, ditolak = hitung percobaan. */
async function settle(
  db: LocalDb,
  chunk: OutboxEntry[],
  result: FlushResult,
  send: () => Promise<void>,
): Promise<void> {
  try {
    await send();
  } catch (e) {
    if (e instanceof RemoteUnreachableError) throw e; // berhenti total, entri tetap
    const msg = e instanceof Error ? e.message : String(e);
    for (const entry of chunk) {
      const tries = entry.tries + 1;
      if (tries >= MAX_TRIES) {
        await deadLetter(db, entry, msg);
        result.deadLettered += 1;
      } else {
        await db.outbox.update(entry.id!, { tries });
      }
    }
    return;
  }
  await db.outbox.bulkDelete(chunk.map((e) => e.id!));
  result.sent += chunk.length;
}

async function deadLetter(db: LocalDb, entry: OutboxEntry, error: string): Promise<void> {
  const list = (await getMeta<DeadLetter[]>(db, "deadLetters")) ?? [];
  list.push({ entry, error, at: new Date().toISOString() });
  await setMeta(db, "deadLetters", list.slice(-MAX_DEAD_LETTERS));
  await db.outbox.delete(entry.id!);
}
