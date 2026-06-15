#!/usr/bin/env python3
"""Build the map/intelligence aggregates Raaste serves to the browser.

Reads the large anonymised Bengaluru parking-violation CSV and writes three small JSON
files the web app consumes:

  public/data/summary.json   city totals, time-of-day / day-of-week distributions, legends
  public/data/hotspots.json  ranked ~220 m grid cells with a congestion-impact score
  public/data/points.json    a sampled point set for the density heatmap

Each violation gets a severity weight (how badly that offence chokes the carriageway); a
cell's impact is the sum of severities inside it, so the ranking rewards both volume and
how disruptive the parking is — not raw counts alone.

Standard library only: runs anywhere with Python 3, no third-party packages.
Usage: python3 build_data.py   (raw CSV auto-located, or set RAASTE_RAW=/path/to/dir)
"""
import csv
import glob
import json
import os
import random
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "data"))

IST = timedelta(hours=5, minutes=30)   # dataset timestamps are UTC; enforcement cares about local time
CELL = 0.002                           # ~220 m grid cells
TOP_HOTSPOTS = 500
SAMPLE_SIZE = 50000
SEED = 42
BBOX = (11.5, 14.0, 76.5, 78.5)        # sane lat/lng bounds around Bengaluru

# How much each offence obstructs moving traffic (1 = minor, 5 = severe carriageway/junction block).
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

TYPE_ORDER = [
    "WRONG PARKING", "NO PARKING", "PARKING IN A MAIN ROAD", "PARKING ON FOOTPATH",
    "DOUBLE PARKING", "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC", "PARKING NEAR ROAD CROSSING",
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS", "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE",
    "PARKING OTHER THAN BUS STOP",
]
TYPE_IDX = {t: i for i, t in enumerate(TYPE_ORDER)}
OTHER_TYPE = len(TYPE_ORDER)

VEHICLE_ORDER = ["SCOOTER", "CAR", "MOTOR CYCLE", "PASSENGER AUTO", "MAXI-CAB", "LGV", "GOODS AUTO", "MOPED"]
VEH_IDX = {v: i for i, v in enumerate(VEHICLE_ORDER)}
OTHER_VEH = len(VEHICLE_ORDER)


def find_raw():
    candidates = []
    if os.environ.get("RAASTE_RAW"):
        candidates.append(os.environ["RAASTE_RAW"])
    candidates += [
        os.path.join(HERE, "..", "data", "raw"),
        os.path.join(HERE, "..", "..", "data", "raw"),
        os.path.join(os.getcwd(), "data", "raw"),
    ]
    for c in candidates:
        hits = glob.glob(os.path.join(os.path.normpath(c), "*police violation*.csv"))
        if hits:
            return hits[0]
    sys.exit("Could not find the violation CSV. Set RAASTE_RAW or place it in data/raw/.")


def parse_types(raw):
    try:
        arr = json.loads(raw)
        if isinstance(arr, list):
            return [str(x).strip().upper() for x in arr if str(x).strip()]
    except Exception:
        pass
    return []


def representative(types):
    """The most disruptive offence on a violation, with its severity."""
    best_sev, best = DEFAULT_SEV, (types[0] if types else "OTHER")
    for t in types:
        s = SEVERITY.get(t, DEFAULT_SEV)
        if s >= best_sev:
            best_sev, best = s, t
    return best_sev, best


def ist_hour_dow(s):
    if not s or len(s) < 19 or not s[0].isdigit():
        return -1, -1
    try:
        dt = datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S") + IST
        return dt.hour, dt.weekday()   # Monday = 0
    except Exception:
        return -1, -1


def cellkey(lat, lng):
    return (round(lat / CELL), round(lng / CELL))


def pretty(name):
    return name.title().replace("Etc", "etc.").replace("Or", "or")


def main():
    path = find_raw()
    print(f"reading {path}")
    lo_lat, hi_lat, lo_lng, hi_lng = BBOX

    cell_count, cell_sev = Counter(), Counter()
    cell_slat, cell_slng = defaultdict(float), defaultdict(float)
    type_counts, veh_counts = Counter(), Counter()
    station_counts, station_sev = Counter(), Counter()
    hourly, daily = [0] * 24, [0] * 7
    hourdow = [[0] * 24 for _ in range(7)]
    n = geo = 0
    sum_lat = sum_lng = 0.0
    dmin = dmax = None
    rng = random.Random(SEED)
    sample, seen = [], 0

    with open(path, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        col = {name: i for i, name in enumerate(header)}
        iLat, iLng = col["latitude"], col["longitude"]
        iVeh, iVt = col["vehicle_type"], col["violation_type"]
        iCre, iSt = col["created_datetime"], col["police_station"]
        ncols = len(header)
        for row in reader:
            n += 1
            if len(row) < ncols:
                continue
            try:
                lat, lng = float(row[iLat]), float(row[iLng])
            except ValueError:
                continue
            if not (lo_lat < lat < hi_lat and lo_lng < lng < hi_lng):
                continue
            geo += 1
            types = parse_types(row[iVt])
            sev, rep = representative(types)
            veh = row[iVeh].strip().upper()
            station = row[iSt].strip()
            hr, dw = ist_hour_dow(row[iCre])
            ck = cellkey(lat, lng)

            cell_count[ck] += 1
            cell_sev[ck] += sev
            cell_slat[ck] += lat
            cell_slng[ck] += lng
            for t in (types or ["OTHER"]):
                type_counts[t] += 1
            veh_counts[veh] += 1
            if station:
                station_counts[station] += 1
                station_sev[station] += sev
            if hr >= 0:
                hourly[hr] += 1
                daily[dw] += 1
                hourdow[dw][hr] += 1
            sum_lat += lat
            sum_lng += lng
            day = row[iCre][:10]
            if day[:1].isdigit():
                dmin = day if dmin is None or day < dmin else dmin
                dmax = day if dmax is None or day > dmax else dmax

            seen += 1
            rec = [round(lat, 5), round(lng, 5),
                   TYPE_IDX.get(rep, OTHER_TYPE), VEH_IDX.get(veh, OTHER_VEH), hr, dw]
            if len(sample) < SAMPLE_SIZE:
                sample.append(rec)
            else:
                j = rng.randint(0, seen - 1)
                if j < SAMPLE_SIZE:
                    sample[j] = rec

    print(f"rows={n} geo={geo} cells={len(cell_count)} dates={dmin}..{dmax}")

    top = sorted(cell_count, key=lambda c: cell_sev[c], reverse=True)[:TOP_HOTSPOTS]
    topset = set(top)
    max_impact = max((cell_sev[c] for c in top), default=1)

    # Second pass: rich breakdown only for the cells that made the ranking.
    h_types, h_veh, h_station = defaultdict(Counter), defaultdict(Counter), defaultdict(Counter)
    h_hour = defaultdict(lambda: [0] * 24)
    h_dow = defaultdict(lambda: [0] * 7)
    h_loc = {}
    iLoc = col["location"]
    with open(path, newline="") as fh:
        reader = csv.reader(fh)
        next(reader)
        for row in reader:
            if len(row) < ncols:
                continue
            try:
                lat, lng = float(row[iLat]), float(row[iLng])
            except ValueError:
                continue
            ck = cellkey(lat, lng)
            if ck not in topset:
                continue
            for t in (parse_types(row[iVt]) or ["OTHER"]):
                h_types[ck][t] += 1
            h_veh[ck][row[iVeh].strip().upper()] += 1
            st = row[iSt].strip()
            if st:
                h_station[ck][st] += 1
            hr, dw = ist_hour_dow(row[iCre])
            if hr >= 0:
                h_hour[ck][hr] += 1
                h_dow[ck][dw] += 1
            if ck not in h_loc:
                h_loc[ck] = row[iLoc].strip().strip('"')[:120]

    hotspots = []
    for i, ck in enumerate(top):
        cnt = cell_count[ck]
        impact = cell_sev[ck]
        hot_hours, hot_days = h_hour[ck], h_dow[ck]
        hotspots.append({
            "id": f"h{i}",
            "rank": i + 1,
            "lat": round(cell_slat[ck] / cnt, 5),
            "lng": round(cell_slng[ck] / cnt, 5),
            "count": cnt,
            "impact": impact,
            "score": round(100 * impact / max_impact, 1),
            "topTypes": [[pretty(t), c] for t, c in h_types[ck].most_common(4)],
            "vehicle": pretty(h_veh[ck].most_common(1)[0][0]) if h_veh[ck] else "",
            "station": h_station[ck].most_common(1)[0][0] if h_station[ck] else "",
            "location": h_loc.get(ck, ""),
            "peakHour": max(range(24), key=lambda h: hot_hours[h]) if sum(hot_hours) else None,
            "peakDow": max(range(7), key=lambda d: hot_days[d]) if sum(hot_days) else None,
            "hourly": hot_hours,
            "daily": hot_days,
        })

    summary = {
        "totalViolations": n,
        "geoViolations": geo,
        "dateRange": [dmin, dmax],
        "cityCenter": [round(sum_lat / max(geo, 1), 5), round(sum_lng / max(geo, 1), 5)],
        "numHotspots": len(hotspots),
        "sampleSize": len(sample),
        "violationTypes": [[pretty(t), c] for t, c in type_counts.most_common(20)],
        "vehicleTypes": [[pretty(v), c] for v, c in veh_counts.most_common(10)],
        "topStations": [[s, station_counts[s], station_sev[s]] for s, _ in station_counts.most_common(15)],
        "hourly": hourly,
        "daily": daily,
        "hourDow": hourdow,
        "typeLegend": [pretty(t) for t in TYPE_ORDER] + ["Other"],
        "vehicleLegend": [pretty(v) for v in VEHICLE_ORDER] + ["Other"],
    }

    os.makedirs(OUT, exist_ok=True)
    writes = {"summary.json": summary, "hotspots.json": hotspots, "points.json": {"points": sample}}
    for name, obj in writes.items():
        with open(os.path.join(OUT, name), "w") as f:
            json.dump(obj, f, separators=(",", ":"))
        print(f"wrote {name}: {os.path.getsize(os.path.join(OUT, name)) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
