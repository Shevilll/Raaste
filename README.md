# Raaste

Parking-congestion intelligence and enforcement planning for the Bengaluru Traffic Police.

Wrong and illegal parking is one of the biggest sources of street-level congestion in
Bengaluru, but it's hard to see in the data: every ticket is just a dot, and a dot doesn't
tell you which corners actually choke the city or what they cost. Raaste turns the
enforcement record into something a traffic officer can act on — where the problem is, what
it's worth, where congestion is going untouched, and what to patrol tomorrow.

## What it does

The app is one map-first dashboard plus two operational views, mirroring the chain of people
who'd actually use it.

- **`/` — City dashboard.** A live hotspot map (heatmap + ranked corners) you can scrub by
  hour of day and day of week. On top of it:
  - an **impact score** that weights each violation by how much it obstructs traffic, so a
    blocked main road outranks a quiet side street;
  - a **congestion overlay** that lines the parking hotspots up against real ASTraM
    congestion/incident events — the proof that these corners and the city's congestion are
    the same places;
  - an **enforcement blind-spot lens**: corners with heavy logged congestion but almost no
    parking enforcement — where attention *should* go and isn't;
  - a **forecast** that re-ranks corners by predicted violation intensity for any
    hour/day, and an **optimizer** that splits the top corners into patrol routes;
  - supporting panels for the recoverable fine value, a what-if enforcement simulator, and a
    per-junction drilldown.
- **`/briefing` — Patrol beat sheet.** Pick a station and a shift and get a printable
  one-pager: the corners to cover in driving order, expected violations, peak window, the
  dominant offence and vehicle, nearby congestion, and the fine value sitting there if
  enforced.
- **`/field` — Field mode.** The beat sheet, made for a constable's phone. Hand it off from
  the beat sheet with a QR scan, then work one corner at a time: live distance to the next
  corner, a tap to open native maps, log each stop as *issued / cleared / skipped*, watch the
  running tally, and finish with a printable shift report. Stays usable when GPS is off and
  resumes mid-shift if the page is reloaded.

## Data

Built on two anonymized, geocoded datasets:

- ~298,000 Bengaluru Traffic Police parking-violation records, November 2023 – April 2024
  (location, vehicle type, offence, timestamps, police station, junction).
- ASTraM congestion and incident events (congestion, accidents, breakdowns, water-logging)
  with priority, road-closure and corridor/junction context, used for the congestion overlay
  and the blind-spot analysis.

The raw exports are large and aren't committed. A small Python pipeline reads them and writes
compact JSON aggregates into `public/data/`, which is what the app loads — so the site runs
without the raw data.

## Tech

- **Next.js** (App Router, TypeScript) and **React**, deployed on Vercel.
- **Map:** the basemap is **MapmyIndia / Mappls**, with **deck.gl** drawing the hotspot,
  congestion and blind-spot layers on top. When a Mappls key isn't present (local dev, preview
  URLs) it falls back to CARTO raster tiles via MapLibre GL, so the map always renders.
  **Tailwind CSS** for styling; charts are hand-built SVG, no chart library.
- **Python** for the pipeline — standard library for the data shaping, **numpy** +
  **scikit-learn** for the model. The forecast is a random-forest regressor predicting
  violations per ~220 m cell per hour-of-week (R² ≈ 0.65 on a held-out test split).

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The committed aggregates in `public/data/` are enough to run
everything. Locally the map uses a CARTO basemap; set `NEXT_PUBLIC_MAPPLS_KEY` (a
domain-whitelisted Mappls web key) to render the MapmyIndia basemap in production.

### Regenerating the data (optional)

Only needed if you have the raw CSVs and want to rebuild the aggregates.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r pipeline/requirements.txt

# point the scripts at the violations CSV (or drop the files in ./data/raw/)
export RAASTE_RAW=/path/to/violations.csv

# each script writes one or more files into public/data/
python pipeline/build_data.py
python pipeline/build_congestion.py
python pipeline/build_junctions.py
python pipeline/build_fines.py
python pipeline/build_simulator.py
python pipeline/build_blindspots.py
python pipeline/train_model.py
```

## Layout

```
src/app/            routes — / (dashboard), /briefing (beat sheet), /field (field mode)
src/components/     map, panels, and the field-mode workflow
src/lib/            beat-sheet logic, routing/geo, shift log, formatting, types
pipeline/           Python scripts: raw CSV -> public/data/*.json
public/data/        committed JSON aggregates the app reads
```

## Credits

Built for the Bengaluru Traffic Police parking-congestion challenge (Gridlock 2.0). Mapping by
**MapmyIndia / Mappls**; the enforcement and congestion datasets come from the **Bengaluru
Traffic Police** and its **ASTraM** programme.
