// Word Scramble end-to-end, against a dev server on the emulators (see
// dev-against-emulators.mjs): a desktop host and three phones (two iPhones,
// an Android) form two teams of two. The uneven-teams warning shows until the
// fourth joins; a 3-turns-per-team game is played with tiles - a wrong
// arrangement in the feed for both teams, a hint, a mouse drag, words tapped
// in and confirmed, a Team B turn timed out - then
// the end screen and a rematch. About a minute and a half.
//
//   node .claude/skills/live-test/scripts/word-scramble.mjs [baseUrl] [screenshotDir]
import { readFileSync } from "node:fs";
import { closeBrowsers, newProfileContext } from "../../ui-review/scripts/screenshots.mjs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const out = process.argv[3];
const DB = "http://127.0.0.1:9000", NS = "demo-game-room-default-rtdb";
const WORDS = JSON.parse(readFileSync(new URL("../../../../lib/games/wordscramble/words.json", import.meta.url), "utf8"));
const errors = [];
const log = (...a) => console.log("•", ...a);
const adminRead = async (path) => (await fetch(`${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } })).json();
async function until(fn, what, ms = 30000) {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error(`timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 150)); }
}
async function player(profile, label) {
  const page = await (await newProfileContext(profile)).newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text().slice(0, 300)}`));
  return page;
}
const shot = async (page, name) => { if (out) await page.screenshot({ path: `${out}/${name}.png`, fullPage: true }); };
/** Taps tiles to spell `letters` (each tap sends the first matching tile to the next empty slot), then confirms. */
async function arrange(page, letters) {
  for (const l of letters) await page.getByRole("button", { name: `Letter ${l}`, exact: true }).first().click();
  await page.getByRole("button", { name: /^Confirm / }).click();
}
/** Drags the first `letter` tile onto empty slot `slot` with the mouse. */
async function drag(page, letter, slot) {
  const from = await page.getByRole("button", { name: `Letter ${letter}`, exact: true }).first().boundingBox();
  const to = await page.getByRole("img", { name: `Slot ${slot}, empty` }).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 20, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}
const plain = (w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

try {
  const A = await player("desktop", "A (host, desktop)");
  const B = await player("iphone", "B (iPhone)");
  const C = await player("android", "C (Android)");
  const D = await player("iphone-se", "D (iPhone SE)");
  await A.goto(`${BASE}/wordscramble`);
  await A.waitForFunction(() => location.hash.length === 7, null, { timeout: 60000 });
  const room = new URL(A.url()).hash.slice(1);
  const state = () => adminRead(`games/${room}/wordscramble`);
  const join = async (page, name) => {
    if (page !== A) await page.goto(A.url());
    await page.getByLabel("What's your name?").fill(name);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("heading", { name: "Pick a team" }).waitFor({ timeout: 30000 });
  };
  await join(A, "Sam");
  await join(B, "Léa");
  await join(C, "Max");
  await until(async () => Object.keys((await state())?.teams ?? {}).length === 3, "three teams picked");
  await A.getByText("Teams must be even: 2 vs 1").waitFor();
  await A.getByRole("button", { name: "Start" }).isDisabled().then((d) => { if (!d) throw new Error("Start enabled with uneven teams"); });
  log("room", room, "- uneven 2 vs 1: warning shown, Start disabled");
  await join(D, "Noah");
  const teams = await until(async () => { const t = (await state())?.teams; return t && Object.keys(t).length === 4 ? t : null; }, "four teams picked");
  log("teams:", JSON.stringify(teams));
  if (Object.values(teams).filter((t) => t === "A").length !== 2) throw new Error("teams aren't 2v2");
  const pageOf = { p1: A, p2: B, p3: C, p4: D };
  const teamPages = (team) => Object.entries(teams).filter(([, t]) => t === team).map(([seat]) => pageOf[seat]);

  // Host settings: 3 turns per team.
  await A.getByRole("button", { name: "Fewer turns" }).click();
  await A.getByRole("button", { name: "Fewer turns" }).click();
  await until(async () => (await state())?.settings?.turnsPerTeam === 3, "3 turns per team");
  await shot(A, "lobby-desktop");
  await shot(B, "lobby-iphone");
  await A.getByRole("button", { name: "Start", exact: true }).click();
  await B.getByText(/starts/).waitFor({ timeout: 10000 });
  log("started");

  for (let turn = 0; turn < 6; turn++) {
    const s = await until(async () => { const v = await state(); return v?.phase === "turn" && v.turn === turn ? v : null; }, `turn ${turn + 1}`, 30000);
    const word = WORDS.find((w) => w.id === s.wordId).word;
    const team = turn % 2 === 0 ? "A" : "B";
    const [p, q] = teamPages(team);
    const watcher = teamPages(team === "A" ? "B" : "A")[0];
    await p.getByRole("button", { name: /^Confirm/ }).waitFor({ timeout: 10000 });
    await watcher.getByText(`Team ${team} is playing`).waitFor();
    if (turn === 0) {
      // A wrong guess (in both teams' feeds), a hint, then the right word.
      // The tiles in scrambled order: never the word itself.
      const row = await q.getByRole("group", { name: "Scrambled letters" }).getByRole("button").allTextContents();
      await arrange(q, row);
      await until(async () => ((await state())?.guesses ?? []).length === 1, "the wrong guess");
      await p.getByText("not it").waitFor();
      await watcher.getByText("not it").waitFor();
      await p.getByRole("button", { name: /Hint/ }).click();
      await until(async () => (await state())?.hints === 1, "the hint");
      await p.getByRole("img", { name: /^Slot 1, .* \(hint\)$/ }).waitFor();
      // One real drag, then tap the rest.
      await drag(p, plain(word)[1], 2);
      await p.getByRole("button", { name: `Slot 2, ${plain(word)[1]}. Press to take it back` }).waitFor();
      await shot(p, `turn-playing-${p === A ? "desktop" : "phone"}`);
      await shot(q, `turn-playing-${q === A ? "desktop" : "phone"}`);
      await shot(watcher, "turn-watching");
    }
    if (turn === 3) {
      // Let this one run out.
      await until(async () => (await state())?.phase === "result", "time's up", 40000);
      await watcher.getByText("Time's up").waitFor();
      log(`turn ${turn + 1}: time's up, the word was ${word}`);
      continue;
    }
    await arrange(p, [...plain(word)].slice(turn === 0 ? 2 : 0));
    const r = await until(async () => { const v = await state(); return v?.phase === "result" ? v : null; }, "the right guess");
    const expected = plain(word).length - (turn === 0 ? 1 : 0);
    const got = r.history.at(-1).points;
    if (got !== expected) throw new Error(`turn ${turn + 1}: ${got} points, expected ${expected}`);
    await watcher.getByText("Got it!").waitFor();
    if (turn === 0) { await shot(watcher, "result-right"); }
    log(`turn ${turn + 1}: Team ${team} found ${word} for ${got}`);
    if (turn === 0) {
      await until(async () => (await state())?.phase === "scoreboard", "the scoreboard");
      await shot(C, "scoreboard-android");
    }
  }
  const end = await until(async () => { const v = await state(); return v?.phase === "end" ? v : null; }, "the end", 20000);
  const title = end.scores.A === end.scores.B ? "It's a draw!" : `Team ${end.scores.A > end.scores.B ? "A" : "B"} wins!`;
  for (const page of [A, B, C, D]) await page.getByRole("heading", { name: title }).waitFor();
  log("end:", JSON.stringify(end.scores), "-", title);
  await shot(A, "end-desktop");
  await shot(B, "end-iphone");

  await D.getByRole("button", { name: "Rematch" }).click();
  await until(async () => { const v = await state(); return v?.phase === "turn" && v.turn === 0 && v.scores.A === 0 && v.scores.B === 0; }, "the rematch");
  log("rematch started, same teams");

  if (errors.length) throw new Error(`console errors:\n${errors.join("\n")}`);
  console.log("\nPASS - no console errors");
} catch (e) {
  console.error("\nFAIL:", e.message);
  if (errors.length) console.error(errors.join("\n"));
  process.exitCode = 1;
} finally {
  await closeBrowsers();
}
