"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Flag } from "lucide-react";
import type { BeatSheet } from "@/lib/beatsheet";
import {
  emptyShiftLog,
  loadShiftLog,
  saveShiftLog,
  clearShiftLog,
  recordOutcome,
  undoLast,
  visitedInOrder,
  tally,
  localDate,
  browserStore,
  type ShiftLog,
  type Outcome,
} from "@/lib/fieldShift";
import { orderByDistance, haversine } from "@/lib/geo";
import { useGeolocation } from "@/lib/useGeolocation";
import { fmt } from "@/lib/format";
import CornerCard from "@/components/field/CornerCard";
import ShiftSummary from "@/components/field/ShiftSummary";

export default function FieldShift({
  sheet,
  radiusM,
}: {
  sheet: BeatSheet;
  radiusM: number;
}) {
  const date = useMemo(() => localDate(new Date()), []);
  const [log, setLog] = useState<ShiftLog>(() =>
    emptyShiftLog(sheet.station, sheet.shift.id, date),
  );
  const [nearestFirst, setNearestFirst] = useState(false);
  const [ended, setEnded] = useState(false);
  const geo = useGeolocation(true);

  // Hydrate any saved progress for this beat once on mount (client only).
  useEffect(() => {
    const store = browserStore();
    if (!store) return;
    const saved = loadShiftLog(sheet.station, sheet.shift.id, date, store);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLog(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: ShiftLog) => {
    setLog(next);
    const store = browserStore();
    if (store) saveShiftLog(next, store);
  };

  const remaining = useMemo(() => {
    const left = sheet.corners.filter((c) => !log.entries[c.hotspot.id]);
    if (nearestFirst && geo.coords) {
      return orderByDistance(left, geo.coords.lat, geo.coords.lng);
    }
    return left;
  }, [sheet.corners, log.entries, nearestFirst, geo.coords]);

  const t = tally(log);

  // Pin the corner being shown. "remaining" re-sorts on every GPS tick under
  // nearest-first, so without a lock the card could swap out from under the
  // officer mid-tap; the active corner only advances once it's actioned (and
  // leaves "remaining") or the officer steps back.
  const [activeId, setActiveId] = useState<string | null>(null);
  const pinned = activeId
    ? remaining.find((c) => c.hotspot.id === activeId)
    : undefined;
  const current = pinned ?? remaining[0] ?? null;
  useEffect(() => {
    const id = current ? current.hotspot.id : null;
    if (id !== activeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(id);
    }
  }, [current, activeId]);

  // Position by how many corners are already done, so the "Corner X of N" label
  // and progress bar stay monotonic even when "nearest first" reorders what's left.
  const currentIndex = current ? sheet.corners.length - remaining.length : -1;

  const distanceKm =
    current && geo.coords
      ? haversine(geo.coords.lat, geo.coords.lng, current.hotspot.lat, current.hotspot.lng)
      : null;

  const act = (o: Outcome) => {
    if (!current) return;
    persist(recordOutcome(log, current.hotspot.id, o, current.fine, Date.now()));
  };

  const back = () => {
    const ordered = visitedInOrder(log);
    if (!ordered.length) return;
    // Re-open the corner we most recently actioned and show it again.
    setActiveId(ordered[ordered.length - 1].cornerId);
    persist(undoLast(log));
  };

  const navigate = () => {
    if (!current) return;
    const { lat, lng } = current.hotspot;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const reset = () => {
    const store = browserStore();
    if (store) clearShiftLog(sheet.station, sheet.shift.id, date, store);
    setLog(emptyShiftLog(sheet.station, sheet.shift.id, date));
    setActiveId(null);
    setEnded(false);
  };

  const issuedDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  // Done when every corner is recorded, or the officer ends the shift early.
  const finished = ended || (sheet.corners.length > 0 && remaining.length === 0);

  if (finished) {
    return (
      <ShiftSummary sheet={sheet} log={log} issuedDate={issuedDate} onReset={reset} />
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => geo.supported && setNearestFirst((v) => !v)}
          disabled={!geo.supported || !geo.coords}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
            nearestFirst
              ? "bg-amber-500 text-slate-950"
              : "bg-[var(--chip)] text-[var(--text-muted)] hover:bg-[var(--track)]"
          } disabled:opacity-50`}
          title={geo.coords ? "Order corners by your distance" : "Location off"}
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Nearest first
        </button>
        <button
          onClick={() => setEnded(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--chip)]"
        >
          <Flag className="h-3.5 w-3.5" aria-hidden />
          End shift
        </button>
      </div>

      {current && (
        <CornerCard
          corner={current}
          index={currentIndex}
          total={sheet.corners.length}
          distanceKm={distanceKm}
          radiusM={radiusM}
          canBack={t.visited > 0}
          onNavigate={navigate}
          onOutcome={act}
          onBack={back}
        />
      )}

      <div className="mt-4 border-t border-[var(--border)] pt-3 text-center text-xs text-[var(--text-muted)]">
        Shift: <span className="font-semibold text-[var(--text)]">{t.actioned}</span> actioned ·{" "}
        <span className="font-semibold text-[var(--accent-text)]">₹{fmt(t.rupees)}</span> logged
        {geo.error && !geo.coords ? " · location off" : ""}
      </div>
    </div>
  );
}
