"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer, PathLayer, TextLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Layer, PickingInfo } from "@deck.gl/core";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Hotspot, Point, CongestionEvent } from "@/lib/types";

// A single simulated live-feed ping (one incoming "report" on the map).
type Ping = { id: number; lng: number; lat: number; born: number };

// How long a ping stays alive before it's dropped (ms).
const PING_LIFE = 2200;

// Mappls (MapmyIndia) basemap is used on the whitelisted production domain; everywhere
// else (localhost, previews) and on any load failure we fall back to CARTO so the map
// always renders.
const MAPPLS_KEY = process.env.NEXT_PUBLIC_MAPPLS_KEY;
const MAPPLS_HOSTS = new Set(["raaste.theahmadfaraz.com"]);

// Self-contained raster basemap (CARTO dark tiles) — reliable fallback, no style.json fetch.
const BASEMAP_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0a0f1c" } },
    { id: "carto", type: "raster", source: "carto" },
  ],
} as unknown as maplibregl.StyleSpecification;

// blue → teal → green → amber → orange → red
const HEAT_RANGE: [number, number, number][] = [
  [12, 28, 68],
  [22, 78, 132],
  [34, 150, 160],
  [150, 200, 90],
  [245, 205, 70],
  [240, 120, 40],
  [214, 40, 40],
];

// warm YlOrRd ramp for the light basemap (no dark colours that smudge on a light map)
const HEAT_RANGE_LIGHT: [number, number, number][] = [
  [255, 255, 178],
  [254, 217, 118],
  [254, 178, 76],
  [253, 141, 60],
  [252, 78, 42],
  [227, 26, 28],
  [177, 0, 38],
];

/* eslint-disable @typescript-eslint/no-explicit-any */
let mapplsSdk: Promise<any> | null = null;

function loadMappls(key: string): Promise<any> {
  const w = window as any;
  if (w.mappls && w.mappls.Map) return Promise.resolve(w.mappls);
  if (mapplsSdk) return mapplsSdk;
  mapplsSdk = new Promise((resolve, reject) => {
    const cb = "__raasteMapplsCb";
    w[cb] = () =>
      w.mappls && w.mappls.Map
        ? resolve(w.mappls)
        : reject(new Error("mappls unavailable"));
    const s = document.createElement("script");
    s.src = `https://apis.mappls.com/advancedmaps/api/${key}/map_sdk?layer=vector&v=3.0&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error("mappls sdk load error"));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error("mappls sdk timeout")), 9000);
  });
  return mapplsSdk;
}

// Resolve only once the Mappls map has actually loaded its tiles.
function createMapplsMap(
  container: HTMLDivElement,
  center: [number, number]
): Promise<any> {
  return loadMappls(MAPPLS_KEY as string).then(
    (mappls) =>
      new Promise((resolve, reject) => {
        let map: any;
        const to = setTimeout(() => {
          try {
            map?.remove();
          } catch {}
          reject(new Error("mappls map load timeout"));
        }, 9000);
        try {
          map = new mappls.Map(container.id, {
            center: [center[0], center[1]], // Mappls expects [lat, lng]
            zoom: 11.2,
            zoomControl: true,
            location: false,
          });
          map.on("load", () => {
            clearTimeout(to);
            resolve(map);
          });
        } catch (e) {
          clearTimeout(to);
          reject(e);
        }
      })
  );
}

function createCartoMap(
  container: HTMLDivElement,
  center: [number, number]
): maplibregl.Map {
  const map = new maplibregl.Map({
    container,
    style: BASEMAP_STYLE,
    center: [center[1], center[0]],
    zoom: 11.2,
    minZoom: 9,
    maxZoom: 18,
    attributionControl: { compact: true },
  });
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "bottom-right"
  );
  return map;
}

export interface MapProps {
  center: [number, number];
  hotspots: Hotspot[];
  points: Point[];
  showHeatmap: boolean;
  showHotspots: boolean;
  congestion: CongestionEvent[];
  showCongestion: boolean;
  selectedId: string | null;
  focusBounds?: [[number, number], [number, number]] | null;
  route: Hotspot[] | null;
  showLive: boolean;
  onSelect: (h: Hotspot | null) => void;
}

export default function HotspotMap({
  center,
  hotspots,
  points,
  showHeatmap,
  showHotspots,
  congestion,
  showCongestion,
  selectedId,
  focusBounds,
  route,
  showLive,
  onSelect,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const [isLight, setIsLight] = useState(false);

  // Live-feed simulation: lightweight DOM pings projected over the map.
  const [pings, setPings] = useState<Ping[]>([]);
  const [liveCount, setLiveCount] = useState(0);

  // create the map once (Mappls on prod, CARTO otherwise / on failure)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const useMappls =
      !!MAPPLS_KEY &&
      typeof window !== "undefined" &&
      MAPPLS_HOSTS.has(window.location.hostname);

    const setup = (map: any) => {
      if (cancelled) {
        try {
          map.remove();
        } catch {}
        return;
      }
      const overlay = new MapboxOverlay({ layers: [] });
      map.addControl(overlay as unknown as maplibregl.IControl);
      map.on("error", (e: any) =>
        console.warn("map error", e?.error?.message ?? e)
      );
      map.on("load", () => {
        try {
          map.resize();
        } catch {}
      });
      ro = new ResizeObserver(() => {
        try {
          map.resize();
        } catch {}
      });
      ro.observe(container);
      try {
        map.resize();
      } catch {}
      mapRef.current = map;
      overlayRef.current = overlay;
      setReady(true);
    };

    (async () => {
      let map: any = null;
      if (useMappls) {
        try {
          map = await createMapplsMap(container, center);
        } catch (e) {
          console.warn("Mappls basemap unavailable, using CARTO:", e);
          map = null;
        }
      }
      if (!map && !cancelled) map = createCartoMap(container, center);
      if (map) setup(map);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      try {
        mapRef.current?.remove();
      } catch {}
      mapRef.current = null;
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // track the active theme so the heatmap palette can adapt (light vs dark basemap)
  useEffect(() => {
    const read = () =>
      setIsLight(
        document.documentElement.getAttribute("data-theme") === "light"
      );
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  // fly to a selected station's hotspots
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusBounds) return;
    map.fitBounds(focusBounds, { padding: 90, maxZoom: 14.5, duration: 800 });
  }, [focusBounds, ready]);

  // fit the map to an active patrol route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route || route.length < 2) return;
    const lats = route.map((h) => h.lat);
    const lngs = route.map((h) => h.lng);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 110, maxZoom: 14, duration: 800 }
    );
  }, [route, ready]);

  // rebuild deck layers when data / filters / selection change
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const layers: Layer[] = [];

    if (showHeatmap) {
      layers.push(
        new HeatmapLayer<Point>({
          id: "heat",
          data: points,
          getPosition: (p: Point) => [p[1], p[0]] as [number, number],
          getWeight: () => 1,
          aggregation: "SUM",
          radiusPixels: 38,
          intensity: 1,
          threshold: 0.05,
          colorRange: isLight ? HEAT_RANGE_LIGHT : HEAT_RANGE,
          opacity: isLight ? 0.7 : 0.85,
        })
      );
    }

    if (showCongestion && congestion.length) {
      layers.push(
        new ScatterplotLayer<CongestionEvent>({
          id: "congestion",
          data: congestion,
          getPosition: (e: CongestionEvent) => [e[1], e[0]] as [number, number],
          getRadius: 55,
          radiusUnits: "meters",
          radiusMinPixels: 2.5,
          radiusMaxPixels: 7,
          stroked: true,
          filled: true,
          getFillColor: [230, 40, 70, 70] as [number, number, number, number],
          getLineColor: [240, 80, 95, 200] as [number, number, number, number],
          lineWidthMinPixels: 1,
        })
      );
    }

    if (showHotspots) {
      layers.push(
        new ScatterplotLayer<Hotspot>({
          id: "hotspots",
          data: hotspots,
          getPosition: (h: Hotspot) => [h.lng, h.lat] as [number, number],
          getRadius: (h: Hotspot) => 70 + (h.score / 100) * 460,
          radiusUnits: "meters",
          radiusMinPixels: 3,
          radiusMaxPixels: 46,
          getFillColor: (h: Hotspot) =>
            (h.id === selectedId
              ? [255, 255, 255, 235]
              : [255, 110, 40, 170]) as [number, number, number, number],
          stroked: true,
          lineWidthMinPixels: 1,
          getLineColor: (h: Hotspot) =>
            (h.id === selectedId
              ? [255, 255, 255, 255]
              : [255, 190, 130, 130]) as [number, number, number, number],
          pickable: true,
          onClick: (info: PickingInfo<Hotspot>) =>
            onSelect(info.object ?? null),
          updateTriggers: {
            getFillColor: selectedId,
            getLineColor: selectedId,
          },
        })
      );
    }

    if (route && route.length) {
      layers.push(
        new PathLayer<{ path: [number, number][] }>({
          id: "route-line",
          data: [{ path: route.map((h) => [h.lng, h.lat] as [number, number]) }],
          getPath: (d) => d.path,
          getColor: [245, 158, 11, 230],
          getWidth: 4,
          widthUnits: "pixels",
          capRounded: true,
          jointRounded: true,
        })
      );
      layers.push(
        new ScatterplotLayer<Hotspot>({
          id: "route-stops",
          data: route,
          getPosition: (h: Hotspot) => [h.lng, h.lat] as [number, number],
          getRadius: 11,
          radiusUnits: "pixels",
          getFillColor: [245, 158, 11, 255] as [number, number, number, number],
          stroked: true,
          getLineColor: [10, 15, 28, 255] as [number, number, number, number],
          lineWidthMinPixels: 2,
        })
      );
      layers.push(
        new TextLayer<{ pos: [number, number]; n: string }>({
          id: "route-labels",
          data: route.map((h, i) => ({
            pos: [h.lng, h.lat] as [number, number],
            n: String(i + 1),
          })),
          getPosition: (d) => d.pos,
          getText: (d) => d.n,
          getSize: 12,
          getColor: [10, 15, 28, 255] as [number, number, number, number],
          fontWeight: 700,
          getTextAnchor: "middle",
          getAlignmentBaseline: "center",
        })
      );
    }

    overlay.setProps({
      layers,
      getTooltip: (info: PickingInfo<Hotspot>) => {
        const o = info.object;
        if (!o || o.rank === undefined) return null;
        return {
          html: `<b>#${o.rank} · score ${o.score}</b><br/>${o.count.toLocaleString(
            "en-IN"
          )} violations<br/>${o.station ?? ""}`,
          style: {
            background: "#0b1220",
            color: "#e5e7eb",
            fontSize: "12px",
            padding: "6px 8px",
            borderRadius: "6px",
            border: "1px solid #243044",
          },
        };
      },
    });
  }, [
    ready,
    hotspots,
    points,
    congestion,
    showHeatmap,
    showHotspots,
    showCongestion,
    selectedId,
    route,
    isLight,
    onSelect,
  ]);

  // Live-feed simulation. Spawns amber pings at random (score-weighted) hotspots
  // and keeps them attached to the map as it pans/zooms. Purely a DOM overlay —
  // it never touches the deck.gl layers, so the heatmap/scatter stay untouched.
  useEffect(() => {
    if (!showLive || !ready) {
      // Nothing running: make sure the overlay is empty.
      setPings([]);
      return;
    }

    let nextId = 0;

    // Pick a hotspot, biased toward higher scores (more "active" areas fire more
    // often). Falls back to a uniform pick if every score is zero.
    const pickHotspot = (): Hotspot | null => {
      if (!hotspots.length) return null;
      const total = hotspots.reduce((sum, h) => sum + (h.score || 0), 0);
      if (total <= 0) {
        return hotspots[Math.floor(Math.random() * hotspots.length)];
      }
      let r = Math.random() * total;
      for (const h of hotspots) {
        r -= h.score || 0;
        if (r <= 0) return h;
      }
      return hotspots[hotspots.length - 1];
    };

    const spawn = setInterval(() => {
      const h = pickHotspot();
      if (!h) return;
      const ping: Ping = { id: nextId++, lng: h.lng, lat: h.lat, born: Date.now() };
      setLiveCount((c) => c + 1);
      setPings((prev) => {
        const now = Date.now();
        const live = prev.filter((p) => now - p.born < PING_LIFE);
        return [...live, ping].slice(-14);
      });
    }, 700);

    // Faster tick so rings keep animating and dead pings get pruned smoothly.
    const tick = setInterval(() => {
      setPings((prev) => {
        const now = Date.now();
        const live = prev.filter((p) => now - p.born < PING_LIFE);
        return live.length === prev.length ? prev : live;
      });
    }, 80);

    // Re-render on map movement so projected positions stay glued to the map.
    const nudge = () => setPings((prev) => prev.slice());
    const map = mapRef.current;
    try {
      map?.on("move", nudge);
      map?.on("zoom", nudge);
    } catch {}

    return () => {
      clearInterval(spawn);
      clearInterval(tick);
      try {
        map?.off("move", nudge);
        map?.off("zoom", nudge);
      } catch {}
      setPings([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLive, ready, hotspots]);

  // Outer div keeps the Tailwind `absolute inset-0`; the inner div is the map
  // container (the GL libs force position:relative, so it must size via h/w-full).
  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        id="raaste-basemap"
        className="h-full w-full"
        role="region"
        aria-label="Map of Bengaluru parking hotspots"
      />

      {showLive && ready && (
        <>
          {/* Live-feed pings: each is an expanding, fading amber ring + dot,
              projected to screen space from its lng/lat every render. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {pings.map((p) => {
              let screen: { x: number; y: number } | null = null;
              try {
                screen = mapRef.current?.project([p.lng, p.lat]) ?? null;
              } catch {
                screen = null;
              }
              if (!screen) return null;

              const age = Date.now() - p.born;
              const t = Math.min(age / PING_LIFE, 1);
              const radius = 6 + t * 28; // grows 6px -> 34px
              const opacity = 1 - t; // fades to 0

              return (
                <div
                  key={p.id}
                  className="pointer-events-none absolute"
                  style={{ left: screen.x, top: screen.y }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: -radius,
                      top: -radius,
                      width: radius * 2,
                      height: radius * 2,
                      borderRadius: "9999px",
                      border: "2px solid rgba(245, 158, 11, 0.9)",
                      opacity,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: -3,
                      top: -3,
                      width: 6,
                      height: 6,
                      borderRadius: "9999px",
                      background: "rgb(245, 158, 11)",
                      opacity: Math.max(opacity, 0.3),
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Status badge — sits below the route-clear button (top-3 left-3). */}
          <div className="pointer-events-none absolute left-3 top-14 flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-500 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <span>LIVE · simulating real-time feed</span>
            <span className="tabular-nums opacity-70">{liveCount}</span>
          </div>
        </>
      )}
    </div>
  );
}
