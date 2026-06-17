"use client";

import { Printer, RotateCcw } from "lucide-react";
import type { BeatSheet } from "@/lib/beatsheet";
import { tally, distanceCoveredKm, elapsedMs, type ShiftLog } from "@/lib/fieldShift";
import { fmt } from "@/lib/format";

export default function ShiftSummary({
  sheet,
  log,
  issuedDate,
  onReset,
}: {
  sheet: BeatSheet;
  log: ShiftLog;
  issuedDate: string;
  onReset: () => void;
}) {
  const t = tally(log);
  const km = distanceCoveredKm(sheet.corners, log);
  const mins = Math.round(elapsedMs(log) / 60_000);

  return (
    <div className="flex flex-col">
      <div className="no-print mb-4 flex items-center gap-2">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          Print / Save PDF
        </button>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-4 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--chip)]"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Start over
        </button>
      </div>

      <article className="print-sheet mx-auto w-full max-w-[820px] bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 print:shadow-none print:ring-0">
        <header className="border-b-2 border-slate-900 px-6 py-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600">
            Bengaluru Traffic Police · Raaste
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Shift Report</h1>
          <div className="mt-1 text-sm text-slate-600">
            {sheet.station} station · {sheet.shift.label} shift · {issuedDate}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-4">
          <Cell label="Actioned" value={`${t.actioned} / ${sheet.corners.length}`} sub="corners" />
          <Cell label="Fines logged" value={`₹${fmt(t.rupees)}`} sub={`${t.issued} issued`} />
          <Cell label="Cleared" value={String(t.cleared)} sub="moved on, no ticket" />
          <Cell label="Patrol" value={`${km.toFixed(1)} km`} sub={mins > 0 ? `${mins} min` : "—"} />
        </div>

        <ol>
          {sheet.corners.map((c) => {
            const e = log.entries[c.hotspot.id];
            const badgeStatus = e ? e.outcome : "pending";
            return (
              <li
                key={c.hotspot.id}
                className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-3"
              >
                <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                  {c.hotspot.location || c.hotspot.station || "Unknown corner"}
                </span>
                <Badge status={badgeStatus} fine={e && e.outcome === "issued" ? e.fine : 0} />
              </li>
            );
          })}
        </ol>

        <footer className="px-6 py-4 text-[10px] leading-relaxed text-slate-500">
          Recorded by the patrolling officer in Raaste field mode. &ldquo;Cleared&rdquo; marks a
          corner where the offending vehicle was moved on without a ticket. Fine values use BTP
          compounding rates. For planning and accountability use.
        </footer>
      </article>
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-slate-900">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Badge({
  status,
  fine,
}: {
  status: "issued" | "cleared" | "skip" | "pending";
  fine: number;
}) {
  const map: Record<string, { text: string; cls: string }> = {
    issued: { text: fine ? `Issued · ₹${fmt(fine)}` : "Issued", cls: "bg-emerald-100 text-emerald-800" },
    cleared: { text: "Cleared", cls: "bg-sky-100 text-sky-800" },
    skip: { text: "Skipped", cls: "bg-slate-100 text-slate-600" },
    pending: { text: "Not reached", cls: "bg-slate-100 text-slate-500" },
  };
  const { text, cls } = map[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {text}
    </span>
  );
}
