#!/usr/bin/env node
// Border Run with others (lib/games/borderrun/race.ts), against a dev server on
// the emulators (dev-against-emulators.mjs). About four minutes.
//
// - Private Challenge, desktop host + iPhone: Start asks for a mode first; the
//   room's link drops ?mode=; the host changes the map, the length and the mode
//   (Survival refuses 2 players, back to Challenge); the countdown holds the
//   guess box; one player solves, the other gives up, so the round ends early;
//   a reload mid-round keeps the guesses; 3 routes, then the standings, then
//   back to the lobby.
// - Private Survival, 4 players: one goes out per round; the one out watches
//   and can leave; the last one in wins.
// - Matchmaking: Challenge and Survival are separate queues (4 and 8 seats);
//   two Challenge searchers meet, and the room starts by itself.
//
//   node .claude/skills/live-test/scripts/border-run-race.mjs [baseUrl] [screenshotDir]
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeBrowsers, newProfileContext } from "../../ui-review/scripts/screenshots.mjs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const out = process.argv[3];
const DB = "http://127.0.0.1:9000", NS = "demo-game-room-default-rtdb";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const errors = [];
let failures = 0;
const log = (...a) => console.log("•", ...a);
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const adminRead = async (path) => (await fetch(`${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } })).json();
async function until(fn, what, ms = 30000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}
// The Firebase SDK's long-poll disconnect on reload in WebKit is SDK noise, not the game's.
const noise = (text) => text.includes(".lp?disconn");
async function player(profile, label) {
  const page = await (await newProfileContext(profile)).newPage();
  page.on("pageerror", (e) => !noise(String(e)) && errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !noise(m.text()) && errors.push(`${label}: ${m.text().slice(0, 300)}`));
  return page;
}
const shot = async (page, name) => {
  if (out) await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
};
const roomOf = (page) => new URL(page.url()).hash.slice(1);

// The map data, to find each route's answer.
const COUNTRIES = JSON.parse(readFileSync(join(repo, "lib/games/borderrun/countries.json"), "utf8"));
const areasSource = readFileSync(join(repo, "lib/games/borderrun/areas.ts"), "utf8");
const listOf = (name) => new Set(areasSource.match(new RegExp(`const ${name} =\\s*"([^"]+)"`))[1].split(" "));
const AREA = { europe: listOf("EUROPE"), asia: listOf("ASIA"), africa: listOf("AFRICA"), americas: listOf("AMERICAS") };
AREA.eurasia = new Set([...AREA.europe, ...AREA.asia]);
AREA.world = new Set(Object.keys(COUNTRIES));
function answer(route) {
  const closed = new Set((route.closed ?? []).map(([a, b]) => `${a}-${b}`));
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
const islandOn = (route) => [...AREA[route.area]].find((code) => !COUNTRIES[code].borders.length);

const state = (room) => adminRead(`games/${room}/borderrun`);
const box = (page) => page.getByRole("combobox", { name: "Guess a country" });
async function guess(page, code) {
  await box(page).fill(COUNTRIES[code].en);
  await box(page).press("Enter");
}
/** Waits for round `n` (from 0) to be under way, past its countdown. */
async function roundStarted(room, n) {
  const s = await until(async () => {
    const s = await state(room);
    return s?.phase === "round" && s.round === n ? s : null;
  }, `round ${n + 1}`, 40000);
  await new Promise((r) => setTimeout(r, Math.max(0, s.startsAt - Date.now()) + 600));
  return s;
}
async function solve(page, route) {
  for (const code of answer(route)) await guess(page, code);
}
async function giveUp(page) {
  await page.getByRole("button", { name: "Give up…" }).click();
  await page.getByRole("button", { name: "Give up", exact: true }).click();
}
async function takeSeat(page, name) {
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /^Join/ }).click();
}
/** From the hub: Start → pick a mode → Start room. Resolves with the new room's code once the link is clean. */
async function startRoom(page, mode) {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Start a Border Run room" }).click();
  const dialog = page.getByRole("dialog");
  const startButton = dialog.getByRole("button", { name: "Start room" });
  check(`Start (${mode}): nothing picked, Start room waits`, await startButton.isDisabled());
  await dialog.getByRole("radio", { name: new RegExp(mode) }).click();
  await startButton.click();
  await page.waitForURL(/\/borderrun#[a-z0-9]{6}$/, { timeout: 30000 });
  return roomOf(page);
}

try {
  // ---- Private Challenge -----------------------------------------------------------------
  const H = await player("desktop", "Hana (desktop)");
  const P = await player("iphone", "Pia (iPhone)");
  const room = await startRoom(H, "Challenge");
  check("the room's link has no ?mode= once created", !H.url().includes("?"), H.url());
  check("the room was created in Challenge, 8 seats", (await state(room)).mode === "challenge" && (await adminRead(`games/${room}/meta/maxPlayers`)) === 8);
  await takeSeat(H, "Hana");
  await H.getByRole("button", { name: "Start the race" }).waitFor();
  check("alone: Start waits for a second player", await H.getByRole("button", { name: "Start the race" }).isDisabled());

  await P.goto(`${BASE}/borderrun#${room}`);
  await takeSeat(P, "Pia");
  await H.getByText("Players: 2 of 4").waitFor();
  await H.getByRole("radiogroup", { name: "Map" }).getByRole("radio", { name: "Europe", exact: true }).click();
  await H.getByRole("radiogroup", { name: "Mode" }).getByRole("radio", { name: "Survival", exact: true }).click();
  await H.getByText("Survival needs at least 4 players.").waitFor();
  check("Survival with 2: Start refused", await H.getByRole("button", { name: "Start the race" }).isDisabled());
  await P.getByText("Survival", { exact: true }).first().waitFor();
  await H.getByRole("radiogroup", { name: "Mode" }).getByRole("radio", { name: "Challenge", exact: true }).click();
  await P.getByText("Map: Europe, 3 routes").waitFor();
  check("the guest sees the host's settings, and no switches", (await P.getByRole("radiogroup", { name: "Mode" }).count()) === 0);
  await shot(H, "challenge-lobby-desktop");
  await shot(P, "challenge-lobby-iphone");
  await H.getByRole("button", { name: "Start the race" }).click();

  // Round 1: the countdown, then Hana solves and Pia gives up: the round ends early.
  await P.locator(".race-countdown").waitFor({ timeout: 15000 });
  check("countdown: the guess box waits", await box(P).isDisabled());
  await shot(P, "countdown-iphone");
  let s = await roundStarted(room, 0);
  check("round 1 is on Europe", s.route.area === "europe", s.route.area);
  await solve(H, s.route);
  await guess(P, islandOn(s.route));
  await P.getByText("1 of").first().waitFor().catch(() => {});
  await shot(P, "round-iphone");
  await H.getByText(/^Done in/).waitFor();
  await giveUp(P);
  s = await until(async () => {
    const s = await state(room);
    return s.phase === "results" ? s : null;
  }, "round 1's results", 15000);
  check("the round ended as soon as both were done", s.results[0].scores.p1.done && !s.results[0].scores.p2.done);
  await P.getByText("Didn't finish").waitFor();
  await shot(P, "results-iphone");
  await P.getByRole("button", { name: /Hana/ }).click();
  check("the results show the picked player's guesses", (await P.getByText("Hana's guesses").count()) === 1);

  // Round 2: a reload mid-round keeps Pia's guesses.
  s = await roundStarted(room, 1);
  const path2 = answer(s.route);
  await guess(P, path2[0]);
  await P.locator(".br-guess-item").first().waitFor();
  await P.reload();
  await box(P).waitFor();
  await until(async () => (await P.locator(".br-guess-item").count()) === 1, "Pia's guess back after a reload", 15000);
  check("reload mid-round: the guess is still there", true);
  for (const code of path2.slice(1)) await guess(P, code);
  await solve(H, s.route);
  await until(async () => (await state(room)).phase === "results", "round 2's results", 15000);

  // Round 3, both solve; then the standings.
  s = await roundStarted(room, 2);
  await solve(P, s.route);
  await solve(H, s.route);
  await H.getByText("Final standings", { exact: true }).waitFor({ timeout: 40000 });
  check("Challenge: the standings after 3 routes", (await state(room)).phase === "over");
  await shot(H, "final-desktop");
  await H.getByRole("button", { name: "Change mode or settings" }).click();
  await P.getByText("Waiting for Hana to start…").waitFor();
  check("back to the lobby, settings kept", (await state(room)).map === "europe");
  await P.getByRole("button", { name: "Leave room" }).click();
  await P.waitForURL(`${BASE}/`);
  await until(async () => !(await adminRead(`games/${room}/seats/p2`)), "Pia's seat given up");
  check("Leave room gives up the seat", true);
  log("Challenge done");

  // ---- Private Survival, 4 players -------------------------------------------------------
  const players = [H, P, await player("android", "Ana (Android)"), await player("iphone-se", "Sid (iPhone SE)")];
  const names = ["Hana", "Pia", "Ana", "Sid"];
  const sroom = await startRoom(H, "Survival");
  await takeSeat(H, "Hana");
  for (const [i, page] of players.entries()) {
    if (i === 0) continue;
    await page.goto(`${BASE}/borderrun#${sroom}`);
    await takeSeat(page, names[i]);
  }
  await H.getByText("Players: 4 of 8").waitFor();
  await H.getByRole("button", { name: "Start the race" }).click();
  // Each round, the last player still in gives up and goes out.
  for (let round = 0; round < 3; round++) {
    s = await roundStarted(sroom, round);
    const alive = s.alive;
    const last = alive.at(-1);
    for (const seat of alive.slice(0, -1)) await solve(players[Number(seat.slice(1)) - 1], s.route);
    await giveUp(players[Number(last.slice(1)) - 1]);
    s = await until(async () => {
      const s = await state(sroom);
      return s.phase === "results" && s.round === round ? s : null;
    }, `survival round ${round + 1}'s results`, 15000);
    check(`survival round ${round + 1}: the one who gave up is out`, JSON.stringify(s.results[round].out) === JSON.stringify([last]), JSON.stringify(s.results[round].out));
    if (round === 0) {
      const outPage = players[Number(last.slice(1)) - 1];
      await outPage.getByRole("button", { name: "Leave room" }).waitFor();
      await shot(outPage, "survival-out");
    }
  }
  await H.getByText("You win!").waitFor({ timeout: 40000 });
  await players[1].getByText("Hana wins!").waitFor();
  check("Survival: the last one in wins", true);
  await shot(H, "survival-final-desktop");
  log("Survival done");

  // ---- Matchmaking by mode ---------------------------------------------------------------
  const search = async (page, mode, name) => {
    await page.goto(BASE);
    await page.getByRole("button", { name: "Matchmaking for Border Run: play with other players" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Your name").fill(name);
    check(`Matchmaking (${mode}): Find players waits for a mode`, await dialog.getByRole("button", { name: "Find players" }).isDisabled());
    await dialog.getByRole("radio", { name: new RegExp(mode) }).click();
    await dialog.getByRole("button", { name: "Find players" }).click();
    await page.waitForURL(/\/borderrun#[a-z0-9]{6}$/, { timeout: 30000 });
    return roomOf(page);
  };
  const M1 = await player("desktop", "Max (desktop)");
  const M2 = await player("iphone", "Noa (iPhone)");
  const M3 = await player("android", "Oli (Android)");
  const c1 = await search(M1, "Challenge", "Max");
  await M1.getByText(/Waiting for more players/).waitFor({ timeout: 15000 });
  const meta1 = await adminRead(`games/${c1}/meta`);
  check("a Challenge search: a public Challenge room with 4 seats", meta1.publicLang === "challenge" && meta1.maxPlayers === 4, JSON.stringify(meta1));
  check("a public lobby has no mode switch", (await M1.getByRole("radiogroup", { name: "Mode" }).count()) === 0);
  const v1 = await search(M2, "Survival", "Noa");
  const meta2 = await adminRead(`games/${v1}/meta`);
  await M2.getByText(/Waiting for more players/).waitFor({ timeout: 15000 });
  check("a Survival search doesn't land in the Challenge room", v1 !== c1 && meta2.publicLang === "survival" && meta2.maxPlayers === 8, JSON.stringify(meta2));
  await shot(M2, "survival-waiting-iphone");
  const c2 = await search(M3, "Challenge", "Oli");
  check("a second Challenge search joins the first", c2 === c1, `${c1} / ${c2}`);
  await M1.getByText(/Starting in/).waitFor({ timeout: 15000 });
  await shot(M1, "public-countdown-desktop");
  await until(async () => (await state(c1))?.phase === "round", "the public Challenge starting by itself", 40000);
  check("the public Challenge starts by itself with both", JSON.stringify((await state(c1)).players) === JSON.stringify(["p1", "p2"]));
  await M3.locator(".race-board-row").nth(1).waitFor();
  log("Matchmaking done");
} catch (e) {
  failures++;
  console.log("FAIL ", e.message);
}

console.log(`\n${failures ? `${failures} FAILED` : "all passed"}; console errors: ${errors.length ? errors.join(" | ") : "none"}`);
await closeBrowsers();
process.exit(failures || errors.length ? 1 : 0);
