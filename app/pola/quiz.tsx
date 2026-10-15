"use client";

import { useState, useTransition } from "react";
import { generatePolaQuiz, type PolaQuestion } from "./actions";
import { recordPola } from "@/lib/local/runtime";

export default function PolaQuiz() {
  const [qs, setQs] = useState<PolaQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      setQs(await generatePolaQuiz(10));
      setI(0);
      setPicked(null);
      setScore(0);
    });

  if (!qs) {
    return (
      <button onClick={begin} disabled={pending} className="rounded-xl bg-emerald-700 px-4 py-3 text-white disabled:opacity-50">
        {pending ? "Menyiapkan..." : "Mulai kuis pola"}
      </button>
    );
  }
  if (qs.length === 0) return <p className="text-sm">Soal belum tersedia.</p>;
  if (i >= qs.length) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-lg font-medium">Skor: {score} / {qs.length}</p>
        <button onClick={begin} disabled={pending} className="self-start rounded-xl bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
          Kuis lagi
        </button>
      </div>
    );
  }
  const q = qs[i];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs opacity-60">Soal {i + 1} / {qs.length} · QS {q.ref}</p>
      <p className="text-center text-4xl leading-loose" lang="ar" dir="rtl">{q.word}</p>
      <p className="text-center text-sm opacity-70">{q.gloss ? `Arti: ${q.gloss}` : "Bentuk apakah kata ini?"}</p>
      <div className="grid gap-2">
        {q.options.map((o, k) => {
          const state = picked === null ? "" : k === q.answer ? "border-emerald-600 bg-emerald-100 dark:bg-emerald-900/40" : k === picked ? "border-red-500 bg-red-100 dark:bg-red-900/40" : "";
          return (
            <button
              key={k}
              disabled={picked !== null}
              onClick={() => {
                setPicked(k);
                if (k === q.answer) setScore((s) => s + 1);
                void recordPola(q.category, k === q.answer);
              }}
              className={`rounded-xl border border-black/15 px-3 py-2 text-left dark:border-white/25 ${state}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <button
          onClick={() => {
            setI(i + 1);
            setPicked(null);
          }}
          className="self-end rounded-lg bg-emerald-700 px-4 py-2 text-white"
        >
          Lanjut
        </button>
      )}
    </div>
  );
}
