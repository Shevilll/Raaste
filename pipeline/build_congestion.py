#!/usr/bin/env python3
"""Cross-reference parking hotspots with real ASTraM congestion/incident events.

Reads the anonymised ASTraM event dataset and the parking hotspots produced by
build_data.py, then writes public/data/congestion.json:
  * events            — congestion/incident points for the map overlay
  * nearby / minDistM — per-hotspot count of events within 300 m, and distance to the nearest
  * correlation       — how strongly the worst parking hotspots coincide with real congestion
  * cost              — real congestion-hours (event durations, weighted by road-closure and
                        priority) that sit on the top-100 parking hotspots, with a transparent
                        vehicle-hours / rupee estimate on top

This is the evidence that illegal-parking hotspots sit on the city's real congestion points,
and what that congestion is worth — built from two HackerEarth-provided datasets, no external data.

Standard library only.
"""
import csv
import glob
import json
import math
import os
import sys
from collections import Counter
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "data"))
BBOX = (11.5, 14.0, 76.5, 78.5)
NEAR_M = 300
M_PER_DEG_LAT = 111320

# Cost model — the top parking hotspots we'd actually enforce, and how disruptive an event is.
TOP_FOR_COST = 100
CLOSURE_W = 2.0          # a road-closure event chokes the carriageway twice as hard
HIGH_PRI_W = 1.5         # ASTraM "High" priority events are the bad ones
# Transparent estimate assumptions (clearly labelled as estimates in the UI):
VEH_PER_HOUR = 500       # vehicles delayed per congestion-hour on a Bengaluru arterial
RUPEES_PER_VEH_HOUR = 120  # value of time + fuel burned per vehicle-hour, in rupees

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


def parse_dt(s):
    if not s:
        return None
    s = s.strip()
    if s in ("NULL", ""):
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S.%f+00", "%Y-%m-%d %H:%M:%S+00"):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            pass
    return None


def event_duration_min(row):
    """Minutes from start to the first available resolved/end/closed time, clamped to (0, 24h]."""
    st = parse_dt(row.get("start_datetime"))
    if not st:
        return None
    for f in ("resolved_datetime", "end_datetime", "closed_datetime"):
        en = parse_dt(row.get(f))
        if en and en > st:
            m = (en - st).total_seconds() / 60
            if 0 < m <= 24 * 60:
                return m
    return None


def main():
    path = find_events()
    print(f"reading {path}")
    lo_lat, hi_lat, lo_lng, hi_lng = BBOX

    events = []   # [lat, lng, causeIdx, priIdx]
    ev_dur = []   # duration in minutes (or None) aligned with events
    ev_w = []     # disruption weight aligned with events
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
            ev_dur.append(event_duration_min(row))
            closure = (row.get("requires_road_closure") or "").strip().upper() == "TRUE"
            high = (row.get("priority") or "").strip() == "High"
            ev_w.append((CLOSURE_W if closure else 1.0) * (HIGH_PRI_W if high else 1.0))
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

    # --- Cost: real congestion-hours that sit on the top parking hotspots ---
    valid = sorted(d for d in ev_dur if d is not None)
    median_min = valid[len(valid) // 2] if valid else 50.0
    imputed = sum(1 for d in ev_dur if d is None)

    cost_hotspots = hotspots[:TOP_FOR_COST]

    def near_parking(elat, elng):
        coslat = math.cos(math.radians(elat))
        near_lng = NEAR_M / (M_PER_DEG_LAT * coslat)
        for h in cost_hotspots:
            if abs(h["lat"] - elat) > near_lat * 4 or abs(h["lng"] - elng) > near_lng * 4:
                continue
            dlat = (h["lat"] - elat) * M_PER_DEG_LAT
            dlng = (h["lng"] - elng) * M_PER_DEG_LAT * coslat
            if math.hypot(dlat, dlng) <= NEAR_M:
                return True
        return False

    total_hours = total_w_hours = 0.0
    near_events = 0
    near_hours = near_w_hours = 0.0
    for i, e in enumerate(events):
        d = ev_dur[i] if ev_dur[i] is not None else median_min
        hrs = d / 60.0
        w_hrs = hrs * ev_w[i]
        total_hours += hrs
        total_w_hours += w_hrs
        if near_parking(e[0], e[1]):
            near_events += 1
            near_hours += hrs
            near_w_hours += w_hrs

    est_veh_hours = near_w_hours * VEH_PER_HOUR
    est_cost_crore = est_veh_hours * RUPEES_PER_VEH_HOUR / 1e7  # rupees -> crore
    cost = {
        "topN": TOP_FOR_COST,
        "totalEventHours": round(total_hours),
        "medianMin": round(median_min),
        "imputedSharePct": round(100 * imputed / max(len(events), 1), 1),
        "closureWeight": CLOSURE_W,
        "highPriWeight": HIGH_PRI_W,
        "nearEvents": near_events,
        "nearHours": round(near_hours),
        "nearWeightedHours": round(near_w_hours),
        "pctHoursNear": round(100 * near_hours / max(total_hours, 1), 1),
        "estVehicleHours": round(est_veh_hours),
        "estCostCrore": round(est_cost_crore, 1),
        "vehPerHour": VEH_PER_HOUR,
        "rupeesPerVehHour": RUPEES_PER_VEH_HOUR,
    }
    print("cost", cost)

    out = {
        "events": events,
        "causeLegend": [c.replace("_", " ") for c in CAUSE_ORDER] + ["other"],
        "nearby": nearby,
        "minDistM": min_dist,
        "correlation": correlation,
        "cost": cost,
    }
    with open(os.path.join(OUT, "congestion.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote congestion.json: {os.path.getsize(os.path.join(OUT, 'congestion.json')) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
