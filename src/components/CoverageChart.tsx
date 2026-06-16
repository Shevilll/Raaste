"use client";

import type { Hotspot } from "@/lib/types";

const W = 300;
const H = 100;
const PAD_L = 4;
const PAD_R = 4;
const PAD_T = 8;
const PAD_B = 4;

export default function CoverageChart({
  hotspots,
  totalImpact,
}: {
  hotspots: Hotspot[];
  totalImpact: number;
}) {
  const n = hotspots.length;

  // Cumulative share of total impact covered by the top k zones (k = 1..n).
  // hotspots are pre-sorted by impact descending, so this is monotonically rising.
  const cumPct: number[] = [];
  let running = 0;
  for (let i = 0; i < n; i++) {
    running += hotspots[i].impact;
    cumPct.push(totalImpact > 0 ? (running / totalImpact) * 100 : 0);
  }

  // Smallest N whose cumulative coverage first reaches ~40% of total impact.
  // Fall back to the top 20 (their actual coverage) if 40% is never hit.
  let takeawayN = 0;
  let takeawayPct = 0;
  const threshold = 40;
  for (let i = 0; i < n; i++) {
    if (cumPct[i] >= threshold) {
      takeawayN = i + 1;
      takeawayPct = cumPct[i];
      break;
    }
  }
  if (takeawayN === 0) {
    takeawayN = Math.min(20, n);
    takeawayPct = n > 0 ? cumPct[takeawayN - 1] : 0;
  }

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const xAt = (k: number) =>
    PAD_L + (n <= 1 ? 0 : ((k - 1) / (n - 1)) * plotW);
  const yAt = (pct: number) => PAD_T + (1 - pct / 100) * plotH;

  // Build the curve as an SVG path (start at the first zone's coverage).
  const points = cumPct
    .map((pct, i) => `${xAt(i + 1).toFixed(2)},${yAt(pct).toFixed(2)}`)
    .join(" L ");
  const linePath = n > 0 ? `M ${points}` : "";
  const areaPath =
    n > 0
      ? `M ${xAt(1).toFixed(2)},${yAt(0).toFixed(2)} L ${points} L ${xAt(
          n,
        ).toFixed(2)},${yAt(0).toFixed(2)} Z`
      : "";

  const gridLines = [0, 50, 100];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        Impact concentration
      </div>

      <div className="mt-2 flex gap-1.5">
        <div className="flex flex-col justify-between py-[6px] text-right text-[9px] leading-none text-slate-600">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-[100px] w-full"
          role="img"
          aria-label="Cumulative share of parking-congestion impact by number of zones"
        >
          {gridLines.map((g) => (
            <line
              key={g}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yAt(g)}
              y2={yAt(g)}
              stroke="#334155"
              strokeWidth={0.5}
              strokeDasharray={g === 0 || g === 100 ? undefined : "2 3"}
            />
          ))}

          {areaPath && <path d={areaPath} fill="#f59e0b" fillOpacity={0.15} />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>

      <div className="mt-0.5 flex justify-between pl-[26px] text-[9px] text-slate-600">
        <span>1</span>
        <span>{n}</span>
      </div>

      <p className="mt-2 text-[12px] leading-snug text-slate-300">
        <span className="font-semibold text-amber-400">
          Just {takeawayN} zones
        </span>{" "}
        cover {Math.round(takeawayPct)}% of all parking-congestion impact
      </p>
    </div>
  );
}
