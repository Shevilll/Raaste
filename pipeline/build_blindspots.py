#!/usr/bin/env python3
"""Find the city's enforcement blind spots.

A blind spot is a corner the city is effectively blind to: heavy real ASTraM congestion sits
there, yet almost no parking enforcement happens. We bin both the congestion events and the
parking violations onto one shared ~500 m grid, then flag the cells that fall in the worst
quartile of congestion-hours but below the median for enforcement. Each one is named from the
ASTraM junction / corridor / address fields, so the output reads like a place, not a tile.

Writes public/data/blindspots.json. Standard library only — no third-party packages.
Usage: python3 build_blindspots.py
"""
import csv
import glob
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "data"))
BBOX = (11.5, 14.0, 76.5, 78.5)

CELL_B = 0.0045          # ~500 m grid cells
ENFORCE_WITHIN_M = 250   # nominal radius the per-cell enforcement count stands in for
MIN_EVENTS = 3           # noise floor: a blind spot needs at least this many congestion events
CONG_PCTL = 75           # congestion-hours must be in the top quartile to qualify
ENF_PCTL = 50            # enforcement must be at or below the median to qualify
SMOOTH = 5               # smoothing term in the blind-spot score denominator
TOP_LIST = 40            # how many blind spots to ship for the side panel

# A road-closure event chokes the carriageway harder; "High" priority events are the bad ones.
CLOSURE_W = 2.0
HIGH_PRI_W = 1.5

CAUSE_ORDER = [
    "congestion", "accident", "vehicle_breakdown", "water_logging", "pot_holes",
    "construction", "road_conditions", "tree_fall", "public_event", "procession",
    "vip_movement", "others",
]


def find_one(patterns, env, what):
    cands = []
    if os.environ.get(env):
        cands.append(os.environ[env])
    cands += [
        os.path.join(HERE, "..", "data", "raw"),
        os.path.join(HERE, "..", "..", "data", "raw"),
        os.path.join(os.getcwd(), "data", "raw"),
    ]
    for c in cands:
        for pat in patterns:
            hits = glob.glob(os.path.join(os.path.normpath(c), pat))
            if hits:
                return hits[0]
    sys.exit(f"Could not find the {what}. Set {env} or place it in data/raw/.")


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
    """Minutes from start to the first available end/resolved/closed time, clamped to (0, 24h]."""
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


def cellkey(lat, lng):
    return (round(lat / CELL_B), round(lng / CELL_B))


def pctl(sorted_vals, p):
    """Linear-interpolated percentile of an already-sorted list."""
    if not sorted_vals:
        return 0.0
    k = (len(sorted_vals) - 1) * p / 100.0
    f, c = math.floor(k), math.ceil(k)
    if f == c:
        return float(sorted_vals[int(k)])
    return sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f)


def clean_label(s, cap=42):
    s = " ".join((s or "").split()).strip().strip('"')
    if s.upper() in ("NULL", "NONE", "NA", "N/A", "-", ""):
        return ""
    # un-glue camelCase names for readability: "MekhriCircle" -> "Mekhri Circle",
    # "VeerannapalyaJunction(BEL,HO)" -> "Veerannapalya Junction (BEL,HO)"
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", s)
    s = re.sub(r"(?<=[A-Za-z])(?=\()", " ", s)
    s = " ".join(s.split())
    if len(s) > cap:
        s = s[: cap - 1].rstrip() + "…"
    return s


def main():
    lo_lat, hi_lat, lo_lng, hi_lng = BBOX

    # --- Congestion pass: read every ASTraM event, keep what we need in memory (small file) ---
    ev_path = find_one(["*Astram*event*.csv", "*astram*event*.csv"], "RAASTE_EVENTS", "ASTraM event CSV")
    print(f"reading {ev_path}")
    events = []  # (ck, lat, lng, cause, dur_or_None, weight, junction, corridor, address, station)
    with open(ev_path, newline="") as fh:
        for row in csv.DictReader(fh):
            try:
                lat, lng = float(row["latitude"]), float(row["longitude"])
            except (ValueError, TypeError, KeyError):
                continue
            if not (lo_lat < lat < hi_lat and lo_lng < lng < hi_lng):
                continue
            cause = (row.get("event_cause") or "").strip().lower()
            closure = (row.get("requires_road_closure") or "").strip().upper() == "TRUE"
            high = (row.get("priority") or "").strip() == "High"
            w = (CLOSURE_W if closure else 1.0) * (HIGH_PRI_W if high else 1.0)
            events.append((
                cellkey(lat, lng), round(lat, 5), round(lng, 5), cause,
                event_duration_min(row), w,
                clean_label(row.get("junction")), clean_label(row.get("corridor")),
                clean_label(row.get("address")), (row.get("police_station") or "").strip(),
            ))
    print(f"events in bbox = {len(events)}")
    if not events:
        sys.exit("No ASTraM events found inside the Bengaluru bounding box.")

    valid = sorted(e[4] for e in events if e[4] is not None)
    median_min = valid[len(valid) // 2] if valid else 50.0

    ev_count = Counter()
    cong_hours = defaultdict(float)        # weighted congestion-hours per cell
    slat, slng = defaultdict(float), defaultdict(float)
    cause_ct = defaultdict(Counter)
    junc_ct, corr_ct, addr_ct = defaultdict(Counter), defaultdict(Counter), defaultdict(Counter)
    ev_station_ct = defaultdict(Counter)
    for ck, lat, lng, cause, dur, w, junc, corr, addr, station in events:
        hrs = ((dur if dur is not None else median_min) / 60.0) * w
        ev_count[ck] += 1
        cong_hours[ck] += hrs
        slat[ck] += lat
        slng[ck] += lng
        if cause:
            cause_ct[ck][cause] += 1
        if junc:
            junc_ct[ck][junc] += 1
        if corr:
            corr_ct[ck][corr] += 1
        if addr:
            addr_ct[ck][addr] += 1
        if station:
            ev_station_ct[ck][station] += 1

    event_cells = set(ev_count)

    # --- Enforcement pass: count parking violations per cell on the same grid ---
    raw_path = find_one(["*police violation*.csv"], "RAASTE_RAW", "parking violation CSV")
    print(f"reading {raw_path}")
    enf_count = Counter()
    enf_station_ct = defaultdict(Counter)   # only tracked for cells that have congestion events
    total_enforcement = 0
    with open(raw_path, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        col = {name: i for i, name in enumerate(header)}
        iLat, iLng, iSt = col["latitude"], col["longitude"], col["police_station"]
        ncols = len(header)
        for row in reader:
            if len(row) < ncols:
                continue
            try:
                lat, lng = float(row[iLat]), float(row[iLng])
            except ValueError:
                continue
            if not (lo_lat < lat < hi_lat and lo_lng < lng < hi_lng):
                continue
            ck = cellkey(lat, lng)
            enf_count[ck] += 1
            total_enforcement += 1
            if ck in event_cells:
                st = row[iSt].strip()
                if st:
                    enf_station_ct[ck][st] += 1
    print(f"enforcement violations in bbox = {total_enforcement}")

    # --- Score & flag blind spots ---
    candidates = [ck for ck in event_cells if ev_count[ck] >= MIN_EVENTS]
    cong_sorted = sorted(cong_hours[ck] for ck in candidates)
    enf_sorted = sorted(enf_count.get(ck, 0) for ck in candidates)
    cong_thresh = pctl(cong_sorted, CONG_PCTL)
    enf_thresh = pctl(enf_sorted, ENF_PCTL)
    print(f"candidates={len(candidates)} congThresh(p{CONG_PCTL})={cong_thresh:.1f} "
          f"enfThresh(p{ENF_PCTL})={enf_thresh:.1f}")

    blind = [
        ck for ck in candidates
        if cong_hours[ck] >= cong_thresh and enf_count.get(ck, 0) <= enf_thresh
    ]
    blind.sort(key=lambda ck: cong_hours[ck] / (enf_count.get(ck, 0) + SMOOTH), reverse=True)

    total_cong_hours = sum(cong_hours.values())
    blind_cong_hours = sum(cong_hours[ck] for ck in blind)
    blind_enforcement = sum(enf_count.get(ck, 0) for ck in blind)

    def label_for(ck):
        for ctr in (junc_ct[ck], corr_ct[ck], addr_ct[ck]):
            if ctr:
                return ctr.most_common(1)[0][0]
        return f"near {round(slat[ck] / ev_count[ck], 4)}, {round(slng[ck] / ev_count[ck], 4)}"

    def station_for(ck):
        if enf_station_ct[ck]:
            return enf_station_ct[ck].most_common(1)[0][0]
        if ev_station_ct[ck]:
            return ev_station_ct[ck].most_common(1)[0][0]
        return ""

    blindspots = []
    for i, ck in enumerate(blind[:TOP_LIST]):
        n = ev_count[ck]
        top_cause = cause_ct[ck].most_common(1)[0][0].replace("_", " ") if cause_ct[ck] else "congestion"
        blindspots.append({
            "id": f"b{i}",
            "rank": i + 1,
            "lat": round(slat[ck] / n, 5),
            "lng": round(slng[ck] / n, 5),
            "name": label_for(ck),
            "station": station_for(ck),
            "events": n,
            "congHours": round(cong_hours[ck]),
            "enforcement": enf_count.get(ck, 0),
            "topCause": top_cause,
            "score": round(cong_hours[ck] / (enf_count.get(ck, 0) + SMOOTH), 1),
        })

    out = {
        "cellM": 500,
        "enforceWithinM": ENFORCE_WITHIN_M,
        "minEvents": MIN_EVENTS,
        "count": len(blind),
        "totalEvents": len(events),
        "totalCongHours": round(total_cong_hours),
        "totalEnforcement": total_enforcement,
        "pctCongInBlind": round(100 * blind_cong_hours / max(total_cong_hours, 1), 1),
        "pctEnforcementInBlind": round(100 * blind_enforcement / max(total_enforcement, 1), 2),
        "causeLegend": [c.replace("_", " ") for c in CAUSE_ORDER] + ["other"],
        "blindspots": blindspots,
    }
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, "blindspots.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"blind cells={len(blind)} "
          f"carrying {out['pctCongInBlind']}% of congestion-hours on "
          f"{out['pctEnforcementInBlind']}% of enforcement")
    print(f"wrote blindspots.json: {os.path.getsize(p) / 1024:.0f} KB")
    for b in blindspots[:8]:
        print(f"  #{b['rank']:<2} {b['name'][:34]:<34} ev={b['events']:<4} "
              f"congH={b['congHours']:<5} enforce={b['enforcement']:<5} ({b['station']})")


if __name__ == "__main__":
    main()
