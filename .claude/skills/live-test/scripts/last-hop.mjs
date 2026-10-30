// Last Hop end-to-end, against a dev server on the emulators (see
// dev-against-emulators.mjs): a desktop host starts a Track room from the hub
// (the mode is picked there; the lobby only shows it) and an iPhone joins.
// They play a Track match through - taps during "Get ready" that do nothing, a
// reload mid-round, the Leave room question, a round lost on time, the pair's
// second round on the same board with sides swapped, the match's end (also
// after a reload), How to play from the header and the lobby. The guest only plays: only the host starts, switches the
// next match to Grid, plays again and resets (Reset keeps Grid). Then
// matchmaking: two strangers search Track, the match starts by itself; after
// it they vote (a split vote waits, an agreed "Change to Grid" starts a Grid
// match); one leaves and the other is offered another player. About three
// minutes.
//
//   node .claude/skills/live-test/scripts/last-hop.mjs [baseUrl] [screenshotDir] [phoneProfile]
import { closeBrowsers, newProfileContext } from "../../ui-review/scripts/screenshots.mjs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const out = process.argv[3];
const PHONE = process.argv[4] ?? "iphone";
const DB = "http://127.0.0.1:9000", NS = "demo-game-room-default-rtdb";
const errors = [];
const log = (...a) => console.log("•", ...a);
const admin = async (path, method = "GET", body) =>
  (await fetch(`${DB}/${path}.json?ns=${NS}`, { method, headers: { Authorization: "Bearer owner" }, body: body == null ? undefined : JSON.stringify(body) })).json();
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const other = (seat) => (seat === "p1" ? "p2" : "p1");
const aSeat = (s) => (s.round % 2 === 1 ? s.firstA : other(s.firstA));
const mover = (s) => (s.turn === "A" ? aSeat(s) : other(aSeat(s)));

try {
  const A = await player("desktop", "A (desktop)");
  const B = await player(PHONE, `B (${PHONE})`);
  // The hub's Start asks for the mode first.
  await A.goto(BASE);
  await A.getByRole("button", { name: "Start a Last Hop room" }).click();
  await A.getByRole("dialog").getByRole("radio", { name: /Track/ }).click();
  await A.getByRole("dialog").getByRole("button", { name: "Start room" }).click();
  await A.waitForURL(/\/lasthop#[a-z0-9]{6}$/, { timeout: 60000 });
  const room = new URL(A.url()).hash.slice(1);
  const path = `games/${room}/lasthop`;
  const state = () => admin(path);
  if ((await until(state, "the room's state")).mode !== "track") throw new Error("the room didn't start in Track");
  await A.getByLabel("Your name").fill("Sam");
  await A.getByRole("button", { name: "Continue" }).click();
  await A.getByRole("button", { name: "Copy invite link" }).waitFor({ timeout: 30000 });
  await shot(A, "invite-desktop");
  log("A created room", room);

  await B.goto(A.url());
  await B.getByLabel("Your name").fill("Léa");
  await B.getByRole("button", { name: "Continue" }).click();
  for (const page of [A, B]) await page.getByRole("heading", { name: "Make the last move" }).waitFor({ timeout: 30000 });
  log("both in the lobby");

  // The lobby only shows the mode picked on the hub: nobody can switch it here.
  for (const page of [A, B]) {
    await page.getByText("Quick and sharp. One row, every move counts.").waitFor();
    if ((await page.getByRole("radio").count()) !== 0) throw new Error("the lobby offers a mode switch");
  }
  await shot(B, "lobby-iphone");
  log("Start asked for the mode; the lobby only shows it");

  // How to play: from the header's ? (closed with Got it) and the lobby's link (closed with Escape).
  await B.getByRole("button", { name: "How to play" }).click();
  await B.getByRole("dialog").getByRole("heading", { name: "How to play" }).waitFor();
  await shot(B, "rules-iphone");
  await B.getByRole("dialog").getByRole("button", { name: "Got it" }).click();
  await B.getByRole("dialog").waitFor({ state: "detached" });
  await A.getByRole("button", { name: "Read the full rules" }).click();
  await A.getByRole("dialog").getByRole("heading", { name: "How to play" }).waitFor();
  await shot(A, "rules-desktop");
  await A.keyboard.press("Escape");
  await A.getByRole("dialog").waitFor({ state: "detached" });
  log("How to play opens from the header and the lobby, and closes");

  const pageOf = (seat) => (seat === "p1" ? A : B);
  /** The mover plays one move through the board: a piece that can move, then a square to move to. */
  async function playOne() {
    const s = await state();
    const page = pageOf(mover(s));
    await page.getByRole("button", { name: /can move$/ }).first().click();
    await page.getByRole("button", { name: /move here$/ }).first().click();
    await until(async () => { const v = await state(); return v.moves > s.moves || v.round !== s.round || v.phase !== "playing"; }, "the move to land");
  }
  async function playRoundOut() {
    const round = (await state()).round;
    for (;;) {
      const s = await state();
      if (s.phase !== "playing" || s.round !== round) return s;
      if (Date.now() < s.turnStartedAt + 300) { await wait(200); continue; }
      await playOne();
    }
  }

  // Start: during "Get ready" nothing can be picked.
  // Only the host starts.
  await B.getByText("Waiting for Sam to start the match…").waitFor();
  if ((await B.getByRole("button", { name: "Start the match" }).count()) !== 0) throw new Error("the guest can start the match");
  if ((await B.getByRole("button", { name: "Reset game" }).count()) !== 0) throw new Error("the guest can reset the game");
  await A.getByRole("button", { name: "Start the match" }).click();
  for (const page of [A, B]) await page.getByRole("group", { name: "The track" }).waitFor({ timeout: 10000 });
  await A.getByText(/Get ready/).waitFor();
  const s1 = await state();
  if ((await pageOf(mover(s1)).getByRole("button", { name: /can move$/ }).count()) !== 0) throw new Error("a piece can be picked during Get ready");
  log("round 1 dealt:", s1.board.cells, "first A:", s1.firstA);
  await pageOf(mover(s1)).getByText("Your move").waitFor({ timeout: 10000 });
  await pageOf(other(mover(s1))).getByText(/Sam to move|Léa to move/).waitFor();
  // The waiting player has nothing to pick.
  if ((await pageOf(other(mover(s1))).getByRole("button", { name: /can move$/ }).count()) !== 0) throw new Error("the waiting player can pick a piece");
  await shot(A, "round1-desktop");
  await shot(B, "round1-iphone");

  // Two moves, then a reload mid-round keeps the board; the clock charged and added its increment.
  await playOne();
  await playOne();
  const mid = await state();
  if (mid.moves !== 2) throw new Error(`expected 2 moves, got ${mid.moves}`);
  if (mid.clocks.p1 === 60000 && mid.clocks.p2 === 60000) throw new Error("no clock changed");
  await B.reload();
  await B.getByRole("group", { name: "The track" }).waitFor({ timeout: 30000 });
  const labels = await B.getByRole("group", { name: "The track" }).getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const pieces = labels.filter((l) => l.includes("piece")).length;
  if (pieces !== [...mid.board.cells].filter((c) => c !== ".").length) throw new Error(`after reload B shows ${pieces} pieces`);
  log("reload mid-round keeps the board");

  // Leave room asks first mid-match; Cancel keeps the seat.
  await A.getByRole("button", { name: "Leave room" }).click();
  await A.getByRole("dialog").getByRole("button", { name: /Stay|Cancel/ }).click();
  await A.getByRole("group", { name: "The track" }).waitFor();
  log("Leave room asks first, Cancel stays");

  // Round 1 on time: the mover's clock is cut to 2 s and runs out.
  const before = await state();
  const loser = mover(before);
  await admin(`${path}/clocks`, "PATCH", { [loser]: 2000 });
  const r1 = await until(async () => { const v = await state(); return v.phase === "roundOver" ? v : null; }, "the flag", 15000);
  if (r1.history[0].reason !== "time" || r1.history[0].winner !== other(loser)) throw new Error(`round 1: ${JSON.stringify(r1.history)}`);
  await pageOf(loser).getByText("You ran out of time.", { exact: false }).waitFor();
  await pageOf(other(loser)).getByText("You made the last hop!").waitFor();
  await shot(pageOf(loser), `round-lost-on-time-${loser === "p1" ? "desktop" : "iphone"}`);
  log("round 1 lost on time by", loser);

  // Round 2: the same board, sides swapped.
  const r2 = await until(async () => { const v = await state(); return v.round === 2 && v.phase === "playing" ? v : null; }, "round 2", 15000);
  if (r2.start !== s1.start || aSeat(r2) === aSeat(s1)) throw new Error("round 2 isn't the same board with sides swapped");
  log("round 2: same board, sides swapped");
  let s = await playRoundOut();
  if (s.history[1].reason !== "stuck") throw new Error(`round 2 ended by ${s.history[1].reason}`);
  log("round 2 played out:", s.history[1].moves, "moves, won by", s.history[1].winner);
  await shot(B, "round-over-iphone");

  // Play on until the match ends (rounds 3+ are new boards).
  while (s.phase !== "matchOver") {
    s = await until(async () => { const v = await state(); return v.phase === "playing" || v.phase === "matchOver" ? v : null; }, "the next round", 15000);
    if (s.phase === "matchOver") break;
    if (s.round === 3 && s.start === s1.start) throw new Error("round 3 reuses the first board");
    s = await playRoundOut();
    log(`round ${s.round}: ${s.history.at(-1).winner} (${s.history.at(-1).moves} moves), score ${s.score.p1}-${s.score.p2}`);
  }
  for (const page of [A, B]) await page.getByRole("heading", { name: /wins the match|You win the match|A draw/ }).waitFor({ timeout: 10000 });
  await shot(A, "match-over-desktop");
  await shot(B, "match-over-iphone");
  await B.reload();
  await B.getByRole("heading", { name: /wins the match|You win the match|A draw/ }).waitFor({ timeout: 30000 });
  log("match over", `${s.score.p1}-${s.score.p2}`, "(also after a reload)");

  // Between matches only the host switches the mode; the guest sees it.
  if ((await B.getByRole("radiogroup", { name: "Mode for the next match" }).count()) !== 0) throw new Error("the guest can switch the mode");
  await B.getByText("Waiting for Sam to start it…", { exact: false }).waitFor();
  await A.getByRole("radiogroup", { name: "Mode for the next match" }).getByRole("radio", { name: /Grid/ }).click();
  await until(async () => (await state()).mode === "grid", "the host's switch to Grid");
  await B.getByText("Next match: Grid", { exact: false }).waitFor();
  await shot(A, "next-match-desktop");
  log("between matches only the host switched to Grid");

  // Play again (the host's): a clean score, in Grid.
  if ((await B.getByRole("button", { name: "Play again" }).count()) !== 0) throw new Error("the guest can play again");
  await B.getByText("Waiting for Sam to start it…", { exact: false }).waitFor();
  await A.getByRole("button", { name: "Play again" }).click();
  const again = await until(async () => { const v = await state(); return v.phase === "playing" && v.round === 1 ? v : null; }, "a new match");
  if (again.score.p1 !== 0 || again.score.p2 !== 0 || (again.history ?? []).length) throw new Error("Play again kept the score");
  if (again.mode !== "grid" || again.board.h === 1) throw new Error("Play again isn't in Grid");
  for (const page of [A, B]) await page.getByRole("group", { name: "The grid" }).waitFor({ timeout: 10000 });
  log("Play again starts clean, in Grid");
  const g = await state();
  log("grid dealt:", g.board.w, "x", g.board.h);
  await until(async () => Date.now() > (await state()).turnStartedAt + 300, "the clock to start");
  await playOne();
  await playOne();
  await shot(A, "grid-desktop");
  await shot(B, "grid-iphone");
  s = await playRoundOut();
  if (s.phase !== "roundOver" || s.history[0].reason !== "stuck") throw new Error(`grid round ended ${JSON.stringify(s.history)}`);
  log("grid round played out:", s.history[0].moves, "moves");

  // Reset game: back to the lobby, still in Grid, still no switch.
  await A.getByRole("button", { name: "Reset game" }).click();
  await A.getByRole("dialog").getByRole("button", { name: "Reset game" }).click();
  for (const page of [A, B]) await page.getByRole("heading", { name: "Make the last move" }).waitFor({ timeout: 10000 });
  if ((await state()).mode !== "grid" || (await B.getByRole("radio").count()) !== 0) throw new Error("Reset game lost the mode or shows a switch");
  await B.getByText("Longer, more open. Pieces move two ways.").waitFor();
  log("Reset game keeps Grid");

  // ---- Matchmaking: two strangers search Track ---------------------------------------
  const search = async (page, name) => {
    await page.goto(BASE);
    await page.getByRole("button", { name: "Matchmaking for Last Hop: play with other players" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Your name").fill(name);
    await dialog.getByRole("radio", { name: /Track/ }).click();
    await dialog.getByRole("button", { name: "Find players" }).click();
    await page.waitForURL(/\/lasthop#[a-z0-9]{6}$/, { timeout: 30000 });
    return new URL(page.url()).hash.slice(1);
  };
  const C = await player("android", "C (Android)");
  const D = await player("desktop", "D (desktop)");
  const pub = await search(C, "Kim");
  await C.getByText("Waiting for a player…").waitFor({ timeout: 15000 });
  const meta = await admin(`games/${pub}/meta`);
  if (meta.publicLang !== "track" || meta.maxPlayers !== 2) throw new Error(`public room meta ${JSON.stringify(meta)}`);
  if ((await C.getByRole("radiogroup", { name: "Mode" }).count()) !== 0) throw new Error("a public lobby shows the mode switch");
  await shot(C, "match-waiting-android");
  if ((await search(D, "Ola")) !== pub) throw new Error("the second searcher landed in another room");
  await D.getByText(/Starting in|Starting…/).waitFor({ timeout: 15000 });
  await shot(D, "match-countdown-desktop");
  const pubState = () => admin(`games/${pub}/lasthop`);
  const started = await until(async () => { const v = await pubState(); return v?.phase === "playing" ? v : null; }, "the auto-start", 30000);
  if (started.mode !== "track") throw new Error("the public match isn't Track");
  for (const page of [C, D]) await page.getByRole("group", { name: "The track" }).waitFor({ timeout: 10000 });
  log("matchmaking: both in room", pub, "and the match started by itself");
  // The match ends (written straight to the emulator, to skip the rounds); they vote.
  const ended = await pubState();
  delete ended.turnStartedAt;
  await admin(`games/${pub}/lasthop`, "PUT", { ...ended, phase: "matchOver", round: 3, score: { p1: 3, p2: 0 }, history: [0, 1, 2].map(() => ({ winner: "p1", reason: "stuck", aSeat: "p1", moves: 12 })) });
  for (const page of [C, D]) await page.getByText("What next?").waitFor({ timeout: 15000 });
  if ((await C.getByRole("button", { name: "Play again" }).count()) !== 0) throw new Error("a matchmaking player has a Play again button");
  await C.getByRole("button", { name: "Replay Track" }).click();
  await D.getByText("Kim voted: Replay Track.").waitFor();
  await D.getByRole("button", { name: "Change to Grid" }).click();
  await C.getByText("Ola voted: Change to Grid. Pick the same to start.").waitFor();
  await shot(C, "vote-split-android");
  if ((await pubState()).phase !== "matchOver") throw new Error("a split vote started a match");
  await C.getByRole("button", { name: "Change to Grid" }).click();
  const voted = await until(async () => { const v = await pubState(); return v.phase === "playing" ? v : null; }, "the agreed vote's match");
  if (voted.mode !== "grid" || voted.votes) throw new Error(`after the vote: ${JSON.stringify({ mode: voted.mode, votes: voted.votes })}`);
  for (const page of [C, D]) await page.getByRole("group", { name: "The grid" }).waitFor({ timeout: 10000 });
  log("matchmaking: a split vote waits; agreeing on Change to Grid starts a Grid match");

  // Kim leaves mid-match (asked first); Ola is offered another player.
  await C.getByRole("button", { name: "Leave room" }).click();
  await C.getByRole("dialog").getByRole("button", { name: "Leave room" }).click();
  await C.waitForURL((url) => url.pathname === "/", { timeout: 15000 });
  await D.getByText("The other player left.").waitFor({ timeout: 15000 });
  await D.getByRole("button", { name: "Find another player" }).waitFor();
  await shot(D, "match-left-desktop");
  log("matchmaking: leaving mid-match offers the other another player");

  if (errors.length) throw new Error(`console errors:\n${errors.join("\n")}`);
  console.log("PASS");
} catch (e) {
  console.error("FAIL:", e.message);
  if (errors.length) console.error(errors.join("\n"));
  process.exitCode = 1;
} finally {
  await closeBrowsers();
}
