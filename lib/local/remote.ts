import type { SupabaseClient } from "@supabase/supabase-js";
import type { FsrsCardJson, ItemKind, ItemStatus } from "@/lib/engine";
import type { ExampleView, WordView } from "@/lib/session-types";
import type {
  LocalLemma,
  LocalLesson,
  LocalPlan,
  LocalRoot,
  PolaAttemptPayload,
  ReviewLogPayload,
  UserItemStatePayload,
} from "./types";

/** Server tidak terjangkau (offline, DNS, timeout). Bukan kesalahan data: boleh dicoba lagi tanpa batas. */
export class RemoteUnreachableError extends Error {
  constructor(message = "Server tidak terjangkau") {
    super(message);
    this.name = "RemoteUnreachableError";
  }
}

export interface RemoteSettings {
  timezone: string;
  dailyNewMax: number;
  targetRetention: number;
  targetTokenCoverage: number;
  dailyReviewLimit: number;
  startDate: string;
  phase1Deadline: string | null;
}

export interface RemoteUserItem {
  itemId: number;
  kind: ItemKind;
  refId: number;
  status: ItemStatus;
  level: number;
  everReachedOne: boolean;
  fsrs: FsrsCardJson;
  dueAt: string;
  priority: boolean;
  masteredAt: string | null;
}

export interface RemoteAyahCard {
  ref: number;
  textAr: string;
  translation: string;
  words: WordView[];
}

/**
 * Antarmuka ke server yang dipakai sinkronisasi. Semua metode melempar `RemoteUnreachableError`
 * bila server tidak terjangkau, atau `Error` biasa bila server menolak. Memisahkannya dari
 * Supabase membuat logika sinkron/outbox bisa diuji tanpa jaringan.
 *
 * Metode yang bergantung pada migrasi opsional (`contentVersions`, `lemmaExamples`)
 * mengembalikan `null` bila fungsi RPC belum ada di server.
 */
export interface Remote {
  getUserId(): Promise<string | null>;

  // --- baca ---
  settings(userId: string): Promise<RemoteSettings | null>;
  userItems(userId: string): Promise<RemoteUserItem[]>;
  todayPlan(userId: string, planDate: string): Promise<LocalPlan | null>;
  /** Tanggal lokal yang punya review (untuk streak). */
  reviewDates(tz: string): Promise<string[]>;
  /** Jawaban sejak waktu tertentu (untuk retensi 7 hari). */
  reviewsSince(userId: string, sinceIso: string): Promise<{ at: string; correct: boolean }[]>;
  /** Jawaban salah (rating 1) sejak waktu tertentu (untuk "tanpa lapse 30 hari"). */
  lapsesSince(userId: string, sinceIso: string): Promise<{ itemId: number; at: string }[]>;
  polaSince(userId: string, sinceIso: string): Promise<{ correct: boolean }[]>;
  corpusTotals(): Promise<{ totalWords: number; totalLemmas: number }>;
  lemmas(): Promise<LocalLemma[]>;
  roots(): Promise<LocalRoot[]>;
  lessons(): Promise<LocalLesson[]>;
  contentVersions(): Promise<Record<string, string> | null>;
  lemmaExamples(lemmaIds: number[]): Promise<{ lemmaId: number; example: ExampleView }[] | null>;
  ayahCards(refs: number[]): Promise<RemoteAyahCard[]>;

  // --- tulis (idempoten) ---
  pushReviewLogs(rows: ReviewLogPayload[]): Promise<void>;
  pushUserItemState(userId: string, state: UserItemStatePayload): Promise<void>;
  pushPolaAttempts(rows: PolaAttemptPayload[]): Promise<void>;
  pushSessionDone(userId: string, planDate: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Adaptor Supabase (browser). Kueri meniru yang sudah dipakai di sisi server.
// ---------------------------------------------------------------------------

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Res<T> = { data: T | null; error: { message: string; code?: string } | null };

const PAGE = 1000;

function fail(error: { message: string; code?: string }): never {
  // Galat jaringan dari fetch tidak punya kode Postgres/PostgREST.
  if (!error.code) throw new RemoteUnreachableError(error.message);
  throw new Error(error.message);
}

function unwrap<T>(res: Res<T>): T {
  if (res.error) fail(res.error);
  return res.data as T;
}

/** Mengambil semua baris (batas 1000 baris per permintaan PostgREST). */
async function pageAll<T>(
  run: (from: number, to: number) => PromiseLike<Res<T[]>>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = unwrap(await run(from, from + PAGE - 1)) ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

const SETTINGS_COLUMNS =
  "timezone,daily_new_max,target_retention,target_token_coverage,daily_review_limit,start_date,phase1_deadline";

export function supabaseRemote(supabase: SupabaseClient): Remote {
  return {
    async getUserId() {
      // getSession membaca dari penyimpanan lokal sehingga tetap jalan saat offline.
      const { data } = await supabase.auth.getSession();
      return data.session?.user.id ?? null;
    },

    async settings(userId) {
      const r = unwrap(
        (await supabase
          .from("user_settings")
          .select(SETTINGS_COLUMNS)
          .eq("user_id", userId)
          .maybeSingle()) as Res<Row>,
      );
      if (!r) return null;
      return {
        timezone: String(r.timezone),
        dailyNewMax: Number(r.daily_new_max),
        targetRetention: Number(r.target_retention),
        targetTokenCoverage: Number(r.target_token_coverage),
        dailyReviewLimit: Number(r.daily_review_limit),
        startDate: String(r.start_date),
        phase1Deadline: r.phase1_deadline ? String(r.phase1_deadline) : null,
      };
    },

    async userItems(userId) {
      const rows = await pageAll<Row>((from, to) =>
        supabase
          .from("user_items")
          .select("item_id,status,level,ever_reached_one,fsrs,due_at,priority,mastered_at,items!inner(kind,ref_id)")
          .eq("user_id", userId)
          .order("item_id")
          .range(from, to) as unknown as PromiseLike<Res<Row[]>>,
      );
      return rows.map((r) => {
        const it = Array.isArray(r.items) ? r.items[0] : r.items;
        return {
          itemId: Number(r.item_id),
          kind: it.kind as ItemKind,
          refId: Number(it.ref_id),
          status: r.status as ItemStatus,
          level: Number(r.level),
          everReachedOne: Boolean(r.ever_reached_one),
          fsrs: r.fsrs as FsrsCardJson,
          dueAt: String(r.due_at),
          priority: Boolean(r.priority),
          masteredAt: r.mastered_at ? String(r.mastered_at) : null,
        };
      });
    },

    async todayPlan(userId, planDate) {
      const r = unwrap(
        (await supabase
          .from("daily_plans")
          .select("*")
          .eq("user_id", userId)
          .eq("plan_date", planDate)
          .maybeSingle()) as Res<Row>,
      );
      if (!r) return null;
      return {
        planDate: String(r.plan_date),
        retention7d: Number(r.retention_7d ?? 0.9),
        backlog: Number(r.backlog ?? 0),
        learningPile: Number(r.learning_pile ?? 0),
        newQuota: Number(r.new_quota ?? 0),
        reason: String(r.reason ?? ""),
        sessionDone: Boolean(r.session_done),
      };
    },

    async reviewDates(tz) {
      const data = unwrap((await supabase.rpc("review_days", { p_tz: tz })) as Res<unknown[]>) ?? [];
      return (data as (string | Record<string, string>)[]).map((d) =>
        typeof d === "string" ? d : Object.values(d)[0],
      );
    },

    async reviewsSince(userId, sinceIso) {
      const rows = await pageAll<Row>((from, to) =>
        supabase
          .from("review_logs")
          .select("reviewed_at,correct")
          .eq("user_id", userId)
          .gte("reviewed_at", sinceIso)
          .order("reviewed_at")
          .range(from, to) as unknown as PromiseLike<Res<Row[]>>,
      );
      return rows.map((r) => ({ at: String(r.reviewed_at), correct: Boolean(r.correct) }));
    },

    async lapsesSince(userId, sinceIso) {
      const rows = await pageAll<Row>((from, to) =>
        supabase
          .from("review_logs")
          .select("item_id,reviewed_at")
          .eq("user_id", userId)
          .eq("rating", 1)
          .gte("reviewed_at", sinceIso)
          .order("reviewed_at")
          .range(from, to) as unknown as PromiseLike<Res<Row[]>>,
      );
      return rows.map((r) => ({ itemId: Number(r.item_id), at: String(r.reviewed_at) }));
    },

    async polaSince(userId, sinceIso) {
      const rows = await pageAll<Row>((from, to) =>
        supabase
          .from("pola_attempts")
          .select("correct")
          .eq("user_id", userId)
          .gte("answered_at", sinceIso)
          .order("answered_at")
          .range(from, to) as unknown as PromiseLike<Res<Row[]>>,
      );
      return rows.map((r) => ({ correct: Boolean(r.correct) }));
    },

    async corpusTotals() {
      const rows =
        unwrap((await supabase.from("corpus_meta").select("key,value")) as Res<Row[]>) ?? [];
      const get = (k: string) => Number(rows.find((r) => r.key === k)?.value ?? 0);
      return { totalWords: get("quran_total_words"), totalLemmas: get("quran_total_lemmas") };
    },

    async lemmas() {
      const rows = await pageAll<Row>((from, to) =>
        supabase
          .from("lemmas")
          .select("id,lemma_ar,pos,gloss_id,root_id,freq,freq_rank")
          .not("gloss_id", "is", null)
          .order("id")
          .range(from, to) as unknown as PromiseLike<Res<Row[]>>,
      );
      return rows.map((l) => ({
        id: Number(l.id),
        lemmaAr: String(l.lemma_ar),
        pos: String(l.pos),
        gloss: String(l.gloss_id),
        rootId: l.root_id === null ? null : Number(l.root_id),
        freq: Number(l.freq),
        freqRank: l.freq_rank === null ? null : Number(l.freq_rank),
      }));
    },

    async roots() {
      const rows = await pageAll<Row>((from, to) =>
        supabase
          .from("roots")
          .select("id,root_ar")
          .order("id")
          .range(from, to) as unknown as PromiseLike<Res<Row[]>>,
      );
      return rows.map((r) => ({ id: Number(r.id), rootAr: String(r.root_ar) }));
    },

    async lessons() {
      const rows = unwrap(
        (await supabase
          .from("lessons")
          .select("id,code,title,body_md,exercises")
          .order("id")) as Res<Row[]>,
      );
      return (rows ?? []).map((l) => ({
        id: Number(l.id),
        code: String(l.code),
        title: String(l.title),
        bodyMd: String(l.body_md),
        exercises: l.exercises as LocalLesson["exercises"],
      }));
    },

    async contentVersions() {
      const res = (await supabase.rpc("content_versions")) as Res<Row[]>;
      // Migrasi belum diterapkan (fungsi tidak ada): sinkron tetap jalan tanpa versi.
      if (res.error) {
        if (!res.error.code) fail(res.error);
        return null;
      }
      const out: Record<string, string> = {};
      for (const r of res.data ?? []) out[String(r.key)] = String(r.version);
      return out;
    },

    async lemmaExamples(lemmaIds) {
      const res = (await supabase.rpc("lemma_examples", { p_lemma_ids: lemmaIds })) as Res<Row[]>;
      if (res.error) {
        if (!res.error.code) fail(res.error);
        return null;
      }
      return (res.data ?? []).map((r) => ({
        lemmaId: Number(r.lemma_id),
        example: {
          surah: Number(r.surah),
          ayah: Number(r.ayah),
          translation: String(r.translation_id),
          words: ((r.words ?? []) as Row[]).map(
            (w): WordView => ({
              text: String(w.t),
              gloss: w.g === null || w.g === undefined ? null : String(w.g),
              target: Number(w.l) === Number(r.lemma_id),
            }),
          ),
        } satisfies ExampleView,
      }));
    },

    async ayahCards(refs) {
      const out: RemoteAyahCard[] = [];
      for (let i = 0; i < refs.length; i += 15) {
        const chunk = refs.slice(i, i + 15);
        const filter = chunk
          .map((r) => `and(surah.eq.${Math.floor(r / 1000)},ayah.eq.${r % 1000})`)
          .join(",");
        const ayahs =
          unwrap(
            (await supabase
              .from("ayahs")
              .select("surah,ayah,text_ar,translation_id")
              .or(filter)) as Res<Row[]>,
          ) ?? [];
        const words =
          unwrap(
            (await supabase
              .from("words")
              .select("surah,ayah,position,text_ar,gloss_id")
              .or(filter)
              .order("surah")
              .order("ayah")
              .order("position")) as Res<Row[]>,
          ) ?? [];
        for (const a of ayahs) {
          out.push({
            ref: Number(a.surah) * 1000 + Number(a.ayah),
            textAr: String(a.text_ar),
            translation: String(a.translation_id),
            words: words
              .filter((w) => w.surah === a.surah && w.ayah === a.ayah)
              .map((w) => ({ text: String(w.text_ar), gloss: w.gloss_id ?? null, target: false })),
          });
        }
      }
      return out;
    },

    async pushReviewLogs(rows) {
      if (rows.length === 0) return;
      const res = (await supabase
        .from("review_logs")
        .upsert(rows, { onConflict: "client_id", ignoreDuplicates: true })) as Res<unknown>;
      if (res.error) fail(res.error);
    },

    async pushUserItemState(userId, s) {
      const res = (await supabase
        .from("user_items")
        .update({
          level: s.level,
          ever_reached_one: s.ever_reached_one,
          status: s.status,
          fsrs: s.fsrs,
          due_at: s.due_at,
          mastered_at: s.mastered_at,
        })
        .eq("user_id", userId)
        .eq("item_id", s.item_id)) as Res<unknown>;
      if (res.error) fail(res.error);
    },

    async pushPolaAttempts(rows) {
      if (rows.length === 0) return;
      const res = (await supabase
        .from("pola_attempts")
        .upsert(rows, { onConflict: "client_id", ignoreDuplicates: true })) as Res<unknown>;
      if (!res.error) return;
      // Migrasi 0009 belum diterapkan (kolom client_id belum ada): kirim tanpa kunci idempotensi
      // daripada kehilangan jawaban. Setelah migrasi diterapkan, jalur di atas yang dipakai.
      if (res.error.code === "42703" || res.error.code === "PGRST204") {
        const plain = rows.map((r) => ({
          user_id: r.user_id,
          category: r.category,
          correct: r.correct,
          answered_at: r.answered_at,
        }));
        const retry = (await supabase.from("pola_attempts").insert(plain)) as Res<unknown>;
        if (retry.error) fail(retry.error);
        return;
      }
      fail(res.error);
    },

    async pushSessionDone(userId, planDate) {
      const res = (await supabase
        .from("daily_plans")
        .update({ session_done: true })
        .eq("user_id", userId)
        .eq("plan_date", planDate)) as Res<unknown>;
      if (res.error) fail(res.error);
    },
  };
}
