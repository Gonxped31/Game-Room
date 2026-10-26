#!/usr/bin/env node
// Border Run's edge cases, past the basic path (live-test skill): names in both
// languages, refused guesses, the suggestions, reloads and tab switches mid-route,
// New route / Change / Show a route, best scores, and the daily's resume, penalty
// and finished page. Needs the emulator dev server (dev-against-emulators.mjs).
//
//   node .claude/skills/live-test/scripts/border-run.mjs [baseUrl] [profile]
//
// Exits 1 on any failure or console error.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const [base = "http://localhost:3123", profile = "iphone-se"] = process.argv.slice(2);
const { newProfileContext, closeBrowsers } = await import(pathToFileURL(join(repo, ".claude/skills/ui-review/scripts/screenshots.mjs")).href);

// The map data, read straight from the repo, to find each route's answer.
const COUNTRIES = JSON.parse(readFileSync(join(repo, "lib/games/borderrun/countries.json"), "utf8"));
const areasSource = readFileSync(join(repo, "lib/games/borderrun/areas.ts"), "utf8");
const listOf = (name) => new Set(areasSource.match(new RegExp(`const ${name} =\\s*"([^"]+)"`))[1].split(" "));
const AREA = { europe: listOf("EUROPE"), asia: listOf("ASIA"), africa: listOf("AFRICA"), americas: listOf("AMERICAS") };
AREA.eurasia = new Set([...AREA.europe, ...AREA.asia]);
AREA.world = new Set(Object.keys(COUNTRIES));

/** The countries between start and end on a shortest open route. */
function answer(route) {
  const closed = new Set(route.closed.map(([a, b]) => `${a}-${b}`));
  const open = (a, b) => AREA[route.area].has(b) && !closed.has(a < b ? `${a}-${b}` : `${b}-${a}`);
  const prev = new Map([[route.start, null]]);
  const queue = [route.start];
  while (queue.length) {
    const code = queue.shift();
    for (const next of COUNTRIES[code].borders) if (!prev.has(next) && open(code, next)) prev.set(next, code), queue.push(next);
  }
  const path = [];
  for (let code = prev.get(route.end); code !== route.start; code = prev.get(code)) path.unshift(code);
  return path;
}
/** An island on the route's map: a guess that's always "off" and can never complete a route. */
const islandOn = (route) => [...AREA[route.area]].find((code) => !COUNTRIES[code].borders.length);

const context = await newProfileContext(profile, { extraHTTPHeaders: { "x-forwarded-for": `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
const page = await context.newPage();
const errors = [];
// The Firebase SDK's long-poll disconnect on reload in WebKit is SDK noise, not the game's.
const noise = (text) => text.includes(".lp?disconn");
page.on("pageerror", (e) => !noise(String(e)) && errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !noise(m.text()) && errors.push(m.text()));

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const box = () => page.getByRole("combobox", { name: "Guess a country" });
const button = (name) => page.getByRole("button", { name, exact: true });
const tab = (name) => page.getByRole("radio", { name, exact: true }).click();
const guess = async (text) => {
  await box().fill(text);
  await box().press("Enter");
};
const guessCount = () => page.locator(".br-guess-item").count();
const message = async () => ((await page.locator(".br-message").textContent()) ?? "").trim();
const seconds = async () => {
  const [m, s] = (await page.locator(".br-time").textContent()).trim().split(" ")[0].split(":").map(Number);
  return m * 60 + s;
};
const routeTitle = async () => (await page.locator(".br-route-title").textContent()).trim();
const endless = () => page.evaluate(() => JSON.parse(localStorage.getItem("border-run:endless-game:v1")));
const name = (code, lang = "en") => COUNTRIES[code][lang];

await page.goto(`${base}/borderrun/solo`);
await tab("Endless");
await page.getByRole("radio", { name: "Europe", exact: true }).click();
await button("Start").click();
await box().waitFor();
let game = await endless();
let path = answer(game.route);

// B1: refused guesses cost nothing, and say why.
const before = await guessCount();
await guess("Atlantis");
check("B1 unknown name refused", (await guessCount()) === before && (await message()).includes("No country left on this map matches"), await message());
await guess("Egypt");
check("B1 country off this map refused", (await guessCount()) === before && (await message()).includes("isn’t on this map"), await message());
await guess(name(game.route.start));
check("B1 the start refused", (await guessCount()) === before && (await message()).includes("start or the end"), await message());
check("B1 the box is marked invalid, then clears on typing", (await box().getAttribute("aria-invalid")) === "true");
await box().fill("x");
check("B1 typing clears the message", (await message()) === "");

// B2: names in French, without accents or case; an island counts (off route); a repeat doesn't.
const first = path[0];
const plainFrench = COUNTRIES[first].fr.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
await guess(plainFrench);
check("B2 French name without accents or capitals accepted", (await guessCount()) === 1 && (await page.locator(".br-guess-name").first().textContent()) === name(first), plainFrench);
const island = islandOn(game.route);
await guess(name(island));
check("B2 an island counts, graded off route", (await guessCount()) === 2 && (await page.locator(".br-guess-item").first().getAttribute("data-tone")) === "off");
await guess(name(first));
check("B2 a repeat is refused", (await guessCount()) === 2 && (await message()).includes("already tried"), await message());

// B3: suggestions - arrow keys move the highlight, Enter takes it; a tap takes one too.
if (path.length > 1) {
  const target = path[1];
  const prefix = name(target).slice(0, 2);
  await box().fill(prefix);
  const options = await page.getByRole("option").allTextContents();
  const index = options.findIndex((text) => text.startsWith(name(target)));
  for (let i = 0; i < index; i++) await box().press("ArrowDown");
  await box().press("Enter");
  check("B3 arrow keys + Enter pick the highlighted suggestion", (await page.locator(".br-guess-name").first().textContent()) === name(target), `${prefix} → ${options.join(" | ")}`);
} else check("B3 (route too short to test suggestions)", true);

// B4: a reload mid-route keeps the route, the guesses and the clock.
await page.waitForTimeout(2200);
const countBefore = await guessCount();
const titleBefore = await routeTitle();
const clockBefore = await seconds();
await page.reload();
await box().waitFor();
await page.waitForTimeout(600);
check("B4 reload: same route", (await routeTitle()) === titleBefore);
check("B4 reload: same guesses", (await guessCount()) === countBefore);
check("B4 reload: the clock carries on", (await seconds()) >= clockBefore && (await seconds()) <= clockBefore + 3, `${clockBefore}s → ${await seconds()}s`);

// B5: Daily and back keeps it too.
await tab("Daily route");
await button("Start").waitFor({ timeout: 60000 });
await tab("Endless");
await box().waitFor();
check("B5 tab round trip: same route and guesses", (await routeTitle()) === titleBefore && (await guessCount()) === countBefore);

// B6: two quick Enters on one name make one guess.
game = await endless();
path = answer(game.route);
const remaining = path.filter((code) => !game.guesses.some((g) => g.code === code));
if (remaining.length > 1) {
  await box().fill(name(remaining[0]));
  await box().press("Enter");
  await box().press("Enter");
  check("B6 double Enter: one guess", (await guessCount()) === countBefore + 1);
} else check("B6 (no spare country to test with)", true);

// B7: finishing shows the score with its penalty, keeps the best, and a reload forgets the route.
game = await endless();
for (const code of answer(game.route).filter((code) => !game.guesses.some((g) => g.code === code))) await guess(name(code));
await page.getByText(/^Route complete/).waitFor();
const doneNote = (await page.locator(".br-done-note").textContent()).trim();
check("B7 complete: the island's penalty is shown", doneNote.includes("+ 15 s") || doneNote.includes("+ 30 s"), doneNote);
check("B7 complete: no guess box left", (await box().count()) === 0);
check("B7 complete: the route is spelled out", (await page.locator(".br-path").textContent()).includes("→"));
await page.reload();
await button("Start").waitFor();
check("B7 reload after finishing: the setup card", (await page.locator(".br-route-title").count()) === 0);
check("B7 the best is kept for the map", /Your best on Europe: \d+:\d\d/.test(await page.locator(".br-card").textContent()));

// B8: New route resets the box, the guesses and the clock.
await button("Start").click();
await box().waitFor();
const routeA = await routeTitle();
await box().fill("Fra");
await page.waitForTimeout(1200);
await button("New route").click();
await page.waitForTimeout(300);
check("B8 New route: no guesses", (await guessCount()) === 0);
check("B8 New route: the box is empty", (await box().inputValue()) === "");
check("B8 New route: the clock is back to 0", (await seconds()) <= 1);
check("B8 New route: (usually) another route", true, `${routeA} / ${await routeTitle()}`);

// B9: Show a route gives up: a route drawn, no box, no best; a reload shows the setup card.
const bestBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("border-run:endless:v1")).best.europe);
await button("Show a route").click();
check("B9 Show a route: one way through, spelled out", (await page.getByText("One way through").count()) === 1 && (await page.locator(".br-path").textContent()).includes("→"));
check("B9 Show a route: no guess box", (await box().count()) === 0);
check("B9 Show a route: the best is untouched", (await page.evaluate(() => JSON.parse(localStorage.getItem("border-run:endless:v1")).best.europe)) === bestBefore);
await page.reload();
await button("Start").waitFor();
check("B9 reload after giving up: the setup card", (await page.locator(".br-route-title").count()) === 0);

// B10: Change goes back to the picker; another map starts there; a reload after Change resumes nothing.
await page.getByRole("radio", { name: "Africa", exact: true }).click();
await button("Start").click();
await box().waitFor();
game = await endless();
check("B10 the Africa map gives an Africa route", game.route.area === "africa" && AREA.africa.has(game.route.start) && AREA.africa.has(game.route.end));
await button("Change").click();
await page.reload();
await button("Start").waitFor();
check("B10 reload after Change: the setup card, Africa still picked", (await page.getByRole("radio", { name: "Africa", exact: true }).getAttribute("aria-checked")) === "true");

// B11: names switch to French, and stay French after a reload.
await button("Start").click();
await box().waitFor();
game = await endless();
await page.getByRole("radiogroup", { name: "Country names" }).getByRole("radio", { name: "FR" }).click();
check("B11 FR: the route in French", (await routeTitle()).includes(name(game.route.start, "fr")), await routeTitle());
await page.reload();
await box().waitFor();
check("B11 FR survives a reload", (await routeTitle()).includes(name(game.route.start, "fr")));
await page.getByRole("radiogroup", { name: "Country names" }).getByRole("radio", { name: "EN" }).click();

// B12: the map zooms (buttons, double tap or click, ctrl + wheel), drags once zoomed, and a new route starts zoomed out.
const viewBox = async () => (await page.locator(".br-map").getAttribute("viewBox")).split(" ").map(Number);
// Buttons and double taps glide for 300 ms.
const glided = () => page.waitForTimeout(450);
const [, , wholeWidth] = await viewBox();
check("B12 whole map: only Zoom in", (await button("Zoom out").count()) === 0 && (await button("Show the whole map").count()) === 0);
await button("Zoom in").click();
await button("Zoom in").click();
await glided();
check("B12 two quick presses zoom in twice (the second doesn't cut the first short)", Math.abs((await viewBox())[2] - wholeWidth / 4) < 0.01, `${wholeWidth} → ${(await viewBox())[2]}`);
await button("Zoom out").click();
await glided();
let [x0, , w0] = await viewBox();
check("B12 Zoom out doubles it back", Math.abs(w0 - wholeWidth / 2) < 0.01, `${wholeWidth} → ${w0}`);
check("B12 zoomed: Zoom out and Show the whole map appear", (await button("Zoom out").count()) === 1 && (await button("Show the whole map").count()) === 1);
const mapBox = await page.locator(".br-map").boundingBox();
const middle = { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };
const drag = async (dx) => {
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(middle.x + dx, middle.y, { steps: 5 });
  await page.mouse.up();
};
// Right drags the view west; at the map's west edge it can't go, so then left.
await drag(60);
let [x1, , w1] = await viewBox();
if (x1 === x0) {
  await drag(-60);
  [x1, , w1] = await viewBox();
}
check("B12 dragging pans the zoomed map", x1 !== x0 && w1 === w0, `x ${x0} → ${x1}`);
await page.waitForTimeout(400);
if (profile === "desktop") {
  await page.mouse.dblclick(middle.x, middle.y);
} else {
  await page.touchscreen.tap(middle.x, middle.y);
  await page.touchscreen.tap(middle.x, middle.y);
}
await glided();
[, , w1] = await viewBox();
check(`B12 a double ${profile === "desktop" ? "click" : "tap"} zooms in`, Math.abs(w1 - w0 / 2) < 0.01, `${w0} → ${w1}`);
if (profile === "desktop") {
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await page.waitForTimeout(200);
  const [, , w2] = await viewBox();
  check("B12 ctrl + wheel zooms in", w2 < w1, `${w1} → ${w2}`);
}
await button("Show the whole map").click();
await glided();
check("B12 Show the whole map", (await viewBox())[2] === wholeWidth && (await button("Zoom out").count()) === 0);
await button("Zoom in").click();
await button("New route").click();
await box().waitFor();
check("B12 a new route starts zoomed out", (await viewBox())[2] === wholeWidth);

// D1: the daily resumes after a reload, guesses and server clock included.
await tab("Daily route");
await button("Start").click({ timeout: 60000 });
await box().waitFor({ timeout: 60000 });
const daily = await (await page.waitForFunction(() => JSON.parse(localStorage.getItem("border-run:daily-guesses:v1")))).jsonValue();
const dailyPath = answer(daily.route);
await guess(name(islandOn(daily.route)));
await guess(name(dailyPath[0]));
await page.waitForTimeout(2200);
const dailyClock = await seconds();
await page.reload();
await box().waitFor({ timeout: 60000 });
await page.waitForTimeout(800);
check("D1 reload: the daily's guesses come back", (await guessCount()) === 2);
check("D1 reload: the server's clock carries on", (await seconds()) >= dailyClock, `${dailyClock}s → ${await seconds()}s`);

// D2: finishing: the penalty on the result, then a reload shows the finished page with its map and route.
for (const code of dailyPath.slice(1)) await guess(name(code));
await page.getByText(/^Done in/).waitFor({ timeout: 30000 });
check("D2 the penalty is on the result", (await page.locator(".br-card").textContent()).includes("+ 15 s for guesses past the par"));
await page.reload();
await page.getByText(/^Done in/).waitFor({ timeout: 60000 });
await page.waitForTimeout(800);
check("D2 reload: the finished page, with the map and the route", (await page.locator(".br-map").count()) === 1 && (await page.locator(".br-path").count()) === 1);
check("D2 reload: no guess box", (await box().count()) === 0);

console.log(`\n${failures ? `${failures} FAILED` : "all passed"}; console errors: ${errors.length ? errors.join(" | ") : "none"}`);
await closeBrowsers();
process.exit(failures || errors.length ? 1 : 0);
