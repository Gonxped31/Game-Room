#!/usr/bin/env node
// Checkmate Grid with others (lib/games/regions/race.ts), against a dev server on
// the emulators (dev-against-emulators.mjs). About four minutes.
//
// - Private Challenge, desktop host + iPhone: Start asks for a mode first and opens
//   /regions/race; the host picks the piece and the length, Survival refuses 2
//   players; the countdown holds the board; a reload mid-round keeps the pieces;
//   Auto ✕ locks; one solves, the other gives up, so the round ends early; the
//   results show anyone's board, and the faint answer for an unsolved one; Undo
//   takes a move back; 3 puzzles, the standings, back to the lobby, Leave room.
// - Private Survival, 4 players: one goes out per round; the last one in wins.
// - Matchmaking: Challenge and Survival are separate queues (4 and 8 seats); two
//   Challenge searchers meet and the room starts by itself.
//
// The script solves each puzzle from the board on screen (regions by colour, mix
// pieces by their labels), so it plays through the real UI.
//
//   node .claude/skills/live-test/scripts/checkmate-grid-race.mjs [baseUrl] [screenshotDir]
import { closeBrowsers, newProfileContext } from "../../ui-review/scripts/screenshots.mjs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const out = process.argv[3];
const DB = "http://127.0.0.1:9000", NS = "demo-game-room-default-rtdb";
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
const state = (room) => adminRead(`games/${room}/regions`);

// ---- Solving the board on screen ------------------------------------------------------
const GLYPHS = { "♜": "rook", "♚": "king", "♞": "knight", "♝": "bishop", "♛": "queen" };
const VARIANT = { Rook: "rook", King: "king", Knight: "knight", Queen: "queen", Mix: "mix" };
function attacks(piece, size, from, to) {
  const dr = Math.abs(Math.floor(from / size) - Math.floor(to / size));
  const dc = Math.abs((from % size) - (to % size));
  if (piece === "rook") return dr === 0 || dc === 0;
  if (piece === "king") return Math.max(dr, dc) === 1;
  if (piece === "knight") return (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
  if (piece === "bishop") return dr === dc;
  return dr === 0 || dc === 0 || dr === dc;
}
async function solution(page) {
  const board = await page.evaluate(() => ({
    colors: [...document.querySelectorAll("[data-cell]")].map((e) => e.style.backgroundColor),
    labels: [...document.querySelectorAll("[data-cell]")].map((e) => e.querySelector(".cg-label")?.textContent ?? ""),
    variant: document.querySelector(".cg-current-label")?.textContent ?? "",
  }));
  const size = Math.sqrt(board.colors.length);
  const ids = new Map();
  const region = board.colors.map((c) => (ids.has(c) ? ids.get(c) : (ids.set(c, ids.size), ids.size - 1)));
  const variant = VARIANT[Object.keys(VARIANT).find((name) => board.variant.includes(name))];
  const pieceOf = Array(size).fill(variant === "mix" ? null : variant === "queen" ? "queen" : variant);
  if (variant === "mix") board.labels.forEach((label, cell) => label && (pieceOf[region[cell]] = GLYPHS[label.replace("︎", "")]));
  const placed = [];
  const fits = (cell) =>
    placed.every((other) => {
      if (other % size === cell % size || region[other] === region[cell]) return false;
      return !attacks(pieceOf[region[cell]], size, cell, other) && !attacks(pieceOf[region[other]], size, other, cell);
    });
  const go = (row) => {
    if (row === size) return true;
    for (let col = 0; col < size; col++) {
      const cell = row * size + col;
      if (!fits(cell)) continue;
      placed.push(cell);
      if (go(row + 1)) return true;
      placed.pop();
    }
    return false;
  };
  if (!go(0)) throw new Error("no solution read from the board");
  return placed;
}
async function tap(page, cell) {
  const target = page.locator(`[data-cell="${cell}"]`);
  await target.scrollIntoViewIfNeeded();
  const b = await target.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
/** A piece: empty → ✕ → piece. */
const place = async (page, cell) => {
  await tap(page, cell);
  await tap(page, cell);
};
async function solve(page, from = 0) {
  const cells = await solution(page);
  for (const cell of cells.slice(from)) await place(page, cell);
  return cells;
}
const pieces = (page) => page.locator('[data-cell][data-shown="piece"]').count();
async function giveUp(page) {
  await page.getByRole("button", { name: "Give up…" }).click();
  await page.getByRole("button", { name: "Give up", exact: true }).click();
}
async function takeSeat(page, name) {
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /^Join/ }).click();
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
const resultsOf = (room, round) =>
  until(async () => {
    const s = await state(room);
    return s.phase === "results" && s.round === round ? s : null;
  }, `round ${round + 1}'s results`, 20000);
/** From the hub: Start → pick a mode → Start room. */
async function startRoom(page, mode) {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Start a Checkmate Grid room" }).click();
  const dialog = page.getByRole("dialog");
  const startButton = dialog.getByRole("button", { name: "Start room" });
  check(`Start (${mode}): nothing picked, Start room waits`, await startButton.isDisabled());
  await dialog.getByRole("radio", { name: new RegExp(mode) }).click();
  await startButton.click();
  await page.waitForURL(/\/regions\/race#[a-z0-9]{6}$/, { timeout: 30000 });
  return roomOf(page);
}

try {
  // ---- Private Challenge -----------------------------------------------------------------
  const H = await player("desktop", "Hana (desktop)");
  const P = await player("iphone", "Pia (iPhone)");
  const room = await startRoom(H, "Challenge");
  check("the room is at /regions/race, its link without ?mode=", !H.url().includes("?"), H.url());
  check("the room was created in Challenge, 8 seats", (await state(room)).mode === "challenge" && (await adminRead(`games/${room}/meta/maxPlayers`)) === 8);
  await takeSeat(H, "Hana");
  await H.getByRole("button", { name: "Start the race" }).waitFor();
  check("alone: Start waits for a second player", await H.getByRole("button", { name: "Start the race" }).isDisabled());

  await P.goto(`${BASE}/regions/race#${room}`);
  await takeSeat(P, "Pia");
  await H.getByText("Players: 2 of 4").waitFor();
  await H.getByRole("radiogroup", { name: "Pieces" }).getByRole("radio", { name: /King/ }).click();
  await H.getByRole("radiogroup", { name: "Mode" }).getByRole("radio", { name: "Survival", exact: true }).click();
  await H.getByText("Survival needs at least 4 players.").waitFor();
  check("Survival with 2: Start refused", await H.getByRole("button", { name: "Start the race" }).isDisabled());
  await H.getByRole("radiogroup", { name: "Mode" }).getByRole("radio", { name: "Challenge", exact: true }).click();
  await P.getByText("Pieces: King, 3 puzzles").waitFor();
  check("the guest sees the host's settings, and no switches", (await P.getByRole("radiogroup", { name: "Pieces" }).count()) === 0);
  await shot(H, "lobby-desktop");
  await shot(P, "lobby-iphone");
  await H.getByRole("button", { name: "Start the race" }).click();

  // Round 1: a tap during the countdown does nothing.
  await P.locator(".race-countdown").waitFor({ timeout: 15000 });
  await P.locator("[data-cell]").first().waitFor();
  await tap(P, 0);
  check("countdown: the board waits", (await P.locator('[data-cell="0"][data-shown="empty"]').count()) === 1);
  await shot(P, "countdown-iphone");
  let s = await roundStarted(room, 0);
  check("round 1: a king puzzle, 6×6, the same seed for both", (await P.locator("[data-cell]").count()) === 36 && (await H.getByText("King · 6×6").count()) === 1);
  const cells1 = await solution(P);
  await place(P, cells1[0]);
  await until(async () => ((await adminRead(`games/${room}/regionsRuns/p2/moves`)) ?? []).length === 2, "Pia's two moves in the database");
  await P.reload();
  await until(async () => (await pieces(P)) === 1, "Pia's piece back after a reload", 15000);
  check("reload mid-round: the piece is still there", true);
  await P.getByRole("button", { name: /^Auto ✕/ }).click();
  check("Auto ✕: shows faint ✕s, then locks", (await P.locator('[data-cell][data-shown="auto"]').count()) > 0 && (await P.getByRole("button", { name: /available in/ }).count()) === 1);
  await H.getByText("1 of 6 pieces").waitFor();
  check("the others see how far, never where", (await H.getByText("1 of 6 pieces").count()) === 1);
  await shot(P, "round-iphone");
  await solve(H);
  await H.getByText(/^Solved in/).waitFor();
  await giveUp(P);
  s = await resultsOf(room, 0);
  check("the round ended as soon as both were done", s.results[0].scores.p1.done && !s.results[0].scores.p2.done && s.results[0].scores.p2.found === 1);
  await P.getByText("Didn't solve it").waitFor();
  check("an unsolved board shows the answer, faintly", (await P.locator('[data-cell][data-shown="answer"]').count()) === 5);
  await shot(P, "results-iphone");
  await P.getByRole("button", { name: /Hana/ }).click();
  await P.getByText("Hana's board:").waitFor();
  check("the results show the picked player's board", (await pieces(P)) === 6);

  // Round 2: Undo takes a move back (piece → ✕), then both solve.
  s = await roundStarted(room, 1);
  const cells2 = await solution(P);
  await place(P, cells2[0]);
  await P.getByRole("button", { name: "Undo", exact: true }).click();
  check("Undo: the piece goes back to ✕", (await P.locator(`[data-cell="${cells2[0]}"][data-shown="mark"]`).count()) === 1);
  await tap(P, cells2[0]);
  await solve(P, 1);
  await solve(H);
  await resultsOf(room, 1);

  // Round 3, both solve; then the standings.
  s = await roundStarted(room, 2);
  check("round 3 is 7×7", (await P.locator("[data-cell]").count()) === 49);
  await solve(P);
  await solve(H);
  await H.getByText("Final standings", { exact: true }).waitFor({ timeout: 40000 });
  check("Challenge: the standings after 3 puzzles", (await state(room)).phase === "over");
  await shot(H, "final-desktop");
  await H.getByRole("button", { name: "Change mode or settings" }).click();
  await P.getByText("Waiting for Hana to start…").waitFor();
  check("back to the lobby, settings kept", (await state(room)).pieces === "king");
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
    await page.goto(`${BASE}/regions/race#${sroom}`);
    await takeSeat(page, names[i]);
  }
  await H.getByText("Players: 4 of 8").waitFor();
  await H.getByRole("button", { name: "Start the race" }).click();
  // Each round, the last player still in gives up and goes out.
  for (let round = 0; round < 3; round++) {
    s = await roundStarted(sroom, round);
    const alive = s.alive;
    const last = alive.at(-1);
    for (const seat of alive.slice(0, -1)) await solve(players[Number(seat.slice(1)) - 1]);
    await giveUp(players[Number(last.slice(1)) - 1]);
    s = await resultsOf(sroom, round);
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
    await page.getByRole("button", { name: "Matchmaking for Checkmate Grid: play with other players" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Your name").fill(name);
    check(`Matchmaking (${mode}): Find players waits for a mode`, await dialog.getByRole("button", { name: "Find players" }).isDisabled());
    await dialog.getByRole("radio", { name: new RegExp(mode) }).click();
    await dialog.getByRole("button", { name: "Find players" }).click();
    await page.waitForURL(/\/regions\/race#[a-z0-9]{6}$/, { timeout: 30000 });
    return roomOf(page);
  };
  const M1 = await player("desktop", "Max (desktop)");
  const M2 = await player("iphone", "Noa (iPhone)");
  const M3 = await player("android", "Oli (Android)");
  const c1 = await search(M1, "Challenge", "Max");
  await M1.getByText(/Waiting for more players/).waitFor({ timeout: 15000 });
  const meta1 = await adminRead(`games/${c1}/meta`);
  check("a Challenge search: a public Challenge room with 4 seats", meta1.gameSlug === "regions" && meta1.publicLang === "challenge" && meta1.maxPlayers === 4, JSON.stringify(meta1));
  const v1 = await search(M2, "Survival", "Noa");
  const meta2 = await adminRead(`games/${v1}/meta`);
  check("a Survival search doesn't land in the Challenge room", v1 !== c1 && meta2.publicLang === "survival" && meta2.maxPlayers === 8, JSON.stringify(meta2));
  const c2 = await search(M3, "Challenge", "Oli");
  check("a second Challenge search joins the first", c2 === c1, `${c1} / ${c2}`);
  await M1.getByText(/Starting in/).waitFor({ timeout: 15000 });
  await until(async () => (await state(c1))?.phase === "round", "the public Challenge starting by itself", 40000);
  check("the public Challenge starts by itself with both", JSON.stringify((await state(c1)).players) === JSON.stringify(["p1", "p2"]));
  await M3.locator(".race-board-row").nth(1).waitFor();
  await shot(M3, "public-round-android");
  log("Matchmaking done");
} catch (e) {
  failures++;
  console.log("FAIL ", e.message);
}

console.log(`\n${failures ? `${failures} FAILED` : "all passed"}; console errors: ${errors.length ? errors.join(" | ") : "none"}`);
await closeBrowsers();
process.exit(failures || errors.length ? 1 : 0);
