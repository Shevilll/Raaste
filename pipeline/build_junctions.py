#!/usr/bin/env python3
"""Roll parking violations up to Bengaluru's named traffic junctions.

Reads the anonymised violation CSV, keeps the rows the police already tagged to a named
junction (junction_name like "BTP082 - KR Market Junction"), and writes:

  public/data/junctions.json  ranked junctions with a severity-weighted congestion-impact
                              score, hourly/day profiles, offence mix and a cross-reference
                              to real ASTraM congestion events nearby.

Junctions are how the traffic police actually operate, so this is the natural enforcement
unit on top of the raw grid-cell hotspots. ~48% of violations carry a junction tag.

Standard library only. Usage: python3 build_junctions.py
"""
import csv
import glob
import json
import math
import os
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "data"))

IST = timedelta(hours=5, minutes=30)
BBOX = (11.5, 14.0, 76.5, 78.5)
NEAR_M = 300                 # match build_congestion.py's radius
M_PER_DEG_LAT = 111320

# Same carriageway-obstruction weights as build_data.py (kept local so this script is standalone).
SEVERITY = {
    "PARKING IN A MAIN ROAD": 5,
    "PARKING NEAR ROAD CROSSING": 5,
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS": 5,
    "PARKING ON FOOTPATH": 4,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 4,
    "DOUBLE PARKING": 4,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 3,
    "PARKING OTHER THAN BUS STOP": 3,
    "WRONG PARKING": 2,
    "NO PARKING": 2,
}
DEFAULT_SEV = 1
NON_JUNCTION = {"", "NO JUNCTION", "NULL"}


def find_one(env, pattern, what):
    cands = []
    if os.environ.get(env):
        cands.append(os.environ[env])
    cands += [
        os.path.join(HERE, "..", "data", "raw"),
        os.path.join(HERE, "..", "..", "data", "raw"),
        os.path.join(os.getcwd(), "data", "raw"),
    ]
    for c in cands:
        hits = glob.glob(os.path.join(os.path.normpath(c), pattern))
        if hits:
            return hits[0]
    sys.exit(f"Could not find the {what} CSV. Set {env} or place it in data/raw/.")


def parse_types(raw):
    try:
        arr = json.loads(raw)
        if isinstance(arr, list):
            return [str(x).strip().upper() for x in arr if str(x).strip()]
    except Exception:
        pass
    return []


def severity_of(types):
    best = DEFAULT_SEV
    for t in types:
        s = SEVERITY.get(t, DEFAULT_SEV)
        if s > best:
            best = s
    return best


def ist_hour_dow(s):
    if not s or len(s) < 19 or not s[0].isdigit():
        return -1, -1
    try:
        dt = datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S") + IST
        return dt.hour, dt.weekday()   # Monday = 0, matching the web app's DAYS order
    except Exception:
        return -1, -1


def split_junction(name):
    """Split an already-stripped tag: 'BTP082 - KR Market Junction' -> ('BTP082', 'KR Market Junction')."""
    if " - " in name:
        code, label = name.split(" - ", 1)
        return code.strip(), label.strip()
    return None, name


def pretty(name):
    return name.title().replace("Etc", "etc.").replace("Or", "or")


def main():
    vpath = find_one("RAASTE_RAW", "*police violation*.csv", "violation")
    print(f"reading {vpath}")
    lo_lat, hi_lat, lo_lng, hi_lng = BBOX

    j_count = Counter()
    j_impact = Counter()
    j_lats, j_lngs = defaultdict(list), defaultdict(list)
    j_hour = defaultdict(lambda: [0] * 24)
    j_dow = defaultdict(lambda: [0] * 7)
    j_types = defaultdict(Counter)
    j_veh = defaultdict(Counter)
    j_station = defaultdict(Counter)
    j_name = {}
    j_code = {}

    with open(vpath, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        col = {name: i for i, name in enumerate(header)}
        iLat, iLng = col["latitude"], col["longitude"]
        iVeh, iVt = col["vehicle_type"], col["violation_type"]
        iCre, iSt = col["created_datetime"], col["police_station"]
        iJn = col["junction_name"]
        ncols = len(header)
        for row in reader:
            if len(row) < ncols:
                continue
            jraw = row[iJn].strip().strip('"')
            if jraw.upper() in NON_JUNCTION:
                continue
            try:
                lat, lng = float(row[iLat]), float(row[iLng])
            except ValueError:
                continue
            if not (lo_lat < lat < hi_lat and lo_lng < lng < hi_lng):
                continue
            code, label = split_junction(jraw)
            key = code or label
            j_name.setdefault(key, label)
            j_code.setdefault(key, code)
            types = parse_types(row[iVt])
            j_count[key] += 1
            j_impact[key] += severity_of(types)
            j_lats[key].append(lat)
            j_lngs[key].append(lng)
            for t in (types or ["OTHER"]):
                j_types[key][t] += 1
            j_veh[key][row[iVeh].strip().upper()] += 1
            st = row[iSt].strip()
            if st:
                j_station[key][st] += 1
            hr, dw = ist_hour_dow(row[iCre])
            if hr >= 0:
                j_hour[key][hr] += 1
                j_dow[key][dw] += 1

    keys = sorted(j_count, key=lambda k: j_impact[k], reverse=True)
    max_impact = max((j_impact[k] for k in keys), default=1)
    print(f"junctions={len(keys)} tagged_violations={sum(j_count.values())}")

    # Cross-reference ASTraM congestion events (same logic/radius as build_congestion.py).
    epath = find_one("RAASTE_EVENTS", "*Astram*event*.csv", "ASTraM event")
    events = []
    with open(epath, newline="") as fh:
        for row in csv.DictReader(fh):
            try:
                lat, lng = float(row["latitude"]), float(row["longitude"])
            except (ValueError, TypeError, KeyError):
                continue
            if lo_lat < lat < hi_lat and lo_lng < lng < hi_lng:
                events.append((lat, lng))
    near_lat = NEAR_M / M_PER_DEG_LAT

    junctions = []
    for i, k in enumerate(keys):
        cnt = j_count[k]
        impact = j_impact[k]
        clat = round(statistics.median(j_lats[k]), 5)
        clng = round(statistics.median(j_lngs[k]), 5)
        hours, days = j_hour[k], j_dow[k]
        coslat = math.cos(math.radians(clat))
        near_lng = NEAR_M / (M_PER_DEG_LAT * coslat)
        cong, best = 0, 1e9
        for elat, elng in events:
            if abs(elat - clat) > near_lat * 4 or abs(elng - clng) > near_lng * 4:
                continue
            d = math.hypot((elat - clat) * M_PER_DEG_LAT, (elng - clng) * M_PER_DEG_LAT * coslat)
            if d < best:
                best = d
            if d <= NEAR_M:
                cong += 1
        junctions.append({
            "id": k,
            "code": j_code[k],
            "name": j_name[k],
            "rank": i + 1,
            "lat": clat,
            "lng": clng,
            "count": cnt,
            "impact": impact,
            "score": round(100 * impact / max_impact, 1),
            "topTypes": [[pretty(t), c] for t, c in j_types[k].most_common(4)],
            "vehicle": pretty(j_veh[k].most_common(1)[0][0]) if j_veh[k] else "",
            "station": j_station[k].most_common(1)[0][0] if j_station[k] else "",
            "peakHour": max(range(24), key=lambda h: hours[h]) if sum(hours) else None,
            "peakDow": max(range(7), key=lambda d: days[d]) if sum(days) else None,
            "hourly": hours,
            "daily": days,
            "congestionNearby": cong,
            "minDistM": round(best) if best < 1e9 else None,
        })

    # Totals + Pareto headline, using the already-built summary.json for the denominators.
    impact_at = sum(j_impact.values())
    viol_at = sum(j_count.values())
    total_viol = total_impact = 0
    try:
        with open(os.path.join(OUT, "summary.json")) as f:
            s = json.load(f)
            total_viol = s.get("totalViolations", 0)
            total_impact = s.get("totalImpact", 0)
    except FileNotFoundError:
        pass

    out = {
        "junctions": junctions,
        "count": len(junctions),
        "violationsAtJunctions": viol_at,
        "pctOfViolations": round(100 * viol_at / total_viol, 1) if total_viol else 0,
        "impactAtJunctions": impact_at,
        "pctOfImpact": round(100 * impact_at / total_impact, 1) if total_impact else 0,
        "radiusM": NEAR_M,
    }
    os.makedirs(OUT, exist_ok=True)
    dest = os.path.join(OUT, "junctions.json")
    with open(dest, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote junctions.json: {os.path.getsize(dest) / 1024:.0f} KB "
          f"({out['pctOfImpact']}% of impact at {out['count']} junctions)")


if __name__ == "__main__":
    main()
