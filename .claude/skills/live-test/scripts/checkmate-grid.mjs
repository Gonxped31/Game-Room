#!/usr/bin/env node
// Checkmate Grid (/regions) edge cases, on one device profile, against the
// emulator dev server (dev-against-emulators.mjs): the Auto ✕ lock belongs to
// its puzzle (New puzzle, Next puzzle, Change then Start all unlock it), a
// reload or a tab switch keeps it, a puzzle being built never lands after
// Change, a double New puzzle saves the board that is shown, and the Daily
// lock is separate. Exits 1 if any check fails.
//
//   node .claude/skills/live-test/scripts/checkmate-grid.mjs [baseUrl] [profile]
//
// Run it on iphone-se (WebKit) and desktop (Chromium) at least.
import { closeBrowsers, newProfileContext } from "../../ui-review/scripts/screenshots.mjs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const profile = process.argv[3] ?? "iphone-se";
// Each run is its own connection, so the Daily attempt is a ranked first one.
const context = await newProfileContext(profile, { extraHTTPHeaders: { "x-forwarded-for": `10.5.${Math.floor(Math.random() * 250)}.1` } });
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

const btn = () => page.getByRole("button", { name: /^Auto ✕/ });
// Locked by the countdown (the label shows "Ns"), as opposed to unusable for having no piece on the board.
const locked = async () => /[0-9]+s$/.test((await btn().textContent()).trim());
const btnText = async () => (await btn().textContent()).trim();
const faint = () => page.locator('[data-cell][data-shown="auto"]').count();
const cellCount = () => page.locator("[data-cell]").count();
const grid = () => page.$$eval("[data-cell]", (els) => els.map((e) => e.style.backgroundColor).join("|"));
const time = async () => (await page.locator(".cg-time").textContent()).trim();
const tab = (name) => page.getByRole("radio", { name }).click();
const pick = (group, name) => page.getByRole("radiogroup", { name: group }).getByRole("radio", { name }).click();
const button = (name) => page.getByRole("button", { name, exact: true });
const tap = async (cell) => {
  await page.evaluate(() => document.querySelector(".cg-board").scrollIntoView({ block: "end" }));
  const b = await page.locator(`[data-cell="${cell}"]`).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};
const waitBoard = (n) => page.waitForFunction((n) => document.querySelectorAll("[data-cell]").length === n, n, { timeout: 30000 });
const placePiece = async () => { await tap(0); await tap(0); };
/** Rook 5x5: one per row, column and colour, from the colours on screen. */
const rookSolution = async () => {
  const colors = (await grid()).split("|");
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  return perms([0, 1, 2, 3, 4]).find((cols) => new Set(cols.map((c, r) => colors[r * 5 + c])).size === 5).map((c, r) => r * 5 + c);
};

await page.goto(`${BASE}/regions`);
await tab("Endless");
await pick("Piece", /Rook/);
await pick("Grid size", /^5/);
await button("Start").click();
await waitBoard(25);

// E1: press, New puzzle -> a different board, unlocked, no hints, clock back to 0.
await placePiece();
await btn().click();
check("E1 press locks", await locked(), await btnText());
const g1 = await grid();
await page.waitForTimeout(1200);
await button("New puzzle").click();
await waitBoard(25);
await page.waitForTimeout(300);
check("E1 New puzzle: no faint ✕ carried over (before any move)", (await faint()) === 0);
await placePiece();
check("E1 New puzzle: different board", (await grid()) !== g1);
check("E1 New puzzle: Auto ✕ not locked", !(await locked()), await btnText());
check("E1 New puzzle: no faint ✕ carried over", (await faint()) === 0);
check("E1 New puzzle: clock restarted", (await time()).startsWith("0:0"), await time());

// E2: press (E1 left a piece on the board), Change, Start (same piece and size) -> unlocked.
await btn().click();
await button("Change").click();
await button("Start").click();
await waitBoard(25);
await placePiece();
check("E2 Change -> Start: Auto ✕ not locked", !(await locked()), await btnText());

// E3: press, Change, other piece and size, Start -> unlocked, right size.
await btn().click();
await button("Change").click();
await pick("Piece", /King/);
await pick("Grid size", /^6/);
await button("Start").click();
await waitBoard(36);
await placePiece();
check("E3 Change -> King 6x6 -> Start: Auto ✕ not locked", !(await locked()), await btnText());

// E4: rook 5x5, press mid-solve, solve, Next puzzle -> unlocked; best time shown on setup.
await button("Change").click();
await pick("Piece", /Rook/);
await pick("Grid size", /^5/);
await button("Start").click();
await waitBoard(25);
const sol = await rookSolution();
await tap(sol[0]); await tap(sol[0]);
await btn().click();
check("E4 press mid-solve locks", await locked());
for (const cell of sol.slice(1)) { await tap(cell); await tap(cell); }
await page.getByText(/^Solved in/).waitFor({ timeout: 10000 });
check("E4 solved: no Auto ✕ press possible", (await btn().getAttribute("aria-disabled")) === "true");
await button("Next puzzle").click();
await waitBoard(25);
await placePiece();
check("E4 Next puzzle: Auto ✕ not locked", !(await locked()), await btnText());
await button("Change").click();
check("E4 best time on the setup card", /Your best at Rook 5×5: \d+:\d\d/.test(await page.locator(".cg-daily-card").textContent()));

// E5: press, reload -> same puzzle, still locked; New puzzle -> unlocked; reload -> still unlocked.
await button("Start").click();
await waitBoard(25);
await placePiece();
await btn().click();
const g5 = await grid();
await page.waitForTimeout(1500);
await page.reload();
await waitBoard(25);
await page.waitForTimeout(500);
check("E5 reload: same puzzle", (await grid()) === g5);
check("E5 reload: still locked, time kept", (await locked()) && Number((await btnText()).match(/(\d+)s/)?.[1]) <= 29, await btnText());
await button("New puzzle").click();
await waitBoard(25);
await placePiece();
check("E5 New puzzle after reload: not locked", !(await locked()), await btnText());
await page.reload();
await waitBoard(25);
await page.waitForTimeout(500);
check("E5 reload again: still not locked", !(await locked()), await btnText());

// E6: press, Daily tab, back to Endless -> same puzzle, still locked.
await btn().click();
const g6 = await grid();
await tab("Daily puzzle");
await button("Start").waitFor({ timeout: 60000 });
await tab("Endless");
await waitBoard(25);
await page.waitForTimeout(500);
check("E6 tab round trip: same puzzle", (await grid()) === g6);
check("E6 tab round trip: still locked", await locked(), await btnText());

// E7: Start then Change before the puzzle is built -> nothing lands; a reload shows the setup card.
await button("Change").click();
await page.evaluate(async () => {
  const find = (label) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
  find("Start").click();
  await new Promise((r) => setTimeout(r, 0));
  find("Change").click();
});
await page.waitForTimeout(800);
check("E7 Change during the build: no board", (await cellCount()) === 0 && (await button("Start").count()) === 1);
await page.reload();
await button("Start").waitFor({ timeout: 30000 });
check("E7 reload after: setup card, nothing resumed", (await cellCount()) === 0);

// E8: New puzzle twice in a row -> one board; what's saved is what's shown.
await button("Start").click();
await waitBoard(25);
await page.evaluate(async () => {
  const find = (label) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
  find("New puzzle").click();
  await new Promise((r) => setTimeout(r, 5));
  find("New puzzle").click();
});
await waitBoard(25);
await page.waitForTimeout(600);
const g8 = await grid();
await page.reload();
await waitBoard(25);
check("E8 double New puzzle: the saved board is the one shown", (await grid()) === g8);

// D1: Daily press, Endless tab, back -> still locked; reload -> still locked; Endless unaffected.
await tab("Daily puzzle");
await button("Start").click({ timeout: 60000 });
await page.waitForSelector("[data-cell]", { timeout: 60000 });
await placePiece();
await btn().click();
await tab("Endless");
await page.waitForSelector("[data-cell]");
await placePiece().catch(() => {});
const endlessLocked = await locked();
await tab("Daily puzzle");
await page.waitForSelector("[data-cell]", { timeout: 60000 });
await page.waitForTimeout(800);
check("D1 Daily tab round trip: still locked", await locked(), await btnText());
await page.reload();
await page.waitForSelector("[data-cell]", { timeout: 60000 });
await page.waitForTimeout(800);
check("D1 Daily reload: still locked", await locked(), await btnText());
check("D1 a Daily press doesn't lock Endless's new puzzle", !endlessLocked);

console.log(`\n${failures ? `${failures} FAILED` : "all passed"}; console errors: ${errors.length ? errors.join(" | ") : "none"}`);
await closeBrowsers();
process.exit(failures ? 1 : 0);
