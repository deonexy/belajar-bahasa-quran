"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface WordRow {
  id: number;
  arab: string;
  gloss: string;
  pos: string;
  root: string | null;
  freq: number;
  level: number;
  status: string;
  percent: number;
  dueAt: string;
  seen: boolean;
}

type Sort = "lemah" | "kuat" | "frekuensi" | "jatuh-tempo";
type Filter = "semua" | "belum-kokoh" | "kokoh";

const STATUS: Record<string, string> = {
  learning: "Belajar",
  review: "Review",
  mastered: "Dikuasai",
  suspended: "Ditunda",
};

function dueLabel(iso: string, now: number): string {
  const days = Math.ceil((new Date(iso).getTime() - now) / 86400_000);
  if (days <= 0) return "jatuh tempo";
  if (days === 1) return "besok";
  return `${days} hari lagi`;
}

export default function WordList({ words }: { words: WordRow[] }) {
  const [sort, setSort] = useState<Sort>("lemah");
  const [filter, setFilter] = useState<Filter>("semua");
  const [q, setQ] = useState("");
  const [now] = useState(() => Date.now());

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = words.filter((w) => {
      if (filter === "belum-kokoh" && w.status === "mastered") return false;
      if (filter === "kokoh" && w.status !== "mastered") return false;
      if (!needle) return true;
      return w.gloss.toLowerCase().includes(needle) || w.arab.includes(q.trim());
    });
    const cmp: Record<Sort, (a: WordRow, b: WordRow) => number> = {
      lemah: (a, b) => a.percent - b.percent || b.freq - a.freq,
      kuat: (a, b) => b.percent - a.percent || b.freq - a.freq,
      frekuensi: (a, b) => b.freq - a.freq,
      "jatuh-tempo": (a, b) => a.dueAt.localeCompare(b.dueAt),
    };
    return [...list].sort(cmp[sort]);
  }, [words, sort, filter, q]);

  if (words.length === 0) {
    return (
      <p className="rounded-xl border border-current/15 p-4 text-sm opacity-80">
        Belum ada kata yang dipelajari. Mulai dari{" "}
        <Link href="/belajar" className="underline">sesi belajar</Link> hari ini.
      </p>
    );
  }

  const avg = Math.round(words.reduce((s, w) => s + w.percent, 0) / words.length);
  const mastered = words.filter((w) => w.status === "mastered").length;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Summary label="Kata" value={String(words.length)} />
        <Summary label="Dikuasai" value={String(mastered)} />
        <Summary label="Rata-rata paham" value={`${avg}%`} />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari kata atau arti"
          className="min-w-0 flex-1 rounded-lg border border-current/30 bg-transparent px-3 py-1.5 text-sm"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-lg border border-current/30 bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="semua">Semua</option>
          <option value="belum-kokoh">Belum dikuasai</option>
          <option value="kokoh">Dikuasai</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-current/30 bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="lemah">Terlemah dulu</option>
          <option value="kuat">Terkuat dulu</option>
          <option value="frekuensi">Paling sering di Al-Qur&apos;an</option>
          <option value="jatuh-tempo">Jatuh tempo terdekat</option>
        </select>
      </div>

      <ul className="flex flex-col gap-2">
        {shown.map((w) => (
          <li key={w.id} className="rounded-xl border border-current/15 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="arab text-2xl leading-tight" dir="rtl">{w.arab}</p>
                <p className="text-sm">{w.gloss}</p>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{w.percent}%</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-current/10">
              <div
                className={`h-full ${w.percent >= 80 ? "bg-emerald-600" : w.percent >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${w.percent}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs opacity-60">
              {STATUS[w.status] ?? w.status} · level {w.level}/3 · muncul {w.freq}× di Al-Qur&apos;an
              {w.seen ? ` · ulang ${dueLabel(w.dueAt, now)}` : " · belum dijawab"}
            </p>
          </li>
        ))}
        {shown.length === 0 && <li className="text-sm opacity-60">Tidak ada kata yang cocok.</li>}
      </ul>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-current/15 p-2">
      <p className="text-xs opacity-60">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
