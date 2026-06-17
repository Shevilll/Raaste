"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type {
  Summary,
  Hotspot,
  Point,
  Congestion,
  Prediction,
  Offenders as OffendersData,
  JunctionsFile,
  Simulator,
  Fines,
  BlindspotsFile,
} from "@/lib/types";
import StatsPanel from "@/components/StatsPanel";
import Trends from "@/components/Trends";
import TimeControls from "@/components/TimeControls";
import OptimizerModal from "@/components/OptimizerModal";
import MethodologyModal from "@/components/MethodologyModal";
import TypeFilter from "@/components/TypeFilter";
import IntroTour from "@/components/IntroTour";
import Offenders from "@/components/Offenders";
import JunctionDetail from "@/components/JunctionDetail";
import CoverageChart from "@/components/CoverageChart";
import MonthlyTrend from "@/components/MonthlyTrend";
import ThemeToggle from "@/components/ThemeToggle";
import { planRoute } from "@/lib/route";
import { Mini, ScoreChip } from "@/components/Stat";
import { fmt, hourRange, hourLabel, DAYS } from "@/lib/format";
import {
  Zap,
  ClipboardList,
  Link2,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Smartphone,
} from "lucide-react";

const HotspotMap = dynamic(() => import("@/components/HotspotMap"), {
  ssr: false,
});

// side panel resize bounds (desktop only) — never wider than half the screen
const MIN_PANEL_W = 300;
const DEFAULT_PANEL_W = 340;
const PANEL_W_KEY = "raaste:panelW";
const clampPanelW = (w: number) =>
  Math.max(MIN_PANEL_W, Math.min(w, window.innerWidth / 2));

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [congestion, setCongestion] = useState<Congestion | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [offenders, setOffenders] = useState<OffendersData | null>(null);
  const [junctionsData, setJunctionsData] = useState<JunctionsFile | null>(null);
  const [sim, setSim] = useState<Simulator | null>(null);
  const [fines, setFines] = useState<Fines | null>(null);
  const [blind, setBlind] = useState<BlindspotsFile | null>(null);
  const [blindId, setBlindId] = useState<string | null>(null);
  const [lens, setLens] = useState<"station" | "junction">("station");
  const [junctionId, setJunctionId] = useState<string | null>(null);
  const [showJunctions, setShowJunctions] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [station, setStation] = useState<string | null>(null);
  const [typeIdx, setTypeIdx] = useState<number | null>(null);
  const [hour, setHour] = useState(-1);
  const [dow, setDow] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showCongestion, setShowCongestion] = useState(false);
  const [showBlind, setShowBlind] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [teams, setTeams] = useState(8);
  const [route, setRoute] = useState<{ zones: Hotspot[]; km: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [panelW, setPanelW] = useState(DEFAULT_PANEL_W);
  const resizing = useRef(false);

  // restore the saved panel width, and keep it within half the screen on resize
  useEffect(() => {
    const saved = Number(localStorage.getItem(PANEL_W_KEY));
    if (saved) setPanelW(clampPanelW(saved));
    const onResize = () => setPanelW((w) => clampPanelW(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // persist the width once dragging settles
  useEffect(() => {
    const id = window.setTimeout(
      () => localStorage.setItem(PANEL_W_KEY, String(panelW)),
      200
    );
    return () => window.clearTimeout(id);
  }, [panelW]);

  const startResize = useCallback((e: ReactPointerEvent) => {
    e.preventDefault();
    resizing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onResizeMove = useCallback((e: ReactPointerEvent) => {
    if (!resizing.current) return;
    // panel hugs the left edge, so the pointer's x is the new width
    setPanelW(clampPanelW(e.clientX));
  }, []);

  const endResize = useCallback((e: ReactPointerEvent) => {
    if (!resizing.current) return;
    resizing.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const nudgeResize = useCallback((e: ReactKeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPanelW((w) => clampPanelW(w - 16));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPanelW((w) => clampPanelW(w + 16));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const getJSON = async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url} → ${r.status}`);
      return r.json();
    };
    (async () => {
      try {
        const [s, h, p, c, pr, off, jn, sm, fn, bl] = await Promise.all([
          getJSON("/data/summary.json"),
          getJSON("/data/hotspots.json"),
          getJSON("/data/points.json"),
          getJSON("/data/congestion.json"),
          getJSON("/data/prediction.json"),
          getJSON("/data/offenders.json"),
          getJSON("/data/junctions.json"),
          getJSON("/data/simulator.json"),
          getJSON("/data/fines.json"),
          getJSON("/data/blindspots.json"),
        ]);
        if (!alive) return;
        setSummary(s);
        setHotspots(h);
        setPoints(p.points ?? []);
        setCongestion(c);
        setPrediction(pr);
        setOffenders(off);
        setJunctionsData(jn);
        setSim(sm);
        setFines(fn);
        setBlind(bl);
        setLoading(false);
      } catch (e) {
        console.warn("data load failed", e);
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
  }, []);

  // build a shareable link for the current view, copied on demand — the URL
  // bar itself stays clean and doesn't change as you click around the map
  const copyShareLink = useCallback(async () => {
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
    const url = `${window.location.origin}${window.location.pathname}${
      qs ? `?${qs}` : ""
    }`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked (e.g. insecure context) — fall back to a prompt
      window.prompt("Copy this link to the current view:", url);
    }
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

  const handleSelect = useCallback((h: Hotspot | null) => {
    setSelectedId(h ? h.id : null);
    if (h) setJunctionId(null);
  }, []);
  const handleLensChange = useCallback((l: "station" | "junction") => {
    setLens(l);
    if (l !== "junction") setJunctionId(null);
    if (l === "junction") setShowJunctions(true);
  }, []);
  const congestionEvents = useMemo(
    () => congestion?.events ?? [],
    [congestion]
  );
  const routeZones = useMemo(() => route?.zones ?? null, [route]);

  // a generated patrol route only matches the filters it was built under
  useEffect(() => {
    setRoute(null);
  }, [station, hour, dow, typeIdx, showForecast]);

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

  const selectedJunction =
    junctionId && junctionsData
      ? junctionsData.junctions.find((j) => j.id === junctionId) ?? null
      : null;

  const junctionFocus = useMemo<
    [[number, number], [number, number]] | null
  >(() => {
    if (!selectedJunction) return null;
    const { lat, lng } = selectedJunction;
    const d = 0.012; // ~1.3 km padding box around the junction
    return [
      [lng - d, lat - d],
      [lng + d, lat + d],
    ];
  }, [selectedJunction]);

  const selectedBlind =
    blindId && blind
      ? blind.blindspots.find((b) => b.id === blindId) ?? null
      : null;

  const blindFocus = useMemo<
    [[number, number], [number, number]] | null
  >(() => {
    if (!selectedBlind) return null;
    const { lat, lng } = selectedBlind;
    const d = 0.012; // ~1.3 km padding box around the blind spot
    return [
      [lng - d, lat - d],
      [lng + d, lat + d],
    ];
  }, [selectedBlind]);

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
    <div className="flex min-h-[100dvh] w-full flex-col bg-[var(--bg)] text-[var(--text)] lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 lg:static lg:py-1.5 lg:pt-1.5">
        <div className="flex shrink-0 items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-strong)]">
            Raa<span className="text-[var(--accent-text)]">ste</span>
          </h1>
          <span className="hidden text-xs text-[var(--text-muted)] lg:inline">
            Parking-Congestion Intelligence · Bengaluru Traffic Police
          </span>
          <button
            onClick={() => setMethodOpen(true)}
            className="hidden text-xs text-[var(--text-faint)] underline-offset-2 hover:text-[var(--accent-text)] hover:underline lg:inline"
          >
            How it works
          </button>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOptimizerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 lg:py-1"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Patrol plan
          </button>
          <Link
            href="/briefing"
            onClick={() => {
              // hand the selected station to the beat sheet without putting it in the URL
              if (station) sessionStorage.setItem("raaste:station", station);
              else sessionStorage.removeItem("raaste:station");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/60 px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] hover:bg-amber-500/10 lg:py-1"
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            Beat sheet
          </Link>
          <Link
            href="/field"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/60 px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] hover:bg-amber-500/10 lg:py-1"
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            Field mode
          </Link>
          <button
            onClick={copyShareLink}
            title="Copy a link to the current view"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/60 px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] hover:bg-amber-500/10 lg:py-1"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Link copied
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" aria-hidden />
                Copy link
              </>
            )}
          </button>
          <Toggle on={showHeatmap} set={setShowHeatmap} label="Heatmap" />
          <Toggle on={showHotspots} set={setShowHotspots} label="Hotspots" />
          <Toggle
            on={showCongestion}
            set={setShowCongestion}
            label="Congestion"
          />
          {/* Rendered unconditionally so the toolbar doesn't reflow when the
              blindspot/prediction data finishes loading on reload — the layers
              simply stay empty until their data arrives. */}
          <Toggle on={showBlind} set={setShowBlind} label="Blind spots" />
          <Toggle on={showForecast} set={setShowForecast} label="Forecast" />
          <Toggle on={showLive} set={setShowLive} label="Live" />
          <Toggle on={showJunctions} set={setShowJunctions} label="Junctions" />
        </div>
      </header>

      <div className="relative flex flex-1 flex-col overflow-visible lg:flex-row lg:overflow-hidden">
        <aside
          style={{ "--panel-w": `${panelW}px` } as CSSProperties}
          className="z-10 order-2 flex w-full shrink-0 flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:order-none lg:w-[var(--panel-w)] lg:overflow-y-auto lg:border-t-0 lg:pb-3"
        >
          {summary && <StatsPanel summary={summary} />}
          {congestion && (
            <ProofPanel c={congestion} onShow={() => setShowCongestion(true)} />
          )}
          {blind && blind.count > 0 && (
            <BlindspotPanel
              data={blind}
              selectedId={blindId}
              onShow={() => setShowBlind(true)}
              onSelect={(id) => {
                setShowBlind(true);
                setBlindId((cur) => (cur === id ? null : id));
              }}
            />
          )}
          {summary && (
            <CoverageChart hotspots={hotspots} totalImpact={summary.totalImpact} />
          )}
          {sim && <WhatIfPanel sim={sim} />}
          {summary && <Trends summary={summary} hour={hour} dow={dow} />}
          {summary?.monthly && <MonthlyTrend monthly={summary.monthly} />}
          {prediction && <ModelCard p={prediction} />}
          {offenders && <Offenders data={offenders} />}
          {fines && <RevenuePanel fines={fines} />}
          {selectedHotspot ? (
            <HotspotDetail
              h={selectedHotspot}
              congestion={congestion}
              onBack={() => setSelectedId(null)}
            />
          ) : selectedJunction && junctionsData ? (
            <JunctionDetail
              j={selectedJunction}
              radiusM={junctionsData.radiusM}
              onBack={() => setJunctionId(null)}
            />
          ) : (
            <>
              {junctionsData && <LensToggle lens={lens} setLens={handleLensChange} />}
              {lens === "station" ? (
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
                  {/* Gated on summary like the panels above so the list's
                      empty state ("No hotspots for this filter") isn't shown
                      while data is still loading on reload — a genuine empty
                      filter still shows it once loaded. */}
                  {summary && (
                    <RankedList
                      hotspots={displayHotspots}
                      title={listTitle}
                      onSelect={setSelectedId}
                    />
                  )}
                </>
              ) : (
                junctionsData && (
                  <JunctionList data={junctionsData} onSelect={setJunctionId} />
                )
              )}
            </>
          )}
        </aside>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize side panel"
          aria-valuenow={Math.round(panelW)}
          aria-valuemin={MIN_PANEL_W}
          tabIndex={0}
          onPointerDown={startResize}
          onPointerMove={onResizeMove}
          onPointerUp={endResize}
          onKeyDown={nudgeResize}
          className="z-20 hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-[var(--border)] transition-colors hover:bg-[var(--accent-text)] focus-visible:bg-[var(--accent-text)] focus-visible:outline-none lg:block"
        />

        <main className="relative isolate order-1 h-[55dvh] min-h-[420px] w-full lg:order-none lg:h-auto lg:min-h-0 lg:flex-1">
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
                congestion={congestionEvents}
                showCongestion={showCongestion}
                showLive={showLive}
                selectedId={selectedId}
                focusBounds={blindFocus ?? junctionFocus ?? focusBounds}
                route={routeZones}
                onSelect={handleSelect}
                junctions={junctionsData?.junctions ?? []}
                showJunctions={showJunctions}
                selectedJunctionId={junctionId}
                onSelectJunction={(j) => {
                  setSelectedId(null);
                  setLens("junction");
                  setShowJunctions(true);
                  setJunctionId(j ? j.id : null);
                }}
                blindspots={blind?.blindspots ?? []}
                showBlind={showBlind}
                selectedBlindId={blindId}
                onSelectBlind={(b) => {
                  setShowBlind(true);
                  setBlindId(b ? b.id : null);
                }}
              />
            </>
          )}
          {loading && !error && (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              Loading Bengaluru parking data…
            </div>
          )}
          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[var(--text-muted)]">
              <span>Couldn&apos;t load the parking data.</span>
              <button
                onClick={() => window.location.reload()}
                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
              >
                Retry
              </button>
            </div>
          )}
          {route && (
            <button
              onClick={() => setRoute(null)}
              className="absolute bottom-3 right-3 z-10 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-full border border-amber-500/60 bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] shadow-lg hover:bg-amber-500/10 lg:bottom-auto lg:right-auto lg:left-3 lg:top-3"
            >
              <span className="truncate">
                Patrol route · {route.km.toFixed(1)} km · clear
              </span>
              <X className="h-3 w-3 shrink-0" aria-hidden />
            </button>
          )}
          <Legend showBlind={showBlind} />
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
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors lg:py-1 ${
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
        Parking ↔ congestion
      </div>
      <div className="mt-1 text-2xl font-semibold text-[var(--text-strong)]">
        {x.pctTop50}%
      </div>
      <div className="text-xs text-[var(--text)]">
        of the top 50 parking hotspots co-locate with a real ASTraM congestion
        event within {x.radiusM}m ({x.pctTop100}% of the top 100).
      </div>
      <div className="mt-2 border-t border-[var(--danger-border)] pt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold text-[var(--text-strong)]">
            ≈₹{c.cost.estCostCrore} cr
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--danger-text)]">
            est. congestion cost
          </span>
        </div>
        <div className="text-[11px] text-[var(--text)]">
          {fmt(c.cost.nearEvents)} events · {fmt(c.cost.nearHours)} congestion-hours
          sit on the top {c.cost.topN} parking hotspots
        </div>
        <div className="mt-1 text-[10px] leading-snug text-[var(--text-muted)]">
          rough estimate — {c.cost.imputedSharePct}% of event clear-times imputed;
          assumes {fmt(c.cost.estVehicleHours)} vehicle-hours × ₹
          {c.cost.rupeesPerVehHour}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-faint)]">
        <span>{fmt(x.totalEvents)} ASTraM events cross-referenced</span>
        <button
          onClick={onShow}
          className="inline-flex items-center gap-1 text-[var(--danger-text)] hover:opacity-80"
        >
          show on map
          <ArrowRight className="h-3 w-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function BlindspotPanel({
  data,
  selectedId,
  onSelect,
  onShow,
}: {
  data: BlindspotsFile;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShow: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--blind-border)] bg-[var(--blind-bg)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--blind-text)]">
        Enforcement blind spots
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-[var(--text-strong)]">
          {data.count}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">
          corners the city is blind to
        </span>
      </div>
      <div className="text-xs text-[var(--text)]">
        carry{" "}
        <span className="font-semibold text-[var(--blind-text)]">
          {data.pctCongInBlind}%
        </span>{" "}
        of the city&apos;s logged congestion-hours but just{" "}
        <span className="font-semibold text-[var(--blind-text)]">
          {data.pctEnforcementInBlind}%
        </span>{" "}
        of its parking enforcement — heavy congestion, almost no tickets.
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-faint)]">
        <span>
          {fmt(data.totalEvents)} ASTraM events vs {fmt(data.totalEnforcement)}{" "}
          tickets
        </span>
        <button
          onClick={onShow}
          className="inline-flex items-center gap-1 text-[var(--blind-text)] hover:opacity-80"
        >
          show on map
          <ArrowRight className="h-3 w-3" aria-hidden />
        </button>
      </div>
      <div className="mt-2 space-y-1.5">
        {data.blindspots.slice(0, 8).map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left lg:py-1.5 ${
              b.id === selectedId
                ? "bg-violet-500/20"
                : "bg-[var(--chip)] hover:bg-[var(--track)]"
            }`}
          >
            <span className="w-6 shrink-0 text-xs font-semibold text-[var(--blind-text)]">
              #{b.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-[var(--text)]">
                {b.name}
              </span>
              <span className="block truncate text-[10px] text-[var(--text-faint)]">
                {fmt(b.events)} events · {b.enforcement} tickets · {b.station}
              </span>
            </span>
            <span className="shrink-0 text-[10px] font-semibold text-[var(--blind-text)]">
              {b.congHours}h
            </span>
          </button>
        ))}
      </div>
      {data.count > 8 && (
        <div className="mt-1.5 text-[9px] text-[var(--text-faint)]">
          showing top 8 of {data.count} · ranked by the congestion-to-enforcement
          gap
        </div>
      )}
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
            className="inline-flex items-center gap-1 text-[10px] text-[var(--accent-text)] hover:opacity-80"
          >
            clear
            <X className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {stations.slice(0, 12).map(([name, count]) => (
          <button
            key={name}
            onClick={() => onSelect(active === name ? null : name)}
            title={`${fmt(count)} violations`}
            className={`max-w-full truncate rounded px-2 py-1.5 text-[10px] lg:py-0.5 ${
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
            className="flex w-full items-center gap-2 rounded-md bg-[var(--chip)] px-2 py-2 text-left hover:bg-[var(--track)] lg:py-1.5"
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
        className="mb-2 -ml-1 inline-flex min-h-[28px] items-center gap-1 rounded px-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        back to list
      </button>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-strong)]">
          #{h.rank} hotspot
        </span>
        <ScoreChip score={h.score} />
      </div>
      <div className="mt-1 break-words text-xs text-[var(--text)]">
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

function Legend({ showBlind }: { showBlind: boolean }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded-md border border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-2 text-[10px] text-[var(--text-muted)] shadow-lg backdrop-blur lg:bottom-auto lg:left-auto lg:right-3 lg:top-24 lg:px-3">
      <div className="mb-1 uppercase tracking-wider">Violation density</div>
      <div className="flex items-center gap-1">
        <span>low</span>
        <div
          className="h-2 w-20 rounded sm:w-28"
          style={{ backgroundImage: "linear-gradient(to right, var(--heat-grad))" }}
        />
        <span>high</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff6e28]" />
        <span>hotspot (size = impact score)</span>
      </div>
      {showBlind && (
        <div className="mt-1.5 flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#a855f7] bg-transparent" />
          <span>blind spot (congestion, little enforcement)</span>
        </div>
      )}
    </div>
  );
}

function LensToggle({
  lens,
  setLens,
}: {
  lens: "station" | "junction";
  setLens: (l: "station" | "junction") => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1">
      {(["station", "junction"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLens(l)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            lens === l
              ? "bg-amber-500 text-slate-950"
              : "text-[var(--text-muted)] hover:bg-[var(--chip)]"
          }`}
        >
          {l === "station" ? "Stations" : "Junctions"}
        </button>
      ))}
    </div>
  );
}

function JunctionList({
  data,
  onSelect,
}: {
  data: JunctionsFile;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        Worst junctions
      </div>
      <div className="mt-1 text-[11px] text-[var(--text)]">
        {data.count} managed junctions drive{" "}
        <span className="font-semibold text-[var(--accent-text)]">
          {data.pctOfImpact}%
        </span>{" "}
        of all parking impact.
      </div>
      <div className="mt-2 space-y-1.5">
        {data.junctions.slice(0, 40).map((j) => (
          <button
            key={j.id}
            onClick={() => onSelect(j.id)}
            className="flex w-full items-center gap-2 rounded-md bg-[var(--chip)] px-2 py-2 text-left hover:bg-[var(--track)] lg:py-1.5"
          >
            <span className="w-6 shrink-0 text-xs font-semibold text-[var(--accent-text)]">
              #{j.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-[var(--text)]">
                {j.name}
              </span>
              <span className="block truncate text-[10px] text-[var(--text-faint)]">
                {fmt(j.count)} violations · peak {hourRange(j.peakHour ?? -1)}
              </span>
            </span>
            <ScoreChip score={j.score} />
          </button>
        ))}
      </div>
    </div>
  );
}

function WhatIfPanel({ sim }: { sim: Simulator }) {
  const [n, setN] = useState(Math.min(25, sim.nMax));
  const i = Math.min(n, sim.nMax) - 1;
  const impact = sim.impactPct[i] ?? 0;
  const congH = sim.congHours[i] ?? 0;
  const congP = sim.congPct[i] ?? 0;
  const events = sim.events[i] ?? 0;
  const maxImpact = sim.impactPct[sim.nMax - 1] || 1;
  return (
    <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--info-text)]">
        What-if · clear the worst hotspots
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-[var(--text-strong)]">{impact}%</span>
        <span className="text-[11px] text-[var(--text-muted)]">of parking impact addressed</span>
      </div>
      <div className="text-[11px] text-[var(--text)]">
        clearing the worst{" "}
        <span className="font-semibold text-[var(--accent-text)]">{n}</span> hotspots also
        covers {fmt(congH)} congestion-hours ({congP}%) across {fmt(events)} real incidents
      </div>
      <input
        type="range"
        min={1}
        max={sim.nMax}
        value={n}
        onChange={(e) => setN(Number(e.target.value))}
        aria-label="Number of hotspots cleared"
        className="mt-2 w-full accent-amber-500"
      />
      <div className="mt-1 flex h-10 items-end gap-px">
        {sim.impactPct.map((v, idx) => (
          <div
            key={idx}
            className={`flex-1 rounded-sm ${
              idx === i
                ? "bg-amber-400"
                : idx < i
                ? "bg-sky-400/60"
                : "bg-[var(--track)]"
            }`}
            style={{ height: `${Math.max((v / maxImpact) * 100, 3)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 text-[9px] text-[var(--text-faint)]">
        worst {sim.nMax} hotspots → {sim.impactPct[sim.nMax - 1]}% of impact ·{" "}
        {sim.congPct[sim.nMax - 1]}% of logged congestion
      </div>
      <div className="mt-0.5 text-[9px] text-[var(--text-faint)]">
        congestion-hours use logged ASTraM durations, median-imputed where missing
      </div>
    </div>
  );
}

function RevenuePanel({ fines }: { fines: Fines }) {
  const countOf = (s: string) =>
    fines.validation.find((v) => v[0] === s)?.[1] ?? 0;
  const approved = countOf("approved");
  const rejected = countOf("rejected");
  const pending = countOf("pending");
  const total = fines.totalViolations || 1;
  const other = Math.max(total - approved - rejected - pending, 0);
  const seg = (c: number) => `${((100 * c) / total).toFixed(1)}%`;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
        Revenue &amp; enforcement integrity
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-[var(--text-strong)]">
          ≈₹{fines.totalPotentialCrore} cr
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">potential fines</span>
      </div>
      <div className="text-[11px] text-[var(--text)]">
        ₹{fines.realizedCrore} cr approved · {fines.rejectedPct}% of reviewed rejected ·{" "}
        {fines.pendingPct}% pending
      </div>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded bg-[var(--chip)]">
        <div className="bg-emerald-500" style={{ width: seg(approved) }} />
        <div className="bg-red-500" style={{ width: seg(rejected) }} />
        <div className="bg-amber-500/70" style={{ width: seg(pending) }} />
        <div className="bg-[var(--track)]" style={{ width: seg(other) }} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-[var(--text-faint)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />
          approved {fmt(approved)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-500" />
          rejected {fmt(rejected)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/70" />
          pending {fmt(pending)}
        </span>
        {other > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-[var(--track)]" />
            other {fmt(other)}
          </span>
        )}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
        Top stations by fine value
      </div>
      <div className="mt-1 space-y-1">
        {fines.byStation.slice(0, 4).map(([name, cr, count]) => (
          <div key={name} className="flex justify-between text-[11px] text-[var(--text)]">
            <span className="truncate pr-2">{name}</span>
            <span className="text-[var(--text-faint)]">
              ₹{cr} cr · {fmt(count)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[9px] leading-snug text-[var(--text-faint)]">
        priced at BTP compounding rates (₹500 standard, ₹1,000 for carriageway-blocking
        offences)
      </div>
    </div>
  );
}
