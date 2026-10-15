"use client";

import { useEffect, useState } from "react";
import { getDb, localStorageAvailable } from "@/lib/local/db";
import { getLocalStats, type LocalStats } from "@/lib/local/stats";

/** Ringkasan belajar dari data lokal (streak, jatuh tempo, cakupan, indeks) saat offline. */
export default function LocalSummary() {
  const [stats, setStats] = useState<LocalStats | null | undefined>(undefined);

  useEffect(() => {
    const load = localStorageAvailable() ? getLocalStats(getDb()) : Promise.resolve(null);
    load.then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) return null;
  const items: { label: string; value: string }[] = [
    { label: "Streak", value: `${stats.streak} hari${stats.studiedToday ? "" : " (belum hari ini)"}` },
    { label: "Menunggu diulang", value: String(stats.dueNow) },
    { label: "Kata dipelajari", value: String(stats.lemmasOpened) },
    { label: "Cakupan Al-Qur'an", value: `${stats.coveragePct.toFixed(1)}%` },
    { label: "Tingkat pemahaman", value: `${Math.round(stats.indexScore)}` },
  ];
  return (
    <dl className="grid w-full max-w-sm grid-cols-2 gap-2 text-left text-sm">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border border-current/15 px-3 py-2">
          <dt className="text-xs opacity-60">{i.label}</dt>
          <dd className="font-medium">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
