#!/usr/bin/env python3
"""Precompute the "what-if" enforcement curve.

If the traffic police clear the worst N parking hotspots, how much parking impact and how
much real ASTraM congestion does that address? Reads the ranked hotspots (build_data.py),
the city impact total (summary.json) and the ASTraM events, then writes
public/data/simulator.json — cumulative arrays over N = 1..nMax that the dashboard's
interactive slider reads directly.

Standard library only. Usage: python3 build_simulator.py
"""
import csv
import glob
import json
import math
import os
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "data"))
BBOX = (11.5, 14.0, 76.5, 78.5)
NEAR_M = 300
M_PER_DEG_LAT = 111320
N_MAX = 150


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
    lo_lat, hi_lat, lo_lng, hi_lng = BBOX
    with open(os.path.join(OUT, "hotspots.json")) as f:
        hotspots = json.load(f)
    with open(os.path.join(OUT, "summary.json")) as f:
        total_impact = json.load(f).get("totalImpact", 0) or sum(h["impact"] for h in hotspots)
    n_max = min(N_MAX, len(hotspots))
    top = hotspots[:n_max]

    path = find_events()
    print(f"reading {path}")
    ev = []            # (lat, lng, dur_min or None)
    durs_valid = []
    with open(path, newline="") as fh:
        for row in csv.DictReader(fh):
            try:
                lat, lng = float(row["latitude"]), float(row["longitude"])
            except (ValueError, TypeError, KeyError):
                continue
            if not (lo_lat < lat < hi_lat and lo_lng < lng < hi_lng):
                continue
            d = event_duration_min(row)
            if d is not None:
                durs_valid.append(d)
            ev.append((round(lat, 5), round(lng, 5), d))
    median_min = sorted(durs_valid)[len(durs_valid) // 2] if durs_valid else 50.0
    near_lat = NEAR_M / M_PER_DEG_LAT

    # per-event: smallest top-rank (1-based) within NEAR_M, else None; plus the event's hours
    cover = [None] * len(ev)
    hours = [0.0] * len(ev)
    for idx, (elat, elng, d) in enumerate(ev):
        hours[idx] = (d if d is not None else median_min) / 60.0
        coslat = math.cos(math.radians(elat))
        near_lng = NEAR_M / (M_PER_DEG_LAT * coslat)
        for i, h in enumerate(top):
            if abs(h["lat"] - elat) > near_lat * 4 or abs(h["lng"] - elng) > near_lng * 4:
                continue
            dlat = (h["lat"] - elat) * M_PER_DEG_LAT
            dlng = (h["lng"] - elng) * M_PER_DEG_LAT * coslat
            if math.hypot(dlat, dlng) <= NEAR_M:
                cover[idx] = i + 1
                break

    add_events = [0] * (n_max + 1)
    add_hours = [0.0] * (n_max + 1)
    for idx in range(len(ev)):
        r = cover[idx]
        if r is not None:
            add_events[r] += 1
            add_hours[r] += hours[idx]

    total_cong_hours = sum(hours)
    cum_events, cum_hours, cum_impact_pct, cong_pct = [], [], [], []
    run_e, run_h, run_imp = 0, 0.0, 0
    for n in range(1, n_max + 1):
        run_e += add_events[n]
        run_h += add_hours[n]
        run_imp += top[n - 1]["impact"]
        cum_events.append(run_e)
        cum_hours.append(round(run_h))
        cum_impact_pct.append(round(100 * run_imp / max(total_impact, 1), 1))
        cong_pct.append(round(100 * run_h / max(total_cong_hours, 1), 1))

    out = {
        "nMax": n_max,
        "radiusM": NEAR_M,
        "totalImpact": total_impact,
        "totalCongestionHours": round(total_cong_hours),
        "totalCongestionEvents": len(ev),
        "impactPct": cum_impact_pct,
        "congHours": cum_hours,
        "congPct": cong_pct,
        "events": cum_events,
    }
    os.makedirs(OUT, exist_ok=True)
    dest = os.path.join(OUT, "simulator.json")
    with open(dest, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote simulator.json: nMax={n_max} -> impact={cum_impact_pct[-1]}% "
          f"congHours={cum_hours[-1]} ({cong_pct[-1]}%) events={cum_events[-1]}")


if __name__ == "__main__":
    main()
