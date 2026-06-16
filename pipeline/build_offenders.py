#!/usr/bin/env python3
"""Repeat-offender intelligence from the parking-violation dataset.

Counts violations per (anonymised) vehicle and writes public/data/offenders.json:
how concentrated violations are among a small set of vehicles, plus the worst
repeat offenders — so enforcement can target habitual violators rather than
chasing one-off tickets.

Standard library only.
"""
import csv
import glob
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "data"))


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


def main():
    path = find_raw()
    print(f"reading {path}")
    counts = Counter()
    vtype = {}
    n = 0
    with open(path, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        col = {name: i for i, name in enumerate(header)}
        iV, iVt = col["vehicle_number"], col["vehicle_type"]
        ncols = len(header)
        for row in reader:
            if len(row) < ncols:
                continue
            v = row[iV].strip()
            if not v or v == "NULL":
                continue
            counts[v] += 1
            n += 1
            t = row[iVt].strip().title()
            if t:
                vtype[v] = t

    total_vehicles = len(counts)
    ranked = counts.most_common()
    k = max(1, total_vehicles // 100)  # top 1% of vehicles
    top1 = sum(c for _, c in ranked[:k])
    share1 = round(100 * top1 / n, 1) if n else 0
    repeat = sum(1 for _, c in ranked if c > 1)

    out = {
        "totalVehicles": total_vehicles,
        "totalViolations": n,
        "repeatOffenders": repeat,
        "top1pct": {"vehicles": k, "share": share1},
        "offenders": [
            {"vehicle": v, "count": c, "type": vtype.get(v, "")} for v, c in ranked[:15]
        ],
    }
    with open(os.path.join(OUT, "offenders.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(
        f"offenders.json: {total_vehicles} vehicles, {repeat} repeat offenders, "
        f"top 1% = {share1}% of violations"
    )


if __name__ == "__main__":
    main()
