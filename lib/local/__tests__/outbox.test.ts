import { describe, expect, it } from "vitest";
import { MAX_TRIES, enqueue, flushOutbox, pendingCount, type DeadLetter } from "../outbox";
import { enqueuePolaAttempt, markSessionDone, submitLocalReview } from "../review";
import { getMeta, setMeta, wipeUserData } from "../db";
import { FakeRemote, NOW, localItem, makeDb, SETTINGS } from "./helpers";

async function seed() {
  const db = makeDb();
  await setMeta(db, "userId", "u1");
  await db.settings.put({ id: 1, ...SETTINGS });
  await db.userItems.bulkPut([localItem({ itemId: 1 }), localItem({ itemId: 2 })]);
  return db;
}

const answer = (itemId: number, clientId: string, correct = true, responseMs = 2000) => ({
  clientId,
  itemId,
  exercise: "recognize" as const,
  correct,
  responseMs,
});

describe("submitLocalReview", () => {
  it("memperbarui item, hitungan hari, dan menaruh log + keadaan di antrean", async () => {
    const db = await seed();
    const res = await submitLocalReview(db, answer(1, "c1"), NOW);

    expect(res.ok).toBe(true);
    expect(res.level).toBe(1); // benar cepat (<3 dtk) = rating 4 => level naik
    expect(res.after!).toBeGreaterThan(res.before!);

    const item = (await db.userItems.get(1))!;
    expect(item.level).toBe(1);
    expect(item.fsrs.reps).toBe(1);
    expect(item.dueAt > NOW.toISOString()).toBe(true);

    const day = (await db.reviewDays.toArray())[0];
    expect(day).toEqual({ date: "2026-10-16", total: 1, correct: 1 });

    const out = await db.outbox.toArray();
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("review");
    if (out[0].kind === "review") {
      expect(out[0].payload.log.client_id).toBe("c1");
      expect(out[0].payload.log.reviewed_at).toBe(NOW.toISOString()); // waktu jawab, bukan waktu kirim
      expect(out[0].payload.log.level_before).toBe(0);
      expect(out[0].payload.state.level).toBe(1);
    }
  });

  it("jawaban salah dicatat sebagai lapse dan tidak menaikkan level", async () => {
    const db = await seed();
    const res = await submitLocalReview(db, answer(1, "c1", false), NOW);
    expect(res.level).toBe(0);
    expect((await db.userItems.get(1))!.lapses).toEqual([NOW.toISOString()]);
    expect(await db.reviewDays.get("2026-10-16")).toEqual({ date: "2026-10-16", total: 1, correct: 0 });
  });

  it("menolak item tak dikenal dan data yang belum siap", async () => {
    const db = await seed();
    expect((await submitLocalReview(db, answer(99, "x"), NOW)).ok).toBe(false);
    await db.meta.clear();
    expect((await submitLocalReview(db, answer(1, "y"), NOW)).ok).toBe(false);
    expect(await pendingCount(db)).toBe(0);
  });

  it("clientId yang sama tidak masuk antrean dua kali", async () => {
    const db = await seed();
    await submitLocalReview(db, answer(1, "dup"), NOW);
    await expect(submitLocalReview(db, answer(2, "dup"), NOW)).rejects.toThrow();
    expect(await pendingCount(db)).toBe(1);
    expect(await enqueue(db, { kind: "session_done", clientId: "dup", payload: { planDate: "x" } })).toBe(false);
  });
});

describe("flushOutbox", () => {
  it("mengirim log berurutan, keadaan terakhir tiap item, lalu mengosongkan antrean", async () => {
    const db = await seed();
    const remote = new FakeRemote();
    remote.items = [
      { ...localItem({ itemId: 1 }), dueAt: "x" },
      { ...localItem({ itemId: 2 }), dueAt: "x" },
    ] as never;

    await submitLocalReview(db, answer(1, "a1"), new Date(NOW.getTime()));
    await submitLocalReview(db, answer(1, "a2"), new Date(NOW.getTime() + 60_000));
    await submitLocalReview(db, answer(2, "b1"), new Date(NOW.getTime() + 120_000));
    const finalItem1 = (await db.userItems.get(1))!;

    const res = await flushOutbox(db, remote, "u1");
    expect(res).toMatchObject({ sent: 3, remaining: 0, deadLettered: 0, unreachable: false });
    expect([...remote.logsByClientId.keys()]).toEqual(["a1", "a2", "b1"]);
    // satu pembaruan keadaan per item, memakai keadaan TERAKHIR
    expect(remote.statePushes.map((s) => s.item_id).sort()).toEqual([1, 2]);
    expect(remote.statePushes.find((s) => s.item_id === 1)!.level).toBe(finalItem1.level);
    expect(await pendingCount(db)).toBe(0);
  });

  it("offline: entri tetap ada dan hitungan percobaan tidak bertambah", async () => {
    const db = await seed();
    const remote = new FakeRemote();
    await submitLocalReview(db, answer(1, "a1"), NOW);
    remote.offline = true;

    const res = await flushOutbox(db, remote, "u1");
    expect(res.unreachable).toBe(true);
    expect(res.remaining).toBe(1);
    expect((await db.outbox.toArray())[0].tries).toBe(0);

    // kembali online: terkirim, dan kirim ulang tidak menggandakan log
    remote.offline = false;
    await flushOutbox(db, remote, "u1");
    await flushOutbox(db, remote, "u1");
    expect(remote.logsByClientId.size).toBe(1);
    expect(await pendingCount(db)).toBe(0);
  });

  it("aman diulang: gagal di tengah (log sudah masuk) lalu dikirim ulang tidak menggandakan", async () => {
    const db = await seed();
    const remote = new FakeRemote();
    await submitLocalReview(db, answer(1, "a1"), NOW);

    // log terkirim, tetapi pembaruan keadaan gagal (koneksi putus)
    const original = remote.pushUserItemState.bind(remote);
    remote.pushUserItemState = async () => {
      remote.pushUserItemState = original;
      throw new (await import("../remote")).RemoteUnreachableError();
    };
    const first = await flushOutbox(db, remote, "u1");
    expect(first.remaining).toBe(1);
    expect(remote.logsByClientId.size).toBe(1);

    const second = await flushOutbox(db, remote, "u1");
    expect(second.remaining).toBe(0);
    expect(remote.logsByClientId.size).toBe(1); // tidak ganda
    expect(remote.statePushes).toHaveLength(1);
  });

  it("ditolak server: percobaan bertambah, lalu dibuang ke deadLetters agar tidak memblokir", async () => {
    const db = await seed();
    const remote = new FakeRemote();
    remote.rejectPushes = new Error("violates foreign key");
    await submitLocalReview(db, answer(1, "bad"), NOW);

    for (let i = 1; i < MAX_TRIES; i++) {
      await flushOutbox(db, remote, "u1");
      expect((await db.outbox.toArray())[0].tries).toBe(i);
    }
    const last = await flushOutbox(db, remote, "u1");
    expect(last.deadLettered).toBe(1);
    expect(await pendingCount(db)).toBe(0);
    const dead = (await getMeta<DeadLetter[]>(db, "deadLetters"))!;
    expect(dead).toHaveLength(1);
    expect(dead[0].error).toContain("foreign key");
  });

  it("entri milik akun lain tidak dikirim", async () => {
    const db = await seed();
    const remote = new FakeRemote();
    await submitLocalReview(db, answer(1, "mine"), NOW);
    const [e] = await db.outbox.toArray();
    if (e.kind === "review") {
      await db.outbox.update(e.id!, { payload: { ...e.payload, log: { ...e.payload.log, user_id: "other" } } });
    }
    const res = await flushOutbox(db, remote, "u1");
    expect(res.deadLettered).toBe(1);
    expect(remote.logsByClientId.size).toBe(0);
  });

  it("panggilan bersamaan berbagi satu pengiriman", async () => {
    const db = await seed();
    const remote = new FakeRemote();
    await submitLocalReview(db, answer(1, "a1"), NOW);
    const [a, b] = await Promise.all([flushOutbox(db, remote, "u1"), flushOutbox(db, remote, "u1")]);
    expect(a).toBe(b);
    expect(remote.count("pushReviewLogs")).toBe(1);
  });
});

describe("pola dan sesi selesai", () => {
  it("jawaban pola masuk antrean idempoten dan dikirim", async () => {
    const db = await seed();
    const remote = new FakeRemote();
    expect(await enqueuePolaAttempt(db, "PERF", true, "p1", NOW)).toBe(true);
    expect(await getMeta(db, "pola30")).toEqual({ correct: 1, total: 1 });
    await flushOutbox(db, remote, "u1");
    expect(remote.polaByClientId.get("p1")).toMatchObject({ category: "PERF", correct: true, user_id: "u1" });
  });

  it("tanpa userId lokal, jawaban pola tidak diantrekan", async () => {
    const db = makeDb();
    expect(await enqueuePolaAttempt(db, "PERF", true, "p1", NOW)).toBe(false);
  });

  it("sesi selesai hanya sekali per tanggal", async () => {
    const db = await seed();
    const remote = new FakeRemote();
    await db.dailyPlan.put({
      planDate: "2026-10-16",
      retention7d: 0.9,
      backlog: 0,
      learningPile: 0,
      newQuota: 5,
      reason: "",
      sessionDone: false,
    });
    await markSessionDone(db, NOW);
    await markSessionDone(db, NOW);
    expect((await db.dailyPlan.get("2026-10-16"))!.sessionDone).toBe(true);
    expect(await pendingCount(db)).toBe(1);
    await flushOutbox(db, remote, "u1");
    expect(remote.sessionDone).toEqual(["2026-10-16"]);
  });
});

describe("wipeUserData", () => {
  it("menghapus data pengguna tetapi mempertahankan konten", async () => {
    const db = await seed();
    await db.lemmas.put({ id: 1, lemmaAr: "x", pos: "N", gloss: "g", rootId: null, freq: 1, freqRank: 1 });
    await submitLocalReview(db, answer(1, "a1"), NOW);
    await wipeUserData(db);
    expect(await db.userItems.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.settings.count()).toBe(0);
    expect(await db.reviewDays.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
    expect(await db.lemmas.count()).toBe(1);
  });
});
