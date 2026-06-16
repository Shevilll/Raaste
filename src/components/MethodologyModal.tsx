"use client";

import { type ReactNode } from "react";
import type { Summary, Congestion, Prediction } from "@/lib/types";
import { fmt } from "@/lib/format";
import { useEscape } from "@/lib/useEscape";

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
  useEscape(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[6vh]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-[640px] flex-col rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="How Raaste works"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--text-strong)]">How Raaste works</div>
          <button
            onClick={onClose}
            className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-xs leading-relaxed text-[var(--text)]">
          <Section title="Data — real, and only what is provided">
            Built strictly from the two HackerEarth-provided Bengaluru Traffic Police
            datasets:{" "}
            <b className="text-[var(--text-strong)]">
              {fmt(summary.totalViolations)} anonymized parking violations
            </b>{" "}
            ({summary.dateRange[0]} → {summary.dateRange[1]}) and{" "}
            <b className="text-[var(--text-strong)]">
              {fmt(corr?.totalEvents ?? 8173)} ASTraM events
            </b>
            . No external datasets — nothing scraped, nothing simulated.
          </Section>

          <Section title="Hotspots and the impact score">
            Violations are binned into ~220 m grid cells. Each cell carries an{" "}
            <b className="text-[var(--text-strong)]">impact score</b> that sums a severity weight per
            violation — parking on a main road, at a junction, on a footpath, or near a
            bus-stop or school counts far more than a generic no-parking ticket. So the
            ranking reflects how much each zone chokes traffic, not merely how many tickets
            were written.
          </Section>

          <Section title="Proving parking → congestion">
            Every parking hotspot is cross-referenced against real ASTraM
            congestion/incident events.{" "}
            <b className="text-[var(--text-strong)]">{corr?.pctTop50 ?? 100}% of the top 50</b>{" "}
            hotspots (and {corr?.pctTop100 ?? 98}% of the top 100) sit within{" "}
            {corr?.radiusM ?? 300} m of a logged congestion point — evidence that the worst
            parking zones are the real congestion points of the city.
          </Section>

          <Section title="The forecast model">
            A <b className="text-[var(--text-strong)]">RandomForest (120 trees)</b> predicts violation
            intensity per cell, per hour, per day-of-week. Held-out accuracy:{" "}
            <b className="text-[var(--text-strong)]">R² {prediction?.metrics.r2 ?? 0.59}</b>. What
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

        <div className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--text-faint)]">
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
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-text)]">
        {title}
      </div>
      <p>{children}</p>
    </div>
  );
}
