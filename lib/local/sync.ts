import { localDate } from "@/lib/dates";
import { getMeta, setMeta, wipeUserData, type LocalDb } from "./db";
import { flushOutbox, type FlushResult } from "./outbox";
import { RemoteUnreachableError, type Remote } from "./remote";
import type { LocalAyah, LocalExample, LocalUserItem } from "./types";

/** Kunci versi konten yang diperbarui otomatis bila berubah di server. */
export const CONTENT_KEYS = ["lemmas", "roots", "lessons"] as const;
type ContentKey = (typeof CONTENT_KEYS)[number];

/** Tanpa informasi versi dari server, konten dimuat ulang paling cepat sekali per 24 jam. */
export const UNVERSIONED_REFRESH_MS = 24 * 3600_000;
const SYNCED_AT_KEY = "_syncedAt";
const EXAMPLE_CHUNK = 40;

export interface SyncOptions {
  now?: Date;
}

export interface SyncResult {
  ok: boolean;
  /** Alasan tidak berjalan. */
  skipped?: "no-user";
  /** Server tidak terjangkau: data lokal tetap dipakai. */
  unreachable?: boolean;
  error?: string;
  flush?: FlushResult;
  /** "skipped-pending": masih ada antrean yang belum terkirim, jadi data pengguna lokal tidak ditimpa. */
  userData?: "pulled" | "skipped-pending";
  contentRefreshed: ContentKey[];
}

/**
 * Sinkron turun penuh: kirim antrean -> tarik data pengguna -> perbarui konten berversi.
 * Aman dipanggil berulang. Server tetap master; lokal hanya salinan + antrean.
 */
export async function syncAll(
  db: LocalDb,
  remote: Remote,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const result: SyncResult = { ok: false, contentRefreshed: [] };
  try {
    const userId = await remote.getUserId();
    if (!userId) {
      result.skipped = "no-user";
      return result;
    }

    // Akun berganti pada perangkat ini: data pengguna akun lama tidak boleh tersisa.
    const knownUser = await getMeta<string>(db, "userId");
    if (knownUser && knownUser !== userId) await wipeUserData(db);
    await setMeta(db, "userId", userId);

    result.flush = await flushOutbox(db, remote, userId);
    if (result.flush.unreachable) {
      result.unreachable = true;
      return result;
    }

    if (result.flush.remaining === 0) {
      result.userData = (await pullUserData(db, remote, userId, now)) ? "pulled" : "skipped-pending";
    } else {
      // Lokal lebih maju dari server: jangan menimpa.
      result.userData = "skipped-pending";
    }

    result.contentRefreshed = await pullContent(db, remote, now);
    await pullOpenedItemData(db, remote);
    await setMeta(db, "lastSyncAt", now.toISOString());
    result.ok = true;
  } catch (e) {
    if (e instanceof RemoteUnreachableError) result.unreachable = true;
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

const iso = (s: string) => new Date(s).toISOString();

/** @returns false bila batal karena ada jawaban baru di antrean selama menunggu server. */
async function pullUserData(
  db: LocalDb,
  remote: Remote,
  userId: string,
  now: Date,
): Promise<boolean> {
  const settings = await remote.settings(userId);
  const tz = settings?.timezone ?? "Asia/Jakarta";
  const since7 = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const since30 = new Date(now.getTime() - 30 * 86400_000).toISOString();

  const [items, dates, logs7, lapses, pola, totals, plan] = await Promise.all([
    remote.userItems(userId),
    remote.reviewDates(tz),
    remote.reviewsSince(userId, since7),
    remote.lapsesSince(userId, since30),
    remote.polaSince(userId, since30),
    remote.corpusTotals(),
    remote.todayPlan(userId, localDate(tz, now)),
  ]);

  const lapseMap = new Map<number, string[]>();
  for (const l of lapses) {
    const arr = lapseMap.get(l.itemId) ?? [];
    arr.push(iso(l.at));
    lapseMap.set(l.itemId, arr);
  }
  const rows: LocalUserItem[] = items.map((r) => ({
    itemId: r.itemId,
    kind: r.kind,
    refId: r.refId,
    status: r.status,
    level: r.level,
    everReachedOne: r.everReachedOne,
    fsrs: r.fsrs,
    // Samakan format waktu (Postgres memberi "+00:00") agar urutan teks = urutan waktu.
    dueAt: iso(r.dueAt),
    priority: r.priority,
    masteredAt: r.masteredAt,
    lapses: lapseMap.get(r.itemId) ?? [],
  }));

  // Hitungan per hari: 7 hari terakhir dari log, hari lebih lama hanya penanda "ada review".
  const days = new Map<string, { date: string; total?: number; correct?: number }>();
  for (const d of dates) days.set(d, { date: d });
  const perDay = new Map<string, { total: number; correct: number }>();
  for (const l of logs7) {
    const d = localDate(tz, new Date(l.at));
    const cur = perDay.get(d) ?? { total: 0, correct: 0 };
    cur.total += 1;
    if (l.correct) cur.correct += 1;
    perDay.set(d, cur);
  }
  for (const [d, c] of perDay) days.set(d, { date: d, ...c });

  return db.transaction(
    "rw",
    [db.userItems, db.settings, db.dailyPlan, db.reviewDays, db.meta, db.outbox],
    async () => {
      // Jawaban baru masuk antrean saat kita menunggu server: data server sudah basi, jangan menimpa.
      if ((await db.outbox.count()) > 0) return false;
      await db.userItems.clear();
      await db.userItems.bulkPut(rows);

      if (settings) {
        await db.settings.put({ id: 1, ...settings });
      }
      if (plan) {
        await db.dailyPlan.put(plan);
      }
      await db.reviewDays.clear();
      await db.reviewDays.bulkPut([...days.values()]);
      await db.meta.put({ key: "totals", value: totals });
      await db.meta.put({
        key: "pola30",
        value: { correct: pola.filter((p) => p.correct).length, total: pola.length },
      });
      return true;
    },
  );
}

/** Memperbarui lemma/akar/pelajaran bila versinya berubah di server; mengembalikan yang diperbarui. */
async function pullContent(db: LocalDb, remote: Remote, now: Date): Promise<ContentKey[]> {
  const remoteVersions = await remote.contentVersions();
  const stored = new Map((await db.contentVersion.toArray()).map((r) => [r.key, r.version]));
  const syncedAt = stored.get(SYNCED_AT_KEY);
  const stale =
    !syncedAt || now.getTime() - new Date(syncedAt).getTime() > UNVERSIONED_REFRESH_MS;

  const counts: Record<ContentKey, () => Promise<number>> = {
    lemmas: () => db.lemmas.count(),
    roots: () => db.roots.count(),
    lessons: () => db.lessons.count(),
  };

  const refreshed: ContentKey[] = [];
  for (const key of CONTENT_KEYS) {
    const empty = (await counts[key]()) === 0;
    const changed = remoteVersions
      ? remoteVersions[key] !== undefined && remoteVersions[key] !== stored.get(key)
      : stale;
    if (!empty && !changed) continue;

    if (key === "lemmas") {
      const rows = await remote.lemmas();
      await db.transaction("rw", [db.lemmas, db.exampleAyahs], async () => {
        await db.lemmas.clear();
        await db.lemmas.bulkPut(rows);
        // Arti berubah => contoh ayat (yang memuat arti per kata) ikut dimuat ulang.
        await db.exampleAyahs.clear();
      });
    } else if (key === "roots") {
      const rows = await remote.roots();
      await db.transaction("rw", db.roots, async () => {
        await db.roots.clear();
        await db.roots.bulkPut(rows);
      });
    } else {
      const rows = await remote.lessons();
      await db.transaction("rw", db.lessons, async () => {
        await db.lessons.clear();
        await db.lessons.bulkPut(rows);
      });
    }
    await db.contentVersion.put({ key, version: remoteVersions?.[key] ?? "unversioned" });
    refreshed.push(key);
  }
  if (refreshed.length > 0 || !syncedAt) {
    await db.contentVersion.put({ key: SYNCED_AT_KEY, version: now.toISOString() });
  }
  return refreshed;
}

/** Contoh ayat dan teks ayat hanya untuk item yang sudah dibuka pengguna (kecil, otomatis). */
async function pullOpenedItemData(db: LocalDb, remote: Remote): Promise<void> {
  const items = await db.userItems.toArray();

  const lemmaIds = items.filter((i) => i.kind === "lemma").map((i) => i.refId);
  const haveExamples = new Set(await db.exampleAyahs.toCollection().primaryKeys());
  const needExamples = [...new Set(lemmaIds)].filter((id) => !haveExamples.has(id));
  for (let i = 0; i < needExamples.length; i += EXAMPLE_CHUNK) {
    const chunk = needExamples.slice(i, i + EXAMPLE_CHUNK);
    const found = await remote.lemmaExamples(chunk);
    if (found === null) break; // RPC belum ada di server: kartu tampil tanpa contoh
    const byId = new Map(found.map((f) => [f.lemmaId, f.example]));
    const rows: LocalExample[] = chunk.map((id) => ({ lemmaId: id, example: byId.get(id) ?? null }));
    await db.exampleAyahs.bulkPut(rows);
  }

  const ayahRefs = items.filter((i) => i.kind === "ayah").map((i) => i.refId);
  const haveAyahs = new Set(await db.ayahs.toCollection().primaryKeys());
  const needAyahs = [...new Set(ayahRefs)].filter((r) => !haveAyahs.has(r));
  if (needAyahs.length > 0) {
    const cards = await remote.ayahCards(needAyahs);
    const rows: LocalAyah[] = cards.map((c) => ({
      ref: c.ref,
      textAr: c.textAr,
      translation: c.translation,
      words: c.words,
    }));
    await db.ayahs.bulkPut(rows);
  }
}
