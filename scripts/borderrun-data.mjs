#!/usr/bin/env node
// Builds Border Run's map data from public sources, once; the output is
// committed, so neither the build nor the app fetches anything:
//   lib/games/borderrun/countries.json  names (EN, FR, aliases), land borders and capitals, for the game logic (server and client)
//   lib/games/borderrun/shapes.json     simplified outlines, for the map (client only)
//
// Sources, pinned:
//   world-atlas 2.0.2 countries-50m (Natural Earth 1:50m admin 0, public domain; ISC packaging)
//   i18n-iso-countries 7.14.0 (ISO codes, and EN/FR names with their alternatives; MIT)
//   Natural Earth 5.1.2 ne_50m_populated_places (capitals, with EN/FR names; public domain)
// Display names come from this Node's Intl.DisplayNames (EN and FR), with the
// overrides below, and are written into the JSON, so they don't depend on the
// browser.
//
// Run: node scripts/borderrun-data.mjs. Rerun it only to change the data; the
// tests in lib/games/borderrun/ check the result.
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(repo, "lib/games/borderrun");
const ATLAS = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json";
const ISO = "https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0";
const PLACES = "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_populated_places.geojson";

/** Douglas-Peucker tolerance, in degrees (about 4 km). */
const TOLERANCE = 0.04;
/** Islands smaller than this (square degrees) are dropped, except a country's largest piece. */
const MIN_AREA = 0.03;
/** Coordinates are stored as integers in hundredths of a degree. */
const PRECISION = 100;

/** Natural Earth units that aren't on the map: no land borders anyone would route through, or duplicates. */
const SKIP = new Set(["Antarctica", "Siachen Glacier", "Indian Ocean Ter.", "Ashmore and Cartier Is.", "Hong Kong", "Macao", "St-Martin", "Sint Maarten", "Åland"]);
/** Dependencies with no land border: left out, so the guess list holds countries people would name. */
const TERRITORIES = new Set(["AI", "AS", "AW", "BL", "BM", "CK", "CW", "FK", "FO", "GG", "GS", "GU", "HM", "IM", "IO", "JE", "KY", "MP", "MS", "NC", "NF", "NU", "PF", "PM", "PN", "PR", "SH", "TC", "TF", "VG", "VI", "WF"]);
/** Natural Earth units without an ISO code that merge into a country, or get one. */
const NO_ISO = { Somaliland: "SO", "N. Cyprus": "CY", Kosovo: "XK" };

const DISPLAY = {
  en: { CD: "DR Congo", CG: "Congo", MM: "Myanmar", PS: "Palestine", VA: "Vatican City", BA: "Bosnia and Herzegovina", TR: "Turkey", CI: "Ivory Coast", TL: "East Timor", XK: "Kosovo", SZ: "Eswatini", GF: "French Guiana", EH: "Western Sahara" },
  fr: { CD: "RD Congo", CG: "Congo", MM: "Birmanie", PS: "Palestine", VA: "Vatican", TL: "Timor oriental", XK: "Kosovo", GF: "Guyane", US: "États-Unis", VN: "Viêt Nam", EH: "Sahara occidental" },
};
/**
 * The capital, where Natural Earth lists more than one or none for a country
 * (it has no country-level capital for the last four): the official seat,
 * picked by name.
 */
const CAPITAL = { ZA: "Pretoria", CI: "Yamoussoukro", BO: "Sucre", MM: "Naypyidaw", XK: "Pristina", GF: "Cayenne", PS: "Ramallah", EH: "Laayoune", TZ: "Dodoma", BJ: "Porto-Novo" };
/**
 * Where Natural Earth 5.1.2 is out of date: Burundi's capital moved to Gitega
 * in 2019 (not among its 1:50m places, so placed by hand), and Nur-Sultan
 * went back to Astana in 2022.
 */
const CAPITAL_FIX = { BI: { en: "Gitega", fr: "Gitega", at: [29.93, -3.43] }, KZ: { en: "Astana", fr: "Astana" } };

/** Short forms people type, on top of the sources' alternatives. */
const EXTRA_ALIASES = {
  US: ["USA", "US", "America", "Amérique", "EU", "EUA"],
  GB: ["UK", "Britain", "Great Britain", "England", "Angleterre", "Grande-Bretagne", "Royaume Uni"],
  CD: ["DRC", "RDC", "Congo-Kinshasa", "Zaire", "Zaïre", "Congo Kinshasa"],
  CG: ["Congo-Brazzaville", "Congo Brazzaville", "Republic of Congo"],
  CZ: ["Czech Republic", "République tchèque"],
  NL: ["Holland", "Hollande"],
  MM: ["Burma", "Myanmar"],
  CI: ["Côte d'Ivoire", "Cote d'Ivoire"],
  MK: ["Macedonia", "Macédoine"],
  AE: ["UAE", "EAU", "Emirates", "Émirats"],
  CF: ["CAR", "RCA", "Centrafrique"],
  KR: ["Korea"],
  VA: ["Vatican", "Holy See", "Saint-Siège", "Cité du Vatican"],
  TR: ["Türkiye", "Turkiye"],
  SZ: ["Swaziland"],
  BA: ["Bosnia", "Bosnie"],
  TL: ["Timor-Leste", "Timor"],
  GF: ["Guyane française", "French Guyana"],
  RU: ["Russian Federation", "Fédération de Russie"],
  DE: ["Deutschland"],
  ES: ["España"],
};

const json = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
};

const [topo, codes, enNames, frNames, places] = await Promise.all([
  json(ATLAS),
  json(`${ISO}/codes.json`),
  json(`${ISO}/langs/en.json`),
  json(`${ISO}/langs/fr.json`),
  json(PLACES),
]);
const isoOf = Object.fromEntries(codes.map(([alpha2, , numeric]) => [numeric, alpha2]));

// --- Arcs: decode the quantized, delta-encoded arcs into degrees.
const [sx, sy] = topo.transform.scale;
const [tx, ty] = topo.transform.translate;
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * sx + tx, y * sy + ty];
  });
});

function simplify(points) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const length = Math.hypot(bx - ax, by - ay);
    let far = -1;
    let farthest = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (d > farthest) {
        farthest = d;
        far = i;
      }
    }
    if (far >= 0 && farthest > TOLERANCE) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
// Each arc is simplified once, so two neighbours share exactly the same border line.
const simple = arcs.map(simplify);

const ring = (indexes) => {
  const points = [];
  for (const index of indexes) {
    const arc = index < 0 ? simple[~index].slice().reverse() : simple[index];
    points.push(...(points.length ? arc.slice(1) : arc));
  }
  // A ring that crosses the date line (Russia's far east, Fiji) jumps from 180 to -180: keep it whole, east of 180.
  const crosses = points.some(([x], i) => i > 0 && Math.abs(x - points[i - 1][0]) > 180);
  return crosses ? points.map(([x, y]) => [x < 0 ? x + 360 : x, y]) : points;
};
const area = (points) => {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) sum += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  return Math.abs(sum / 2);
};
const centroid = (points) => {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const cross = points[j][0] * points[i][1] - points[i][0] * points[j][1];
    a += cross;
    x += (points[j][0] + points[i][0]) * cross;
    y += (points[j][1] + points[i][1]) * cross;
  }
  if (Math.abs(a) < 1e-12) return points[0];
  return [x / (3 * a), y / (3 * a)];
};

/**
 * Which country a Natural Earth polygon belongs to. France's polygons are
 * split: French Guiana becomes its own entry (it borders Brazil and
 * Suriname), and the other overseas islands leave the map.
 */
function ownerOf(geometry, polygon) {
  const name = geometry.properties.name;
  if (SKIP.has(name)) return null;
  const code = geometry.id ? isoOf[geometry.id] : NO_ISO[name];
  if (!code) throw new Error(`No ISO code for ${name}`);
  if (TERRITORIES.has(code)) return null;
  if (code !== "FR") return code;
  const [lon, lat] = centroid(ring(polygon[0]));
  if (lon < -40 && lon > -60 && lat > 0) return "GF";
  return lon > -10 && lon < 20 && lat > 40 && lat < 52 ? "FR" : null;
}

const polygonsOf = new Map();
const arcOwners = new Map();
for (const geometry of topo.objects.countries.geometries) {
  const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.type === "MultiPolygon" ? geometry.arcs : [];
  for (const polygon of polygons) {
    const owner = ownerOf(geometry, polygon);
    if (!owner) continue;
    if (!polygonsOf.has(owner)) polygonsOf.set(owner, []);
    polygonsOf.get(owner).push(polygon.map(ring));
    for (const indexes of polygon)
      for (const index of indexes) {
        const arc = index < 0 ? ~index : index;
        if (!arcOwners.has(arc)) arcOwners.set(arc, new Set());
        arcOwners.get(arc).add(owner);
      }
  }
}

// --- Borders: two countries share a border where their outlines share an arc.
const borders = new Map([...polygonsOf.keys()].map((code) => [code, new Set()]));
for (const owners of arcOwners.values())
  for (const a of owners)
    for (const b of owners) if (a !== b) borders.get(a).add(b);

// --- Names.
const displayEn = new Intl.DisplayNames(["en"], { type: "region" });
const displayFr = new Intl.DisplayNames(["fr"], { type: "region" });
const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/** A country's capital: its name in EN and FR, and where it is ([lon, lat], to 0.01°). */
function capitalOf(code) {
  if (CAPITAL_FIX[code]?.at) return CAPITAL_FIX[code];
  const ofCountry = places.features.filter(({ properties: p }) => p.ISO_A2 === code || (code === "XK" && p.ADM0NAME === "Kosovo"));
  const picked = CAPITAL[code]
    ? // By name among every place: Natural Earth files Laayoune under Morocco.
      places.features.filter(({ properties: p }) => p.NAME === CAPITAL[code] && p.FEATURECLA.includes("capital"))
    : ofCountry.filter(({ properties: p }) => p.FEATURECLA === "Admin-0 capital");
  if (picked.length !== 1) throw new Error(`${picked.length} capitals for ${code}`);
  const { properties: p, geometry } = picked[0];
  const [lon, lat] = geometry.coordinates;
  return { en: p.NAME_EN || p.NAME, fr: p.NAME_FR || p.NAME, at: [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100], ...CAPITAL_FIX[code] };
}

const codesOnMap = [...polygonsOf.keys()].sort();
const displayOf = (code) => {
  const en = DISPLAY.en[code] ?? displayEn.of(code);
  const fr = DISPLAY.fr[code] ?? displayFr.of(code);
  if (!en || en === code || !fr || fr === code) throw new Error(`No name for ${code}`);
  return { en, fr };
};
const allAliases = (code) => [...new Set([...list(enNames.countries[code]), ...list(frNames.countries[code]), ...(EXTRA_ALIASES[code] ?? []), displayEn.of(code), displayFr.of(code)])];
// An alias two countries share ("Congo") names neither: the display names decide.
const fold = (text) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const claims = new Map();
for (const code of codesOnMap) {
  const { en, fr } = displayOf(code);
  for (const name of [en, fr, ...allAliases(code)]) {
    const key = fold(name);
    if (!claims.has(key)) claims.set(key, new Set());
    claims.get(key).add(code);
  }
}

const countries = {};
const shapes = {};
for (const code of codesOnMap) {
  const { en, fr } = displayOf(code);
  const aliases = allAliases(code).filter((alias) => alias && alias !== en && alias !== fr && claims.get(fold(alias)).size === 1);
  countries[code] = { en, fr, aliases, borders: [...borders.get(code)].sort() };
  // A capital for every country a route can start or end in: the route's distance is capital to capital.
  if (countries[code].borders.length) countries[code].capital = capitalOf(code);

  // Outlines: drop specks of islands, keep the largest piece whatever its size; round to PRECISION and delta-encode.
  const pieces = polygonsOf.get(code).map((rings) => ({ rings, size: area(rings[0]) }));
  const largest = Math.max(...pieces.map((piece) => piece.size));
  const kept = pieces.filter((piece) => piece.size === largest || piece.size >= MIN_AREA);
  const main = pieces.find((piece) => piece.size === largest);
  const [cx, cy] = centroid(main.rings[0]);
  shapes[code] = {
    c: [Math.round(cx * PRECISION), Math.round(cy * PRECISION)],
    p: kept.map(({ rings }) =>
      rings
        .map((points) => {
          const out = [];
          let px = 0;
          let py = 0;
          for (const [x, y] of points) {
            const qx = Math.round(x * PRECISION);
            const qy = Math.round(y * PRECISION);
            if (out.length && qx === px && qy === py) continue;
            out.push(qx - px, qy - py);
            px = qx;
            py = qy;
          }
          return out;
        })
        // A ring of under three points is gone; a piece whose outer ring is gone goes with it (the Vatican: just its centre, c).
        .filter((encoded, i, all) => encoded.length >= 6 && all[0].length >= 6),
    ).filter((rings) => rings.length > 0),
  };
}

await writeFile(join(OUT, "countries.json"), JSON.stringify(countries, null, 1) + "\n");
await writeFile(join(OUT, "shapes.json"), JSON.stringify(shapes) + "\n");
const pairs = Object.values(countries).reduce((sum, c) => sum + c.borders.length, 0) / 2;
console.log(`${Object.keys(countries).length} countries, ${pairs} borders`);
