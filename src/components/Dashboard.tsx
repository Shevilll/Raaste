"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type {
  Summary,
  Hotspot,
  Point,
  Congestion,
  Prediction,
  Offenders as OffendersData,
} from "@/lib/types";
import StatsPanel from "@/components/StatsPanel";
import Trends from "@/components/Trends";
import TimeControls from "@/components/TimeControls";
import OptimizerModal from "@/components/OptimizerModal";
import MethodologyModal from "@/components/MethodologyModal";
import TypeFilter from "@/components/TypeFilter";
import IntroTour from "@/components/IntroTour";
import Offenders from "@/components/Offenders";
import CoverageChart from "@/components/CoverageChart";
import MonthlyTrend from "@/components/MonthlyTrend";
import ThemeToggle from "@/components/ThemeToggle";
import { planRoute } from "@/lib/route";
import { fmt, hourRange, hourLabel, DAYS } from "@/lib/format";

const HotspotMap = dynamic(() => import("@/components/HotspotMap"), {
  ssr: false,
});

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [congestion, setCongestion] = useState<Congestion | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [offenders, setOffenders] = useState<OffendersData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [station, setStation] = useState<string | null>(null);
  const [typeIdx, setTypeIdx] = useState<number | null>(null);
  const [hour, setHour] = useState(-1);
  const [dow, setDow] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showCongestion, setShowCongestion] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [teams, setTeams] = useState(8);
  const [route, setRoute] = useState<{ zones: Hotspot[]; km: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/data/summary.json").then((r) => r.json()),
      fetch("/data/hotspots.json").then((r) => r.json()),
      fetch("/data/points.json").then((r) => r.json()),
      fetch("/data/congestion.json").then((r) => r.json()),
      fetch("/data/prediction.json").then((r) => r.json()),
      fetch("/data/offenders.json").then((r) => r.json()),
    ])
      .then(([s, h, p, c, pr, off]) => {
        if (!alive) return;
        setSummary(s);
        setHotspots(h);
        setPoints(p.points);
        setCongestion(c);
        setPrediction(pr);
        setOffenders(off);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // restore a shared view from the URL on first load
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const n = (k: string) => Number(p.get(k));
    if (p.has("h")) setHour(n("h"));
    if (p.has("d")) setDow(n("d"));
    if (p.has("s")) setStation(p.get("s"));
    if (p.has("t")) setTypeIdx(n("t"));
    if (p.has("heat")) setShowHeatmap(p.get("heat") !== "0");
    if (p.has("hot")) setShowHotspots(p.get("hot") !== "0");
    if (p.has("cong")) setShowCongestion(p.get("cong") === "1");
    if (p.has("fc")) setShowForecast(p.get("fc") === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the URL in sync so the current view can be shared / bookmarked
  useEffect(() => {
    const p = new URLSearchParams();
    if (hour >= 0) p.set("h", String(hour));
    if (dow >= 0) p.set("d", String(dow));
    if (station) p.set("s", station);
    if (typeIdx !== null) p.set("t", String(typeIdx));
    if (!showHeatmap) p.set("heat", "0");
    if (!showHotspots) p.set("hot", "0");
    if (showCongestion) p.set("cong", "1");
    if (showForecast) p.set("fc", "1");
    const qs = p.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname
    );
  }, [
    hour,
    dow,
    station,
    typeIdx,
    showHeatmap,
    showHotspots,
    showCongestion,
    showForecast,
  ]);

  const center: [number, number] = summary?.cityCenter ?? [12.97, 77.59];

  // heatmap points filtered by the active hour / day
  const filteredPoints = useMemo(() => {
    if (hour < 0 && dow < 0 && typeIdx === null) return points;
    return points.filter(
      (p) =>
        (hour < 0 || p[4] === hour) &&
        (dow < 0 || p[5] === dow) &&
        (typeIdx === null || p[2] === typeIdx)
    );
  }, [points, hour, dow, typeIdx]);

  // hotspots: model-predicted when Forecast is on, else historical (re-ranked by hour/day)
  const displayHotspots = useMemo(() => {
    const base = station
      ? hotspots.filter((h) => h.station === station)
      : hotspots;
    if (showForecast && prediction?.forecast) {
      const fc = prediction.forecast;
      const fv = (h: Hotspot) =>
        hour >= 0
          ? fc[h.id]?.[hour] ?? 0
          : (fc[h.id] ?? []).reduce((a, b) => a + b, 0);
      const scored = base.map((h) => ({ h, v: fv(h) })).filter((x) => x.v > 0);
      const max = Math.max(...scored.map((x) => x.v), 1);
      return scored
        .sort((a, b) => b.v - a.v)
        .map((x, i) => ({
          ...x.h,
          rank: i + 1,
          count: Math.round(x.v),
          score: Math.round((1000 * x.v) / max) / 10,
        }));
    }
    if (hour < 0 && dow < 0) return base;
    const valOf = (h: Hotspot) =>
      hour >= 0 ? h.hourly[hour] ?? 0 : h.daily[dow] ?? 0;
    const scored = base.map((h) => ({ h, v: valOf(h) })).filter((x) => x.v > 0);
    const max = Math.max(...scored.map((x) => x.v), 1);
    return scored
      .sort((a, b) => b.v - a.v)
      .map((x, i) => ({
        ...x.h,
        rank: i + 1,
        count: x.v,
        score: Math.round((1000 * x.v) / max) / 10,
      }));
  }, [hotspots, station, hour, dow, showForecast, prediction]);

  const focusBounds = useMemo<
    [[number, number], [number, number]] | null
  >(() => {
    if (!station) return null;
    const hs = hotspots.filter((h) => h.station === station);
    if (!hs.length) return null;
    const lats = hs.map((h) => h.lat);
    const lngs = hs.map((h) => h.lng);
    return [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
  }, [station, hotspots]);

  const selectedHotspot = selectedId
    ? hotspots.find((h) => h.id === selectedId) ?? null
    : null;

  const listTitle = showForecast
    ? hour >= 0
      ? `Predicted at ${hourLabel(hour)}`
      : "Predicted hotspots"
    : station
    ? station
    : hour >= 0
    ? `Worst at ${hourLabel(hour)}`
    : dow >= 0
    ? `Worst on ${DAYS[dow]}`
    : "Worst hotspots";

  return (
    <div className="flex h-screen w-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="z-20 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-tight text-[var(--text-strong)]">
            Raa<span className="text-[var(--accent-text)]">ste</span>
          </span>
          <span className="hidden text-xs text-[var(--text-muted)] sm:inline">
            Parking-Congestion Intelligence · Bengaluru Traffic Police
          </span>
          <button
            onClick={() => setMethodOpen(true)}
            className="hidden text-xs text-[var(--text-faint)] underline-offset-2 hover:text-amber-400 hover:underline sm:inline"
          >
            How it works
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOptimizerOpen(true)}
            className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            ⚡ Patrol plan
          </button>
          <Toggle on={showHeatmap} set={setShowHeatmap} label="Heatmap" />
          <Toggle on={showHotspots} set={setShowHotspots} label="Hotspots" />
          <Toggle
            on={showCongestion}
            set={setShowCongestion}
            label="Congestion"
          />
          {prediction && (
            <Toggle on={showForecast} set={setShowForecast} label="Forecast" />
          )}
          <Toggle on={showLive} set={setShowLive} label="Live" />
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <aside className="z-10 flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-3">
          {summary && <StatsPanel summary={summary} />}
          {congestion && (
            <ProofPanel c={congestion} onShow={() => setShowCongestion(true)} />
          )}
          {summary && (
            <CoverageChart hotspots={hotspots} totalImpact={summary.totalImpact} />
          )}
          {summary && <Trends summary={summary} hour={hour} dow={dow} />}
          {summary?.monthly && <MonthlyTrend monthly={summary.monthly} />}
          {prediction && <ModelCard p={prediction} />}
          {offenders && <Offenders data={offenders} />}
          {selectedHotspot ? (
            <HotspotDetail
              h={selectedHotspot}
              congestion={congestion}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <>
              {summary && (
                <StationFilter
                  stations={summary.topStations}
                  active={station}
                  onSelect={setStation}
                />
              )}
              {summary && (
                <TypeFilter
                  legend={summary.typeLegend}
                  selected={typeIdx}
                  onSelect={setTypeIdx}
                />
              )}
              <RankedList
                hotspots={displayHotspots}
                title={listTitle}
                onSelect={setSelectedId}
              />
            </>
          )}
        </aside>

        <main className="relative flex-1">
          {!loading && summary && (
            <>
              <TimeControls
                hour={hour}
                setHour={setHour}
                dow={dow}
                setDow={setDow}
                playing={playing}
                setPlaying={setPlaying}
              />
              <HotspotMap
                center={center}
                hotspots={displayHotspots}
                points={filteredPoints}
                showHeatmap={showHeatmap}
                showHotspots={showHotspots}
                congestion={congestion?.events ?? []}
                showCongestion={showCongestion}
                showLive={showLive}
                selectedId={selectedId}
                focusBounds={focusBounds}
                route={route?.zones ?? null}
                onSelect={(h) => setSelectedId(h ? h.id : null)}
              />
            </>
          )}
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              Loading Bengaluru parking data…
            </div>
          )}
          {route && (
            <button
              onClick={() => setRoute(null)}
              className="absolute left-3 top-3 z-10 rounded-full border border-amber-500/60 bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-amber-300 shadow-lg hover:bg-amber-500/10"
            >
              Patrol route · {route.km.toFixed(1)} km · clear ✕
            </button>
          )}
          <Legend />
        </main>
      </div>

      {optimizerOpen && summary && (
        <OptimizerModal
          hotspots={hotspots}
          totalImpact={summary.totalImpact}
          teams={teams}
          setTeams={setTeams}
          congestion={congestion}
          onShowRoute={(zones) => {
            const r = planRoute(zones);
            setRoute({ zones: r.order.map((i) => zones[i]), km: r.km });
            setOptimizerOpen(false);
          }}
          onClose={() => setOptimizerOpen(false)}
        />
      )}

      {methodOpen && summary && (
        <MethodologyModal
          summary={summary}
          congestion={congestion}
          prediction={prediction}
          onClose={() => setMethodOpen(false)}
        />
      )}

      <IntroTour />
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
          : "bg-[var(--chip)] text-[var(--text-muted)] hover:bg-[var(--track)]"
      }`}
    >
      {label}
    </button>
  );
}

function ModelCard({ p }: { p: Prediction }) {
  const maxImp = Math.max(...p.importances.map((i) => i[1]), 0.001);
  const a = p.sample.actual;
  const pr = p.sample.predicted;
  const maxA = Math.max(...a, 1);
  const maxP = Math.max(...pr, 1);
  return (
    <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--info-text)]">
        AI forecast model
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-[var(--text-strong)]">
          R² {p.metrics.r2.toFixed(2)}
        </span>
        <span className="text-[10px] text-[var(--text-faint)]">
          held-out · MAE {p.metrics.mae.toFixed(2)}
        </span>
      </div>
      <div className="text-[11px] text-[var(--text-muted)]">
        {p.model} — predicts violations by location &amp; time
      </div>

      <div className="mt-2 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
        What drives it
      </div>
      <div className="mt-1 space-y-1">
        {p.importances.map(([name, v]) => (
          <div key={name}>
            <div className="flex justify-between text-[10px] text-[var(--text)]">
              <span>{name}</span>
              <span className="text-[var(--text-faint)]">{Math.round(v * 100)}%</span>
            </div>
            <div className="h-1.5 rounded bg-[var(--chip)]">
              <div
                className="h-1.5 rounded bg-sky-400"
                style={{ width: `${(v / maxImp) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
        Daily pattern · predicted vs actual
      </div>
      <div className="mt-1 flex h-12 gap-px">
        {a.map((v, i) => (
          <div key={i} className="relative h-full flex-1">
            <div
              className="absolute bottom-0 w-full rounded-sm bg-[var(--track)]"
              style={{ height: `${(v / maxA) * 100}%` }}
            />
            <div
              className="absolute bottom-0 w-full rounded-sm bg-sky-400/70"
              style={{ height: `${(pr[i] / maxP) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-3 text-[9px] text-[var(--text-faint)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-slate-600" />
          actual
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-sky-400/70" />
          predicted
        </span>
      </div>
    </div>
  );
}

function ProofPanel({ c, onShow }: { c: Congestion; onShow: () => void }) {
  const x = c.correlation;
  return (
    <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--danger-text)]">
        Parking → congestion
      </div>
      <div className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">
        {x.pctTop50}%
      </div>
      <div className="text-xs text-[var(--text)]">
        of the top 50 parking hotspots sit within {x.radiusM}m of a real ASTraM
        congestion event ({x.pctTop100}% of the top 100).
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-faint)]">
        <span>{fmt(x.totalEvents)} ASTraM events cross-referenced</span>
        <button
          onClick={onShow}
          className="text-[var(--danger-text)] hover:opacity-80"
        >
          show on map →
        </button>
      </div>
    </div>
  );
}

function StationFilter({
  stations,
  active,
  onSelect,
}: {
  stations: [string, number, number][];
  active: string | null;
  onSelect: (s: string | null) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
          By police station
        </span>
        {active && (
          <button
            onClick={() => onSelect(null)}
            className="text-[10px] text-[var(--accent-text)] hover:opacity-80"
          >
            clear ✕
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {stations.slice(0, 12).map(([name, count]) => (
          <button
            key={name}
            onClick={() => onSelect(active === name ? null : name)}
            title={`${fmt(count)} violations`}
            className={`rounded px-2 py-0.5 text-[10px] ${
              active === name
                ? "bg-amber-500 text-slate-950"
                : "bg-[var(--chip)] text-[var(--text)] hover:bg-[var(--track)]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function RankedList({
  hotspots,
  title,
  onSelect,
}: {
  hotspots: Hotspot[];
  title: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        {title}
      </div>
      <div className="mt-2 space-y-1.5">
        {hotspots.length === 0 && (
          <div className="text-[11px] text-[var(--text-faint)]">
            No hotspots for this filter.
          </div>
        )}
        {hotspots.slice(0, 40).map((h) => (
          <button
            key={h.id}
            onClick={() => onSelect(h.id)}
            className="flex w-full items-center gap-2 rounded-md bg-[var(--chip)] px-2 py-1.5 text-left hover:bg-[var(--chip)]"
          >
            <span className="w-6 shrink-0 text-xs font-semibold text-[var(--accent-text)]">
              #{h.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-[var(--text)]">
                {h.station || h.location || "Unknown"}
              </span>
              <span className="block truncate text-[10px] text-[var(--text-faint)]">
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

function HotspotDetail({
  h,
  congestion,
  onBack,
}: {
  h: Hotspot;
  congestion: Congestion | null;
  onBack: () => void;
}) {
  const maxH = Math.max(...h.hourly, 1);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <button
        onClick={onBack}
        className="mb-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        ← back to list
      </button>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-strong)]">
          #{h.rank} hotspot
        </span>
        <ScoreChip score={h.score} />
      </div>
      <div className="mt-1 text-xs text-[var(--text)]">
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

      {congestion && (
        <div className="mt-2 rounded bg-[var(--danger-bg)] px-2 py-1.5 text-[11px] text-[var(--danger-text)]">
          {congestion.nearby[h.id] ?? 0} real congestion events within{" "}
          {congestion.correlation.radiusM}m
          {congestion.minDistM[h.id] !== undefined
            ? ` · nearest ${congestion.minDistM[h.id]}m`
            : ""}
        </div>
      )}

      <div className="mt-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        By hour of day
      </div>
      <div className="mt-1 flex h-12 items-end gap-px">
        {h.hourly.map((v, i) => (
          <div
            key={i}
            title={`${i}:00 — ${v}`}
            className={`flex-1 rounded-sm ${
              i === h.peakHour ? "bg-amber-400" : "bg-[var(--track)]"
            }`}
            style={{ height: `${Math.max((v / maxH) * 100, 4)}%` }}
          />
        ))}
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        Offences here
      </div>
      <div className="mt-1 space-y-1">
        {h.topTypes.map(([name, c]) => (
          <div
            key={name}
            className="flex justify-between text-[11px] text-[var(--text)]"
          >
            <span className="truncate pr-2">{name}</span>
            <span className="text-[var(--text-faint)]">{fmt(c)}</span>
          </div>
        ))}
      </div>
      {h.vehicle && (
        <div className="mt-2 text-[11px] text-[var(--text-faint)]">
          Most common vehicle:{" "}
          <span className="text-[var(--text)]">{h.vehicle}</span>
        </div>
      )}
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const hue =
    score >= 75
      ? "bg-red-500/20 text-[var(--danger-text)]"
      : score >= 45
      ? "bg-amber-500/20 text-[var(--accent-text)]"
      : "bg-[var(--chip)] text-[var(--text)]";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${hue}`}
    >
      {score}
    </span>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-[var(--chip)] px-2 py-1.5">
      <div className="text-[10px] uppercase text-[var(--text-faint)]">{label}</div>
      <div className="text-xs font-medium text-[var(--text-strong)]">{value}</div>
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[10px] text-[var(--text-muted)]">
      <div className="mb-1 uppercase tracking-wider">Violation density</div>
      <div className="flex items-center gap-1">
        <span>low</span>
        <div
          className="h-2 w-28 rounded"
          style={{ backgroundImage: "linear-gradient(to right, var(--heat-grad))" }}
        />
        <span>high</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff6e28]" />
        <span>hotspot (size = impact score)</span>
      </div>
    </div>
  );
}
