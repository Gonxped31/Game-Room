"use client";

import { memo, useId, useMemo } from "react";
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

const RAD = Math.PI / 180;
/** Miller's projection, in degrees: kinder to Europe's north than Mercator, and simple. */
const millerY = (lat: number) => (1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * RAD))) / RAD;
const project = (lon: number, lat: number): [number, number] => [lon, -millerY(lat)];

interface Outline {
  d: string;
  /** Projected bounds: west, top, east, bottom. */
  box: [number, number, number, number];
  centre: [number, number];
  /** Every vertex, as "x,y" in hundredths of a degree: two neighbours share their border's. */
  vertices: string[];
}

const outlines = new Map<string, Outline>();

/** A country's outline as an SVG path, projected once and kept. */
function outlineOf(code: string): Outline {
  const cached = outlines.get(code);
  if (cached) return cached;
  const shape = SHAPES[code];
  const box: Outline["box"] = [Infinity, Infinity, -Infinity, -Infinity];
  const vertices: string[] = [];
  const parts: string[] = [];
  for (const rings of shape.p)
    for (const ring of rings) {
      let x = 0;
      let y = 0;
      let d = "";
      for (let i = 0; i < ring.length; i += 2) {
        x += ring[i];
        y += ring[i + 1];
        vertices.push(`${x},${y}`);
        const [px, py] = project(x / 100, y / 100);
        box[0] = Math.min(box[0], px);
        box[1] = Math.min(box[1], py);
        box[2] = Math.max(box[2], px);
        box[3] = Math.max(box[3], py);
        d += `${i ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`;
      }
      parts.push(`${d}Z`);
    }
  const centre = project(shape.c[0] / 100, shape.c[1] / 100);
  if (!shape.p.length) box.splice(0, 4, centre[0], centre[1], centre[0], centre[1]);
  const outline = { d: parts.join(""), box, centre, vertices };
  outlines.set(code, outline);
  return outline;
}

/** The vertices two countries' outlines share (their border), projected. */
function sharedPoints(a: string, b: string): [number, number][] {
  const theirs = new Set(outlineOf(b).vertices);
  return outlineOf(a)
    .vertices.filter((v) => theirs.has(v))
    .map((v) => v.split(",").map((n) => Number(n) / 100))
    .map(([lon, lat]) => project(lon, lat));
}

/** Halfway between two countries' centres: where no shared vertex survived the simplifying. */
function midway(a: string, b: string): [number, number] {
  const [ax, ay] = outlineOf(a).centre;
  const [bx, by] = outlineOf(b).centre;
  return [(ax + bx) / 2, (ay + by) / 2];
}

/** A point on the border two countries share (the middle of their common vertices), or halfway between their centres. */
function borderPoint(a: string, b: string): [number, number] {
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
function crossingPoint(a: string, b: string, from: [number, number], toward: [number, number]): [number, number] {
  const shared = sharedPoints(a, b);
  if (!shared.length) return midway(a, b);
  const detour = ([x, y]: [number, number]) => Math.hypot(x - from[0], y - from[1]) + Math.hypot(toward[0] - x, toward[1] - y);
  return shared.reduce((best, point) => (detour(point) < detour(best) ? point : best));
}

type Box = { left: number; top: number; right: number; bottom: number };

/**
 * Where a country's name and the route's ends go: its centre, or, when that
 * is off the map (Russia's middle on the Europe map), the middle of the part
 * of its outline that is on it.
 */
function anchorOf(code: string, view: Box): [number, number] {
  const { centre, vertices } = outlineOf(code);
  const inside = ([x, y]: [number, number]) => x >= view.left && x <= view.right && y >= view.top && y <= view.bottom;
  if (inside(centre)) return centre;
  const seen = vertices.map((v) => v.split(",").map((n) => Number(n) / 100)).map(([lon, lat]) => project(lon, lat)).filter(inside);
  if (!seen.length) return [Math.min(Math.max(centre[0], view.left), view.right), Math.min(Math.max(centre[1], view.top), view.bottom)];
  return [seen.reduce((sum, [x]) => sum + x, 0) / seen.length, seen.reduce((sum, [, y]) => sum + y, 0) / seen.length];
}

/** A smooth curve through the points (Catmull-Rom, as cubic Béziers). */
function smoothPath(points: [number, number][]): string {
  let d = `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

interface Label {
  code: string;
  x: number;
  y: number;
  size: number;
  main: boolean;
}

/**
 * Names on the map, placed greedily: the start and end first, then the
 * route's countries in order, each above its anchor, else below, else left
 * out (the route is also spelled out under the map). Kept inside the map.
 */
function placeLabels(codes: { code: string; main: boolean }[], lang: Lang, view: Box, width: number): Label[] {
  const placed: { label: Label; box: Box }[] = [];
  for (const { code, main } of codes) {
    const size = width * (main ? 0.032 : 0.026);
    const textWidth = nameOf(code, lang).length * size * 0.56;
    const [ax, ay] = anchorOf(code, view);
    const x = Math.min(Math.max(ax, view.left + textWidth / 2 + size * 0.3), view.right - textWidth / 2 - size * 0.3);
    for (const y of [ay - size * 0.55, ay + size * 1.25]) {
      if (y - size < view.top || y > view.bottom) continue;
      const box = { left: x - textWidth / 2, right: x + textWidth / 2, top: y - size * 0.9, bottom: y + size * 0.2 };
      if (placed.some(({ box: b }) => box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top)) continue;
      placed.push({ label: { code, x, y, size, main }, box });
      break;
    }
  }
  return placed.map(({ label }) => label);
}

/**
 * The map: blank but for a light graticule, with only the start, the end and
 * the guesses drawn, each in its tone, and the start's and end's names.
 * Countries too small to see (Andorra, the Vatican) get a dot too. Closed
 * borders carry a red ✕ where they are. Given a `route` (complete, or shown
 * on giving up), a dotted line draws itself through it, crossing each border
 * where the two countries meet, and its countries are named. The map's size
 * is fixed by its area, so nothing moves as countries appear.
 */
function RouteMap({ area, shown, closed, lang, route }: { area: Area; shown: Shown[]; closed: [string, string][]; lang: Lang; route?: string[] | null }) {
  const view = AREA_VIEW[area];
  const [left, top] = project(view.west, view.north);
  const [right, bottom] = project(view.east, view.south);
  const width = right - left;
  const height = bottom - top;
  // About 4 px on a phone-wide map: big enough to find Andorra or a closed border.
  const dot = width * 0.011;

  const graticule = useMemo(() => {
    const lines: string[] = [];
    for (let lon = Math.ceil(view.west / 10) * 10; lon <= view.east; lon += 10) lines.push(`M${lon} ${top}V${bottom}`);
    for (let lat = Math.ceil(view.south / 10) * 10; lat <= view.north; lat += 10) {
      const y = project(0, lat)[1];
      lines.push(`M${left} ${y.toFixed(2)}H${right}`);
    }
    return lines.join("");
  }, [view, left, right, top, bottom]);

  const marks = useMemo(() => closed.map(([a, b]) => ({ key: `${a}-${b}`, at: borderPoint(a, b) })), [closed]);

  const box = useMemo(() => ({ left, top, right, bottom }), [left, top, right, bottom]);
  const ends = useMemo(() => shown.filter((s) => s.tone === "endpoint").map((s) => s.code), [shown]);
  // The line: from the start's anchor, through each border crossing, to the end's.
  const line = useMemo(() => {
    if (!route || route.length < 2) return null;
    const points: [number, number][] = [anchorOf(route[0], box)];
    for (let i = 0; i < route.length - 1; i++) points.push(crossingPoint(route[i], route[i + 1], points[i], anchorOf(route[i + 1], box)));
    points.push(anchorOf(route[route.length - 1], box));
    return smoothPath(points);
  }, [route, box]);
  const labels = useMemo(
    () =>
      placeLabels(
        [...ends.map((code) => ({ code, main: true })), ...(route ?? []).filter((code) => !ends.includes(code)).map((code) => ({ code, main: false }))],
        lang,
        box,
        width,
      ),
    [ends, route, lang, box, width],
  );
  const maskId = `br-line-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const label = `Map of ${AREA_NAME[area].en}: ${shown.map((s) => `${nameOf(s.code, lang)} (${TONE_LABEL[s.tone]})`).join(", ")}`;

  return (
    <svg className="br-map" viewBox={`${left} ${top} ${width} ${height}`} style={{ aspectRatio: `${width} / ${height}` }} role="img" aria-label={label}>
      <rect x={left} y={top} width={width} height={height} className="br-map-sea" />
      <path d={graticule} className="br-map-grid" />
      {shown.map(({ code, tone, faded }) => {
        const { d } = outlineOf(code);
        return d ? <path key={code} d={d} className="br-map-country" data-faded={faded ? "" : undefined} fill={TONE[tone]} /> : null;
      })}
      {marks.map(({ key, at: [x, y] }) => (
        <g key={key} className="br-map-closed" transform={`translate(${x} ${y})`}>
          <circle r={dot * 1.7} />
          <path d={`M${-dot * 0.8} ${-dot * 0.8}L${dot * 0.8} ${dot * 0.8}M${dot * 0.8} ${-dot * 0.8}L${-dot * 0.8} ${dot * 0.8}`} />
        </g>
      ))}
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
      {/* Dots last, so a closed border's ✕ never hides a tiny start or end. */}
      {shown.map(({ code, tone, faded }) => {
        const { box, centre } = outlineOf(code);
        if (Math.max(box[2] - box[0], box[3] - box[1]) >= width * 0.012) return null;
        return <circle key={code} cx={centre[0]} cy={centre[1]} r={dot} className="br-map-country br-map-dot" data-faded={faded ? "" : undefined} fill={TONE[tone]} />;
      })}
      {ends.map((code) => {
        const [x, y] = anchorOf(code, box);
        return <circle key={code} cx={x} cy={y} r={dot * 0.75} className="br-map-end" />;
      })}
      {labels.map(({ code, x, y, size, main }) => (
        <text key={code} x={x} y={y} fontSize={size} strokeWidth={size * 0.28} className="br-map-label" data-main={main ? "" : undefined}>
          {nameOf(code, lang)}
        </text>
      ))}
    </svg>
  );
}

const TONE_LABEL: Record<Tone, string> = { endpoint: "start or end", best: "on a shortest route", close: "close", off: "off the route", reveal: "a route" };

export default memo(RouteMap);
