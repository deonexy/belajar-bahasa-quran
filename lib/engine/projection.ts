/** Proyeksi tanggal selesai Fase 1 (SPEC_FASE1 F7). */

export interface CoveragePoint {
  /** Tanggal YYYY-MM-DD. */
  date: string;
  /** Cakupan dalam persen (0-100). */
  coverage: number;
}

const DAY_MS = 86_400_000;

function dayIndex(date: string): number {
  return Math.floor(new Date(date + "T00:00:00Z").getTime() / DAY_MS);
}

/** Kenaikan cakupan (poin persen) per minggu: regresi linear atas titik-titik terbaru. */
export function weeklyRate(points: CoveragePoint[]): number | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => dayIndex(p.date));
  const ys = points.map((p) => p.coverage);
  const n = points.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return (num / den) * 7;
}

export type ProjectionStatus =
  | { kind: "reached" }
  | { kind: "no_data" }
  | { kind: "stalled" }
  | { kind: "on_track"; projected: string; weeksAhead: number }
  | { kind: "behind"; projected: string; weeksBehind: number };

/**
 * Tanggal proyeksi = hari ini + (target - sekarang) / laju.
 * On track bila proyeksi <= tenggat; selain itu tertinggal X minggu.
 * Catatan: kurva cakupan berbasis frekuensi melambat, jadi proyeksi linear
 * cenderung terlalu optimistis di bulan-bulan awal.
 */
export function projectCompletion(input: {
  coverageNow: number;
  target: number;
  ratePerWeek: number | null;
  today: string;
  deadline: string;
}): ProjectionStatus {
  const { coverageNow, target, ratePerWeek, today, deadline } = input;
  if (coverageNow >= target) return { kind: "reached" };
  if (ratePerWeek === null) return { kind: "no_data" };
  if (ratePerWeek <= 0) return { kind: "stalled" };

  const weeksNeeded = (target - coverageNow) / ratePerWeek;
  const projectedMs = new Date(today + "T00:00:00Z").getTime() + weeksNeeded * 7 * DAY_MS;
  const projected = new Date(projectedMs).toISOString().slice(0, 10);
  const diffWeeks = (projectedMs - new Date(deadline + "T00:00:00Z").getTime()) / (7 * DAY_MS);

  if (diffWeeks <= 0) {
    return { kind: "on_track", projected, weeksAhead: Math.floor(-diffWeeks) };
  }
  return { kind: "behind", projected, weeksBehind: Math.ceil(diffWeeks) };
}

/** Tenggat default: tanggal mulai + 24 bulan. */
export function defaultDeadline(startDate: string): string {
  const d = new Date(startDate + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + 2);
  return d.toISOString().slice(0, 10);
}
