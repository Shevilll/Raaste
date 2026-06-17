// The state of a constable's patrol shift: which corners were actioned and how.
//
// This is pure data + helpers so it can be unit-tested and reused. The React
// view holds a ShiftLog in state and mirrors it to localStorage (via the
// injected `store`) so closing the phone mid-shift resumes where it left off.

import type { BeatCorner } from "@/lib/beatsheet";
import { haversine } from "@/lib/geo";

export type Outcome = "issued" | "cleared" | "skip";

export interface CornerLog {
  cornerId: string; // hotspot id
  outcome: Outcome;
  fine: number; // representative fine for the corner (counts only when issued)
  at: number; // epoch ms when recorded
}

export interface ShiftLog {
  station: string;
  shiftId: string;
  date: string; // YYYY-MM-DD, device-local
  entries: Record<string, CornerLog>; // keyed by cornerId, latest outcome wins
}

export interface ShiftTally {
  issued: number;
  cleared: number;
  skipped: number;
  actioned: number; // issued + cleared
  visited: number; // total corners recorded
  rupees: number; // sum of fine over issued corners
}

// A minimal slice of Web Storage so we can inject a fake in tests.
export type Storageish = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Device-local calendar day, so a shift resets at midnight wherever the officer is.
export function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftStorageKey(
  station: string,
  shiftId: string,
  date: string,
): string {
  return `raaste:shift:${station}|${shiftId}|${date}`;
}

export function emptyShiftLog(
  station: string,
  shiftId: string,
  date: string,
): ShiftLog {
  return { station, shiftId, date, entries: {} };
}

export function recordOutcome(
  log: ShiftLog,
  cornerId: string,
  outcome: Outcome,
  fine: number,
  at: number,
): ShiftLog {
  return {
    ...log,
    entries: { ...log.entries, [cornerId]: { cornerId, outcome, fine, at } },
  };
}

// Drop the most recently recorded corner (the "Back" action).
export function undoLast(log: ShiftLog): ShiftLog {
  const ordered = visitedInOrder(log);
  if (ordered.length === 0) return log;
  const lastId = ordered[ordered.length - 1].cornerId;
  const entries = { ...log.entries };
  delete entries[lastId];
  return { ...log, entries };
}

export function tally(log: ShiftLog): ShiftTally {
  const t: ShiftTally = {
    issued: 0,
    cleared: 0,
    skipped: 0,
    actioned: 0,
    visited: 0,
    rupees: 0,
  };
  for (const e of Object.values(log.entries)) {
    t.visited += 1;
    if (e.outcome === "issued") {
      t.issued += 1;
      t.actioned += 1;
      t.rupees += e.fine;
    } else if (e.outcome === "cleared") {
      t.cleared += 1;
      t.actioned += 1;
    } else {
      t.skipped += 1;
    }
  }
  return t;
}

export function visitedInOrder(log: ShiftLog): CornerLog[] {
  return Object.values(log.entries).sort((a, b) => a.at - b.at);
}

// Total distance over the corners in the order they were actioned.
export function distanceCoveredKm(corners: BeatCorner[], log: ShiftLog): number {
  const byId = new Map(corners.map((c) => [c.hotspot.id, c]));
  const path = visitedInOrder(log)
    .map((e) => byId.get(e.cornerId))
    .filter((c): c is BeatCorner => Boolean(c));
  let km = 0;
  for (let i = 1; i < path.length; i++) {
    km += haversine(
      path[i - 1].hotspot.lat,
      path[i - 1].hotspot.lng,
      path[i].hotspot.lat,
      path[i].hotspot.lng,
    );
  }
  return km;
}

// Time from first to last recorded action, in ms.
export function elapsedMs(log: ShiftLog): number {
  const ordered = visitedInOrder(log);
  if (ordered.length < 2) return 0;
  return ordered[ordered.length - 1].at - ordered[0].at;
}

export function loadShiftLog(
  station: string,
  shiftId: string,
  date: string,
  store: Storageish,
): ShiftLog {
  try {
    const raw = store.getItem(shiftStorageKey(station, shiftId, date));
    if (!raw) return emptyShiftLog(station, shiftId, date);
    const parsed = JSON.parse(raw) as ShiftLog;
    if (!parsed || typeof parsed !== "object" || !parsed.entries) {
      return emptyShiftLog(station, shiftId, date);
    }
    return { station, shiftId, date, entries: parsed.entries };
  } catch {
    return emptyShiftLog(station, shiftId, date);
  }
}

export function saveShiftLog(log: ShiftLog, store: Storageish): void {
  try {
    store.setItem(
      shiftStorageKey(log.station, log.shiftId, log.date),
      JSON.stringify(log),
    );
  } catch {
    // private mode / quota — fall back to in-memory state for the session
  }
}

export function clearShiftLog(
  station: string,
  shiftId: string,
  date: string,
  store: Storageish,
): void {
  try {
    store.removeItem(shiftStorageKey(station, shiftId, date));
  } catch {
    // ignore
  }
}

// Resolve the browser's localStorage, or null where it is unavailable.
export function browserStore(): Storageish | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // access can throw in some privacy modes
  }
  return null;
}
