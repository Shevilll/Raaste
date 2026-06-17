"use client";

import type { ReactNode } from "react";
import { Navigation, Check, Ban, SkipForward, ArrowLeft, TriangleAlert } from "lucide-react";
import type { BeatCorner } from "@/lib/beatsheet";
import type { Outcome } from "@/lib/fieldShift";
import { fmt, hourRange } from "@/lib/format";

export default function CornerCard({
  corner,
  index,
  total,
  distanceKm,
  radiusM,
  canBack,
  onNavigate,
  onOutcome,
  onBack,
}: {
  corner: BeatCorner;
  index: number; // 0-based position among all corners
  total: number;
  distanceKm: number | null;
  radiusM: number;
  canBack: boolean;
  onNavigate: () => void;
  onOutcome: (o: Outcome) => void;
  onBack: () => void;
}) {
  const h = corner.hotspot;
  const dist =
    distanceKm == null
      ? null
      : distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m away`
        : `${distanceKm.toFixed(1)} km away`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>
          Corner {index + 1} of {total}
        </span>
        {canBack && (
          <button
            onClick={onBack}
            className="-mr-1 inline-flex min-h-[28px] items-center gap-1 rounded px-1 py-1 text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            back
          </button>
        )}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-[var(--chip)]">
        <div
          className="h-full rounded bg-amber-500"
          style={{ width: `${(index / Math.max(total, 1)) * 100}%` }}
        />
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-[var(--text-strong)]">
          {h.location || h.station || "Unknown corner"}
        </h2>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
          city #{h.rank}
        </span>
      </div>
      <div className="mt-0.5 text-sm text-[var(--text-muted)]">
        {corner.topOffence} · mostly {corner.vehicle}
      </div>
      {dist && (
        <div className="mt-1 text-sm font-medium text-[var(--accent-text)]">{dist}</div>
      )}

      {corner.congestionNearby > 0 && (
        <div className="mt-3 inline-flex items-start gap-1.5 self-start rounded-md bg-[var(--danger-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--danger-text)]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {corner.congestionNearby} real congestion event
            {corner.congestionNearby === 1 ? "" : "s"} within {radiusM} m
            {corner.congestionM != null ? ` · nearest ${corner.congestionM} m` : ""}
          </span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Expected today" value={`≈ ${Math.round(corner.expectedPerDay)}`} />
        <Stat label="Peak window" value={hourRange(corner.peakHour)} />
        <Stat label="If enforced" value={`≈ ₹${fmt(Math.round(corner.rupeesPerDay))}`} />
      </div>

      <button
        onClick={onNavigate}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400"
      >
        <Navigation className="h-4 w-4" aria-hidden />
        Navigate
      </button>

      <div className="mt-auto grid grid-cols-3 gap-2 pt-6">
        <Action
          label="Issued"
          icon={<Check className="h-4 w-4" aria-hidden />}
          className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          onClick={() => onOutcome("issued")}
        />
        <Action
          label="Cleared"
          icon={<Ban className="h-4 w-4" aria-hidden />}
          className="bg-sky-500 text-slate-950 hover:bg-sky-400"
          onClick={() => onOutcome("cleared")}
        />
        <Action
          label="Skip"
          icon={<SkipForward className="h-4 w-4" aria-hidden />}
          className="bg-[var(--chip)] text-[var(--text)] hover:bg-[var(--track)]"
          onClick={() => onOutcome("skip")}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--chip)] px-2 py-2">
      <div className="text-[9px] uppercase tracking-wider text-[var(--text-faint)]">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-[var(--text-strong)]">
        {value}
      </div>
    </div>
  );
}

function Action({
  label,
  icon,
  className,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}
