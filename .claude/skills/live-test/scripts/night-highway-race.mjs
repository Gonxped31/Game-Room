// Night Highway end-to-end, against a dev server on the emulators
// (see dev-against-emulators.mjs). A desktop player (Chromium) races an
// iPhone (WebKit) for a full 60 seconds, so this takes about 1.5 minutes.
//
//   node .claude/skills/live-test/scripts/night-highway-race.mjs [baseUrl] [screenshotDir]
//
// Checks, in order:
// - Solo: the title screen's Drive button starts a run.
// - A creates a room and waits with the invite link; B joins by the link.
// - A switches Rain on in the lobby and B switches Desert on: each sees the
//   other's switch, and both race in the rain, in the desert.
// - Both press Ready; the race starts in the database with a seed.
// - Both browsers simulate the race's traffic identically (V8 vs JavaScriptCore).
// - Each player's HUD names the other, and both live cars reach the database.
// - When the clock runs out, both results land and both see the results screen.
// Exits non-zero on the first failure; prints any browser console errors.
import { closeBrowsers, newProfileContext } from "../../ui-review/scripts/screenshots.mjs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const DB = "http://127.0.0.1:9000";
const NS = "demo-game-room-default-rtdb";
const out = process.argv[3];
const shot = (page, name) => (out ? page.screenshot({ path: `${out}/${name}.png` }) : Promise.resolve());
const errors = [];
const log = (...a) => console.log("•", ...a);
async function adminRead(path) {
  const res = await fetch(`${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } });
  return res.json();
}
async function until(fn, what, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
async function player(profile, label) {
  const page = await (await newProfileContext(profile)).newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  return page;
}

try {
  const solo = await player("desktop", "solo (desktop)");
  await solo.goto(`${BASE}/nighthighway/solo`);
  await solo.getByRole("button", { name: /Drive/ }).click();
  await until(() => solo.evaluate(() => window.NightHighway?.G.state === "countdown" || window.NightHighway?.G.state === "drive"), "a solo run to start");
  await solo.close();
  log("solo: Drive starts a run");

  const A = await player("desktop", "A (desktop)");
  const B = await player("iphone", "B (iPhone)");
  await A.goto(`${BASE}/nighthighway`);
  await A.waitForFunction(() => location.hash.length === 7);
  const room = new URL(A.url()).hash.slice(1);
  await A.getByLabel("Your name").fill("Sam");
  await A.getByRole("button", { name: "Continue" }).click();
  await A.getByText("Waiting for the other driver").waitFor();
  log("A created room", room, "and waits with the invite link");
  await shot(A, "1-waiting");

  await B.goto(A.url());
  await B.getByText("Sam is waiting at the start line").waitFor();
  await B.getByLabel("Your name").fill("Alex");
  await B.getByRole("button", { name: "Continue" }).click();
  await A.getByRole("button", { name: "Ready" }).waitFor();
  await B.getByRole("button", { name: "Ready" }).waitFor();
  log("both in the lobby");
  await shot(B, "2-lobby-iphone");

  // Options: A turns rain on; B's switch follows (pickups stay on by default).
  await A.getByRole("switch", { name: "Rain" }).click();
  await until(async () => (await B.getByRole("switch", { name: "Rain" }).getAttribute("aria-checked")) === "true", "B to see rain switched on");
  if ((await B.getByRole("switch", { name: "Pickups" }).getAttribute("aria-checked")) !== "true") throw new Error("pickups should default to on");
  log("A switched rain on; B sees it");
  await B.getByRole("switch", { name: "Desert" }).click();
  await until(async () => (await A.getByRole("switch", { name: "Desert" }).getAttribute("aria-checked")) === "true", "A to see the desert switched on");
  await until(() => A.evaluate(() => window.NightHighway.circuit() === "desert"), "A's lobby road to show the desert");
  log("B switched the desert on; A sees it, and the lobby road is the desert");

  await A.getByRole("button", { name: "Ready" }).click();
  await B.getByText("Sam is ready.").waitFor();
  await B.getByRole("button", { name: "Ready" }).click();
  const game = await until(async () => {
    const g = await adminRead(`games/${room}/nighthighway`);
    return g?.phase === "RACING" ? g : null;
  }, "the race to start");
  log("race", game.race, "started, seed", game.seed);

  // Both browsers simulate this race's traffic identically (Chromium's V8 vs WebKit's JSC).
  const [ca, cb] = await Promise.all([A, B].map((p) => p.evaluate(([seed]) => window.NightHighway.raceTrafficChecksum(seed, 63), [game.seed])));
  if (ca !== cb) throw new Error(`traffic differs between browsers: ${ca} vs ${cb}`);
  log("identical traffic in Chromium and WebKit:", ca);

  // A drives: gas, a bit of steering. B (touch) gets auto-gas like the original.
  await A.locator("#scene").click();
  await A.keyboard.down("ArrowUp");
  await until(() => A.evaluate(() => window.NightHighway.G.state === "drive"), "Go", 15000);
  log("countdown done, driving");
  const opts = await Promise.all([A, B].map((p) => p.evaluate(() => window.NightHighway.G.race?.options)));
  if (!opts.every((o) => o && o.rain === true && o.pickups === true && o.desert === true)) throw new Error(`race options differ or are wrong: ${JSON.stringify(opts)}`);
  const circuits = await Promise.all([A, B].map((p) => p.evaluate(() => window.NightHighway.circuit())));
  if (!circuits.every((c) => c === "desert")) throw new Error(`both should race in the desert: ${circuits}`);
  log("both race in the desert, with rain and pickups on");
  await A.waitForTimeout(4000);
  await A.keyboard.down("ArrowLeft");
  await A.waitForTimeout(400);
  await A.keyboard.up("ArrowLeft");

  // Each sees the other: the HUD line, and the ghost car near the start.
  const oppA = await until(async () => (await A.locator("#opp").textContent())?.trim(), "A's opponent line");
  const oppB = await until(async () => (await B.locator("#opp").textContent())?.trim(), "B's opponent line");
  log("HUD lines:", JSON.stringify(oppA), "/", JSON.stringify(oppB));
  if (!oppA.startsWith("Alex") || !oppB.startsWith("Sam")) throw new Error("opponent lines name the wrong player");
  const cars = await adminRead(`games/${room}/nighthighwayCars`);
  if (!cars?.p1 || !cars?.p2) throw new Error("live cars missing in the database");
  log("live cars in the database: p1 at", cars.p1.s, "m, p2 at", cars.p2.s, "m");
  await shot(A, "3-racing-desktop");

  // Let the race run out (it ends 63 s after the countdown starts).
  const endsAt = game.startAt + 63000;
  await A.waitForTimeout(Math.max(0, endsAt - Date.now() + 1500));
  await A.keyboard.up("ArrowUp");
  const done = await until(async () => {
    const g = await adminRead(`games/${room}/nighthighway`);
    return g?.phase === "DONE" ? g : null;
  }, "both results in", 20000);
  log("race over:", JSON.stringify(done.history[0]), "wins", JSON.stringify(done.wins));
  await A.getByRole("button", { name: "Race again" }).waitFor();
  await B.getByRole("button", { name: "Race again" }).waitFor();
  const headline = await A.locator(".nh-headline").textContent();
  log("A sees:", headline);
  await shot(A, "4-results-desktop");
  await shot(B, "4-results-iphone");

  console.log(errors.length ? `\nCONSOLE ERRORS:\n  ${errors.join("\n  ")}` : "\nPASS - no console errors");
  process.exitCode = errors.length ? 1 : 0;
} catch (error) {
  console.error(`\nFAILED: ${error.message}`);
  if (errors.length) console.error(`console errors so far:\n  ${errors.join("\n  ")}`);
  process.exitCode = 1;
} finally {
  await closeBrowsers();
}
