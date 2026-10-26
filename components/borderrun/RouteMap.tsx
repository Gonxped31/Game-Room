"use client";

import { memo, useMemo } from "react";
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

/** A point on the border two countries share (the middle of their common vertices), or halfway between their centres. */
function borderPoint(a: string, b: string): [number, number] {
  const theirs = new Set(outlineOf(b).vertices);
  const shared = outlineOf(a).vertices.filter((v) => theirs.has(v));
  if (!shared.length) {
    const [ax, ay] = outlineOf(a).centre;
    const [bx, by] = outlineOf(b).centre;
    return [(ax + bx) / 2, (ay + by) / 2];
  }
  const [x, y] = shared[Math.floor(shared.length / 2)].split(",").map((v) => Number(v) / 100);
  return project(x, y);
}

/**
 * The map: blank but for a light graticule, with only the start, the end and
 * the guesses drawn, each in its tone. Countries too small to see (Andorra,
 * the Vatican) get a dot too. Closed borders carry a red ✕ where they are.
 * Its size is fixed by the map's area, so nothing moves as countries appear.
 */
function RouteMap({ area, shown, closed, lang }: { area: Area; shown: Shown[]; closed: [string, string][]; lang: Lang }) {
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
      {/* Dots last, so a closed border's ✕ never hides a tiny start or end. */}
      {shown.map(({ code, tone, faded }) => {
        const { box, centre } = outlineOf(code);
        if (Math.max(box[2] - box[0], box[3] - box[1]) >= width * 0.012) return null;
        return <circle key={code} cx={centre[0]} cy={centre[1]} r={dot} className="br-map-country br-map-dot" data-faded={faded ? "" : undefined} fill={TONE[tone]} />;
      })}
    </svg>
  );
}

const TONE_LABEL: Record<Tone, string> = { endpoint: "start or end", best: "on a shortest route", close: "close", off: "off the route", reveal: "a route" };

export default memo(RouteMap);
