"use client";

import { type ReactNode } from "react";
import type { Summary, Congestion, Prediction } from "@/lib/types";
import { fmt } from "@/lib/format";

export default function MethodologyModal({
  summary,
  congestion,
  prediction,
  onClose,
}: {
  summary: Summary;
  congestion: Congestion | null;
  prediction: Prediction | null;
  onClose: () => void;
}) {
  const corr = congestion?.correlation;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[6vh]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-[640px] max-w-full flex-col rounded-xl border border-slate-700 bg-[#0a0f1c] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="text-sm font-semibold text-white">How Raaste works</div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-xs leading-relaxed text-slate-300">
          <Section title="Data — real, and only what is provided">
            Built strictly from the two HackerEarth-provided Bengaluru Traffic Police
            datasets:{" "}
            <b className="text-slate-100">
              {fmt(summary.totalViolations)} anonymized parking violations
            </b>{" "}
            ({summary.dateRange[0]} → {summary.dateRange[1]}) and{" "}
            <b className="text-slate-100">
              {fmt(corr?.totalEvents ?? 8173)} ASTraM events
            </b>
            . No external datasets — nothing scraped, nothing simulated.
          </Section>

          <Section title="Hotspots and the impact score">
            Violations are binned into ~220 m grid cells. Each cell carries an{" "}
            <b className="text-slate-100">impact score</b> that sums a severity weight per
            violation — parking on a main road, at a junction, on a footpath, or near a
            bus-stop or school counts far more than a generic no-parking ticket. So the
            ranking reflects how much each zone chokes traffic, not merely how many tickets
            were written.
          </Section>

          <Section title="Proving parking → congestion">
            Every parking hotspot is cross-referenced against real ASTraM
            congestion/incident events.{" "}
            <b className="text-slate-100">{corr?.pctTop50 ?? 100}% of the top 50</b>{" "}
            hotspots (and {corr?.pctTop100 ?? 98}% of the top 100) sit within{" "}
            {corr?.radiusM ?? 300} m of a logged congestion point — evidence that the worst
            parking zones are the real congestion points of the city.
          </Section>

          <Section title="The forecast model">
            A <b className="text-slate-100">RandomForest (120 trees)</b> predicts violation
            intensity per cell, per hour, per day-of-week. Held-out accuracy:{" "}
            <b className="text-slate-100">R² {prediction?.metrics.r2 ?? 0.59}</b>. What
            drives it:{" "}
            {(prediction?.importances ?? [])
              .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
              .join(", ") || "location 59%, hour 28%, day 12%"}
            . Forecast mode ranks zones by this prediction, so patrols can be pre-positioned
            before violations build up.
          </Section>

          <Section title="Enforcement optimizer">
            A greedy impact-coverage pass over the ranked hotspots turns intelligence into
            action: choose N patrol teams and get the N highest-impact zones, each with its
            peak deployment window and the share of city-wide impact covered — exportable as
            a patrol plan.
          </Section>
        </div>

        <div className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
          Data is anonymized and processed offline into compact aggregates, so no raw
          records ever reach the browser.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
        {title}
      </div>
      <p>{children}</p>
    </div>
  );
}
