import { describe, expect, it } from "vitest";
import { AREA_COUNTRIES, AREA_VIEW } from "./areas";
import { AREAS, MAX_PAR, PENALTY_MS } from "./constants";
import { capitalDistanceKm, CODES, COUNTRIES, findCountry, fold, suggest } from "./countries";
import { borderrunDaily, SCHEDULE } from "./daily";
import { addGuess, links, newPlay, refusalOf, replay, status } from "./play";
import { closenessOf, distances, generateRoute, neighboursOf, shortestPath, type Route } from "./route";
import shapes from "./shapes.json";

const SHAPES: Record<string, { c: number[]; p: number[][][] }> = shapes;

describe("map data", () => {
  it("borders go both ways, and never to oneself", () => {
    for (const code of CODES)
      for (const next of COUNTRIES[code].borders) {
        expect(next).not.toBe(code);
        expect(COUNTRIES[next]?.borders, `${code}-${next}`).toContain(code);
      }
  });

  it("has the land borders people know", () => {
    const known = "FR-ES FR-DE FR-BE FR-CH FR-IT FR-AD FR-MC FR-LU ES-PT ES-AD DE-PL DE-DK DE-AT DE-CZ IT-VA IT-SM AT-LI CH-LI PL-UA UA-RU RU-CN RU-KP CN-IN CN-AF IN-PK US-CA US-MX GT-MX PA-CO BR-GF GF-SR BR-AR EG-LY EG-IL EG-SD ZA-LS ZA-SZ MA-EH XK-RS GB-IE HT-DO MY-BN ID-TL ID-PG TR-GR AZ-AM SS-SD";
    for (const pair of known.split(" ")) {
      const [a, b] = pair.split("-");
      expect(COUNTRIES[a].borders, pair).toContain(b);
    }
  });

  it("has no border that isn't on land", () => {
    for (const pair of "FR-GB ES-MA US-RU FR-BR FR-SR DK-SE IT-TN".split(" ")) {
      const [a, b] = pair.split("-");
      expect(COUNTRIES[a].borders, pair).not.toContain(b);
    }
  });

  it("every country has names in both languages and an outline", () => {
    for (const code of CODES) {
      expect(COUNTRIES[code].en.length).toBeGreaterThan(1);
      expect(COUNTRIES[code].fr.length).toBeGreaterThan(1);
      expect(SHAPES[code]?.c, code).toHaveLength(2);
    }
    expect(Object.keys(SHAPES).sort()).toEqual([...CODES].sort());
  });

  it("every map's countries exist, and each map shows its routes' countries", () => {
    for (const area of AREAS) {
      const view = AREA_VIEW[area];
      for (const code of AREA_COUNTRIES[area]) {
        expect(COUNTRIES[code], code).toBeDefined();
        if (!neighboursOf({ area, closed: [] })(code).length || area === "world") continue;
        // Some of its outline is in view (Russia's middle isn't on the Europe map, its west is); the Vatican has only its centre.
        const [cx, cy] = SHAPES[code].c.map((v) => v / 100);
        const centreInView = cx >= view.west && cx <= view.east && cy >= view.south && cy <= view.north;
        const inView = centreInView || SHAPES[code].p.some((rings) => {
          let x = 0;
          let y = 0;
          return rings[0].some((v, i) => {
            if (i % 2) y += v;
            else x += v;
            return i % 2 === 1 && x / 100 >= view.west && x / 100 <= view.east && y / 100 >= view.south && y / 100 <= view.north;
          });
        });
        expect(inView, `${code} on ${area}`).toBe(true);
      }
    }
  });
});

describe("capitals", () => {
  it("every country a route can start or end in has a capital, in both languages", () => {
    for (const code of CODES) {
      if (!COUNTRIES[code].borders.length) continue;
      const capital = COUNTRIES[code].capital;
      expect(capital?.en, code).toBeTruthy();
      expect(capital?.fr, code).toBeTruthy();
      expect(capital!.at).toHaveLength(2);
    }
    expect(COUNTRIES.PT.capital).toMatchObject({ en: "Lisbon", fr: "Lisbonne" });
    expect(COUNTRIES.ZA.capital?.en).toBe("Pretoria");
    // Official seats, where the source lists the biggest city or an old name.
    expect([COUNTRIES.TZ, COUNTRIES.BJ, COUNTRIES.BI, COUNTRIES.KZ].map((c) => c.capital?.en)).toEqual(["Dodoma", "Porto-Novo", "Gitega", "Astana"]);
  });

  it("measures capital to capital as the crow flies", () => {
    expect(capitalDistanceKm("FR", "DE")).toBe(880); // Paris-Berlin, about 878 km
    expect(capitalDistanceKm("PT", "PL")).toBe(2760); // Lisbon-Warsaw, about 2,760 km
    expect(capitalDistanceKm("US", "CA")).toBeGreaterThan(700);
    expect(capitalDistanceKm("US", "CA")).toBeLessThan(760); // Washington-Ottawa, about 735 km
    expect(capitalDistanceKm("FR", "FR")).toBe(0);
  });
});

describe("names", () => {
  it("finds a country by its English or French name, aliases too, whatever the accents and case", () => {
    expect(findCountry("Germany")).toBe("DE");
    expect(findCountry("allemagne")).toBe("DE");
    expect(findCountry("  ÉTATS-UNIS ")).toBe("US");
    expect(findCountry("etats unis")).toBe("US");
    expect(findCountry("USA")).toBe("US");
    expect(findCountry("the Netherlands")).toBe("NL");
    expect(findCountry("Pays-Bas")).toBe("NL");
    expect(findCountry("la Suisse")).toBe("CH");
    expect(findCountry("Côte d'Ivoire")).toBe("CI");
    expect(findCountry("cote divoire")).toBe(null);
    expect(findCountry("Ivory Coast")).toBe("CI");
    expect(findCountry("RDC")).toBe("CD");
    expect(findCountry("Congo")).toBe("CG");
    expect(findCountry("Tchéquie")).toBe("CZ");
    expect(findCountry("Czech Republic")).toBe("CZ");
    expect(findCountry("Birmanie")).toBe("MM");
    expect(findCountry("Atlantis")).toBe(null);
    expect(findCountry("")).toBe(null);
  });

  it("no two countries share a name", () => {
    const seen = new Map<string, string>();
    for (const code of CODES)
      for (const name of [COUNTRIES[code].en, COUNTRIES[code].fr]) {
        const key = fold(name);
        expect(seen.get(key) ?? code, name).toBe(code);
        seen.set(key, code);
      }
  });

  it("suggests from what's typed, names starting with it first", () => {
    const europe = AREA_COUNTRIES.europe;
    expect(suggest("ger", europe, "en")[0]).toBe("DE");
    expect(suggest("all", europe, "fr")[0]).toBe("DE");
    expect(suggest("macedoine", europe, "fr")).toEqual(["MK"]);
    expect(suggest("bos", europe, "en")).toEqual(["BA"]);
    expect(suggest("", europe, "en")).toEqual([]);
    expect(suggest("s", europe, "en", 3)).toHaveLength(3);
    expect(suggest("egy", europe, "en")).toEqual([]);
  });
});

const portugalToPoland: Route = { area: "europe", start: "PT", end: "PL", closed: [], par: 3 };

describe("routes", () => {
  it("measures by land, through the map's countries only", () => {
    const dist = distances(neighboursOf(portugalToPoland), "PT");
    expect(dist.get("ES")).toBe(1);
    expect(dist.get("FR")).toBe(2);
    expect(dist.get("PL")).toBe(4);
    expect(dist.has("EG")).toBe(false);
    expect(shortestPath(portugalToPoland)).toEqual(["PT", "ES", "FR", "DE", "PL"]);
  });

  it("a closed border is never crossed", () => {
    const route: Route = { ...portugalToPoland, closed: [["DE", "FR"]] };
    const path = shortestPath(route)!;
    expect(path.join("-")).not.toContain("FR-DE");
    expect(path).toHaveLength(6);
  });

  it("grades a guess: on a shortest route, nearly, or off", () => {
    expect(closenessOf(portugalToPoland, "FR")).toBe("best");
    expect(closenessOf(portugalToPoland, "DE")).toBe("best");
    expect(closenessOf(portugalToPoland, "CH")).toBe("close");
    expect(closenessOf(portugalToPoland, "GR")).toBe("off");
    expect(closenessOf(portugalToPoland, "IS")).toBe("off");
  });

  it("generates routes in range on every map, the same for the same seed", () => {
    for (const area of AREAS)
      for (let i = 0; i < 30; i++) {
        const options = { area, minPar: 3, maxPar: area === "world" ? 7 : 5 };
        const route = generateRoute(`seed-${i}`, options);
        expect(generateRoute(`seed-${i}`, options)).toEqual(route);
        expect(route.par).toBeGreaterThanOrEqual(options.minPar);
        expect(route.par).toBeLessThanOrEqual(options.maxPar);
        expect(route.closed.length).toBeGreaterThanOrEqual(1);
        expect(route.closed.length).toBeLessThanOrEqual(2);
        const path = shortestPath(route)!;
        expect(path.length - 2).toBe(route.par);
        for (const code of path) expect(AREA_COUNTRIES[area].has(code)).toBe(true);
        // Each closure blocked the way it was on: reopening any one makes the route shorter.
        for (const closed of route.closed) {
          const reopened = { ...route, closed: route.closed.filter((pair) => pair !== closed) };
          expect(shortestPath(reopened)!.length, `${area} ${i}`).toBeLessThan(path.length);
        }
      }
  });

  it("the daily schedule's ranges are all reachable", () => {
    for (const day of SCHEDULE) expect(day.maxPar).toBeLessThanOrEqual(MAX_PAR);
    for (let i = 0; i < 7; i++) expect(() => generateRoute(`day-${i}`, SCHEDULE[i])).not.toThrow();
  });
});

describe("play", () => {
  it("completes once the guesses link start to end, with a penalty past the par", () => {
    let play = newPlay(portugalToPoland);
    play = addGuess(play, "ES", 1000);
    play = addGuess(play, "IT", 2000);
    play = addGuess(play, "FR", 3000);
    expect(status(play).complete).toBe(false);
    play = addGuess(play, "DE", 4000);
    const result = status(play);
    expect(result.complete).toBe(true);
    expect(result.path).toEqual(["PT", "ES", "FR", "DE", "PL"]);
    expect(result.extra).toBe(1);
    expect(result.penaltyMs).toBe(PENALTY_MS);
  });

  it("refuses unknown, off-map, start or end, repeated and late guesses, and times going back", () => {
    const play = addGuess(newPlay(portugalToPoland), "ES", 1000);
    expect(refusalOf(play, null)).toBe("unknown");
    expect(refusalOf(play, "ZZ")).toBe("unknown");
    expect(refusalOf(play, "EG")).toBe("not-on-map");
    expect(refusalOf(play, "PT")).toBe("endpoint");
    expect(refusalOf(play, "PL")).toBe("endpoint");
    expect(refusalOf(play, "ES")).toBe("repeat");
    expect(refusalOf(play, "IS")).toBe(null);
    expect(() => addGuess(play, "FR", 500)).toThrow("Bad time");
    const done = replay(portugalToPoland, [
      { code: "ES", t: 1 },
      { code: "FR", t: 2 },
      { code: "DE", t: 3 },
    ]);
    expect(status(done)).toMatchObject({ complete: true, extra: 0, penaltyMs: 0 });
    expect(refusalOf(done, "IT")).toBe("done");
  });

  it("links the run as it grows, from both ends, and a guess waits until a neighbour joins", () => {
    let play = newPlay(portugalToPoland);
    play = addGuess(play, "DE", 1); // borders Poland, the end
    expect(links(play)).toEqual([["PL", "DE"]]);
    play = addGuess(play, "FR", 2); // borders Germany, which joined from the end
    play = addGuess(play, "IS", 3); // an island: never links
    expect(links(play)).toEqual([
      ["PL", "DE"],
      ["DE", "FR"],
    ]);
    play = addGuess(play, "ES", 4); // borders Portugal (the start) and France: the start joined first
    expect(links(play)).toEqual([
      ["PL", "DE"],
      ["DE", "FR"],
      ["PT", "ES"],
    ]);
    // Austria borders nothing in the run, so it waits; Czechia links to Poland, and Austria to Czechia.
    const waits = replay(portugalToPoland, [
      { code: "AT", t: 1 },
      { code: "CZ", t: 2 },
    ]);
    expect(links(waits)).toEqual([
      ["PL", "CZ"],
      ["CZ", "AT"],
    ]);
  });

  it("keeps every link when a guess is added", () => {
    const guesses = ["IT", "CH", "AT", "FR", "DE", "ES"].map((code, i) => ({ code, t: i }));
    for (let n = 1; n < guesses.length; n++) {
      const before = links(replay(portugalToPoland, guesses.slice(0, n)));
      const after = links(replay(portugalToPoland, guesses.slice(0, n + 1)));
      expect(after.slice(0, before.length)).toEqual(before);
    }
  });

  it("respects closed borders", () => {
    const closedRoute: Route = { ...portugalToPoland, closed: [["DE", "PL"]] };
    expect(links(replay(closedRoute, [{ code: "DE", t: 1 }]))).toEqual([]);
  });
});

describe("daily", () => {
  const route = borderrunDaily.generate("secret", "2026-11-02"); // a Monday: Europe
  const solve = () => shortestPath(route)!.slice(1, -1).map((code, i) => ({ code, t: (i + 1) * 1700 + (i % 2) * 300 }));

  it("Monday is Europe", () => {
    expect(route.area).toBe("europe");
    expect(borderrunDaily.describe("2026-11-02")).toBe("Europe");
  });

  it("accepts a complete route, with its penalty", () => {
    expect(borderrunDaily.verify(route, solve())).toMatchObject({ ok: true, penaltyMs: 0 });
    const offMap = [...AREA_COUNTRIES.europe].find((code) => code !== route.start && code !== route.end && !shortestPath(route)!.includes(code))!;
    const withExtra = [{ code: offMap, t: 500 }, ...solve()];
    expect(borderrunDaily.verify(route, withExtra)).toMatchObject({ ok: true, penaltyMs: PENALTY_MS });
  });

  it("refuses incomplete, unreadable, repeated or after-the-finish guesses", () => {
    const moves = solve();
    expect(borderrunDaily.verify(route, moves.slice(0, -1)).ok).toBe(false);
    expect(borderrunDaily.verify(route, []).ok).toBe(false);
    expect(borderrunDaily.verify(route, "ES").ok).toBe(false);
    expect(borderrunDaily.verify(route, [{ code: 5, t: 1 }]).ok).toBe(false);
    expect(borderrunDaily.verify(route, [...moves, moves[0]]).ok).toBe(false);
    expect(borderrunDaily.verify(route, [...moves, { code: "IS", t: 99_999 }]).ok).toBe(false);
  });
});
