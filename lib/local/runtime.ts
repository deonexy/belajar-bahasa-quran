"use client";

import { createClient } from "@/lib/supabase/client";
import { recordPolaAnswer } from "@/app/pola/actions";
import { getDb, localStorageAvailable } from "./db";
import { flushOutbox, type FlushResult } from "./outbox";
import { supabaseRemote } from "./remote";
import { enqueuePolaAttempt } from "./review";
import { syncAll, type SyncResult } from "./sync";

/** Sinkron yang berhasil tidak diulang dalam jangka ini kecuali dipaksa. */
const THROTTLE_MS = 60_000;

let syncing: Promise<SyncResult | null> | null = null;
let lastOk = 0;

/** Menjalankan sinkron (satu per waktu). Mengembalikan null bila penyimpanan lokal tidak tersedia. */
export function runSync(force = false): Promise<SyncResult | null> {
  if (!localStorageAvailable()) return Promise.resolve(null);
  if (syncing) return syncing;
  if (!force && Date.now() - lastOk < THROTTLE_MS) return Promise.resolve(null);
  syncing = syncAll(getDb(), supabaseRemote(createClient()))
    .then((r) => {
      if (r.ok) lastOk = Date.now();
      return r;
    })
    .finally(() => {
      syncing = null;
    });
  return syncing;
}

/** Mengirim antrean saja (tanpa menarik data). Tidak melempar. */
export async function flushNow(): Promise<FlushResult | null> {
  if (!localStorageAvailable()) return null;
  try {
    const remote = supabaseRemote(createClient());
    const userId = await remote.getUserId();
    if (!userId) return null;
    return await flushOutbox(getDb(), remote, userId);
  } catch {
    return null;
  }
}

/** Jawaban kuis pola: lokal dulu (antrean), cadangan langsung ke server bila lokal tidak siap. */
export async function recordPola(category: string, correct: boolean): Promise<void> {
  if (localStorageAvailable()) {
    try {
      const queued = await enqueuePolaAttempt(getDb(), category, correct, crypto.randomUUID());
      if (queued) {
        void flushNow();
        return;
      }
    } catch {
      // jatuh ke jalur server di bawah
    }
  }
  await recordPolaAnswer(category, correct);
}

/**
 * Menghangatkan cache agar /belajar dan /kuis bisa dibuka tanpa internet: memuat cangkang
 * halaman lewat service worker (header x-warm) dan memuat potongan JS-nya.
 */
export async function warmOffline(): Promise<void> {
  try {
    await Promise.all(
      ["/belajar", "/kuis"].map((p) =>
        fetch(p, { headers: { "x-warm": "1" }, credentials: "same-origin" }).catch(() => undefined),
      ),
    );
    await Promise.all([import("@/app/belajar/local-session"), import("@/components/local-summary")]);
  } catch {
    // opsional; kegagalan tidak mengganggu
  }
}
