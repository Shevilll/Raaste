#!/usr/bin/env python3
"""Cross-reference parking hotspots with real ASTraM congestion/incident events.

Reads the anonymised ASTraM event dataset and the parking hotspots produced by
build_data.py, then writes public/data/congestion.json:
  * events            — congestion/incident points for the map overlay
  * nearby / minDistM — per-hotspot count of events within 300 m, and distance to the nearest
  * correlation       — how strongly the worst parking hotspots coincide with real congestion

This is the evidence that illegal-parking hotspots sit on the city's real congestion points —
built from two HackerEarth-provided datasets, no external data.

Standard library only.
"""
import csv
import glob
import json
import math
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "data"))
BBOX = (11.5, 14.0, 76.5, 78.5)
NEAR_M = 300
M_PER_DEG_LAT = 111320

CAUSE_ORDER = [
    "congestion", "accident", "vehicle_breakdown", "water_logging", "pot_holes",
    "construction", "road_conditions", "tree_fall", "public_event", "procession",
    "vip_movement", "others",
]
CAUSE_IDX = {c: i for i, c in enumerate(CAUSE_ORDER)}
OTHER_CAUSE = len(CAUSE_ORDER)
PRI = {"High": 0, "Low": 1}


def find_events():
    cands = []
    if os.environ.get("RAASTE_EVENTS"):
        cands.append(os.environ["RAASTE_EVENTS"])
    cands += [
        os.path.join(HERE, "..", "data", "raw"),
        os.path.join(HERE, "..", "..", "data", "raw"),
        os.path.join(os.getcwd(), "data", "raw"),
    ]
    for c in cands:
        hits = glob.glob(os.path.join(os.path.normpath(c), "*Astram*event*.csv"))
        if hits:
            return hits[0]
    sys.exit("Could not find the ASTraM event CSV. Set RAASTE_EVENTS or place it in data/raw/.")


def main():
    path = find_events()
    print(f"reading {path}")
    lo_lat, hi_lat, lo_lng, hi_lng = BBOX

    events = []  # [lat, lng, causeIdx, priIdx]
    causes = Counter()
    with open(path, newline="") as fh:
        for row in csv.DictReader(fh):
            try:
                lat, lng = float(row["latitude"]), float(row["longitude"])
            except (ValueError, TypeError, KeyError):
                continue
            if not (lo_lat < lat < hi_lat and lo_lng < lng < hi_lng):
                continue
            cause = (row.get("event_cause") or "").strip().lower()
            events.append([
                round(lat, 5), round(lng, 5),
                CAUSE_IDX.get(cause, OTHER_CAUSE),
                PRI.get((row.get("priority") or "").strip(), 1),
            ])
            causes[cause] += 1
    print(f"events={len(events)} top causes={causes.most_common(5)}")

    with open(os.path.join(OUT, "hotspots.json")) as f:
        hotspots = json.load(f)

    # nearest-event distance + count within NEAR_M for every hotspot
    near_lat = NEAR_M / M_PER_DEG_LAT
    nearby, min_dist = {}, {}
    for h in hotspots:
        hlat, hlng = h["lat"], h["lng"]
        coslat = math.cos(math.radians(hlat))
        near_lng = NEAR_M / (M_PER_DEG_LAT * coslat)
        cnt, best = 0, 1e9
        for e in events:
            if abs(e[0] - hlat) > near_lat * 4 or abs(e[1] - hlng) > near_lng * 4:
                continue  # cheap reject
            dlat = (e[0] - hlat) * M_PER_DEG_LAT
            dlng = (e[1] - hlng) * M_PER_DEG_LAT * coslat
            d = math.hypot(dlat, dlng)
            if d < best:
                best = d
            if d <= NEAR_M:
                cnt += 1
        nearby[h["id"]] = cnt
        min_dist[h["id"]] = round(best)

    def pct(n, radius):
        top = hotspots[:n]
        hit = sum(1 for h in top if min_dist[h["id"]] <= radius)
        return round(100 * hit / max(len(top), 1), 1), hit

    for radius in (200, 300, 500):
        print(f"  within {radius}m: top50={pct(50, radius)} top100={pct(100, radius)}")

    p50, h50 = pct(50, NEAR_M)
    p100, h100 = pct(100, NEAR_M)
    correlation = {
        "radiusM": NEAR_M,
        "totalEvents": len(events),
        "pctTop50": p50, "hitTop50": h50,
        "pctTop100": p100, "hitTop100": h100,
        "nHotspots": len(hotspots),
    }
    print("correlation", correlation)

    out = {
        "events": events,
        "causeLegend": [c.replace("_", " ") for c in CAUSE_ORDER] + ["other"],
        "nearby": nearby,
        "minDistM": min_dist,
        "correlation": correlation,
    }
    with open(os.path.join(OUT, "congestion.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote congestion.json: {os.path.getsize(os.path.join(OUT, 'congestion.json')) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
