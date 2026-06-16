export function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-[var(--chip)] px-2 py-1.5">
      <div className="text-[10px] uppercase text-[var(--text-faint)]">{label}</div>
      <div className="text-xs font-medium text-[var(--text-strong)]">{value}</div>
    </div>
  );
}

export function ScoreChip({ score }: { score: number }) {
  const hue =
    score >= 75
      ? "bg-red-500/20 text-[var(--danger-text)]"
      : score >= 45
      ? "bg-amber-500/20 text-[var(--accent-text)]"
      : "bg-[var(--chip)] text-[var(--text)]";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${hue}`}
    >
      {score}
    </span>
  );
}
