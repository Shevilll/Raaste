"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Summary, Hotspot, Point } from "@/lib/types";
import StatsPanel from "@/components/StatsPanel";
import { fmt, hourRange, DAYS } from "@/lib/format";

const HotspotMap = dynamic(() => import("@/components/HotspotMap"), {
  ssr: false,
});

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/data/summary.json").then((r) => r.json()),
      fetch("/data/hotspots.json").then((r) => r.json()),
      fetch("/data/points.json").then((r) => r.json()),
    ])
      .then(([s, h, p]) => {
        if (!alive) return;
        setSummary(s);
        setHotspots(h);
        setPoints(p.points);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const center: [number, number] = summary?.cityCenter ?? [12.97, 77.59];

  return (
    <div className="flex h-screen w-screen flex-col bg-[#070b14] text-slate-200">
      <header className="z-20 flex h-14 items-center justify-between border-b border-slate-800 bg-[#0a0f1c] px-4">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-tight text-white">
            Raa<span className="text-amber-500">ste</span>
          </span>
          <span className="hidden text-xs text-slate-400 sm:inline">
            Parking-Congestion Intelligence · Bengaluru Traffic Police
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Toggle on={showHeatmap} set={setShowHeatmap} label="Heatmap" />
          <Toggle on={showHotspots} set={setShowHotspots} label="Hotspots" />
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <aside className="z-10 flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-800 bg-[#0a0f1c]/95 p-3">
          {summary && <StatsPanel summary={summary} />}
          {selected ? (
            <HotspotDetail h={selected} onBack={() => setSelected(null)} />
          ) : (
            <RankedList hotspots={hotspots} onSelect={setSelected} />
          )}
        </aside>

        <main className="relative flex-1">
          {!loading && summary && (
            <HotspotMap
              center={center}
              hotspots={hotspots}
              points={points}
              showHeatmap={showHeatmap}
              showHotspots={showHotspots}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          )}
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Loading Bengaluru parking data…
            </div>
          )}
          <Legend />
        </main>
      </div>
    </div>
  );
}

function Toggle({
  on,
  set,
  label,
}: {
  on: boolean;
  set: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => set(!on)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        on
          ? "bg-amber-500 text-slate-950"
          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function RankedList({
  hotspots,
  onSelect,
}: {
  hotspots: Hotspot[];
  onSelect: (h: Hotspot) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        Worst hotspots
      </div>
      <div className="mt-2 space-y-1.5">
        {hotspots.slice(0, 40).map((h) => (
          <button
            key={h.id}
            onClick={() => onSelect(h)}
            className="flex w-full items-center gap-2 rounded-md bg-slate-800/40 px-2 py-1.5 text-left hover:bg-slate-800"
          >
            <span className="w-6 shrink-0 text-xs font-semibold text-amber-500">
              #{h.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-slate-200">
                {h.station || h.location || "Unknown"}
              </span>
              <span className="block truncate text-[10px] text-slate-500">
                {fmt(h.count)} violations · peak {hourRange(h.peakHour ?? -1)}
              </span>
            </span>
            <ScoreChip score={h.score} />
          </button>
        ))}
      </div>
    </div>
  );
}

function HotspotDetail({ h, onBack }: { h: Hotspot; onBack: () => void }) {
  const maxH = Math.max(...h.hourly, 1);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <button
        onClick={onBack}
        className="mb-2 text-xs text-slate-400 hover:text-slate-200"
      >
        ← back to list
      </button>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">#{h.rank} hotspot</span>
        <ScoreChip score={h.score} />
      </div>
      <div className="mt-1 text-xs text-slate-300">
        {h.station ? `${h.station} · ` : ""}
        {h.location}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Mini label="Violations" value={fmt(h.count)} />
        <Mini
          label="Peak"
          value={h.peakHour !== null ? hourRange(h.peakHour) : "—"}
        />
        <Mini
          label="Busiest day"
          value={h.peakDow !== null ? DAYS[h.peakDow] : "—"}
        />
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">
        By hour of day
      </div>
      <div className="mt-1 flex h-12 items-end gap-px">
        {h.hourly.map((v, i) => (
          <div
            key={i}
            title={`${i}:00 — ${v}`}
            className={`flex-1 rounded-sm ${
              i === h.peakHour ? "bg-amber-400" : "bg-slate-700"
            }`}
            style={{ height: `${Math.max((v / maxH) * 100, 4)}%` }}
          />
        ))}
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">
        Offences here
      </div>
      <div className="mt-1 space-y-1">
        {h.topTypes.map(([name, c]) => (
          <div
            key={name}
            className="flex justify-between text-[11px] text-slate-300"
          >
            <span className="truncate pr-2">{name}</span>
            <span className="text-slate-500">{fmt(c)}</span>
          </div>
        ))}
      </div>
      {h.vehicle && (
        <div className="mt-2 text-[11px] text-slate-500">
          Most common vehicle: <span className="text-slate-300">{h.vehicle}</span>
        </div>
      )}
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const hue = score >= 75 ? "bg-red-500/20 text-red-300" : score >= 45 ? "bg-amber-500/20 text-amber-300" : "bg-slate-600/30 text-slate-300";
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${hue}`}>
      {score}
    </span>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-800/50 px-2 py-1.5">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="text-xs font-medium text-white">{value}</div>
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-slate-800 bg-[#0a0f1c]/90 px-3 py-2 text-[10px] text-slate-400">
      <div className="mb-1 uppercase tracking-wider">Violation density</div>
      <div className="flex items-center gap-1">
        <span>low</span>
        <div className="h-2 w-28 rounded bg-gradient-to-r from-[#163b6e] via-[#22a0a0] via-40% to-[#d62828]" />
        <span>high</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff6e28]" />
        <span>hotspot (size = impact score)</span>
      </div>
    </div>
  );
}
