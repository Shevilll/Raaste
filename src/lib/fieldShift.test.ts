import { describe, it, expect } from "vitest";
import type { BeatCorner } from "@/lib/beatsheet";
import {
  emptyShiftLog,
  recordOutcome,
  undoLast,
  tally,
  visitedInOrder,
  distanceCoveredKm,
  elapsedMs,
  shiftStorageKey,
  localDate,
  loadShiftLog,
  saveShiftLog,
  clearShiftLog,
  type Storageish,
} from "@/lib/fieldShift";

function corner(id: string, lat: number, lng: number, fine: number): BeatCorner {
  return {
    order: 1,
    hotspot: {
      id,
      rank: 1,
      lat,
      lng,
      count: 0,
      impact: 0,
      score: 0,
      topTypes: [],
      vehicle: "Car",
      station: "S",
      location: id,
      peakHour: 9,
      peakDow: 1,
      hourly: [],
      daily: [],
    },
    expectedPerDay: 1,
    shiftTotal: 1,
    peakHour: 9,
    topOffence: "WRONG PARKING",
    vehicle: "Car",
    fine,
    rupeesPerDay: 1,
    congestionM: null,
    congestionNearby: 0,
  };
}

// A Map-backed stand-in for Web Storage.
function fakeStore(): Storageish {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe("localDate", () => {
  it("formats YYYY-MM-DD", () => {
    expect(localDate(new Date(2026, 5, 17))).toBe("2026-06-17");
  });
});

describe("shiftStorageKey", () => {
  it("namespaces by station, shift and date", () => {
    expect(shiftStorageKey("Indiranagar", "morning", "2026-06-17")).toBe(
      "raaste:shift:Indiranagar|morning|2026-06-17",
    );
  });
});

describe("recordOutcome + tally", () => {
  it("counts issued and cleared as actioned, sums fines for issued only", () => {
    let log = emptyShiftLog("S", "morning", "2026-06-17");
    log = recordOutcome(log, "a", "issued", 500, 1000);
    log = recordOutcome(log, "b", "cleared", 1000, 2000);
    log = recordOutcome(log, "c", "skip", 500, 3000);
    const t = tally(log);
    expect(t.issued).toBe(1);
    expect(t.cleared).toBe(1);
    expect(t.skipped).toBe(1);
    expect(t.actioned).toBe(2);
    expect(t.visited).toBe(3);
    expect(t.rupees).toBe(500);
  });

  it("latest outcome for a corner wins", () => {
    let log = emptyShiftLog("S", "morning", "2026-06-17");
    log = recordOutcome(log, "a", "skip", 500, 1000);
    log = recordOutcome(log, "a", "issued", 500, 2000);
    const t = tally(log);
    expect(t.visited).toBe(1);
    expect(t.issued).toBe(1);
    expect(t.rupees).toBe(500);
  });
});

describe("undoLast", () => {
  it("removes the most recently recorded corner", () => {
    let log = emptyShiftLog("S", "morning", "2026-06-17");
    log = recordOutcome(log, "a", "issued", 500, 1000);
    log = recordOutcome(log, "b", "issued", 500, 2000);
    log = undoLast(log);
    expect(Object.keys(log.entries)).toEqual(["a"]);
  });
});

describe("visitedInOrder / distance / elapsed", () => {
  it("orders by time and sums the legs walked", () => {
    let log = emptyShiftLog("S", "morning", "2026-06-17");
    log = recordOutcome(log, "a", "issued", 500, 1000);
    log = recordOutcome(log, "b", "issued", 500, 3000);
    const corners = [corner("a", 12.97, 77.59, 500), corner("b", 12.98, 77.59, 500)];
    expect(visitedInOrder(log).map((e) => e.cornerId)).toEqual(["a", "b"]);
    expect(distanceCoveredKm(corners, log)).toBeGreaterThan(1.0);
    expect(elapsedMs(log)).toBe(2000);
  });
});

describe("persistence", () => {
  it("saves, loads and clears via injected storage", () => {
    const store = fakeStore();
    let log = emptyShiftLog("S", "morning", "2026-06-17");
    log = recordOutcome(log, "a", "issued", 500, 1000);
    saveShiftLog(log, store);

    const loaded = loadShiftLog("S", "morning", "2026-06-17", store);
    expect(tally(loaded).issued).toBe(1);

    clearShiftLog("S", "morning", "2026-06-17", store);
    expect(tally(loadShiftLog("S", "morning", "2026-06-17", store)).visited).toBe(0);
  });

  it("returns an empty log when nothing is stored", () => {
    expect(tally(loadShiftLog("S", "morning", "2026-06-17", fakeStore())).visited).toBe(0);
  });
});
