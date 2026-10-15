"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addLemmaToReview } from "./actions";

export interface ReaderWord {
  text: string;
  gloss: string | null;
  lemmaId: number | null;
  lemmaAr: string | null;
  rootAr: string | null;
  /** null = belum masuk daftar belajar. */
  level: number | null;
  features: string[];
}
export interface ReaderAyah {
  ayah: number;
  translation: string;
  words: ReaderWord[];
}

const COLORS = [
  "bg-amber-100 dark:bg-amber-900/40",
  "bg-yellow-100 dark:bg-yellow-900/40",
  "bg-lime-200 dark:bg-lime-900/40",
  "bg-emerald-200 dark:bg-emerald-900/50",
];
const LEVEL_NAMES = ["baru dikenal", "mulai ingat", "cukup ingat", "dikuasai"];

export default function Reader({ surah, ayahs }: { surah: number; ayahs: ReaderAyah[] }) {
  const [hideGloss, setHideGloss] = useState(false);
  const [showTrans, setShowTrans] = useState(true);
  const [sel, setSel] = useState<{ a: number; i: number } | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();

  const picked = sel ? ayahs.find((a) => a.ayah === sel.a)?.words[sel.i] ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hideGloss} onChange={(e) => setHideGloss(e.target.checked)} />
          Sembunyikan arti kata
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showTrans} onChange={(e) => setShowTrans(e.target.checked)} />
          Tampilkan terjemah
        </label>
      </div>
      <div className="flex flex-wrap gap-2 text-xs opacity-80">
        <span className="rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">belum dipelajari</span>
        {LEVEL_NAMES.map((n, i) => (
          <span key={n} className={`rounded px-2 py-0.5 ${COLORS[i]}`}>{n}</span>
        ))}
      </div>

      {ayahs.map((a) => (
        <section key={a.ayah} className="flex flex-col gap-2 border-b border-black/10 pb-4 dark:border-white/20">
          <div className="text-xs opacity-60">{surah}:{a.ayah}</div>
          <div dir="rtl" className="flex flex-wrap gap-x-3 gap-y-2">
            {a.words.map((w, i) => {
              const active = sel?.a === a.ayah && sel.i === i;
              return (
                <button
                  key={i}
                  onClick={() => setSel(active ? null : { a: a.ayah, i })}
                  className={`flex flex-col items-center rounded-lg px-2 py-1 ${
                    w.level === null ? "bg-black/5 dark:bg-white/10" : COLORS[w.level]
                  } ${active ? "ring-2 ring-emerald-600" : ""}`}
                >
                  <span className="text-2xl leading-loose" lang="ar">{w.text}</span>
                  {!hideGloss && (
                    <span dir="ltr" className="max-w-24 text-center text-[11px] leading-tight opacity-70">
                      {w.gloss ?? "·"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {showTrans && <p className="text-sm opacity-80">{a.translation}</p>}
          {picked && sel?.a === a.ayah && (
            <div className="flex flex-col gap-1 rounded-xl border border-emerald-700/40 p-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl" lang="ar" dir="rtl">{picked.lemmaAr ?? picked.text}</span>
                <span className="opacity-80">{picked.gloss ?? "(arti belum tersedia)"}</span>
              </div>
              {picked.rootAr && (
                <div>
                  Akar:{" "}
                  <Link className="underline" href={`/akar/${encodeURIComponent(picked.rootAr)}`} lang="ar">
                    {picked.rootAr}
                  </Link>
                </div>
              )}
              {picked.features.length > 0 && <div>Ciri: {picked.features.join(", ")}</div>}
              <div className="opacity-70">
                Status: {picked.level === null ? "belum dipelajari" : LEVEL_NAMES[picked.level]}
              </div>
              {picked.lemmaId != null && picked.level === null && !added.has(picked.lemmaId) && (
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await addLemmaToReview(picked.lemmaId!);
                      if (r.ok) setAdded((s) => new Set(s).add(picked.lemmaId!));
                    })
                  }
                  className="mt-1 self-start rounded-lg bg-emerald-700 px-3 py-1 text-white disabled:opacity-50"
                >
                  Tambah ke review
                </button>
              )}
              {picked.lemmaId != null && added.has(picked.lemmaId) && (
                <span className="text-emerald-700">Ditambahkan ke daftar belajar.</span>
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
