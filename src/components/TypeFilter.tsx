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
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">
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
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
