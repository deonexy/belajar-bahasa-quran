import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSettings, localDate } from "@/lib/server/daily";
import { computeStreak } from "@/lib/server/stats";
import {
  defaultDeadline,
  projectCompletion,
  weeklyRate,
  type CoveragePoint,
} from "@/lib/engine";
import CoverageChart from "./chart";

export default function DashboardPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between text-sm opacity-70">
        <Link href="/">← Beranda</Link>
      </div>
      <h1 className="text-xl font-semibold">Target Fase 1</h1>
      <Suspense fallback={<p className="text-sm opacity-60">Memuat dashboard...</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso + "T00:00:00Z"),
  );
}

/** Titik terakhir tiap minggu (awal minggu Senin) untuk grafik. */
function weeklyPoints(points: CoveragePoint[]): CoveragePoint[] {
  const byWeek = new Map<string, CoveragePoint>();
  for (const p of points) {
    const d = new Date(p.date + "T00:00:00Z");
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    byWeek.set(monday, p); // poin terurut naik: yang terakhir menang
  }
  return [...byWeek.values()];
}

async function Content() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user!;
  const settings = await getSettings(supabase, user.id);
  const today = localDate(settings.timezone);

  // Segarkan titik hari ini agar angka dan grafik sama dengan kondisi sekarang.
  await supabase.rpc("take_daily_snapshot", { p_user: user.id });

  const targetPct = settings.target_token_coverage * 100;
  const deadline = settings.phase1_deadline ?? defaultDeadline(settings.start_date);

  const [{ data: stats }, { data: needed }, { data: dayRows }, lessonsTotal, lessonsPassed] =
    await Promise.all([
      supabase
        .from("daily_stats")
        .select("stat_date,coverage_pct,lemmas_mastered,roots_mastered,comprehension,test_accuracy_4w")
        .eq("user_id", user.id)
        .order("stat_date"),
      supabase.rpc("lemmas_needed_for_target", { p_target: settings.target_token_coverage }),
      supabase.rpc("review_days", { p_tz: settings.timezone }),
      supabase.from("lessons").select("id", { count: "exact", head: true }),
      supabase
        .from("user_items")
        .select("item_id,items!inner(kind)", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("items.kind", "lesson")
        .eq("ever_reached_one", true),
    ]);

  const rows = (stats ?? []) as {
    stat_date: string;
    coverage_pct: number | null;
    lemmas_mastered: number | null;
    roots_mastered: number | null;
    test_accuracy_4w: number | null;
  }[];
  const latest = rows[rows.length - 1];
  const coverage = Number(latest?.coverage_pct ?? 0);
  const lemmas = Number(latest?.lemmas_mastered ?? 0);
  const roots = Number(latest?.roots_mastered ?? 0);
  const lemmasLeft = typeof needed === "number" ? needed : null;

  const points: CoveragePoint[] = rows.map((r) => ({
    date: r.stat_date,
    coverage: Number(r.coverage_pct ?? 0),
  }));
  const since = new Date(new Date(today + "T00:00:00Z").getTime() - 28 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const recent = points.filter((p) => p.date >= since);
  const rate = weeklyRate(recent);
  const status = projectCompletion({ coverageNow: coverage, target: targetPct, ratePerWeek: rate, today, deadline });

  const days = ((dayRows ?? []) as unknown as (string | Record<string, string>)[]).map((d) =>
    typeof d === "string" ? d : Object.values(d)[0],
  );
  const streak = computeStreak(days, settings.timezone);

  const nLessons = lessonsTotal.count ?? 0;
  const nPassed = lessonsPassed.count ?? 0;

  const banner =
    status.kind === "reached"
      ? { tone: "ok", text: "Target cakupan tercapai." }
      : status.kind === "on_track"
        ? { tone: "ok", text: `On track. Proyeksi tercapai ${fmtDate(status.projected)}.` }
        : status.kind === "behind"
          ? { tone: "warn", text: `Tertinggal ${status.weeksBehind} minggu. Proyeksi ${fmtDate(status.projected)}.` }
          : status.kind === "stalled"
            ? { tone: "warn", text: "Cakupan belum naik dalam 4 minggu terakhir." }
            : { tone: "info", text: "Belum cukup data untuk proyeksi. Belajar beberapa hari dulu." };

  const tone =
    banner.tone === "ok"
      ? "border-emerald-600/40 bg-emerald-600/10"
      : banner.tone === "warn"
        ? "border-amber-500/50 bg-amber-500/10"
        : "border-current/20";

  return (
    <>
      <section className={`rounded-2xl border p-4 ${tone}`}>
        <p className="font-medium">{banner.text}</p>
        <p className="mt-1 text-xs opacity-70">
          Tenggat {fmtDate(deadline)}
          {rate !== null && ` · laju ${rate.toFixed(2)} poin/minggu (4 minggu terakhir)`}
        </p>
        {lemmasLeft !== null && coverage < targetPct && (
          <p className="mt-1 text-xs opacity-70">
            Sisa kata yang dibutuhkan untuk target: <b>{lemmasLeft}</b> lemma (urut frekuensi). Proyeksi linear
            cenderung terlalu optimistis di awal karena kurva melambat.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Measure label="Cakupan token Al-Qur'an" value={`${coverage.toFixed(1)}%`} target={`≥ ${targetPct.toFixed(0)}%`} ratio={coverage / targetPct} />
        <Measure
          label="Lemma dikuasai"
          value={String(lemmas)}
          target={lemmasLeft !== null ? `target ± ${lemmas + lemmasLeft}` : undefined}
          ratio={lemmasLeft !== null && lemmas + lemmasLeft > 0 ? lemmas / (lemmas + lemmasLeft) : undefined}
        />
        <Measure label="Akar kata dikuasai" value={String(roots)} target="target menyusul" />
        <Measure
          label="Akurasi tes ayat acak"
          value={latest?.test_accuracy_4w != null ? `${Number(latest.test_accuracy_4w).toFixed(0)}%` : "belum tersedia"}
          target="≥ 80%"
        />
        <Measure
          label="Kurikulum nahwu-sharaf"
          value={`${nPassed} / ${nLessons} unit lulus`}
          target="100%"
          ratio={nLessons > 0 ? nPassed / nLessons : 0}
        />
      </section>

      <section className="rounded-2xl border border-current/15 p-4">
        <p className="mb-2 text-sm font-medium">Cakupan token per minggu</p>
        <CoverageChart points={weeklyPoints(points)} target={targetPct} />
      </section>

      <section className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-current/15 p-4">
          <p className="text-xs opacity-60">Streak</p>
          <p className="text-2xl font-semibold">{streak} hari</p>
        </div>
        <div className="rounded-2xl border border-current/15 p-4">
          <p className="text-xs opacity-60">Hari belajar tercatat</p>
          <p className="text-2xl font-semibold">{days.length}</p>
        </div>
      </section>
    </>
  );
}

function Measure({
  label,
  value,
  target,
  ratio,
}: {
  label: string;
  value: string;
  target?: string;
  ratio?: number;
}) {
  const pct = ratio === undefined ? undefined : Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="rounded-xl border border-current/15 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm">{label}</p>
        <p className="font-semibold tabular-nums">{value}</p>
      </div>
      {pct !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-current/10">
          <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
        </div>
      )}
      {target && <p className="mt-1 text-xs opacity-60">Target: {target}</p>}
    </div>
  );
}
