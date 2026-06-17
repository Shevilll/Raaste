// Route planning for patrol zones.
//
// Given a list of geo points, this orders them into a sensible driving
// route using a nearest-neighbour heuristic and reports the total distance.
// It's a greedy approximation of the travelling-salesman problem — not
// optimal, but cheap and good enough for laying out a patrol loop.

import { haversine } from "@/lib/geo";

export interface RoutePoint {
  lat: number;
  lng: number;
}

/**
 * Order `points` into a driving route starting from the first point.
 *
 * Uses nearest-neighbour: from the current point, hop to the closest one
 * we haven't visited yet, repeating until every point is covered.
 *
 * @returns `order` — the visit sequence as indices into `points`
 *          (so `order[0]` is always 0), and `km` — the total route
 *          length summed over consecutive legs.
 */
export function planRoute<T extends RoutePoint>(
  points: T[],
): { order: number[]; km: number } {
  // Nothing to route, or a single stop — no travel involved.
  if (points.length <= 1) {
    return { order: points.length === 0 ? [] : [0], km: 0 };
  }

  const visited = new Array<boolean>(points.length).fill(false);
  const order: number[] = [];
  let km = 0;

  // Always kick off from the first point.
  let current = 0;
  visited[current] = true;
  order.push(current);

  // Greedily pick the nearest unvisited point each step.
  while (order.length < points.length) {
    let nearest = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < points.length; i++) {
      if (visited[i]) continue;

      const d = haversine(
        points[current].lat,
        points[current].lng,
        points[i].lat,
        points[i].lng,
      );

      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }

    visited[nearest] = true;
    order.push(nearest);
    km += nearestDist;
    current = nearest;
  }

  return { order, km };
}
