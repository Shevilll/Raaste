"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Layer, PickingInfo } from "@deck.gl/core";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Hotspot, Point } from "@/lib/types";

// Self-contained raster basemap (CARTO dark tiles) — no external style.json fetch,
// so it renders reliably even behind ad-blockers / flaky networks.
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

export interface MapProps {
  center: [number, number];
  hotspots: Hotspot[];
  points: Point[];
  showHeatmap: boolean;
  showHotspots: boolean;
  selectedId: string | null;
  onSelect: (h: Hotspot | null) => void;
}

export default function HotspotMap({
  center,
  hotspots,
  points,
  showHeatmap,
  showHotspots,
  selectedId,
  onSelect,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);

  // create the map once
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
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
    map.on("load", () => map.resize());
    map.on("error", (e) => console.warn("map error", e?.error?.message ?? e));

    const overlay = new MapboxOverlay({ layers: [] });
    map.addControl(overlay as unknown as maplibregl.IControl);

    // keep the canvas sized to its flex container
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    mapRef.current = map;
    overlayRef.current = overlay;
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          colorRange: HEAT_RANGE,
          opacity: 0.85,
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
  }, [hotspots, points, showHeatmap, showHotspots, selectedId, onSelect]);

  // Outer div keeps the Tailwind `absolute inset-0`; the inner div is the MapLibre
  // container (MapLibre forces position:relative on it, so it must size via h/w-full).
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
