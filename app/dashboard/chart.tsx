import type { CoveragePoint } from "@/lib/engine";

/** Grafik garis sederhana (SVG), dirender di server. */
export default function CoverageChart({
  points,
  target,
}: {
  points: CoveragePoint[];
  target: number;
}) {
  if (points.length === 0) {
    return <p className="text-sm opacity-60">Belum ada data. Grafik muncul setelah hari pertama belajar.</p>;
  }
  const W = 320;
  const H = 140;
  const pad = { l: 28, r: 8, t: 8, b: 18 };
  const maxY = Math.max(target, ...points.map((p) => p.coverage), 1) * 1.05;
  const x = (i: number) =>
    pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.coverage).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik cakupan token per minggu">
      <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} stroke="currentColor" strokeDasharray="4 4" opacity="0.4" />
      <text x={pad.l - 4} y={y(target) + 3} fontSize="9" textAnchor="end" fill="currentColor" opacity="0.6">
        {target.toFixed(0)}%
      </text>
      <text x={pad.l - 4} y={y(0) + 3} fontSize="9" textAnchor="end" fill="currentColor" opacity="0.6">
        0%
      </text>
      <path d={path} fill="none" stroke="#059669" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.coverage)} r="2.5" fill="#059669" />
      ))}
      <text x={pad.l} y={H - 4} fontSize="9" fill="currentColor" opacity="0.6">
        {points[0].date}
      </text>
      <text x={W - pad.r} y={H - 4} fontSize="9" textAnchor="end" fill="currentColor" opacity="0.6">
        {points[points.length - 1].date}
      </text>
    </svg>
  );
}
