"use client";

import type { Offenders } from "@/lib/types";
import { fmt } from "@/lib/format";

export default function Offenders({ data }: { data: Offenders }) {
  const top = data.offenders.slice(0, 8);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        Repeat offenders
      </div>

      <div className="mt-1 text-3xl font-semibold text-amber-500">
        {data.top1pct.share}%
      </div>
      <div className="text-xs text-slate-400">
        of all violations come from the top 1% of vehicles (
        {fmt(data.top1pct.vehicles)} of them)
      </div>

      <div className="mt-2 text-xs text-slate-300">
        {fmt(data.repeatOffenders)} vehicles were ticketed more than once.
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">
        Worst offenders
      </div>
      <div className="mt-1 space-y-1">
        {top.map((o) => (
          <div
            key={o.vehicle}
            className="flex items-baseline justify-between gap-2"
          >
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="font-mono text-[11px] text-slate-200">
                {o.vehicle}
              </span>
              <span className="truncate text-[11px] text-slate-500">
                {o.type}
              </span>
            </div>
            <span className="text-xs font-medium text-slate-300">
              {fmt(o.count)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
