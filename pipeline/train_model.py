#!/usr/bin/env python3
"""Train a spatio-temporal model that predicts parking-violation intensity.

Learns violations-per-cell-per-hour-of-week from the parking dataset and writes
public/data/prediction.json: held-out accuracy (R^2, MAE), what drives the prediction
(feature importance), and a predicted-vs-actual daily pattern for the #1 hotspot.

Requires numpy + scikit-learn (pipeline/requirements.txt). Run with the project venv:
    .venv/bin/python pipeline/train_model.py
"""
import csv
import glob
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "data"))
BBOX = (11.5, 14.0, 76.5, 78.5)
CELL = 0.002
TOP_CELLS = 1200
IST = timedelta(hours=5, minutes=30)


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


def ist_hour_dow(s):
    if not s or len(s) < 19 or not s[0].isdigit():
        return -1, -1
    try:
        dt = datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S") + IST
        return dt.hour, dt.weekday()
    except Exception:
        return -1, -1


def feats(lat, lng, hh, dw):
    return [
        lat,
        lng,
        math.sin(2 * math.pi * hh / 24),
        math.cos(2 * math.pi * hh / 24),
        math.sin(2 * math.pi * dw / 7),
        math.cos(2 * math.pi * dw / 7),
        1.0 if dw >= 5 else 0.0,
    ]


def main():
    path = find_raw()
    print(f"reading {path}")
    lo_lat, hi_lat, lo_lng, hi_lng = BBOX

    counts = defaultdict(lambda: np.zeros(168, dtype=np.int32))  # cell -> [hour*7+dow]
    slat, slng, total = defaultdict(float), defaultdict(float), defaultdict(int)
    with open(path, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        col = {n: i for i, n in enumerate(header)}
        iLat, iLng, iCre = col["latitude"], col["longitude"], col["created_datetime"]
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
            hh, dw = ist_hour_dow(row[iCre])
            if hh < 0:
                continue
            ck = (round(lat / CELL), round(lng / CELL))
            counts[ck][hh * 7 + dw] += 1
            slat[ck] += lat
            slng[ck] += lng
            total[ck] += 1
    print(f"cells={len(counts)}")

    top = sorted(total, key=lambda c: total[c], reverse=True)[:TOP_CELLS]
    X, y = [], []
    for ck in top:
        clat, clng = slat[ck] / total[ck], slng[ck] / total[ck]
        arr = counts[ck]
        for hh in range(24):
            for dw in range(7):
                X.append(feats(clat, clng, hh, dw))
                y.append(int(arr[hh * 7 + dw]))
    X = np.array(X)
    y = np.array(y, dtype=float)
    print(f"samples={len(y)}")

    Xtr, Xte, ytr, yte = train_test_split(
        X, np.log1p(y), test_size=0.2, random_state=42
    )
    model = RandomForestRegressor(
        n_estimators=120, max_depth=18, n_jobs=-1, random_state=42
    )
    model.fit(Xtr, ytr)
    pred = np.expm1(model.predict(Xte))
    true = np.expm1(yte)
    r2 = r2_score(true, pred)
    mae = mean_absolute_error(true, pred)
    print(f"R2={r2:.3f} MAE={mae:.2f}")

    imp = model.feature_importances_
    groups = {
        "location": imp[0] + imp[1],
        "hour of day": imp[2] + imp[3],
        "day of week": imp[4] + imp[5],
        "weekend": imp[6],
    }
    importances = sorted(
        ([k, round(float(v), 3)] for k, v in groups.items()), key=lambda z: -z[1]
    )

    # predicted-vs-actual daily pattern for the #1 hotspot
    with open(os.path.join(OUT, "hotspots.json")) as f:
        hotspots = json.load(f)
    h0 = hotspots[0]
    pred_hourly = []
    for hh in range(24):
        rows = [feats(h0["lat"], h0["lng"], hh, dw) for dw in range(7)]
        pred_hourly.append(round(float(np.expm1(model.predict(np.array(rows))).sum()), 1))

    out = {
        "model": "RandomForestRegressor · 120 trees",
        "target": "parking violations per ~220 m cell, per hour-of-week",
        "metrics": {
            "r2": round(float(r2), 3),
            "mae": round(float(mae), 2),
            "nTrain": int(len(ytr)),
            "nTest": int(len(yte)),
        },
        "importances": importances,
        "sample": {
            "station": h0.get("station") or h0.get("location", "")[:40],
            "actual": h0["hourly"],
            "predicted": pred_hourly,
        },
    }
    with open(os.path.join(OUT, "prediction.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print("wrote prediction.json", out["metrics"], importances)


if __name__ == "__main__":
    main()
