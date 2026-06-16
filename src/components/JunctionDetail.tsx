import type { Junction } from "@/lib/types";
import { fmt, hourRange, DAYS } from "@/lib/format";
import { Mini, ScoreChip } from "@/components/Stat";

export default function JunctionDetail({
  j,
  radiusM,
  onBack,
}: {
  j: Junction;
  radiusM: number;
  onBack: () => void;
}) {
  const maxH = Math.max(...j.hourly, 1);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <button
        onClick={onBack}
        className="mb-2 -ml-1 inline-flex min-h-[28px] items-center rounded px-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        ← back to junctions
      </button>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-strong)]">
          #{j.rank} junction
        </span>
        <ScoreChip score={j.score} />
      </div>
      <div className="mt-1 break-words text-xs text-[var(--text)]">
        {j.name}
        {j.code ? (
          <span className="text-[var(--text-faint)]"> · {j.code}</span>
        ) : null}
      </div>
      {j.station && (
        <div className="text-[11px] text-[var(--text-faint)]">{j.station} police station</div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Mini label="Violations" value={fmt(j.count)} />
        <Mini label="Peak" value={j.peakHour !== null ? hourRange(j.peakHour) : "—"} />
        <Mini label="Busiest day" value={j.peakDow !== null ? DAYS[j.peakDow] : "—"} />
      </div>

      <div className="mt-2 rounded bg-[var(--danger-bg)] px-2 py-1.5 text-[11px] text-[var(--danger-text)]">
        {j.congestionNearby} real congestion events within {radiusM}m
        {j.minDistM !== null ? ` · nearest ${j.minDistM}m` : ""}
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        By hour of day
      </div>
      <div className="mt-1 flex h-12 items-end gap-px">
        {j.hourly.map((v, i) => (
          <div
            key={i}
            title={`${i}:00 — ${v}`}
            className={`flex-1 rounded-sm ${
              i === j.peakHour ? "bg-amber-400" : "bg-[var(--track)]"
            }`}
            style={{ height: `${Math.max((v / maxH) * 100, 4)}%` }}
          />
        ))}
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        Offences here
      </div>
      <div className="mt-1 space-y-1">
        {j.topTypes.map(([name, c]) => (
          <div key={name} className="flex justify-between text-[11px] text-[var(--text)]">
            <span className="truncate pr-2">{name}</span>
            <span className="text-[var(--text-faint)]">{fmt(c)}</span>
          </div>
        ))}
      </div>
      {j.vehicle && (
        <div className="mt-2 text-[11px] text-[var(--text-faint)]">
          Most common vehicle: <span className="text-[var(--text)]">{j.vehicle}</span>
        </div>
      )}
    </div>
  );
}
