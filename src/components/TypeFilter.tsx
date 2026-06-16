"use client";

export default function TypeFilter({
  legend,
  selected,
  onSelect,
}: {
  legend: string[];
  selected: number | null;
  onSelect: (idx: number | null) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
          Violation type
        </span>
        {selected !== null && (
          <button
            onClick={() => onSelect(null)}
            className="text-[10px] text-amber-400 hover:text-amber-300"
          >
            clear ✕
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <button
          onClick={() => onSelect(null)}
          className={`rounded px-2 py-0.5 text-[10px] ${
            selected === null
              ? "bg-amber-500 text-slate-950"
              : "bg-[var(--chip)] text-[var(--text)] hover:bg-[var(--track)]"
          }`}
        >
          All
        </button>
        {legend.map((name, i) => (
          <button
            key={name}
            onClick={() => onSelect(selected === i ? null : i)}
            title={name}
            className={`max-w-[140px] truncate rounded px-2 py-0.5 text-[10px] ${
              selected === i
                ? "bg-amber-500 text-slate-950"
                : "bg-[var(--chip)] text-[var(--text)] hover:bg-[var(--track)]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
