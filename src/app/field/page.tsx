"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Summary, Hotspot, Congestion, Fines } from "@/lib/types";
import { buildBeatSheet, SHIFTS } from "@/lib/beatsheet";
import BeatPicker from "@/components/field/BeatPicker";
import FieldShift from "@/components/field/FieldShift";

export default function FieldPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [congestion, setCongestion] = useState<Congestion | null>(null);
  const [fines, setFines] = useState<Fines | null>(null);
  const [station, setStation] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string>("morning");
  const [ready, setReady] = useState(false);
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

        // Read the beat from the URL once. An unknown station falls back to the picker.
        const p = new URLSearchParams(window.location.search);
        const us = p.get("s");
        const ush = p.get("shift");
        if (us && s.topStations.some((t: [string, number, number]) => t[0] === us)) {
          setStation(us);
        }
        if (ush && SHIFTS.some((x) => x.id === ush)) setShiftId(ush);
        setReady(true);
        setLoading(false);
      } catch (e) {
        console.warn("field data load failed", e);
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

  const start = (s: string, sh: string) => {
    setStation(s);
    setShiftId(sh);
    const qs = `?s=${encodeURIComponent(s)}&shift=${sh}`;
    window.history.replaceState(null, "", `/field${qs}`);
  };

  const sheet = useMemo(() => {
    if (!station || !summary) return null;
    return buildBeatSheet({
      station,
      shiftId,
      hotspots,
      congestion,
      fines,
      dateRange: summary.dateRange,
    });
  }, [station, shiftId, hotspots, congestion, fines, summary]);

  const radiusM = congestion?.correlation.radiusM ?? 300;

  return (
    <div className="field-root flex min-h-[100dvh] flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="no-print sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--chip)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--track)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Map
        </Link>
        <span className="text-sm font-semibold text-[var(--text-strong)]">
          Raa<span className="text-[var(--accent-text)]">ste</span> field
        </span>
        {station && (
          <span className="ml-auto truncate text-xs text-[var(--text-muted)]">{station}</span>
        )}
      </header>

      <main className="field-scroll flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 print:overflow-visible">
        {loading && (
          <div className="py-20 text-center text-sm text-[var(--text-muted)]">Loading…</div>
        )}
        {error && (
          <div className="py-20 text-center text-sm text-[var(--text-muted)]">
            Couldn&apos;t load the patrol data.
          </div>
        )}
        {ready && summary && !station && (
          <BeatPicker summary={summary} onStart={start} />
        )}
        {ready && sheet && station && (
          <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
            {sheet.corners.length === 0 ? (
              <div className="py-20 text-center text-sm text-[var(--text-muted)]">
                No recorded violations for {station} in the{" "}
                {SHIFTS.find((s) => s.id === shiftId)?.label} shift.{" "}
                <button
                  onClick={() => {
                    setStation(null);
                    window.history.replaceState(null, "", "/field");
                  }}
                  className="text-[var(--accent-text)] underline"
                >
                  pick another beat
                </button>
              </div>
            ) : (
              <FieldShift key={`${station}|${shiftId}`} sheet={sheet} radiusM={radiusM} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
