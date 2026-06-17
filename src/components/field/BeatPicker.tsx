"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Summary } from "@/lib/types";
import { SHIFTS } from "@/lib/beatsheet";

export default function BeatPicker({
  summary,
  onStart,
}: {
  summary: Summary;
  onStart: (station: string, shiftId: string) => void;
}) {
  const [station, setStation] = useState(summary.topStations[0]?.[0] ?? "");
  const [shiftId, setShiftId] = useState("morning");

  return (
    <div className="mx-auto w-full max-w-sm">
      <h2 className="text-lg font-semibold text-[var(--text-strong)]">Start a patrol</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Pick your station and shift to load your patrol corners.
      </p>

      <label
        htmlFor="beat-station"
        className="mt-5 block text-[11px] uppercase tracking-wider text-[var(--text-faint)]"
      >
        Police station
      </label>
      <select
        id="beat-station"
        value={station}
        onChange={(e) => setStation(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        {summary.topStations.map(([name]) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <p className="mt-4 block text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        Shift
      </p>
      <div
        role="group"
        aria-label="Shift"
        className="mt-1 grid grid-cols-3 gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1"
      >
        {SHIFTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setShiftId(s.id)}
            className={`rounded-md px-2 py-2 text-xs font-medium ${
              shiftId === s.id
                ? "bg-amber-500 text-slate-950"
                : "text-[var(--text-muted)] hover:bg-[var(--chip)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => station && onStart(station, shiftId)}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400"
      >
        Start patrol
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
