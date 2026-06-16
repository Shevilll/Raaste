"use client";

import type { Hotspot } from "@/lib/types";
import { fmt, hourRange } from "@/lib/format";

export default function OptimizerModal({
  hotspots,
  totalImpact,
  teams,
  setTeams,
  onClose,
}: {
  hotspots: Hotspot[];
  totalImpact: number;
  teams: number;
  setTeams: (n: number) => void;
  onClose: () => void;
}) {
  const plan = hotspots.slice(0, teams);
  const covered = plan.reduce((s, h) => s + h.impact, 0);
  const pct = totalImpact ? Math.round((covered / totalImpact) * 1000) / 10 : 0;
  const violations = plan.reduce((s, h) => s + h.count, 0);

  const download = () => {
    const rows = [
      ["Team", "Zone (station)", "Location", "Deploy at", "Impact score", "Violations"],
    ];
    plan.forEach((h, i) =>
      rows.push([
        String(i + 1),
        h.station || "",
        h.location || "",
        hourRange(h.peakHour ?? -1),
        String(h.score),
        String(h.count),
      ])
    );
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "raaste-patrol-plan.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-[660px] max-w-full flex-col rounded-xl border border-slate-700 bg-[#0a0f1c] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-white">
              Enforcement Optimizer
            </div>
            <div className="text-[11px] text-slate-400">
              Deploy patrol teams to the highest-impact parking zones, at their peak hours
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-xs text-slate-400">Patrol teams</span>
            <input
              type="range"
              min={1}
              max={25}
              value={teams}
              onChange={(e) => setTeams(Number(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <span className="w-8 text-right text-sm font-semibold text-white">
              {teams}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-amber-400">{pct}%</span>
            <span className="text-xs text-slate-300">
              of all parking-violation impact city-wide, covered by deploying{" "}
              {teams} team{teams > 1 ? "s" : ""} to these zones.
            </span>
          </div>
          <div className="mt-2 h-2 rounded bg-slate-800">
            <div
              className="h-2 rounded bg-amber-500 transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#0a0f1c] text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">Zone</th>
                <th className="px-2 py-1.5">Deploy at</th>
                <th className="px-2 py-1.5 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((h, i) => (
                <tr key={h.id} className="border-t border-slate-800/60">
                  <td className="px-2 py-1.5 align-top font-semibold text-amber-500">
                    {i + 1}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-slate-200">{h.station || "—"}</div>
                    <div className="max-w-[300px] truncate text-[10px] text-slate-500">
                      {h.location}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 align-top text-slate-300">
                    {hourRange(h.peakHour ?? -1)}
                  </td>
                  <td className="px-2 py-1.5 text-right align-top text-slate-300">
                    {h.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
          <span className="text-[11px] text-slate-500">
            {fmt(violations)} violations across {teams} zones
          </span>
          <button
            onClick={download}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            Download patrol plan (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}
