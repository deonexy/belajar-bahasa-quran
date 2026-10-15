import { newCard } from "@/lib/engine";
import type { ExampleView } from "@/lib/session-types";
import { LocalDb } from "../db";
import {
  RemoteUnreachableError,
  type Remote,
  type RemoteAyahCard,
  type RemoteSettings,
  type RemoteUserItem,
} from "../remote";
import type {
  LocalLemma,
  LocalLesson,
  LocalPlan,
  LocalRoot,
  LocalUserItem,
  PolaAttemptPayload,
  ReviewLogPayload,
  UserItemStatePayload,
} from "../types";

export const NOW = new Date("2026-10-16T05:00:00.000Z");

let counter = 0;
export function makeDb(): LocalDb {
  return new LocalDb(`test-${Date.now()}-${counter++}`);
}

export function remoteItem(over: Partial<RemoteUserItem> & { itemId: number }): RemoteUserItem {
  const card = newCard(new Date(NOW.getTime() - 3600_000));
  return {
    kind: "lemma",
    refId: over.itemId * 10,
    status: "learning",
    level: 0,
    everReachedOne: false,
    fsrs: card,
    // format Postgres: "+00:00" (bukan "Z")
    dueAt: "2026-10-16T04:00:00+00:00",
    priority: false,
    masteredAt: null,
    ...over,
  };
}

export function localItem(over: Partial<LocalUserItem> & { itemId: number }): LocalUserItem {
  const card = newCard(new Date(NOW.getTime() - 3600_000));
  return {
    kind: "lemma",
    refId: over.itemId * 10,
    status: "learning",
    level: 0,
    everReachedOne: false,
    fsrs: card,
    dueAt: new Date(NOW.getTime() - 3600_000).toISOString(),
    priority: false,
    masteredAt: null,
    lapses: [],
    ...over,
  };
}

export function lemma(id: number, over: Partial<LocalLemma> = {}): LocalLemma {
  return {
    id,
    lemmaAr: `لَفْظ${id}`,
    pos: "N",
    gloss: `arti-${id}`,
    rootId: 1,
    freq: 100 - id,
    freqRank: id,
    ...over,
  };
}

export const SETTINGS: RemoteSettings = {
  timezone: "Asia/Jakarta",
  dailyNewMax: 5,
  targetRetention: 0.9,
  targetTokenCoverage: 0.85,
  dailyReviewLimit: 150,
  startDate: "2026-10-01",
  phase1Deadline: null,
};

export const EXAMPLE: ExampleView = {
  surah: 1,
  ayah: 2,
  translation: "terjemah",
  words: [
    { text: "كلمة", gloss: "kata", target: true },
    { text: "أخرى", gloss: "lain", target: false },
  ],
};

/** Server palsu di memori: mencatat panggilan, bisa dibuat offline, dan idempoten seperti aslinya. */
export class FakeRemote implements Remote {
  userId: string | null = "u1";
  offline = false;
  /** Bila diisi, semua `push*` ditolak dengan galat ini (server menolak, bukan offline). */
  rejectPushes: Error | null = null;
  calls: Record<string, number> = {};

  settingsRow: RemoteSettings | null = SETTINGS;
  items: RemoteUserItem[] = [];
  plan: LocalPlan | null = null;
  dates: string[] = [];
  logs7: { at: string; correct: boolean }[] = [];
  lapses: { itemId: number; at: string }[] = [];
  pola: { correct: boolean }[] = [];
  totals = { totalWords: 77429, totalLemmas: 4815 };
  lemmaRows: LocalLemma[] = [];
  rootRows: LocalRoot[] = [{ id: 1, rootAr: "كتب" }];
  lessonRows: LocalLesson[] = [];
  /** null = fungsi RPC belum ada di server. */
  versions: Record<string, string> | null = { lemmas: "v1", roots: "v1", lessons: "v1" };
  /** null = fungsi RPC belum ada di server. */
  examples: Map<number, ExampleView> | null = new Map();
  ayahRows: RemoteAyahCard[] = [];
  /** Dipanggil di awal `userItems()` (untuk mensimulasikan kejadian saat menunggu server). */
  onUserItems: (() => Promise<void>) | null = null;

  logsByClientId = new Map<string, ReviewLogPayload>();
  polaByClientId = new Map<string, PolaAttemptPayload>();
  sessionDone: string[] = [];
  statePushes: UserItemStatePayload[] = [];

  private tick(name: string) {
    this.calls[name] = (this.calls[name] ?? 0) + 1;
    if (this.offline) throw new RemoteUnreachableError("offline");
  }
  count(name: string) {
    return this.calls[name] ?? 0;
  }

  async getUserId() {
    return this.userId;
  }
  async settings() {
    this.tick("settings");
    return this.settingsRow;
  }
  async userItems() {
    this.tick("userItems");
    if (this.onUserItems) await this.onUserItems();
    return this.items.map((i) => ({ ...i }));
  }
  async todayPlan() {
    this.tick("todayPlan");
    return this.plan;
  }
  async reviewDates() {
    this.tick("reviewDates");
    return this.dates;
  }
  async reviewsSince() {
    this.tick("reviewsSince");
    return this.logs7;
  }
  async lapsesSince() {
    this.tick("lapsesSince");
    return this.lapses;
  }
  async polaSince() {
    this.tick("polaSince");
    return this.pola;
  }
  async corpusTotals() {
    this.tick("corpusTotals");
    return this.totals;
  }
  async lemmas() {
    this.tick("lemmas");
    return this.lemmaRows;
  }
  async roots() {
    this.tick("roots");
    return this.rootRows;
  }
  async lessons() {
    this.tick("lessons");
    return this.lessonRows;
  }
  async contentVersions() {
    this.tick("contentVersions");
    return this.versions;
  }
  async lemmaExamples(ids: number[]) {
    this.tick("lemmaExamples");
    if (this.examples === null) return null;
    const ex = this.examples;
    return ids.filter((id) => ex.has(id)).map((id) => ({ lemmaId: id, example: ex.get(id)! }));
  }
  async ayahCards(refs: number[]) {
    this.tick("ayahCards");
    return this.ayahRows.filter((a) => refs.includes(a.ref));
  }

  private checkPush(name: string) {
    this.tick(name);
    if (this.rejectPushes) throw this.rejectPushes;
  }
  async pushReviewLogs(rows: ReviewLogPayload[]) {
    this.checkPush("pushReviewLogs");
    // seperti ON CONFLICT (client_id) DO NOTHING
    for (const r of rows) if (!this.logsByClientId.has(r.client_id)) this.logsByClientId.set(r.client_id, r);
  }
  async pushUserItemState(_userId: string, s: UserItemStatePayload) {
    this.checkPush("pushUserItemState");
    this.statePushes.push(s);
    const it = this.items.find((i) => i.itemId === s.item_id);
    if (it) {
      it.level = s.level;
      it.everReachedOne = s.ever_reached_one;
      it.status = s.status;
      it.fsrs = s.fsrs;
      it.dueAt = s.due_at;
      it.masteredAt = s.mastered_at;
    }
  }
  async pushPolaAttempts(rows: PolaAttemptPayload[]) {
    this.checkPush("pushPolaAttempts");
    for (const r of rows) if (!this.polaByClientId.has(r.client_id)) this.polaByClientId.set(r.client_id, r);
  }
  async pushSessionDone(_userId: string, planDate: string) {
    this.checkPush("pushSessionDone");
    if (!this.sessionDone.includes(planDate)) this.sessionDone.push(planDate);
  }
}
