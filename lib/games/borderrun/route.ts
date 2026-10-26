import { AREA_COUNTRIES } from "./areas";
import { MAX_PAR, MIN_PAR, type Area } from "./constants";
import { COUNTRIES } from "./countries";

/**
 * A route to find: link `start` to `end` by land, through countries on the
 * `area` map, without crossing a `closed` border. The par is how many
 * countries the shortest such route has between the two.
 */
export interface Route {
  area: Area;
  start: string;
  end: string;
  /** Closed borders, each a pair of codes in alphabetical order. */
  closed: [string, string][];
  par: number;
}

export interface RouteOptions {
  area: Area;
  minPar: number;
  maxPar: number;
}

const ATTEMPTS = 2000;

const pairKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** The open borders on a route's map: area countries only, closed borders removed. */
export function neighboursOf(route: Pick<Route, "area" | "closed">): (code: string) => string[] {
  const inArea = AREA_COUNTRIES[route.area];
  const closed = new Set(route.closed.map(([a, b]) => pairKey(a, b)));
  return (code) => (inArea.has(code) ? COUNTRIES[code].borders.filter((next) => inArea.has(next) && !closed.has(pairKey(code, next))) : []);
}

/** Land steps from `from` to every country it reaches; `allowed` limits the countries a route may go through. */
export function distances(neighbours: (code: string) => string[], from: string, allowed?: (code: string) => boolean): Map<string, number> {
  const dist = new Map([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const code = queue[i];
    for (const next of neighbours(code)) {
      if (dist.has(next) || (allowed && !allowed(next))) continue;
      dist.set(next, dist.get(code)! + 1);
      queue.push(next);
    }
  }
  return dist;
}

/** One shortest route from start to end (both included), through `allowed` countries only; null if there's none. */
export function shortestPath(route: Route, allowed?: (code: string) => boolean): string[] | null {
  const neighbours = neighboursOf(route);
  const fromEnd = distances(neighbours, route.end, allowed);
  if (!fromEnd.has(route.start)) return null;
  const path = [route.start];
  while (path[path.length - 1] !== route.end) {
    const here = path[path.length - 1];
    const step = neighbours(here)
      .filter((next) => fromEnd.get(next) === fromEnd.get(here)! - 1)
      .sort()[0];
    path.push(step);
  }
  return path;
}

/** How good a guess is: on a shortest route, on one at most two countries longer, or neither. */
export type Closeness = "best" | "close" | "off";

export function closenessOf(route: Route, code: string): Closeness {
  const neighbours = neighboursOf(route);
  const fromStart = distances(neighbours, route.start);
  const fromEnd = distances(neighbours, route.end);
  const best = fromStart.get(route.end)!;
  const a = fromStart.get(code);
  const b = fromEnd.get(code);
  if (a === undefined || b === undefined) return "off";
  return a + b === best ? "best" : a + b <= best + 2 ? "close" : "off";
}

/**
 * A random route, the same for the same seed on every device and the server.
 * 1. Pick a start, and an end a few steps away by land.
 * 2. Close one or two borders that every shortest route crosses, so the
 *    obvious way is blocked (each closure makes the route longer).
 * 3. Keep it if a route still exists and its par is in range.
 */
export function generateRoute(seed: string, options: RouteOptions): Route {
  const { area, minPar, maxPar } = options;
  if (minPar < MIN_PAR || maxPar > MAX_PAR || minPar > maxPar) throw new Error("Par out of range");
  const random = seededRandom(hashSeed(`${seed}|${area}|${minPar}|${maxPar}`));
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const open = neighboursOf({ area, closed: [] });
  const linked = [...AREA_COUNTRIES[area]].filter((code) => open(code).length > 0).sort();

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const start = pick(linked);
    const closures = random() < 0.5 ? 1 : 2;
    const reach = distances(open, start);
    // Each closure adds at least a step, so aim the end short of the final par.
    const ends = [...reach].filter(([code, d]) => code !== start && d - 1 >= minPar - closures && d - 1 <= maxPar - 1).map(([code]) => code);
    if (!ends.length) continue;
    const route: Route = { area, start, end: pick(ends.sort()), closed: [], par: 0 };

    for (let i = 0; i < closures; i++) {
      const cut = sharedBorders(route);
      if (!cut.length) break;
      route.closed.push(pick(cut));
    }
    if (route.closed.length !== closures) continue;
    const length = distances(neighboursOf(route), route.start).get(route.end);
    if (length === undefined) continue;
    route.par = length - 1;
    if (route.par < minPar || route.par > maxPar) continue;
    route.closed.sort(([a1, b1], [a2, b2]) => a1.localeCompare(a2) || b1.localeCompare(b2));
    return route;
  }
  throw new Error(`No route found for ${area}`);
}

/** The borders every shortest route from start to end crosses, as sorted pairs. */
function sharedBorders(route: Route): [string, string][] {
  const neighbours = neighboursOf(route);
  const fromStart = distances(neighbours, route.start);
  const fromEnd = distances(neighbours, route.end);
  const length = fromStart.get(route.end);
  if (length === undefined) return [];
  // How many shortest routes reach each country from the start, and from the end.
  const count = (dist: Map<string, number>) => {
    const ways = new Map<string, number>();
    const byDist = [...dist].sort(([, a], [, b]) => a - b);
    for (const [code, d] of byDist) ways.set(code, d === 0 ? 1 : neighbours(code).reduce((sum, prev) => sum + (dist.get(prev) === d - 1 ? ways.get(prev)! : 0), 0));
    return ways;
  };
  const waysFromStart = count(fromStart);
  const waysFromEnd = count(fromEnd);
  const total = waysFromStart.get(route.end)!;
  const shared: [string, string][] = [];
  for (const [code, d] of fromStart) {
    for (const next of neighbours(code)) {
      if (fromStart.get(next) !== d + 1 || fromEnd.get(next) !== length - d - 1) continue;
      if (waysFromStart.get(code)! * waysFromEnd.get(next)! === total) shared.push(code < next ? [code, next] : [next, code]);
    }
  }
  return shared.sort(([a1, b1], [a2, b2]) => a1.localeCompare(a2) || b1.localeCompare(b2));
}

/** FNV-1a: a string seed as a 32-bit integer. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small seeded generator built only on integer ops, so it's identical in every engine. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
