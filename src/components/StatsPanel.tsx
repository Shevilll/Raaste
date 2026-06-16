"use client";

import type { Summary } from "@/lib/types";
import { fmt, hourRange } from "@/lib/format";

export default function StatsPanel({ summary }: { summary: Summary }) {
  const peakHour = summary.hourly.indexOf(Math.max(...summary.hourly));
  const maxType = summary.violationTypes[0]?.[1] ?? 1;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        City overview
      </div>
      <div className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">
        {fmt(summary.totalViolations)}
      </div>
      <div className="text-xs text-[var(--text-muted)]">
        parking violations · {summary.dateRange[0]} → {summary.dateRange[1]}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Hotspots" value={fmt(summary.numHotspots)} />
        <Stat label="Peak window" value={hourRange(peakHour)} />
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        Top offences
      </div>
      <div className="mt-1 space-y-1.5">
        {summary.violationTypes.slice(0, 6).map(([name, c]) => (
          <div key={name}>
            <div className="flex justify-between text-[11px] text-[var(--text)]">
              <span className="truncate pr-2">{name}</span>
              <span className="text-[var(--text-muted)]">{fmt(c)}</span>
            </div>
            <div className="h-1.5 rounded bg-[var(--chip)]">
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
    <div className="rounded bg-[var(--chip)] px-2 py-1.5">
      <div className="text-[10px] uppercase text-[var(--text-faint)]">{label}</div>
      <div className="text-sm font-medium text-[var(--text-strong)]">{value}</div>
    </div>
  );
}
