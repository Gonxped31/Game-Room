"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { AREA_NAME, AREA_VIEW } from "@/lib/games/borderrun/areas";
import type { Area } from "@/lib/games/borderrun/constants";
import { nameOf } from "@/lib/games/borderrun/countries";
import shapesData from "@/lib/games/borderrun/shapes.json";
import { TONE } from "@/lib/games/borderrun/theme";
import type { Lang } from "@/lib/games/shared/language";

/** scripts/borderrun-data.mjs: `c` the centre, `p` the pieces' rings, delta-encoded, in hundredths of a degree. */
const SHAPES: Record<string, { c: number[]; p: number[][][] }> = shapesData;

export type Tone = keyof typeof TONE;

/** A country drawn on the map, in a tone; `faded` once it isn't on the final route. */
export interface Shown {
  code: string;
  tone: Tone;
  faded?: boolean;
}

type Point = [number, number];

const RAD = Math.PI / 180;
/** Miller's projection, in degrees: kinder to Europe's north than Mercator, and simple. */
const millerY = (lat: number) => (1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * RAD))) / RAD;
const project = (lon: number, lat: number): Point => [lon, -millerY(lat)];

interface Outline {
  d: string;
  /** Projected bounds: west, top, east, bottom. */
  box: [number, number, number, number];
  centre: Point;
  /** Every vertex, as "x,y" in hundredths of a degree: two neighbours share their border's. */
  vertices: string[];
  /** Each ring's vertices, as keys (as in `vertices`) and projected points, in order. */
  rings: { keys: string[]; points: Point[] }[];
}

const outlines = new Map<string, Outline>();

/** A country's outline as an SVG path, projected once and kept. */
function outlineOf(code: string): Outline {
  const cached = outlines.get(code);
  if (cached) return cached;
  const shape = SHAPES[code];
  const box: Outline["box"] = [Infinity, Infinity, -Infinity, -Infinity];
  const vertices: string[] = [];
  const rings: Outline["rings"] = [];
  const parts: string[] = [];
  for (const pieces of shape.p)
    for (const ring of pieces) {
      let x = 0;
      let y = 0;
      let d = "";
      const keys: string[] = [];
      const points: Point[] = [];
      for (let i = 0; i < ring.length; i += 2) {
        x += ring[i];
        y += ring[i + 1];
        keys.push(`${x},${y}`);
        const [px, py] = project(x / 100, y / 100);
        points.push([px, py]);
        box[0] = Math.min(box[0], px);
        box[1] = Math.min(box[1], py);
        box[2] = Math.max(box[2], px);
        box[3] = Math.max(box[3], py);
        d += `${i ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`;
      }
      vertices.push(...keys);
      rings.push({ keys, points });
      parts.push(`${d}Z`);
    }
  const centre = project(shape.c[0] / 100, shape.c[1] / 100);
  if (!shape.p.length) box.splice(0, 4, centre[0], centre[1], centre[0], centre[1]);
  const outline = { d: parts.join(""), box, centre, vertices, rings };
  outlines.set(code, outline);
  return outline;
}

/** The vertices two countries' outlines share (their border), projected. */
function sharedPoints(a: string, b: string): Point[] {
  const theirs = new Set(outlineOf(b).vertices);
  return outlineOf(a).rings.flatMap(({ keys, points }) => points.filter((_, i) => theirs.has(keys[i])));
}

/** The border two countries share, as lines along `a`'s outline: each run of its vertices that `b` has too. */
function borderLines(a: string, b: string): Point[][] {
  const theirs = new Set(outlineOf(b).vertices);
  const lines: Point[][] = [];
  for (const { keys, points } of outlineOf(a).rings) {
    // Start the walk off the border, so a run never wraps around the ring's end.
    const start = keys.findIndex((key) => !theirs.has(key));
    if (start < 0) {
      // A ring wholly inside the other (Lesotho in South Africa): its whole outline.
      lines.push([...points, points[0]]);
      continue;
    }
    let run: Point[] = [];
    for (let i = 1; i <= keys.length; i++) {
      const j = (start + i) % keys.length;
      if (theirs.has(keys[j])) run.push(points[j]);
      else {
        if (run.length > 1) lines.push(run);
        run = [];
      }
    }
  }
  return lines;
}

/** Halfway between two countries' centres: where no shared vertex survived the simplifying. */
function midway(a: string, b: string): Point {
  const [ax, ay] = outlineOf(a).centre;
  const [bx, by] = outlineOf(b).centre;
  return [(ax + bx) / 2, (ay + by) / 2];
}

/** A point on the border two countries share (the middle of their common vertices), or halfway between their centres. */
function borderPoint(a: string, b: string): Point {
  const shared = sharedPoints(a, b);
  return shared.length ? shared[Math.floor(shared.length / 2)] : midway(a, b);
}

/**
 * Where the route line crosses from `a` into `b`: the point of their border
 * that makes the shortest detour on the way from `from` to `toward`. Coming
 * from the Caucasus, Russia into China crosses at the Altai, not the Amur
 * (the middle of their border, which would send the line over Kazakhstan and
 * Mongolia).
 */
function crossingPoint(a: string, b: string, from: Point, toward: Point): Point {
  const shared = sharedPoints(a, b);
  if (!shared.length) return midway(a, b);
  const detour = ([x, y]: Point) => Math.hypot(x - from[0], y - from[1]) + Math.hypot(toward[0] - x, toward[1] - y);
  return shared.reduce((best, point) => (detour(point) < detour(best) ? point : best));
}

type Box = { left: number; top: number; right: number; bottom: number };

const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** A country's bounds, cut to the part of the map in view; null when none of it is. */
function boxInView(code: string, view: Box): Box | null {
  const [west, top, east, bottom] = outlineOf(code).box;
  const box = { left: Math.max(west, view.left), top: Math.max(top, view.top), right: Math.min(east, view.right), bottom: Math.min(bottom, view.bottom) };
  return box.left <= box.right && box.top <= box.bottom ? box : null;
}

/**
 * Where a country's name and the route's ends go: its centre, or, when that
 * is out of view (Russia's middle on the Europe map), the middle of the part
 * of its outline that is in view.
 */
function anchorOf(code: string, view: Box): Point {
  const { centre, rings } = outlineOf(code);
  const inside = ([x, y]: Point) => x >= view.left && x <= view.right && y >= view.top && y <= view.bottom;
  if (inside(centre)) return centre;
  const seen = rings.flatMap(({ points }) => points.filter(inside));
  if (!seen.length) return [Math.min(Math.max(centre[0], view.left), view.right), Math.min(Math.max(centre[1], view.top), view.bottom)];
  return [seen.reduce((sum, [x]) => sum + x, 0) / seen.length, seen.reduce((sum, [, y]) => sum + y, 0) / seen.length];
}

/** A smooth curve through the points (Catmull-Rom, as cubic Béziers). */
function smoothPath(points: Point[]): string {
  let d = `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

const linePath = (points: Point[]) => points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");

interface Label {
  code: string;
  x: number;
  y: number;
  size: number;
  main: boolean;
}

/**
 * Names on the map, placed greedily (the start and end first, then the
 * route's countries in order) so that none hides a small country. A name
 * goes on its country only if it fits inside it, a little above the anchor
 * (else below it); otherwise above the country or below it (beside it, for
 * a tall one like Chile: elsewhere a name beside drifts onto a neighbour),
 * clear of the `small` boxes (padded by `clear`) and never on `blocked`
 * (the zoom buttons). A name with nowhere to go is left out: the route is
 * also spelled out under the map, and zooming in makes room. The start's
 * and end's (`main`) try every side, and at worst cover a small country
 * rather than go missing. `unit` is the visible width, so names keep their
 * size on screen at every zoom.
 */
function placeLabels(
  codes: { code: string; main: boolean }[],
  small: { code: string; box: Box }[],
  blocked: Box[],
  clear: number,
  lang: Lang,
  view: Box,
  unit: number,
): Label[] {
  const placed: Box[] = [];
  const labels: Label[] = [];
  for (const { code, main } of codes) {
    const inView = boxInView(code, view);
    if (!inView) continue;
    const size = unit * (main ? 0.032 : 0.026);
    const half = (nameOf(code, lang).length * size * 0.56) / 2;
    const gap = size * 0.35;
    const [ax, ay] = anchorOf(code, view);
    const fits = half * 2 <= (inView.right - inView.left) * 0.9 && size * 1.6 <= inView.bottom - inView.top;
    // Around the country: past the padding a small one is kept clear by.
    const country = { left: inView.left - clear, top: inView.top - clear, right: inView.right + clear, bottom: inView.bottom + clear };
    const between = (x: number) => Math.min(Math.max(x, view.left + half + gap), view.right - half - gap);
    const tall = country.bottom - country.top > (country.right - country.left) * 2;
    const around: Point[] = [
      [between(ax), country.top - gap],
      [between(ax), country.bottom + size + gap],
    ];
    const beside: Point[] = [
      [country.right + gap + half, ay + size * 0.35],
      [country.left - gap - half, ay + size * 0.35],
    ];
    const inside: Point[] = [
      [ax, ay - size * 0.55],
      [ax, ay + size * 1.25],
    ];
    const spots: Point[] = fits ? inside : main ? (tall ? [...beside, ...around] : [...around, ...beside]) : tall ? beside : around;
    const free = (box: Box, strict: boolean) =>
      box.left >= view.left &&
      box.right <= view.right &&
      box.top >= view.top &&
      box.bottom <= view.bottom &&
      !placed.some((b) => overlaps(box, b)) &&
      !blocked.some((b) => overlaps(box, b)) &&
      // Inside its own country only when it fits there.
      !(strict && small.some((s) => !(fits && s.code === code) && overlaps(box, s.box)));
    const boxAt = ([x, y]: Point) => ({ left: x - half, right: x + half, top: y - size * 0.9, bottom: y + size * 0.25 });
    const spot = spots.find((at) => free(boxAt(at), true)) ?? (main ? spots.find((at) => free(boxAt(at), false)) : undefined);
    if (!spot) continue;
    placed.push(boxAt(spot));
    labels.push({ code, x: spot[0], y: spot[1], size, main });
  }
  return labels;
}

/** The part of the map in view: its centre, in map units, and how far in it's zoomed (1 = the whole map). */
interface View {
  cx: number;
  cy: number;
  scale: number;
}

/** The narrowest a zoomed view gets, in degrees of longitude: Andorra and Luxembourg are a good size by then. */
const MIN_SPAN = 4;

/**
 * Zoom and pan for the map, in the SVG's viewBox: the + and − buttons,
 * double-tap or double-click, pinching on a touch screen, ctrl + wheel (a
 * trackpad's pinch) on a computer, and dragging once zoomed in. One finger
 * scrolls the page while the whole map is in view. From the whole map, the
 * + button zooms in on `focus` (what's drawn), not the map's middle. The
 * buttons, double taps and `show` glide (300 ms, none with reduced motion);
 * a finger or the mouse stops a glide.
 */
function useZoom(svg: RefObject<SVGSVGElement | null>, map: Box, focus: Point) {
  const width = map.right - map.left;
  const height = map.bottom - map.top;
  const maxScale = Math.max(1, width / MIN_SPAN);
  const whole: View = useMemo(() => ({ cx: map.left + width / 2, cy: map.top + height / 2, scale: 1 }), [map, width, height]);
  const [view, setView] = useState(whole);
  // Gestures read the latest view between renders.
  const current = useRef(view);

  /** A view kept on the map: zoomed between 1 and the most, never past an edge. */
  const clamp = useCallback(
    (next: View): View => {
      const scale = Math.min(Math.max(next.scale, 1), maxScale);
      const w = width / scale / 2;
      const h = height / scale / 2;
      return { scale, cx: Math.min(Math.max(next.cx, map.left + w), map.right - w), cy: Math.min(Math.max(next.cy, map.top + h), map.bottom - h) };
    },
    [map, width, height, maxScale],
  );

  const apply = useCallback(
    (next: View) => {
      const clamped = clamp(next);
      current.current = clamped;
      setView(clamped);
    },
    [clamp],
  );

  // The glide running, if any, and where it's going.
  const glide = useRef<{ frame: number; target: View | null }>({ frame: 0, target: null });
  const stopGlide = () => {
    cancelAnimationFrame(glide.current.frame);
    glide.current.target = null;
  };
  /** Where the view is, or is gliding to: the + button and `show` start from there, so a quick second press or a guess mid-glide doesn't cut it short. */
  const settled = useCallback(() => glide.current.target ?? current.current, []);
  useEffect(() => {
    const running = glide.current;
    return () => cancelAnimationFrame(running.frame);
  }, []);

  /** Glide to a view: eased, zooming evenly (in log scale). */
  const animateTo = useCallback(
    (next: View) => {
      stopGlide();
      const target = clamp(next);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return apply(target);
      glide.current.target = target;
      const from = current.current;
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / 300);
        const eased = 1 - (1 - t) ** 3;
        apply({ scale: from.scale * (target.scale / from.scale) ** eased, cx: from.cx + (target.cx - from.cx) * eased, cy: from.cy + (target.cy - from.cy) * eased });
        if (t < 1) glide.current.frame = requestAnimationFrame(step);
        else glide.current.target = null;
      };
      glide.current.frame = requestAnimationFrame(step);
    },
    [clamp, apply],
  );

  /** A screen point, as a fraction of the map's box on screen (`rect`) and as map units in the current view. */
  const locate = useCallback(
    (rect: DOMRect, clientX: number, clientY: number) => {
      const fx = (clientX - rect.left) / rect.width;
      const fy = (clientY - rect.top) / rect.height;
      const { cx, cy, scale } = current.current;
      return { fx, fy, at: [cx + (fx - 0.5) * (width / scale), cy + (fy - 0.5) * (height / scale)] as Point };
    },
    [width, height],
  );

  /** The view zoomed by `factor`, keeping the map point `at` under the screen fraction (fx, fy). */
  const around = useCallback(
    (factor: number, at: Point, fx: number, fy: number, from: View = current.current): View => {
      const scale = Math.min(Math.max(from.scale * factor, 1), maxScale);
      return { scale, cx: at[0] - (fx - 0.5) * (width / scale), cy: at[1] - (fy - 0.5) * (height / scale) };
    },
    [width, height, maxScale],
  );
  const zoomAround = useCallback((factor: number, at: Point, fx: number, fy: number) => apply(around(factor, at, fx, fy)), [apply, around]);

  const zoomBy = useCallback(
    (factor: number) => {
      const from = settled();
      animateTo(from.scale > 1 ? around(factor, [from.cx, from.cy], 0.5, 0.5, from) : { scale: from.scale * factor, cx: focus[0], cy: focus[1] });
    },
    [animateTo, around, focus, settled],
  );
  const reset = useCallback(() => animateTo(whole), [animateTo, whole]);

  /** Bring a point into view, if zoomed in and it's out of view (or at the very edge), keeping the zoom. */
  const show = useCallback(
    ([x, y]: Point) => {
      const { cx, cy, scale } = settled();
      if (scale === 1) return;
      if (Math.abs(x - cx) < (width / scale / 2) * 0.85 && Math.abs(y - cy) < (height / scale / 2) * 0.85) return;
      animateTo({ scale, cx: x, cy: y });
    },
    [animateTo, settled, width, height],
  );

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const tap = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopGlide();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tap.current = pointers.current.size === 1 ? { x: e.clientX, y: e.clientY, t: e.timeStamp, moved: false } : null;
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const before = pointers.current.get(e.pointerId);
    if (!before) return;
    const now = { x: e.clientX, y: e.clientY };
    if (tap.current && Math.hypot(now.x - tap.current.x, now.y - tap.current.y) > 8) tap.current.moved = true;
    const others = [...pointers.current].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
    pointers.current.set(e.pointerId, now);
    if (others.length === 0) {
      // One pointer: drag the map, once zoomed in.
      if (current.current.scale === 1) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const { cx, cy, scale } = current.current;
      apply({ scale, cx: cx - ((now.x - before.x) / rect.width) * (width / scale), cy: cy - ((now.y - before.y) / rect.height) * (height / scale) });
      return;
    }
    // Two pointers: pinch around their middle, which also drags.
    const other = others[0];
    const spread = Math.hypot(before.x - other.x, before.y - other.y);
    if (spread < 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const from = locate(rect, (before.x + other.x) / 2, (before.y + other.y) / 2);
    const to = locate(rect, (now.x + other.x) / 2, (now.y + other.y) / 2);
    zoomAround(Math.hypot(now.x - other.x, now.y - other.y) / spread, from.at, to.fx, to.fy);
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const down = tap.current;
    tap.current = null;
    if (e.type !== "pointerup" || !down || down.moved || e.timeStamp - down.t > 300) return;
    // A tap: the second of two quick ones zooms in where it lands.
    const last = lastTap.current;
    if (last && e.timeStamp - last.t < 350 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
      lastTap.current = null;
      const { fx, fy, at } = locate(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
      animateTo(around(2, at, fx, fy));
    } else lastTap.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };

  // Listeners that must cancel the browser's own scrolling and zooming, so not passive.
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      cancelAnimationFrame(glide.current.frame);
      glide.current.target = null;
      const { fx, fy, at } = locate(element.getBoundingClientRect(), e.clientX, e.clientY);
      zoomAround(Math.exp(-e.deltaY * 0.01), at, fx, fy);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1 || current.current.scale > 1) e.preventDefault();
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("touchmove", onTouchMove);
    };
  }, [svg, locate, zoomAround]);

  return {
    view,
    maxScale,
    zoomBy,
    reset,
    show,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}

/**
 * One link of the run: a dotted line from one country's anchor, across their
 * border, to the other's. A `fresh` one (added since the map appeared) draws
 * itself in from `from`.
 */
function RunLink({ from, to, map, fresh }: { from: string; to: string; map: Box; fresh: boolean }) {
  const d = useMemo(() => {
    const a = anchorOf(from, map);
    const b = anchorOf(to, map);
    return smoothPath([a, crossingPoint(from, to, a, b), b]);
  }, [from, to, map]);
  const maskId = `br-link-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const dots = (
    <>
      <path d={d} className="br-map-route-halo" />
      <path d={d} className="br-map-route-dots" />
    </>
  );
  if (!fresh) return dots;
  const width = map.right - map.left;
  return (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" x={map.left} y={map.top} width={width} height={map.bottom - map.top}>
        <path d={d} className="br-map-route-reveal" pathLength={1} strokeWidth={width * 0.04} />
      </mask>
      <g mask={`url(#${maskId})`}>{dots}</g>
    </>
  );
}

/**
 * The map: blank but for a light graticule, with only the start, the end and
 * the guesses drawn, each in its tone, and the start's and end's names.
 * Countries too small to see (Andorra, the Vatican) get a dot too. A closed
 * border is drawn in red along its length, with a small ✕ on it. As you
 * play, the run's `links` are drawn between the countries they join. A
 * country or link added after the map appeared lands with a little motion
 * (a pop, a ripple in its tone, a link drawing in; not on a reload), and,
 * zoomed in, the map glides to a guess out of view. Given a `route`
 * (complete, or shown on giving up), the links fade and a dotted line draws
 * itself through it, crossing each border where the two countries meet, and
 * its countries are named. It zooms and pans (`useZoom`); names, dots and marks
 * keep their size on screen. The map's size is fixed by its area, so
 * nothing moves as countries appear.
 */
function RouteMap({
  area,
  shown,
  closed,
  lang,
  route,
  links = NO_LINKS,
}: {
  area: Area;
  shown: Shown[];
  closed: [string, string][];
  lang: Lang;
  route?: string[] | null;
  links?: [string, string][];
}) {
  const bounds = AREA_VIEW[area];
  const map = useMemo(() => {
    const [left, top] = project(bounds.west, bounds.north);
    const [right, bottom] = project(bounds.east, bounds.south);
    return { left, top, right, bottom };
  }, [bounds]);
  const { left, top, right, bottom } = map;
  const width = right - left;
  const height = bottom - top;

  // The middle of what's drawn (the countries shown and the closed borders' pairs), for the + button.
  const focus = useMemo((): Point => {
    const codes = [...shown.map((s) => s.code), ...closed.flat()];
    if (!codes.length) return [left + width / 2, top + height / 2];
    const boxes = codes.map((code) => boxInView(code, map)).filter((box) => box !== null);
    if (!boxes.length) return [left + width / 2, top + height / 2];
    const x0 = Math.min(...boxes.map((b) => b.left));
    const x1 = Math.max(...boxes.map((b) => b.right));
    const y0 = Math.min(...boxes.map((b) => b.top));
    const y1 = Math.max(...boxes.map((b) => b.bottom));
    return [(x0 + x1) / 2, (y0 + y1) / 2];
  }, [shown, closed, map, left, top, width, height]);
  const svg = useRef<SVGSVGElement>(null);
  const { view, maxScale, zoomBy, reset, show, handlers } = useZoom(svg, map, focus);

  // What was there when the map appeared (a reload, or a new route) stays still; what comes after lands.
  const [first] = useState(() => ({ codes: new Set(shown.map((s) => s.code)), links: new Set(links.map(([a, b]) => `${a}-${b}`)) }));
  const isFresh = (code: string) => !first.codes.has(code);
  // A single new guess out of view, zoomed in: glide to it.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const codes = shown.map((s) => s.code);
    const before = seen.current;
    seen.current = new Set(codes);
    const added = before ? codes.filter((code) => !before.has(code)) : [];
    if (added.length === 1) show(anchorOf(added[0], map));
  }, [shown, show, map]);
  // The map's width on screen, once measured: to keep names out from under the zoom buttons.
  const [screenWidth, setScreenWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScreenWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const vw = width / view.scale;
  const vh = height / view.scale;
  const visible = useMemo(() => ({ left: view.cx - vw / 2, top: view.cy - vh / 2, right: view.cx + vw / 2, bottom: view.cy + vh / 2 }), [view, vw, vh]);
  // About 4 px on a phone-wide map, at every zoom: big enough to find Andorra or a closed border.
  const dot = vw * 0.011;

  const graticule = useMemo(() => {
    const lines: string[] = [];
    for (let lon = Math.ceil(bounds.west / 10) * 10; lon <= bounds.east; lon += 10) lines.push(`M${lon} ${top}V${bottom}`);
    for (let lat = Math.ceil(bounds.south / 10) * 10; lat <= bounds.north; lat += 10) {
      const y = project(0, lat)[1];
      lines.push(`M${left} ${y.toFixed(2)}H${right}`);
    }
    return lines.join("");
  }, [bounds, left, right, top, bottom]);

  const marks = useMemo(() => closed.map(([a, b]) => ({ key: `${a}-${b}`, at: borderPoint(a, b), d: borderLines(a, b).map(linePath).join("") })), [closed]);

  const ends = useMemo(() => shown.filter((s) => s.tone === "endpoint").map((s) => s.code), [shown]);
  // The line: from the start's anchor, through each border crossing, to the end's (on the whole map, so it stays put as you pan).
  const line = useMemo(() => {
    if (!route || route.length < 2) return null;
    const points: Point[] = [anchorOf(route[0], map)];
    for (let i = 0; i < route.length - 1; i++) points.push(crossingPoint(route[i], route[i + 1], points[i], anchorOf(route[i + 1], map)));
    points.push(anchorOf(route[route.length - 1], map));
    return smoothPath(points);
  }, [route, map]);

  /** Countries drawn as a dot: too small to see at this zoom. */
  const isSpeck = (code: string) => {
    const [west, north, east, south] = outlineOf(code).box;
    return Math.max(east - west, south - north) < vw * 0.012;
  };
  const labels = useMemo(() => {
    // What a name mustn't cover: the small countries drawn (their dots included), and the start's and end's rings.
    const pad = vw * 0.006;
    const clear = pad + dot;
    const small: { code: string; box: Box }[] = [];
    for (const { code } of shown) {
      const [west, north, east, south] = outlineOf(code).box;
      if (Math.max(east - west, south - north) < vw * 0.08) small.push({ code, box: { left: west - clear, top: north - clear, right: east + clear, bottom: south + clear } });
    }
    for (const code of ends) {
      const [x, y] = anchorOf(code, map);
      small.push({ code: "", box: { left: x - dot, top: y - dot, right: x + dot, bottom: y + dot } });
    }
    const codes = [...ends.map((code) => ({ code, main: true })), ...(route ?? []).filter((code) => !ends.includes(code)).map((code) => ({ code, main: false }))];
    // The zoom buttons' corner (see .br-map-zoom): 32 px buttons, 6 px apart, 8 px in; one button on the whole map, three zoomed in.
    const blocked: Box[] = [];
    if (screenWidth) {
      const px = vw / screenWidth;
      const buttons = view.scale > 1 ? 3 : 1;
      blocked.push({ left: visible.right - 44 * px, top: visible.bottom - (12 + buttons * 32 + (buttons - 1) * 6) * px, right: visible.right, bottom: visible.bottom });
    }
    return placeLabels(codes, small, blocked, clear, lang, visible, vw);
  }, [shown, ends, route, lang, visible, vw, dot, map, screenWidth, view.scale]);
  const maskId = `br-line-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const label = `Map of ${AREA_NAME[area].en}: ${shown.map((s) => `${nameOf(s.code, lang)} (${TONE_LABEL[s.tone]})`).join(", ")}`;
  const cross = dot * 0.75;

  return (
    <div className="br-map-frame">
      <svg
        ref={svg}
        className="br-map"
        viewBox={`${visible.left} ${visible.top} ${vw} ${vh}`}
        style={{ aspectRatio: `${width} / ${height}` }}
        role="img"
        aria-label={label}
        data-zoomed={view.scale > 1 ? "" : undefined}
        {...handlers}
      >
        <rect x={left} y={top} width={width} height={height} className="br-map-sea" />
        <path d={graticule} className="br-map-grid" />
        {shown.map(({ code, tone, faded }) => {
          const { d } = outlineOf(code);
          return d ? <path key={code} d={d} className="br-map-country" data-faded={faded ? "" : undefined} data-fresh={isFresh(code) ? "" : undefined} fill={TONE[tone]} /> : null;
        })}
        {marks.map(({ key, d }) => (d ? <path key={key} d={d} className="br-map-closed-line" /> : null))}
        <g className="br-map-links" data-done={line ? "" : undefined}>
          {links.map(([from, to]) => (
            <RunLink key={`${from}-${to}`} from={from} to={to} map={map} fresh={!first.links.has(`${from}-${to}`)} />
          ))}
        </g>
        {line ? (
          <g className="br-map-route">
            {/* In the map's own units: a mask sized to the line's box would clip a flat line's dots. */}
            <mask id={maskId} maskUnits="userSpaceOnUse" x={left} y={top} width={width} height={height}>
              <path d={line} className="br-map-route-reveal" pathLength={1} strokeWidth={width * 0.04} />
            </mask>
            <g mask={`url(#${maskId})`}>
              <path d={line} className="br-map-route-halo" />
              <path d={line} className="br-map-route-dots" />
            </g>
          </g>
        ) : null}
        {marks.map(({ key, at: [x, y] }) => (
          <g key={key} className="br-map-closed" transform={`translate(${x} ${y})`}>
            <path d={`M${-cross} ${-cross}L${cross} ${cross}M${cross} ${-cross}L${-cross} ${cross}`} className="br-map-closed-halo" />
            <path d={`M${-cross} ${-cross}L${cross} ${cross}M${cross} ${-cross}L${-cross} ${cross}`} className="br-map-closed-cross" />
          </g>
        ))}
        {/* Dots after the ✕s, so a closed border's ✕ never hides a tiny start or end. */}
        {shown.map(({ code, tone, faded }) => {
          if (!isSpeck(code)) return null;
          const { centre } = outlineOf(code);
          return <circle key={code} cx={centre[0]} cy={centre[1]} r={dot} className="br-map-country br-map-dot" data-faded={faded ? "" : undefined} data-fresh={isFresh(code) ? "" : undefined} fill={TONE[tone]} />;
        })}
        {/* Where a guess landed: a ring in its tone, spreading and fading once. */}
        {shown.map(({ code, tone }) => {
          if (!isFresh(code)) return null;
          const [x, y] = anchorOf(code, map);
          return <circle key={`ripple-${code}`} cx={x} cy={y} r={dot * 3.5} className="br-map-ripple" stroke={TONE[tone]} />;
        })}
        {ends.map((code) => {
          const [x, y] = anchorOf(code, map);
          return <circle key={code} cx={x} cy={y} r={dot * 0.75} className="br-map-end" />;
        })}
        {labels.map(({ code, x, y, size, main }) => (
          <text key={code} x={x} y={y} fontSize={size} strokeWidth={size * 0.28} className="br-map-label" data-main={main ? "" : undefined}>
            {nameOf(code, lang)}
          </text>
        ))}
      </svg>
      <div className="br-map-zoom">
        {view.scale > 1 ? (
          <button type="button" className="br-map-zoom-button" aria-label="Show the whole map" onClick={reset}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
            </svg>
          </button>
        ) : null}
        <button type="button" className="br-map-zoom-button" aria-label="Zoom in" onClick={() => zoomBy(2)} disabled={view.scale >= maxScale}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
        {view.scale > 1 ? (
          <button type="button" className="br-map-zoom-button" aria-label="Zoom out" onClick={() => zoomBy(0.5)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8h10" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}

const NO_LINKS: [string, string][] = [];

const TONE_LABEL: Record<Tone, string> = { endpoint: "start or end", best: "on a shortest route", close: "close", off: "off the route", reveal: "a route" };

export default memo(RouteMap);
