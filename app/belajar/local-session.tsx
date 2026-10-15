"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getDb, localStorageAvailable, type LocalDb } from "@/lib/local/db";
import { flushNow, runSync } from "@/lib/local/runtime";
import { markSessionDone, submitLocalReview } from "@/lib/local/review";
import { buildLocalQuiz, buildLocalSession } from "@/lib/local/session";
import type { ReviewInput, ReviewResult, SessionCard } from "@/lib/session-types";
import { ensureToday, finishSession, loadServerCards, submitReview } from "./actions";
import Session from "./session";

type Mode = "belajar" | "kuis";

type State =
  | { status: "loading" }
  | { status: "nodata" }
  | { status: "ready"; cards: SessionCard[]; db: LocalDb | null };

/** Batas tunggu jaringan agar sesi tetap terbuka cepat saat koneksi buruk. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
}

/**
 * Sesi belajar/kuis yang berjalan dari data lokal. Online: server membuka item baru (mastery
 * gate) lalu data ditarik; offline: langsung dari salinan lokal. Jawaban dicatat lokal dulu.
 */
export default function LocalSession({ mode }: { mode: Mode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const online = navigator.onLine !== false;

      // Penyimpanan lokal tidak tersedia (mis. mode privat tertentu): jalur server seperti semula.
      if (!localStorageAvailable()) {
        const cards = await loadServerCards(mode).catch(() => []);
        if (!cancelled) setState({ status: "ready", cards, db: null });
        return;
      }

      const db = getDb();
      // Ronde pertama: sinkron dulu bila online. "Kuis lagi" memakai data lokal yang sama.
      if (round === 0 && online) {
        try {
          if (mode === "belajar") await withTimeout(ensureToday(), 8000);
          await withTimeout(runSync(true), 15000);
        } catch {
          // gagal jaringan: lanjut dari data lokal
        }
      }
      if (!(await db.settings.get(1))) {
        if (!cancelled) setState({ status: "nodata" });
        return;
      }
      const cards = mode === "belajar" ? await buildLocalSession(db) : await buildLocalQuiz(db, 10);
      if (!cancelled) setState({ status: "ready", cards, db });
    })().catch(() => {
      if (!cancelled) setState({ status: "nodata" });
    });
    return () => {
      cancelled = true;
    };
  }, [mode, round]);

  const again = useCallback(() => {
    setState({ status: "loading" });
    setRound((r) => r + 1);
  }, []);

  if (state.status === "loading") {
    return <p className="p-8 text-sm opacity-60">{mode === "kuis" ? "Menyusun kuis..." : "Menyiapkan sesi..."}</p>;
  }

  if (state.status === "nodata") {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center gap-3 px-5 py-24 text-center">
        <h1 className="text-xl font-semibold">Data belajar belum tersimpan di perangkat ini</h1>
        <p className="text-sm opacity-70">Sambungkan internet lalu buka halaman ini lagi. Setelah itu bisa dipakai tanpa internet.</p>
        <Link href="/" className="rounded-xl border border-current/25 px-5 py-2.5 font-medium">
          Beranda
        </Link>
      </main>
    );
  }

  const { db } = state;
  const review = async (input: ReviewInput): Promise<ReviewResult> => {
    if (!db) return submitReview(input);
    const res = await submitLocalReview(db, input);
    if (res.ok) void flushNow(); // kirim di latar; gagal/offline = tetap di antrean
    return res;
  };
  const onFinish = () => {
    if (!db) {
      void finishSession();
      return;
    }
    void markSessionDone(db).then(() => flushNow());
  };

  return (
    <Session
      key={round}
      cards={state.cards}
      mode={mode}
      review={review}
      onFinish={mode === "belajar" ? onFinish : undefined}
      onAgain={again}
    />
  );
}
