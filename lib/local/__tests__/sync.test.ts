import { describe, expect, it } from "vitest";
import { getMeta } from "../db";
import { submitLocalReview } from "../review";
import { UNVERSIONED_REFRESH_MS, syncAll } from "../sync";
import { EXAMPLE, FakeRemote, NOW, lemma, makeDb, remoteItem } from "./helpers";

function populatedRemote(): FakeRemote {
  const r = new FakeRemote();
  r.items = [
    remoteItem({ itemId: 1, refId: 10 }),
    remoteItem({ itemId: 2, refId: 20 }),
    remoteItem({ itemId: 3, kind: "lesson", refId: 5 }),
    remoteItem({ itemId: 4, kind: "ayah", refId: 1002 }),
  ];
  r.lemmaRows = [lemma(10), lemma(20), lemma(30)];
  r.lessonRows = [{ id: 5, code: "L1", title: "Pelajaran", bodyMd: "# isi", exercises: [] }];
  r.examples = new Map([[10, EXAMPLE]]); // lemma 20 tidak punya contoh
  r.ayahRows = [{ ref: 1002, textAr: "ayat", translation: "tr", words: [] }];
  r.dates = ["2026-10-14", "2026-10-15"];
  r.logs7 = [
    { at: "2026-10-15T01:00:00Z", correct: true },
    { at: "2026-10-15T02:00:00Z", correct: false },
  ];
  r.lapses = [{ itemId: 1, at: "2026-10-15T02:00:00+00:00" }];
  r.pola = [{ correct: true }, { correct: false }, { correct: true }];
  r.plan = {
    planDate: "2026-10-16",
    retention7d: 0.9,
    backlog: 2,
    learningPile: 1,
    newQuota: 5,
    reason: "ok",
    sessionDone: false,
  };
  return r;
}

describe("syncAll: sinkron turun pertama", () => {
  it("tanpa pengguna masuk: tidak melakukan apa pun", async () => {
    const db = makeDb();
    const remote = populatedRemote();
    remote.userId = null;
    const res = await syncAll(db, remote, { now: NOW });
    expect(res).toMatchObject({ ok: false, skipped: "no-user" });
    expect(await db.userItems.count()).toBe(0);
  });

  it("mengisi data pengguna, konten, contoh ayat, dan ayat terbuka", async () => {
    const db = makeDb();
    const res = await syncAll(db, populatedRemote(), { now: NOW });
    expect(res.ok).toBe(true);
    expect(res.userData).toBe("pulled");
    expect(res.contentRefreshed).toEqual(["lemmas", "roots", "lessons"]);

    expect(await db.userItems.count()).toBe(4);
    // format waktu dinormalkan ke ISO "Z" agar bisa dibandingkan sebagai teks
    expect((await db.userItems.get(1))!.dueAt).toBe("2026-10-16T04:00:00.000Z");
    expect((await db.userItems.get(1))!.lapses).toEqual(["2026-10-15T02:00:00.000Z"]);

    expect((await db.settings.get(1))!.timezone).toBe("Asia/Jakarta");
    expect((await db.dailyPlan.get("2026-10-16"))!.newQuota).toBe(5);
    expect(await getMeta(db, "userId")).toBe("u1");
    expect(await getMeta(db, "totals")).toEqual({ totalWords: 77429, totalLemmas: 4815 });
    expect(await getMeta(db, "pola30")).toEqual({ correct: 2, total: 3 });

    expect(await db.lemmas.count()).toBe(3);
    expect(await db.roots.count()).toBe(1);
    expect(await db.lessons.count()).toBe(1);

    // contoh hanya untuk lemma terbuka; yang tak punya contoh dicatat null (tidak ditanya ulang)
    expect((await db.exampleAyahs.get(10))!.example).toEqual(EXAMPLE);
    expect((await db.exampleAyahs.get(20))!.example).toBeNull();
    expect(await db.exampleAyahs.get(30)).toBeUndefined();
    expect((await db.ayahs.get(1002))!.textAr).toBe("ayat");

    // hitungan per hari: 15 Okt punya total (dari log), 14 Okt hanya penanda
    expect(await db.reviewDays.get("2026-10-15")).toEqual({ date: "2026-10-15", total: 2, correct: 1 });
    expect(await db.reviewDays.get("2026-10-14")).toEqual({ date: "2026-10-14" });
  });

  it("ukuran konten lokal kecil (target < 2 MB)", async () => {
    const db = makeDb();
    const remote = populatedRemote();
    remote.lemmaRows = Array.from({ length: 700 }, (_, i) => lemma(i + 1));
    remote.rootRows = Array.from({ length: 1651 }, (_, i) => ({ id: i + 1, rootAr: "كتب" }));
    await syncAll(db, remote, { now: NOW });
    const bytes = JSON.stringify([
      await db.lemmas.toArray(),
      await db.roots.toArray(),
      await db.lessons.toArray(),
    ]).length;
    expect(bytes).toBeLessThan(2 * 1024 * 1024);
  });
});

describe("syncAll: konten berversi", () => {
  it("versi sama: konten tidak diunduh ulang", async () => {
    const db = makeDb();
    const remote = populatedRemote();
    await syncAll(db, remote, { now: NOW });
    const before = { l: remote.count("lemmas"), r: remote.count("roots"), s: remote.count("lessons") };

    const res = await syncAll(db, remote, { now: new Date(NOW.getTime() + 3600_000) });
    expect(res.contentRefreshed).toEqual([]);
    expect(remote.count("lemmas")).toBe(before.l);
    expect(remote.count("roots")).toBe(before.r);
    expect(remote.count("lessons")).toBe(before.s);
  });

  it("versi lemma berubah: diperbarui otomatis, contoh dimuat ulang, bagian lain tidak", async () => {
    const db = makeDb();
    const remote = populatedRemote();
    await syncAll(db, remote, { now: NOW });

    remote.versions = { lemmas: "v2", roots: "v1", lessons: "v1" };
    remote.lemmaRows = [lemma(10, { gloss: "arti-baru" }), lemma(20), lemma(30)];
    remote.examples = new Map([[10, { ...EXAMPLE, translation: "baru" }]]);
    const res = await syncAll(db, remote, { now: NOW });

    expect(res.contentRefreshed).toEqual(["lemmas"]);
    expect((await db.lemmas.get(10))!.gloss).toBe("arti-baru");
    expect((await db.exampleAyahs.get(10))!.example!.translation).toBe("baru");
    expect(remote.count("roots")).toBe(1);
    expect((await db.contentVersion.get("lemmas"))!.version).toBe("v2");
  });

  it("RPC versi belum ada: muat sekali, lalu hanya tiap 24 jam", async () => {
    const db = makeDb();
    const remote = populatedRemote();
    remote.versions = null;
    remote.examples = null; // RPC contoh juga belum ada

    const first = await syncAll(db, remote, { now: NOW });
    expect(first.ok).toBe(true);
    expect(first.contentRefreshed).toHaveLength(3);
    expect(await db.exampleAyahs.count()).toBe(0); // kartu tampil tanpa contoh, tidak error

    const soon = await syncAll(db, remote, { now: new Date(NOW.getTime() + 3600_000) });
    expect(soon.contentRefreshed).toEqual([]);

    const later = await syncAll(db, remote, { now: new Date(NOW.getTime() + UNVERSIONED_REFRESH_MS + 1000) });
    expect(later.contentRefreshed).toHaveLength(3);
  });
});

describe("syncAll: antrean dan konflik", () => {
  it("jawaban offline terkirim saat online, lalu keadaan server ikut ditarik", async () => {
    const db = makeDb();
    const remote = populatedRemote();
    await syncAll(db, remote, { now: NOW });

    remote.offline = true;
    const res = await submitLocalReview(
      db,
      { clientId: "c1", itemId: 1, exercise: "recognize", correct: true, responseMs: 1500 },
      NOW,
    );
    expect(res.ok).toBe(true);
    const offlineSync = await syncAll(db, remote, { now: NOW });
    expect(offlineSync).toMatchObject({ ok: false, unreachable: true });
    expect(await db.outbox.count()).toBe(1);

    remote.offline = false;
    const online = await syncAll(db, remote, { now: NOW });
    expect(online).toMatchObject({ ok: true, userData: "pulled" });
    expect(await db.outbox.count()).toBe(0);
    expect(remote.logsByClientId.has("c1")).toBe(true);
    // server menerima keadaan baru dan sinkron kembali menariknya
    expect(remote.items.find((i) => i.itemId === 1)!.level).toBe(1);
    expect((await db.userItems.get(1))!.level).toBe(1);
  });

  it("antrean gagal terkirim (ditolak): data lokal tidak ditimpa data server yang lebih lama", async () => {
    const db = makeDb();
    const remote = populatedRemote();
    await syncAll(db, remote, { now: NOW });
    await submitLocalReview(
      db,
      { clientId: "c1", itemId: 1, exercise: "recognize", correct: true, responseMs: 1500 },
      NOW,
    );
    remote.rejectPushes = new Error("ditolak");

    const res = await syncAll(db, remote, { now: NOW });
    expect(res.userData).toBe("skipped-pending");
    expect((await db.userItems.get(1))!.level).toBe(1); // jawaban lokal tetap
    expect(await db.outbox.count()).toBe(1);
  });

  it("jawaban baru masuk saat menunggu server: tarikan dibatalkan, jawaban tidak hilang", async () => {
    const db = makeDb();
    const remote = populatedRemote();
    await syncAll(db, remote, { now: NOW });

    remote.onUserItems = async () => {
      remote.onUserItems = null;
      await submitLocalReview(
        db,
        { clientId: "mid", itemId: 2, exercise: "recognize", correct: true, responseMs: 1500 },
        NOW,
      );
    };
    const res = await syncAll(db, remote, { now: NOW });
    expect(res.userData).toBe("skipped-pending");
    expect((await db.userItems.get(2))!.level).toBe(1);
    expect(await db.outbox.count()).toBe(1);
  });

  it("akun berganti: data pengguna lama dihapus, konten tetap", async () => {
    const db = makeDb();
    const remote = populatedRemote();
    await syncAll(db, remote, { now: NOW });
    await submitLocalReview(
      db,
      { clientId: "old", itemId: 1, exercise: "recognize", correct: true, responseMs: 1500 },
      NOW,
    );

    const other = populatedRemote();
    other.userId = "u2";
    other.items = [remoteItem({ itemId: 7, refId: 70 })];
    const res = await syncAll(db, other, { now: NOW });

    expect(res.ok).toBe(true);
    expect(await db.userItems.toArray().then((a) => a.map((i) => i.itemId))).toEqual([7]);
    expect(await db.outbox.count()).toBe(0); // jawaban akun lama tidak ikut terkirim ke akun baru
    expect(other.logsByClientId.size).toBe(0);
    expect(await db.lemmas.count()).toBe(3);
    expect(await getMeta(db, "userId")).toBe("u2");
  });

  it("server tidak terjangkau sejak awal: data lokal utuh", async () => {
    const db = makeDb();
    const remote = populatedRemote();
    await syncAll(db, remote, { now: NOW });
    remote.offline = true;
    const res = await syncAll(db, remote, { now: NOW });
    expect(res).toMatchObject({ ok: false, unreachable: true });
    expect(await db.userItems.count()).toBe(4);
    expect(await db.lemmas.count()).toBe(3);
  });
});
