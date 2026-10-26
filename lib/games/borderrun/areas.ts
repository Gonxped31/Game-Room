import type { Lang } from "@/lib/games/shared/language";
import type { Area } from "./constants";
import { CODES } from "./countries";

const EUROPE =
  "AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM TR UA VA XK";
const ASIA =
  "AE AF AM AZ BD BH BN BT CN CY GE ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MV MY NP OM PH PK PS QA RU SA SG SY TH TJ TL TM TR TW UZ VN YE";
const AFRICA =
  "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW";
const AMERICAS = "AG AR BB BO BR BS BZ CA CL CO CR CU DM DO EC GD GF GL GT GY HN HT JM KN LC MX NI PA PE PY SR SV TT US UY VC VE";

const set = (...lists: string[]) => new Set(lists.flatMap((list) => list.split(" ")));

/**
 * The countries on each map. A route only goes through these; Russia and
 * Turkey are on both the Europe and the Asia maps, and Cyprus, Iceland or
 * Japan are there to be named even though no land route reaches them.
 */
export const AREA_COUNTRIES: Record<Area, ReadonlySet<string>> = {
  europe: set(EUROPE),
  americas: set(AMERICAS),
  africa: set(AFRICA),
  asia: set(ASIA),
  eurasia: set(EUROPE, ASIA),
  world: new Set(CODES),
};

/** What each map shows: longitude west to east, then latitude south to north (degrees). */
export const AREA_VIEW: Record<Area, { west: number; east: number; south: number; north: number }> = {
  europe: { west: -25, east: 45, south: 34, north: 71 },
  americas: { west: -170, east: -30, south: -56, north: 72 },
  africa: { west: -19, east: 53, south: -36, north: 38 },
  asia: { west: 25, east: 148, south: -11, north: 56 },
  eurasia: { west: -25, east: 150, south: -11, north: 72 },
  world: { west: -170, east: 180, south: -56, north: 78 },
};

export const AREA_NAME: Record<Area, Record<Lang, string>> = {
  europe: { en: "Europe", fr: "Europe" },
  americas: { en: "The Americas", fr: "Amériques" },
  africa: { en: "Africa", fr: "Afrique" },
  asia: { en: "Asia", fr: "Asie" },
  eurasia: { en: "Europe and Asia", fr: "Europe et Asie" },
  world: { en: "The world", fr: "Le monde" },
};
