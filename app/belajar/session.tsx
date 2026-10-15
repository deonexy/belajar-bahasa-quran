"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  AyahCard,
  ExampleView,
  LemmaCard,
  LessonCard,
  SessionCard,
} from "@/lib/session-types";
import { finishSession, submitReview } from "./actions";

type Outcome = { itemId: number; ok: boolean };

type Change = { label: string; before: number; after: number };

function cardLabel(c: SessionCard): string {
  if (c.kind === "lemma") return `${c.lemmaAr} · ${c.gloss}`;
  if (c.kind === "ayah") return `QS ${c.surah}:${c.ayah}`;
  return c.title;
}

export default function Session({
  cards,
  mode = "belajar",
}: {
  cards: SessionCard[];
  mode?: "belajar" | "kuis";
}) {
  const isQuiz = mode === "kuis";
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [changes, setChanges] = useState<Record<number, Change>>({});
  const [missed, setMissed] = useState<Record<number, string>>({});
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const total = queue.length;
  const card = queue[index];

  function advance(ok: boolean) {
    setOutcomes((o) => [...o, { itemId: card.itemId, ok }]);
    // Jawaban salah diulang sekali di akhir sesi.
    if (!ok && !queue.slice(index + 1).some((c) => c.itemId === card.itemId && c !== card)) {
      setQueue((q) => [...q, card]);
    }
    setIndex((i) => i + 1);
  }

  function record(
    c: SessionCard,
    payload: { exercise: string; correct?: boolean; grade?: "benar" | "sebagian" | "salah"; responseMs: number },
    ok: boolean,
  ) {
    setError(null);
    startTransition(async () => {
      const res = await submitReview({
        clientId: crypto.randomUUID(),
        itemId: c.itemId,
        exercise: payload.exercise as never,
        correct: payload.correct,
        grade: payload.grade,
        responseMs: payload.responseMs,
      });
      if (!res.ok) {
        setError(res.error ?? "Gagal menyimpan jawaban");
        return;
      }
      if (res.before !== undefined && res.after !== undefined) {
        const { before, after } = res;
        setChanges((prev) => ({
          ...prev,
          [c.itemId]: {
            label: cardLabel(c),
            before: prev[c.itemId]?.before ?? before,
            after,
          },
        }));
      }
    });
    if (!ok) setMissed((m) => ({ ...m, [c.itemId]: cardLabel(c) }));
    advance(ok);
  }

  if (!card) {
    const right = outcomes.filter((o) => o.ok).length;
    const changeList = Object.values(changes);
    const delta =
      changeList.length > 0
        ? changeList.reduce((sum, c) => sum + (c.after - c.before), 0) / changeList.length
        : 0;
    const empty = outcomes.length === 0;
    return (
      <Shell>
        {!isQuiz && <FinishOnce />}
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-2xl font-semibold">
            {empty
              ? isQuiz
                ? "Belum ada kata untuk dikuis"
                : "Belum ada yang perlu diulang"
              : isQuiz
                ? "Kuis selesai"
                : "Sesi selesai"}
          </p>
          {empty && isQuiz && (
            <p className="max-w-xs text-sm opacity-70">
              Kuis memakai kata yang sudah Anda pelajari. Selesaikan dulu sesi belajar hari ini.
            </p>
          )}
          {!empty && (
            <p className="opacity-70">
              {right} dari {outcomes.length} jawaban tepat.
              {isQuiz && changeList.length > 0 && (
                <>
                  {" "}Rata-rata pemahaman kata{" "}
                  <b className={delta >= 0 ? "text-emerald-600" : "text-red-500"}>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)} poin
                  </b>.
                </>
              )}
            </p>
          )}
        </div>

        {isQuiz && changeList.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm">
            {changeList.map((c, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-current/15 px-3 py-2">
                <span>{c.label}</span>
                <span className="tabular-nums opacity-80">
                  {Math.round(c.before)}% → <b>{Math.round(c.after)}%</b>
                </span>
              </li>
            ))}
          </ul>
        )}
        {isQuiz && Object.keys(missed).length > 0 && (
          <p className="text-sm opacity-70">
            Perlu diulang: {Object.values(missed).join("; ")}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {isQuiz && !empty && (
            <button
              className="rounded-xl bg-emerald-700 px-5 py-2.5 font-medium text-white"
              onClick={() => router.refresh()}
            >
              Kuis lagi
            </button>
          )}
          <Link href="/kosakata" className="rounded-xl border border-current/25 px-5 py-2.5 font-medium">
            Daftar kata
          </Link>
          <Link href="/" className="rounded-xl border border-current/25 px-5 py-2.5 font-medium">
            Beranda
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell progress={`${isQuiz ? "Kuis · " : ""}${Math.min(index + 1, total)} / ${total}`}>
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {card.kind === "lemma" && (
        <LemmaView key={`${card.itemId}-${index}`} card={card} onDone={(ok, ms) =>
          record(card, { exercise: card.exercise, correct: ok, responseMs: ms }, ok)} />
      )}
      {card.kind === "lesson" && (
        <LessonView key={`${card.itemId}-${index}`} card={card} onDone={(ok) =>
          record(card, { exercise: "recognize", correct: ok, responseMs: 5000 }, ok)} />
      )}
      {card.kind === "ayah" && (
        <AyahView key={`${card.itemId}-${index}`} card={card} onDone={(grade) =>
          record(card, { exercise: "translate", grade, responseMs: 5000 }, grade !== "salah")} />
      )}
    </Shell>
  );
}

function FinishOnce() {
  useEffect(() => {
    void finishSession();
  }, []);
  return null;
}

function Shell({ children, progress }: { children: React.ReactNode; progress?: string }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between text-sm opacity-70">
        <Link href="/">← Beranda</Link>
        {progress && <span>{progress}</span>}
      </div>
      {children}
    </main>
  );
}

function Example({ ex, reveal }: { ex: ExampleView; reveal: boolean }) {
  return (
    <div className="rounded-xl border border-current/15 p-4">
      <p className="arab text-2xl" dir="rtl">
        {ex.words.map((w, i) => (
          <span key={i} className={w.target ? "rounded bg-emerald-600/25 px-1" : ""}>
            {w.text}{" "}
          </span>
        ))}
      </p>
      {reveal && (
        <>
          <p className="mt-2 text-sm opacity-80">
            {ex.translation} <span className="opacity-50">(QS {ex.surah}:{ex.ayah})</span>
          </p>
          <CopyButton text={exampleText(ex)} />
        </>
      )}
    </div>
  );
}

/** Teks salinan: ayat Arab, terjemah, dan rujukan surah:ayat. */
function exampleText(ex: ExampleView): string {
  const arab = ex.words.map((w) => w.text).join(" ");
  return `${arab}\n${ex.translation}\n(QS ${ex.surah}:${ex.ayah})`;
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("ok");
    } catch {
      // Cadangan untuk konteks tanpa Clipboard API.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        setState(ok ? "ok" : "fail");
      } catch {
        setState("fail");
      }
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="mt-2 rounded-lg border border-current/25 px-3 py-1 text-xs"
    >
      {state === "ok" ? "Tersalin ✓" : state === "fail" ? "Gagal menyalin" : "Salin ayat & arti"}
    </button>
  );
}

function LemmaView({ card, onDone }: { card: LemmaCard; onDone: (ok: boolean, ms: number) => void }) {
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);
  const [intro, setIntro] = useState(card.isNew);
  const [picked, setPicked] = useState<number | null>(null);

  if (intro) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-emerald-700">Kata baru</p>
        <div className="rounded-2xl border border-emerald-700/30 p-6 text-center">
          <p className="arab text-5xl" dir="rtl">{card.lemmaAr}</p>
          <p className="mt-3 text-xl">{card.gloss}</p>
          {card.rootAr && <p className="mt-1 text-sm opacity-60">akar: <span className="arab">{card.rootAr}</span></p>}
        </div>
        {card.example && <Example ex={card.example} reveal />}
        <button
          className="rounded-xl bg-emerald-700 px-5 py-2.5 font-medium text-white"
          onClick={() => {
            started.current = Date.now();
            setIntro(false);
          }}
        >
          Coba jawab
        </button>
      </div>
    );
  }

  const forward = card.exercise !== "recall";
  const prompt =
    card.exercise === "recall" ? (
      <p className="text-3xl">{card.gloss}</p>
    ) : (
      <p className="arab text-5xl" dir="rtl">{card.lemmaAr}</p>
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm opacity-60">
        {card.exercise === "recall" ? "Pilih tulisan Arab yang tepat" : card.exercise === "context" ? "Apa arti kata yang disorot?" : "Apa artinya?"}
      </p>
      <div className="rounded-2xl border border-current/15 p-6 text-center">{prompt}</div>
      {card.exercise === "context" && card.example && <Example ex={card.example} reveal={picked !== null} />}
      <div className="flex flex-col gap-2">
        {card.options.map((opt, i) => {
          const state =
            picked === null ? "" : i === card.answer ? "border-emerald-600 bg-emerald-600/15" : i === picked ? "border-red-500 bg-red-500/15" : "opacity-50";
          return (
            <button
              key={i}
              disabled={picked !== null}
              onClick={() => setPicked(i)}
              className={`rounded-xl border border-current/25 px-4 py-3 text-left ${state} ${forward ? "" : "arab text-2xl text-center"}`}
              dir={forward ? undefined : "rtl"}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <button
          className="rounded-xl bg-emerald-700 px-5 py-2.5 font-medium text-white"
          onClick={() => onDone(picked === card.answer, Date.now() - started.current)}
        >
          Lanjut
        </button>
      )}
    </div>
  );
}

function LessonView({ card, onDone }: { card: LessonCard; onDone: (ok: boolean) => void }) {
  const [reading, setReading] = useState(card.isNew);
  const [answers, setAnswers] = useState<(number | null)[]>(() => card.exercises.map(() => null));
  const allAnswered = answers.every((a) => a !== null);
  const score = useMemo(
    () => answers.filter((a, i) => a === card.exercises[i].answer).length,
    [answers, card.exercises],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-emerald-700">Pelajaran · {card.title}</p>
      {reading ? (
        <>
          <div className="prose-lesson">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.bodyMd}</ReactMarkdown>
          </div>
          <button className="rounded-xl bg-emerald-700 px-5 py-2.5 font-medium text-white" onClick={() => setReading(false)}>
            Saya sudah baca, mulai latihan
          </button>
        </>
      ) : (
        <>
          {card.exercises.map((ex, qi) => (
            <div key={qi} className="rounded-xl border border-current/15 p-4">
              <p className="arab text-xl" dir="rtl">{ex.q}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ex.options.map((o, oi) => {
                  const a = answers[qi];
                  const state =
                    a === null ? "" : oi === ex.answer ? "border-emerald-600 bg-emerald-600/15" : oi === a ? "border-red-500 bg-red-500/15" : "opacity-50";
                  return (
                    <button
                      key={oi}
                      disabled={a !== null}
                      className={`rounded-lg border border-current/25 px-3 py-1.5 text-sm ${state}`}
                      onClick={() => setAnswers((p) => p.map((x, i) => (i === qi ? oi : x)))}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {allAnswered && (
            <button
              className="rounded-xl bg-emerald-700 px-5 py-2.5 font-medium text-white"
              onClick={() => onDone(score / card.exercises.length >= 0.75)}
            >
              Selesai ({score}/{card.exercises.length} tepat)
            </button>
          )}
        </>
      )}
    </div>
  );
}

function AyahView({ card, onDone }: { card: AyahCard; onDone: (g: "benar" | "sebagian" | "salah") => void }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm opacity-60">
        {card.isNew ? "Ayat terbuka · " : ""}Terjemahkan ayat ini (QS {card.surah}:{card.ayah})
      </p>
      <div className="rounded-2xl border border-current/15 p-6">
        <p className="arab text-3xl" dir="rtl">{card.textAr}</p>
      </div>
      {!shown ? (
        <button className="rounded-xl border border-emerald-700 px-5 py-2.5 font-medium text-emerald-700" onClick={() => setShown(true)}>
          Tampilkan terjemah
        </button>
      ) : (
        <>
          <p className="rounded-xl bg-emerald-700/10 p-4">{card.translation}</p>
          <div className="flex flex-wrap gap-2 text-sm opacity-80">
            {card.words.map((w, i) => (
              <span key={i} className="rounded-lg border border-current/15 px-2 py-1">
                <span className="arab">{w.text}</span> {w.gloss ? `· ${w.gloss}` : ""}
              </span>
            ))}
          </div>
          <p className="text-sm opacity-70">Seberapa tepat terjemahan Anda tadi?</p>
          <div className="grid grid-cols-3 gap-2">
            <button className="rounded-xl bg-emerald-700 py-2.5 text-white" onClick={() => onDone("benar")}>Benar</button>
            <button className="rounded-xl bg-amber-600 py-2.5 text-white" onClick={() => onDone("sebagian")}>Sebagian</button>
            <button className="rounded-xl bg-red-600 py-2.5 text-white" onClick={() => onDone("salah")}>Salah</button>
          </div>
        </>
      )}
    </div>
  );
}
