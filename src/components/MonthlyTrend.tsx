"use client";

import { fmt } from "@/lib/format";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parseMonth(key: string): { label: string; long: string } {
  const [year, month] = key.split("-");
  const idx = parseInt(month, 10) - 1;
  const name = MONTHS[idx] ?? key;
  return { label: name, long: `${name} ${year}` };
}

export default function MonthlyTrend({
  monthly,
}: {
  monthly: [string, number][];
}) {
  const max = Math.max(...monthly.map(([, count]) => count), 1);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        Violations over time
      </div>

      <div className="mt-2 flex h-20 items-end gap-1">
        {monthly.map(([key, count]) => {
          const { long } = parseMonth(key);
          return (
            <div
              key={key}
              title={`${long} · ${fmt(count)}`}
              className={`flex-1 rounded-sm ${
                count === max ? "bg-amber-400" : "bg-[var(--track)]"
              }`}
              style={{ height: `${Math.max((count / max) * 100, 3)}%` }}
            />
          );
        })}
      </div>

      <div className="mt-0.5 flex gap-1">
        {monthly.map(([key]) => (
          <div
            key={key}
            className="flex-1 text-center text-[9px] text-[var(--text-faint)]"
          >
            {parseMonth(key).label}
          </div>
        ))}
      </div>
    </div>
  );
}
