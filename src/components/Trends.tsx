"use client";

import type { Summary } from "@/lib/types";
import { DAYS, hourLabel, fmt } from "@/lib/format";

export default function Trends({
  summary,
  hour,
  dow,
}: {
  summary: Summary;
  hour: number;
  dow: number;
}) {
  const maxH = Math.max(...summary.hourly, 1);
  const maxD = Math.max(...summary.daily, 1);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        When violations happen
      </div>

      <div className="mt-2 text-[10px] text-slate-500">By hour (IST)</div>
      <div className="mt-1 flex h-16 items-end gap-px">
        {summary.hourly.map((v, i) => (
          <div
            key={i}
            title={`${hourLabel(i)} · ${fmt(v)}`}
            className={`flex-1 rounded-sm ${
              i === hour ? "bg-amber-400" : "bg-slate-700"
            }`}
            style={{ height: `${Math.max((v / maxH) * 100, 3)}%` }}
          />
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-slate-600">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>

      <div className="mt-3 text-[10px] text-slate-500">By day of week</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {summary.daily.map((v, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="flex h-12 w-full items-end justify-center">
              <div
                title={`${DAYS[i]} · ${fmt(v)}`}
                className={`w-3.5 rounded-sm ${
                  i === dow ? "bg-amber-400" : "bg-slate-700"
                }`}
                style={{ height: `${Math.max((v / maxD) * 100, 5)}%` }}
              />
            </div>
            <div className="mt-0.5 text-[9px] text-slate-500">{DAYS[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
