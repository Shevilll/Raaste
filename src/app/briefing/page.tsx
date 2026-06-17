"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import type { Summary, Hotspot, Congestion, Fines } from "@/lib/types";
import { buildBeatSheet, SHIFTS, type BeatCorner } from "@/lib/beatsheet";
import { fmt, hourRange } from "@/lib/format";
import OnPhoneQR from "@/components/field/OnPhoneQR";

// Round to a whole number once we're into double digits, otherwise keep one decimal
// so small per-day expectations don't all collapse to "0".
const r1 = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);

export default function BriefingPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [congestion, setCongestion] = useState<Congestion | null>(null);
  const [fines, setFines] = useState<Fines | null>(null);
  const [station, setStation] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string>("morning");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const getJSON = async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url} → ${r.status}`);
      return r.json();
    };
    (async () => {
      try {
        const [s, h, c, f] = await Promise.all([
          getJSON("/data/summary.json"),
          getJSON("/data/hotspots.json"),
          getJSON("/data/congestion.json"),
          getJSON("/data/fines.json"),
        ]);
        if (!alive) return;
        setSummary(s);
        setHotspots(h);
        setCongestion(c);
        setFines(f);
        // seed the station / shift from sessionStorage so a link opens straight to a
        // briefing without leaking the selection into the URL
        const us = sessionStorage.getItem("raaste:station");
        const ush = sessionStorage.getItem("raaste:shift");
        setStation(
          us && s.topStations.some((t: [string, number, number]) => t[0] === us)
            ? us
            : s.topStations[0]?.[0] ?? null
        );
        if (ush && SHIFTS.some((x) => x.id === ush)) setShiftId(ush);
        setLoading(false);
      } catch (e) {
        console.warn("briefing data load failed", e);
        if (alive) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // remember the selection (without touching the URL) so a refresh stays put
  useEffect(() => {
    if (!station) return;
    sessionStorage.setItem("raaste:station", station);
    sessionStorage.setItem("raaste:shift", shiftId);
  }, [station, shiftId]);

  const sheet = useMemo(() => {
    if (!station) return null;
    return buildBeatSheet({
      station,
      shiftId,
      hotspots,
      congestion,
      fines,
      dateRange: summary?.dateRange,
    });
  }, [station, shiftId, hotspots, congestion, fines, summary]);

  const issued = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const radiusM = congestion?.correlation.radiusM ?? 300;

  return (
    <div className="briefing-root flex h-[100dvh] flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Controls — never printed */}
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--chip)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--track)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Map
        </Link>
        <span className="text-sm font-semibold text-[var(--text-strong)]">
          Patrol beat sheet
        </span>
        <select
          value={station ?? ""}
          onChange={(e) => setStation(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-xs text-[var(--text)]"
          aria-label="Police station"
        >
          {summary?.topStations.map(([name]) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1">
          {SHIFTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setShiftId(s.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                shiftId === s.id
                  ? "bg-amber-500 text-slate-950"
                  : "text-[var(--text-muted)] hover:bg-[var(--chip)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {station && (
          <OnPhoneQR station={station} shiftId={shiftId} />
        )}
        <button
          onClick={() => window.print()}
          className="ml-auto rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
        >
          Print / Save PDF
        </button>
      </div>

      <div className="briefing-scroll flex-1 overflow-y-auto bg-[var(--bg)] p-4 sm:p-8 print:overflow-visible print:bg-white print:p-0">
        {loading && (
          <div className="mx-auto max-w-[820px] py-20 text-center text-sm text-[var(--text-muted)]">
            Loading briefing…
          </div>
        )}
        {error && (
          <div className="mx-auto max-w-[820px] py-20 text-center text-sm text-[var(--text-muted)]">
            Couldn&apos;t load the briefing data.
          </div>
        )}
        {sheet && !loading && (
          <article className="print-sheet mx-auto w-full max-w-[820px] bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 print:shadow-none print:ring-0">
            {/* Masthead */}
            <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 px-6 py-6 sm:px-8">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600">
                  Bengaluru Traffic Police · Raaste
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  Patrol Beat Sheet
                </h1>
                <div className="mt-1 text-sm text-slate-600">
                  {sheet.station} station · {sheet.shift.label} shift ({sheet.shift.sub})
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                <div>Issued</div>
                <div className="font-medium text-slate-700">{issued}</div>
              </div>
            </header>

            {/* Shift summary */}
            <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-4">
              <SummaryStat label="Corners" value={String(sheet.corners.length)} />
              <SummaryStat
                label="Expected / day"
                value={`≈ ${r1(sheet.totalExpectedPerDay)}`}
                sub="violations this shift"
              />
              <SummaryStat
                label="Patrol loop"
                value={`${sheet.totalKm.toFixed(1)} km`}
                sub="in visiting order"
              />
              <SummaryStat
                label="If enforced"
                value={`≈ ₹${fmt(Math.round(sheet.rupeesPerDay))}`}
                sub="recoverable / day"
              />
            </div>

            {/* Corner cards */}
            <ol>
              {sheet.corners.map((c) => (
                <CornerRow key={c.hotspot.id} c={c} radiusM={radiusM} />
              ))}
              {sheet.corners.length === 0 && (
                <li className="px-8 py-10 text-center text-sm text-slate-500">
                  No recorded violations for {sheet.station} in the {sheet.shift.label}{" "}
                  shift.
                </li>
              )}
            </ol>

            {/* Method footer */}
            <footer className="border-t border-slate-200 px-6 py-4 text-[10px] leading-relaxed text-slate-500 sm:px-8">
              Corners are this station&apos;s parking hotspots ranked by recorded violations
              in the shift window, ordered into a nearest-neighbour patrol loop. &ldquo;Expected
              / day&rdquo; averages the {sheet.days}-day enforcement record; fine values use
              BTP compounding rates. Congestion flags are real ASTraM events within {radiusM} m.
              Built from Bengaluru Traffic Police enforcement data — for planning use.
            </footer>
          </article>
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-slate-900">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function CornerRow({ c, radiusM }: { c: BeatCorner; radiusM: number }) {
  const h = c.hotspot;
  return (
    <li className="flex gap-4 border-b border-slate-100 px-6 py-4 sm:px-8">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
        {c.order}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="truncate font-semibold text-slate-900">
            {h.location || h.station || "Unknown corner"}
          </div>
          <div className="shrink-0 text-[10px] uppercase tracking-wider text-slate-400">
            city hotspot #{h.rank}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {c.topOffence} · mostly {c.vehicle}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          <Field label="Expected" value={`≈ ${r1(c.expectedPerDay)}/day`} />
          <Field label="Peak window" value={hourRange(c.peakHour)} />
          <Field label="Vehicle" value={c.vehicle} />
          <Field label="If enforced" value={`≈ ₹${fmt(Math.round(c.rupeesPerDay))}/day`} />
        </div>

        {c.congestionNearby > 0 && (
          <div className="mt-2 inline-flex items-start gap-1 rounded bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>
              {c.congestionNearby} real congestion event
              {c.congestionNearby === 1 ? "" : "s"} within {radiusM} m
              {c.congestionM != null ? ` · nearest ${c.congestionM} m` : ""}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="truncate text-xs font-medium text-slate-800">{value}</div>
    </div>
  );
}
