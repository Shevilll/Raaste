// Build a patrol "beat sheet" for one police station and one shift.
//
// Given the station's parking hotspots, this picks the corners worth patrolling in the
// chosen shift, orders them into a driving loop, and works out what an officer should
// expect at each: how many violations a day, the peak hour, the dominant offence and
// vehicle, the nearest live congestion, and the fine value sitting there if enforced.
//
// Everything is derived from the same aggregates the dashboard already serves, so the
// briefing page stays a thin renderer over this.

import type { Hotspot, Congestion, Fines } from "@/lib/types";
import { planRoute } from "@/lib/route";

export interface Shift {
  id: string;
  label: string;
  sub: string;
  hours: number[];
}

// The violation timestamps are concentrated in the morning and fall away after mid-
// afternoon, so the shifts that actually carry signal are morning, afternoon and the
// full day. (A late-evening shift would read as empty.)
export const SHIFTS: Shift[] = [
  { id: "morning", label: "Morning", sub: "6 AM – 12 PM", hours: [6, 7, 8, 9, 10, 11] },
  { id: "afternoon", label: "Afternoon", sub: "12 – 6 PM", hours: [12, 13, 14, 15, 16, 17] },
  { id: "fullday", label: "Full day", sub: "24 hours", hours: Array.from({ length: 24 }, (_, i) => i) },
];

export function shiftById(id: string | null): Shift {
  return SHIFTS.find((s) => s.id === id) ?? SHIFTS[0];
}

export interface BeatCorner {
  order: number; // patrol sequence (1-based)
  hotspot: Hotspot;
  expectedPerDay: number; // avg violations/day in this shift, historically
  shiftTotal: number; // raw violations in the shift window across the dataset
  peakHour: number; // busiest hour within the shift
  topOffence: string;
  vehicle: string;
  fine: number; // representative compounding fine for this corner
  rupeesPerDay: number;
  congestionM: number | null; // distance to the nearest real congestion event
  congestionNearby: number; // congestion events within the proof radius
}

export interface BeatSheet {
  station: string;
  shift: Shift;
  days: number;
  corners: BeatCorner[];
  totalExpectedPerDay: number;
  totalKm: number;
  rupeesPerDay: number;
}

function daysBetween(range: [string, string] | undefined): number {
  if (!range || !range[0] || !range[1]) return 1;
  const d = Math.round((Date.parse(range[1]) - Date.parse(range[0])) / 86_400_000);
  return Math.max(d, 1);
}

export function buildBeatSheet(opts: {
  station: string;
  shiftId: string | null;
  hotspots: Hotspot[];
  congestion: Congestion | null;
  fines: Fines | null;
  dateRange?: [string, string];
  maxCorners?: number;
}): BeatSheet {
  const { station, shiftId, hotspots, congestion, fines, dateRange, maxCorners = 6 } = opts;
  const shift = shiftById(shiftId);
  const days = daysBetween(dateRange);

  const shiftTotal = (h: Hotspot) =>
    shift.hours.reduce((sum, hr) => sum + (h.hourly[hr] ?? 0), 0);

  // The corners worth this shift: station hotspots with activity in the window, worst first.
  const picked = hotspots
    .filter((h) => h.station === station)
    .map((h) => ({ h, total: shiftTotal(h) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, maxCorners);

  // Order them into a driving loop starting from the worst corner.
  const { order, km } = planRoute(picked.map((x) => ({ lat: x.h.lat, lng: x.h.lng })));
  const ordered = order.map((i) => picked[i]);

  const fineFor = (h: Hotspot) =>
    fines?.fineSchedule.find((f) => f[0] === h.topTypes?.[0]?.[0])?.[1] ??
    fines?.avgFine ??
    500;

  const corners: BeatCorner[] = ordered.map((x, idx) => {
    const expectedPerDay = x.total / days;
    const peakHour = shift.hours.reduce(
      (best, hr) => ((x.h.hourly[hr] ?? 0) > (x.h.hourly[best] ?? 0) ? hr : best),
      shift.hours[0]
    );
    const fine = fineFor(x.h);
    return {
      order: idx + 1,
      hotspot: x.h,
      expectedPerDay,
      shiftTotal: x.total,
      peakHour,
      topOffence: x.h.topTypes?.[0]?.[0] ?? "—",
      vehicle: x.h.vehicle || "—",
      fine,
      rupeesPerDay: expectedPerDay * fine,
      congestionM: congestion?.minDistM?.[x.h.id] ?? null,
      congestionNearby: congestion?.nearby?.[x.h.id] ?? 0,
    };
  });

  return {
    station,
    shift,
    days,
    corners,
    totalExpectedPerDay: corners.reduce((a, c) => a + c.expectedPerDay, 0),
    totalKm: km,
    rupeesPerDay: corners.reduce((a, c) => a + c.rupeesPerDay, 0),
  };
}
