import { describe, it, expect } from "vitest";
import { haversine, orderByDistance } from "@/lib/geo";

describe("haversine", () => {
  it("is zero for the same point", () => {
    expect(haversine(12.97, 77.59, 12.97, 77.59)).toBe(0);
  });

  it("approximates a known short distance in km", () => {
    // ~1.1 km between two points 0.01 deg of latitude apart near Bengaluru
    const d = haversine(12.97, 77.59, 12.98, 77.59);
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
  });
});

describe("orderByDistance", () => {
  const mk = (id: string, lat: number, lng: number) => ({
    hotspot: { lat, lng },
    id,
  });

  it("sorts nearest-first from the given origin", () => {
    const items = [
      mk("far", 12.99, 77.59),
      mk("near", 12.971, 77.59),
      mk("mid", 12.98, 77.59),
    ];
    const ordered = orderByDistance(items, 12.97, 77.59).map((x) => x.id);
    expect(ordered).toEqual(["near", "mid", "far"]);
  });

  it("does not mutate the input array", () => {
    const items = [mk("a", 12.99, 77.59), mk("b", 12.97, 77.59)];
    const copy = [...items];
    orderByDistance(items, 12.97, 77.59);
    expect(items).toEqual(copy);
  });
});
