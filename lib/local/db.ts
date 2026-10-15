import Dexie, { type EntityTable } from "dexie";
import type {
  ContentVersionRow,
  DownloadRow,
  LocalAyah,
  LocalExample,
  LocalLemma,
  LocalLesson,
  LocalPlan,
  LocalRoot,
  LocalSettings,
  LocalUserItem,
  MetaRow,
  OutboxEntry,
  ReviewDayRow,
} from "./types";

export const DB_NAME = "bbq-local";

/**
 * Basis data lokal (IndexedDB). Server tetap master untuk data pengguna; ini salinan + antrean
 * kirim (`outbox`). Konten (lemmas/roots/lessons/exampleAyahs) boleh tetap setelah logout;
 * data pengguna dihapus oleh `wipeUserData`.
 *
 * Keputusan: tabel `dueItems` pada rencana tidak dibuat. `userItems` sudah memuat semua item
 * pengguna beserta indeks `dueAt`, jadi "jatuh tempo 7 hari" cukup berupa kueri, tanpa salinan
 * kedua yang bisa tidak sinkron (lihat docs/DECISIONS.md).
 */
export class LocalDb extends Dexie {
  userItems!: EntityTable<LocalUserItem, "itemId">;
  dailyPlan!: EntityTable<LocalPlan, "planDate">;
  settings!: EntityTable<LocalSettings, "id">;
  outbox!: EntityTable<OutboxEntry, "id">;
  lemmas!: EntityTable<LocalLemma, "id">;
  roots!: EntityTable<LocalRoot, "id">;
  lessons!: EntityTable<LocalLesson, "id">;
  exampleAyahs!: EntityTable<LocalExample, "lemmaId">;
  ayahs!: EntityTable<LocalAyah, "ref">;
  contentVersion!: EntityTable<ContentVersionRow, "key">;
  downloads!: EntityTable<DownloadRow, "id">;
  reviewDays!: EntityTable<ReviewDayRow, "date">;
  meta!: EntityTable<MetaRow, "key">;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      userItems: "itemId, kind, status, dueAt",
      dailyPlan: "planDate",
      settings: "id",
      // clientId unik: satu kejadian hanya masuk antrean sekali.
      outbox: "++id, &clientId, kind, createdAt",
      lemmas: "id, freqRank",
      roots: "id",
      lessons: "id, code",
      exampleAyahs: "lemmaId",
      ayahs: "ref",
      contentVersion: "key",
      downloads: "id",
      reviewDays: "date",
      meta: "key",
    });
  }
}

let shared: LocalDb | null = null;

/** Basis data bersama untuk aplikasi (hanya di browser). */
export function getDb(): LocalDb {
  if (typeof indexedDB === "undefined") {
    throw new Error("Penyimpanan lokal (IndexedDB) tidak tersedia di lingkungan ini");
  }
  if (!shared) shared = new LocalDb();
  return shared;
}

/** True bila IndexedDB bisa dipakai (false di server atau mode privat tertentu). */
export function localStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function getMeta<T>(db: LocalDb, key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(db: LocalDb, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/**
 * Hapus data pengguna (saat logout atau ganti akun). Konten tetap. `outbox` ikut terhapus:
 * pemanggil wajib mencoba mengirimnya dulu (lihat `flushOutbox`).
 */
export async function wipeUserData(db: LocalDb): Promise<void> {
  await db.transaction(
    "rw",
    [db.userItems, db.dailyPlan, db.settings, db.outbox, db.reviewDays, db.meta],
    async () => {
      await Promise.all([
        db.userItems.clear(),
        db.dailyPlan.clear(),
        db.settings.clear(),
        db.outbox.clear(),
        db.reviewDays.clear(),
        db.meta.clear(),
      ]);
    },
  );
}
