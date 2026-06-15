"use client";

import type { Summary } from "@/lib/types";
import { fmt, hourRange } from "@/lib/format";

export default function StatsPanel({ summary }: { summary: Summary }) {
  const peakHour = summary.hourly.indexOf(Math.max(...summary.hourly));
  const maxType = summary.violationTypes[0]?.[1] ?? 1;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        City overview
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">
        {fmt(summary.totalViolations)}
      </div>
      <div className="text-xs text-slate-400">
        parking violations · {summary.dateRange[0]} → {summary.dateRange[1]}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Hotspots" value={fmt(summary.numHotspots)} />
        <Stat label="Peak window" value={hourRange(peakHour)} />
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">
        Top offences
      </div>
      <div className="mt-1 space-y-1.5">
        {summary.violationTypes.slice(0, 6).map(([name, c]) => (
          <div key={name}>
            <div className="flex justify-between text-[11px] text-slate-300">
              <span className="truncate pr-2">{name}</span>
              <span className="text-slate-400">{fmt(c)}</span>
            </div>
            <div className="h-1.5 rounded bg-slate-800">
              <div
                className="h-1.5 rounded bg-amber-500"
                style={{ width: `${(c / maxType) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-800/50 px-2 py-1.5">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="text-sm font-medium text-white">{value}</div>
    </div>
  );
}
