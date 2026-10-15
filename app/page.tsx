import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureDailyPlan, getSettings } from "@/lib/server/daily";
import { getHomeStats } from "@/lib/server/stats";
import { signOut } from "./actions";


const MENU = [
  { href: "/baca", label: "Baca", icon: "📖" },
  { href: "/kuis", label: "Kuis", icon: "✏️" },
  { href: "/kosakata", label: "Kata", icon: "🔤" },
  { href: "/pola", label: "Pola", icon: "🧩" },
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

      <nav className="grid grid-cols-5 gap-2">
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
        <Stat label="Streak" value={`${stats.streak} hari`} />
        <Stat label="Kata dikuasai" value={`${stats.lemmasMastered}`} sub={`${stats.lemmasOpened} sudah dibuka`} />
        <Stat label="Kata Al-Qur'an dipahami" value={`${stats.coveragePct.toFixed(1)}%`} />
        <Stat label="Tingkat pemahaman" value={`${stats.comprehension.toFixed(0)}%`} />
      </section>

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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-current/15 p-4">
      <p className="text-xs opacity-60">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}
