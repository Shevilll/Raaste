import { describe, it, expect } from "vitest";
import { qrModules } from "@/lib/qr";

describe("qrModules", () => {
  it("returns a non-empty square matrix", () => {
    const m = qrModules("https://example.com/field?s=Indiranagar&shift=morning");
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((row) => row.length === m.length)).toBe(true);
  });

  it("contains both dark and light modules", () => {
    const m = qrModules("hello");
    const flat = m.flat();
    expect(flat.some(Boolean)).toBe(true);
    expect(flat.some((v) => !v)).toBe(true);
  });
});
