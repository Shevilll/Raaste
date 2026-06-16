"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Congestion, Hotspot } from "@/lib/types";
import { fmt, hourRange } from "@/lib/format";
import { useEscape } from "@/lib/useEscape";

type Mode = "impact" | "congestion";

export default function OptimizerModal({
  hotspots,
  totalImpact,
  teams,
  setTeams,
  congestion,
  onShowRoute,
  onClose,
}: {
  hotspots: Hotspot[];
  totalImpact: number;
  teams: number;
  setTeams: (n: number) => void;
  congestion: Congestion | null;
  onShowRoute?: (zones: Hotspot[]) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("impact");
  useEscape(onClose);

  // Fall back to plain impact ranking if we have no congestion data to lean on.
  const activeMode: Mode = congestion ? mode : "impact";

  // Count of real congestion events logged within range of a hotspot.
  const nearbyOf = (h: Hotspot) => congestion?.nearby[h.id] ?? 0;

  const ranked = useMemo(() => {
    if (activeMode === "congestion" && congestion) {
      // Re-rank everything by impact weighted up by how many congestion
      // events sit on the zone, so we favour spots that are both painful
      // and actually clogged on the ground.
      return [...hotspots].sort((a, b) => {
        const sa = a.impact * (1 + (congestion.nearby[a.id] ?? 0));
        const sb = b.impact * (1 + (congestion.nearby[b.id] ?? 0));
        return sb - sa;
      });
    }
    return hotspots;
  }, [activeMode, congestion, hotspots]);

  const plan = ranked.slice(0, teams);
  const covered = plan.reduce((s, h) => s + h.impact, 0);
  const pct = totalImpact ? Math.round((covered / totalImpact) * 1000) / 10 : 0;
  const violations = plan.reduce((s, h) => s + h.count, 0);
  const planEvents = plan.reduce((s, h) => s + nearbyOf(h), 0);

  const download = () => {
    const rows = [
      [
        "Team",
        "Zone (station)",
        "Location",
        "Deploy at",
        "Impact score",
        "Violations",
        "Congestion nearby",
      ],
    ];
    plan.forEach((h, i) =>
      rows.push([
        String(i + 1),
        h.station || "",
        h.location || "",
        hourRange(h.peakHour ?? -1),
        String(h.score),
        String(h.count),
        String(nearbyOf(h)),
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

  const printPlan = () => {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const modeLabel =
      activeMode === "congestion" ? "Target congestion" : "By impact";

    const body = plan
      .map(
        (h, i) => `
          <tr>
            <td class="num">${i + 1}</td>
            <td>${esc(h.station || "—")}</td>
            <td class="loc">${esc(h.location || "")}</td>
            <td>${esc(hourRange(h.peakHour ?? -1))}</td>
            <td class="num">${h.score}</td>
            <td class="num">${nearbyOf(h)}</td>
          </tr>`
      )
      .join("");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Raaste — Patrol Plan</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111; background: #fff; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #555; font-size: 12px; margin: 0 0 4px; }
  .stat { color: #333; font-size: 13px; margin: 12px 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { background: #f2f2f2; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.loc { color: #555; font-size: 11px; }
  .foot { margin-top: 16px; color: #777; font-size: 11px; }
</style>
</head>
<body>
  <h1>Raaste — Patrol Plan</h1>
  <p class="sub">Bengaluru Traffic Police · parking-congestion enforcement briefing</p>
  <p class="sub">Mode: ${esc(modeLabel)} · ${teams} patrol team${teams > 1 ? "s" : ""}</p>
  <p class="stat">
    Covers ${pct}% of city-wide parking-violation impact.${
      activeMode === "congestion"
        ? ` These ${plan.length} zones sit on ${fmt(planEvents)} logged congestion event${planEvents === 1 ? "" : "s"}.`
        : ""
    }
  </p>
  <table>
    <thead>
      <tr>
        <th class="num">Team</th>
        <th>Station</th>
        <th>Location</th>
        <th>Deploy at</th>
        <th class="num">Score</th>
        <th class="num">Congestion nearby</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
  <p class="foot">${fmt(violations)} violations across ${teams} zones.</p>
</body>
</html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-[660px] flex-col rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Enforcement Optimizer"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text-strong)]">
              Enforcement Optimizer
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Deploy patrol teams to the highest-impact parking zones, at their peak hours
            </div>
          </div>
          <button
            onClick={onClose}
            className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMode("impact")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeMode === "impact"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-[var(--chip)] text-[var(--text)] hover:bg-[var(--track)]"
              }`}
            >
              By impact
            </button>
            {congestion && (
              <button
                onClick={() => setMode("congestion")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeMode === "congestion"
                    ? "bg-amber-500 text-slate-950"
                    : "bg-[var(--chip)] text-[var(--text)] hover:bg-[var(--track)]"
                }`}
              >
                Target congestion
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="shrink-0 text-xs text-[var(--text-muted)]">Patrol teams</span>
            <input
              type="range"
              min={1}
              max={25}
              value={teams}
              onChange={(e) => setTeams(Number(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <span className="w-8 text-right text-sm font-semibold text-[var(--text-strong)]">
              {teams}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-[var(--accent-text)]">{pct}%</span>
            <span className="text-xs text-[var(--text)]">
              of all parking-violation impact city-wide, covered by deploying{" "}
              {teams} team{teams > 1 ? "s" : ""} to these zones.
            </span>
          </div>
          {activeMode === "congestion" && (
            <div className="mt-1.5 text-xs text-[var(--text)]">
              These{" "}
              <span className="font-semibold text-[var(--text-strong)]">{plan.length}</span>{" "}
              zones sit on{" "}
              <span className="font-semibold text-[var(--accent-text)]">
                {fmt(planEvents)}
              </span>{" "}
              logged congestion event{planEvents === 1 ? "" : "s"}.
            </div>
          )}
          <div className="mt-2 h-2 rounded bg-[var(--chip)]">
            <div
              className="h-2 rounded bg-amber-500 transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-2 py-1">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="sticky top-0 bg-[var(--surface)] text-[10px] uppercase text-[var(--text-faint)]">
              <tr>
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">Zone</th>
                <th className="px-2 py-1.5">Deploy at</th>
                <th className="px-2 py-1.5 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((h, i) => {
                const near = nearbyOf(h);
                return (
                  <tr key={h.id} className="border-t border-[var(--border)]">
                    <td className="px-2 py-1.5 align-top font-semibold text-[var(--accent-text)]">
                      {i + 1}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text)]">
                          {h.station || "—"}
                        </span>
                        {congestion && near > 0 && (
                          <span className="rounded bg-[var(--chip)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                            {near} congestion
                          </span>
                        )}
                      </div>
                      <div className="max-w-[300px] truncate text-[10px] text-[var(--text-faint)]">
                        {h.location}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 align-top text-[var(--text)]">
                      {hourRange(h.peakHour ?? -1)}
                    </td>
                    <td className="px-2 py-1.5 text-right align-top text-[var(--text)]">
                      {h.score}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] text-[var(--text-faint)]">
            {fmt(violations)} violations across {teams} zones
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {onShowRoute && (
              <button
                onClick={() => onShowRoute(plan)}
                className="flex-1 whitespace-nowrap rounded-md border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[var(--chip)] sm:flex-none sm:py-1.5"
              >
                Show route on map
              </button>
            )}
            <button
              onClick={printPlan}
              className="flex-1 whitespace-nowrap rounded-md border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[var(--chip)] sm:flex-none sm:py-1.5"
            >
              Print plan
            </button>
            <button
              onClick={download}
              className="w-full whitespace-nowrap rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 sm:w-auto sm:py-1.5"
            >
              Download patrol plan (CSV)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
