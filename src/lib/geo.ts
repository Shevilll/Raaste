// Geographic helpers shared across patrol routing and the field view.

// Great-circle distance between two lat/lng pairs, in kilometres.
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Order items nearest-first from an origin, by the lat/lng on each item's
// hotspot. Returns a new array; the input is left untouched.
export function orderByDistance<T extends { hotspot: { lat: number; lng: number } }>(
  items: T[],
  lat: number,
  lng: number,
): T[] {
  return [...items].sort(
    (a, b) =>
      haversine(lat, lng, a.hotspot.lat, a.hotspot.lng) -
      haversine(lat, lng, b.hotspot.lat, b.hotspot.lng),
  );
}
