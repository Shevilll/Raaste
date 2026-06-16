#!/usr/bin/env python3
"""Estimate enforceable parking-fine value and surface enforcement-data integrity.

Reads the anonymised violation CSV and writes public/data/fines.json:
  * potential fine value — each challan priced at the Bengaluru Traffic Police compounding
    rate for its most serious offence
  * how that value splits by validation_status (approved / rejected / still pending)
  * the rejection rate among reviewed challans, and the top stations by fine value

Standard library only. Usage: python3 build_fines.py
"""
import csv
import glob
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "data"))

# Bengaluru Traffic Police compounding amounts (rupees). The most serious offence on a
# challan sets its fine; carriageway/junction-blocking offences carry the higher rate.
FINE = {
    "PARKING IN A MAIN ROAD": 1000,
    "PARKING NEAR ROAD CROSSING": 1000,
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS": 1000,
    "PARKING ON FOOTPATH": 1000,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 1000,
    "DOUBLE PARKING": 1000,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 500,
    "PARKING OTHER THAN BUS STOP": 500,
    "WRONG PARKING": 500,
    "NO PARKING": 500,
}
DEFAULT_FINE = 500
STATUS_ORDER = ["approved", "rejected", "pending", "processing", "duplicate"]


def find_raw():
    cands = []
    if os.environ.get("RAASTE_RAW"):
        cands.append(os.environ["RAASTE_RAW"])
    cands += [
        os.path.join(HERE, "..", "data", "raw"),
        os.path.join(HERE, "..", "..", "data", "raw"),
        os.path.join(os.getcwd(), "data", "raw"),
    ]
    for c in cands:
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


def fine_of(types):
    best = DEFAULT_FINE
    for t in types:
        f = FINE.get(t, DEFAULT_FINE)
        if f > best:
            best = f
    return best


def pretty(name):
    return name.title().replace("Etc", "etc.").replace("Or", "or")


def main():
    path = find_raw()
    print(f"reading {path}")

    n = 0
    total_fine = 0
    status_count, status_fine = Counter(), Counter()
    station_fine, station_count = Counter(), Counter()

    with open(path, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        col = {name: i for i, name in enumerate(header)}
        iVt = col["violation_type"]
        iVal = col["validation_status"]
        iSt = col["police_station"]
        ncols = len(header)
        for row in reader:
            if len(row) < ncols:
                continue
            n += 1
            fine = fine_of(parse_types(row[iVt]))
            total_fine += fine
            status = (row[iVal] or "").strip().lower()
            if status in ("", "null"):
                status = "pending"
            status_count[status] += 1
            status_fine[status] += fine
            st = row[iSt].strip()
            if st:
                station_fine[st] += fine
                station_count[st] += 1

    approved = status_count.get("approved", 0)
    rejected = status_count.get("rejected", 0)
    reviewed = approved + rejected
    pending = status_count.get("pending", 0)

    statuses = [s for s in STATUS_ORDER if status_count.get(s, 0)]
    statuses += [s for s in status_count if s not in statuses]

    out = {
        "totalViolations": n,
        "totalPotentialCrore": round(total_fine / 1e7, 1),
        "realizedCrore": round(status_fine.get("approved", 0) / 1e7, 1),
        "avgFine": round(total_fine / max(n, 1)),
        "validation": [[s, status_count[s], round(status_fine[s] / 1e7, 2)] for s in statuses],
        "reviewed": reviewed,
        "rejectedPct": round(100 * rejected / max(reviewed, 1), 1),
        "pendingPct": round(100 * pending / max(n, 1), 1),
        "byStation": [[s, round(station_fine[s] / 1e7, 2), station_count[s]]
                      for s, _ in station_fine.most_common(10)],
        "fineSchedule": [[pretty(t), FINE[t]] for t in FINE] + [["Other", DEFAULT_FINE]],
    }
    os.makedirs(OUT, exist_ok=True)
    dest = os.path.join(OUT, "fines.json")
    with open(dest, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote fines.json: {n} challans, ₹{out['totalPotentialCrore']}cr potential, "
          f"{out['rejectedPct']}% of reviewed rejected, {out['pendingPct']}% pending")


if __name__ == "__main__":
    main()
