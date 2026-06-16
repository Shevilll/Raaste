"use client";

import { useEffect } from "react";
import { DAYS, hourLabel } from "@/lib/format";

interface Props {
  hour: number;
  setHour: (h: number) => void;
  dow: number;
  setDow: (d: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
}

export default function TimeControls({
  hour,
  setHour,
  dow,
  setDow,
  playing,
  setPlaying,
}: Props) {
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setHour(hour < 0 ? 0 : (hour + 1) % 24),
      850
    );
    return () => clearInterval(id);
  }, [playing, hour, setHour]);

  const label =
    hour < 0 ? "All day" : `${hourLabel(hour)} – ${hourLabel((hour + 1) % 24)}`;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-10 w-[600px] max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-xl backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Pause" : "Play through the day"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] text-slate-950 hover:bg-amber-400"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={23}
          value={hour < 0 ? 0 : hour}
          onChange={(e) => {
            setPlaying(false);
            setHour(Number(e.target.value));
          }}
          className="h-1 flex-1 cursor-pointer appearance-none rounded bg-[var(--track)] accent-amber-500"
        />
        <span className="w-28 shrink-0 text-right text-xs font-medium tabular-nums text-[var(--text-strong)]">
          {label}
        </span>
        <button
          onClick={() => {
            setPlaying(false);
            setHour(-1);
          }}
          className={`shrink-0 rounded px-2 py-1 text-[11px] ${
            hour < 0
              ? "bg-amber-500 text-slate-950"
              : "bg-[var(--chip)] text-[var(--text-muted)] hover:bg-[var(--track)]"
          }`}
        >
          All hours
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <span className="mr-1 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
          Day
        </span>
        <Chip active={dow < 0} label="All" onClick={() => setDow(-1)} />
        {DAYS.map((d, i) => (
          <Chip
            key={d}
            active={dow === i}
            label={d}
            onClick={() => setDow(dow === i ? -1 : i)}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-[10px] font-medium ${
        active
          ? "bg-amber-500 text-slate-950"
          : "bg-[var(--chip)] text-[var(--text-muted)] hover:bg-[var(--track)]"
      }`}
    >
      {label}
    </button>
  );
}
