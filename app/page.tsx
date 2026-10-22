import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureDailyPlan, getSettings } from "@/lib/server/daily";
import { getHomeStats } from "@/lib/server/stats";
import { comprehensionIndex, streakTier, type StreakTier } from "@/lib/engine";
import { signOut } from "./actions";


const MENU = [
  { href: "/baca", label: "Baca", icon: "📖" },
  { href: "/kuis", label: "Kuis", icon: "✏️" },
  { href: "/kosakata", label: "Kata", icon: "🔤" },
  { href: "/pola", label: "Pola", icon: "🧩" },
  { href: "/pelajaran", label: "Pelajaran", icon: "📚" },
  { href: "/dashboard", label: "Target", icon: "📈" },
];

export default function Home() {
  return (
    <Suspense fallback={<p className="p-8 text-sm opacity-60">Memuat...</p>}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user!;
  const settings = await getSettings(supabase, user.id);
  const plan = await ensureDailyPlan(supabase, user.id, settings);
  const stats = await getHomeStats(supabase, user.id, settings.timezone);

  const index = comprehensionIndex({
    tokenCoverage: stats.coveragePct,
    memoryStrength: stats.comprehension,
    retention: stats.lemmasOpened > 0 ? plan.retention7d * 100 : 0,
    grammar: stats.grammar,
    ayat: stats.ayat,
  });

  const { count: dueNow } = await supabase
    .from("user_items")
    .select("item_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "suspended")
    .lte("due_at", new Date().toISOString());

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-5 py-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Belajar Bahasa Al-Qur&apos;an</h1>
        </div>
        <form action={signOut}>
          <button className="text-sm underline opacity-60">Keluar</button>
        </form>
      </header>

      <section className="rounded-2xl border border-emerald-700/30 bg-emerald-700/5 p-5">
        <p className="text-sm opacity-70">Hari ini</p>
        <p className="mt-1 text-3xl font-semibold">
          {dueNow ?? 0} <span className="text-base font-normal opacity-70">item menunggu</span>
        </p>
        <p className="mt-2 text-sm">{plan.reason}</p>
        <Link
          href="/belajar"
          className="mt-4 inline-block rounded-xl bg-emerald-700 px-5 py-2.5 font-medium text-white"
        >
          {(dueNow ?? 0) > 0 ? "Mulai belajar" : "Lihat sesi"}
        </Link>
      </section>

      <nav className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {MENU.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex flex-col items-center gap-1 rounded-2xl border border-current/15 py-3 text-xs font-medium active:bg-emerald-700/10"
          >
            <span className="text-2xl" aria-hidden>{m.icon}</span>
            {m.label}
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-3">
        <StreakCard streak={stats.streak} studiedToday={stats.studiedToday} />
        <Stat
          label="Penguasaan kata"
          value={`${stats.avgMastery.toFixed(0)}%`}
          sub={`rata-rata · ${stats.lemmasMastered} dikuasai dari ${stats.lemmasOpened} dibuka`}
        />
        <Stat
          wide
          label="Kata dipelajari"
          value={`${stats.lemmasOpened}`}
          sub={`kata unik · ${stats.learnedUniquePct.toFixed(1)}% dari ${stats.totalLemmas.toLocaleString("id-ID")} kata unik, ${stats.lemmasMastered} sudah dikuasai`}
        />
      </section>

      <TokenBar known={stats.learnedTokens} total={stats.totalWords} />

      <IndexCard index={index} />

      <details className="rounded-2xl border border-current/15 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Kondisi mastery gate</summary>
        <ul className="mt-2 space-y-1 opacity-80">
          <li>Retensi 7 hari: {Math.round(plan.retention7d * 100)}%</li>
          <li>Review menunggu: {plan.backlog}</li>
          <li>Kata belum kokoh: {plan.learningPile}</li>
          <li>Kuota item baru hari ini: {plan.newQuota}</li>
        </ul>
      </details>
    </main>
  );
}

function Stat({ label, value, sub, wide }: { label: string; value: string; sub?: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-current/15 p-4 ${wide ? "col-span-2" : ""}`}>
      <p className="text-xs opacity-60">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}

const TIER: Record<StreakTier, { icon: string; box: string; text: string; note: string }> = {
  hot: {
    icon: "🔥",
    box: "border-red-500/50 bg-gradient-to-br from-red-600/30 to-orange-500/20",
    text: "text-red-500 dark:text-orange-300",
    note: "Membara! Pertahankan",
  },
  warm: {
    icon: "🔥",
    box: "border-orange-400/50 bg-orange-500/15",
    text: "text-orange-600 dark:text-orange-300",
    note: "Hangat, terus lanjut",
  },
  cold: {
    icon: "🥶",
    box: "border-sky-500/40 bg-slate-500/15",
    text: "text-sky-700 dark:text-sky-300",
    note: "Belajar hari ini agar tidak putus",
  },
  freeze: {
    icon: "❄️",
    box: "border-cyan-400/50 bg-cyan-400/15",
    text: "text-cyan-700 dark:text-cyan-300",
    note: "Beku, mulai lagi hari ini",
  },
};

function StreakCard({ streak, studiedToday }: { streak: number; studiedToday: boolean }) {
  const t = TIER[streakTier(streak, studiedToday)];
  return (
    <div className={`rounded-2xl border p-4 ${t.box}`}>
      <p className="text-xs opacity-70">Streak</p>
      <p className={`mt-1 text-2xl font-semibold ${t.text}`}>
        <span aria-hidden>{t.icon}</span> {streak} hari
      </p>
      <p className="text-xs opacity-70">{t.note}</p>
    </div>
  );
}

function IndexCard({ index }: { index: ReturnType<typeof comprehensionIndex> }) {
  return (
    <details className="rounded-2xl border border-current/15 p-4">
      <summary className="cursor-pointer list-none">
        <p className="text-xs opacity-60">Tingkat pemahaman</p>
        <p className="mt-1 text-3xl font-semibold">{index.score.toFixed(1)}%</p>
        <p className="text-xs opacity-60">gabungan 5 parameter · ketuk untuk rincian</p>
      </summary>
      <ul className="mt-3 space-y-2 text-xs">
        {index.parts.map((p) => (
          <li key={p.key}>
            <div className="flex justify-between">
              <span>{p.label} <span className="opacity-50">({Math.round(p.weight * 100)}%)</span></span>
              <span>{p.value.toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-black/10 dark:bg-white/15">
              <div className="h-1.5 rounded bg-emerald-600" style={{ width: `${p.value}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function TokenBar({ known, total }: { known: number; total: number }) {
  const pct = total > 0 ? (known / total) * 100 : 0;
  return (
    <section className="rounded-2xl border border-emerald-700/30 bg-emerald-700/5 p-4">
      <p className="text-xs opacity-60">Kata di Al-Qur&apos;an yang sudah kamu kenali</p>
      <p className="mt-1 text-2xl font-semibold">
        {known.toLocaleString("id-ID")}{" "}
        <span className="text-sm font-normal opacity-70">
          dari {total.toLocaleString("id-ID")} kata ({pct.toFixed(1)}%)
        </span>
      </p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
        <div
          className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-lime-400"
          style={{ width: `${Math.max(pct, known > 0 ? 2 : 0)}%` }}
        />
      </div>
      <p className="mt-2 text-xs opacity-60">
        Setiap kata yang muncul berulang dihitung tiap kemunculannya, jadi kata sering seperti min dan Allah
        langsung menambah banyak.
      </p>
    </section>
  );
}
