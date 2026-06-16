"use client";

import { X } from "lucide-react";

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
            className="inline-flex items-center gap-1 text-[10px] text-[var(--accent-text)] hover:opacity-80"
          >
            clear
            <X className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 lg:gap-1">
        <button
          onClick={() => onSelect(null)}
          className={`rounded px-2.5 py-1 text-[11px] lg:px-2 lg:py-0.5 lg:text-[10px] ${
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
            className={`max-w-[160px] truncate rounded px-2.5 py-1 text-[11px] lg:max-w-[140px] lg:px-2 lg:py-0.5 lg:text-[10px] ${
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
