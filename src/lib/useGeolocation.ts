"use client";

import { useEffect, useState } from "react";

export interface GeoState {
  coords: { lat: number; lng: number } | null;
  error: string | null;
  supported: boolean;
}

// Watch the device position while `enabled` is true. Returns the latest fix,
// an error message if the user blocked it, and whether the API exists at all.
export function useGeolocation(enabled: boolean): GeoState {
  const [state, setState] = useState<GeoState>({
    coords: null,
    error: null,
    supported:
      typeof navigator !== "undefined" && "geolocation" in navigator,
  });

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setState({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          error: null,
          supported: true,
        }),
      (err) =>
        setState((s) => ({ ...s, error: err.message || "location unavailable" })),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return state;
}
