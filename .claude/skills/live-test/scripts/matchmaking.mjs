// Matchmaking end-to-end ("Matchmaking" button, docs/matchmaking.md), against a dev
// server on the emulators (see dev-against-emulators.mjs). About four minutes.
//
// - Buzzer Quiz: a desktop player searches from the hub and gets a new public
//   room; an iPhone player's search lands in the same room; an Android player
//   searching in French gets a room of their own. The EN room counts down and
//   starts by itself with the two players, and leaves the queue.
// - Word Scramble: two players who each end up alone in a room of their own
//   (the first room is hidden from the queue for a moment, as when two people
//   search at the same instant) are brought together by the lone-player
//   merge, then the game starts by itself, 1v1, with even teams.
// - Back = Leave room: a player who joined a French room presses Back; their
//   seat goes at once and the countdown stops. Then the French player leaves with
//   "Leave room"; the seat and the queue entry go.
// - Night Highway: no language choice (one `any` queue); the second driver
//   lands in the first's room and the first race starts by itself. After it, the
//   second driver presses Back on the results: their seat goes, and the first
//   sees they left.
//
//   node .claude/skills/live-test/scripts/matchmaking.mjs [baseUrl] [screenshotDir]
import { closeBrowsers, newProfileContext } from "../../ui-review/scripts/screenshots.mjs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const out = process.argv[3];
const DB = "http://127.0.0.1:9000", NS = "demo-game-room-default-rtdb";
const errors = [];
const log = (...a) => console.log("•", ...a);
const adminRead = async (path) => (await fetch(`${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } })).json();
const adminDelete = (path) => fetch(`${DB}/${path}.json?ns=${NS}`, { method: "DELETE", headers: { Authorization: "Bearer owner" } });
async function until(fn, what, ms = 30000) {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error(`timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 200)); }
}
async function player(profile, label) {
  const page = await (await newProfileContext(profile)).newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text().slice(0, 300)}`));
  return page;
}
const shot = async (page, name) => { if (out) await page.screenshot({ path: `${out}/${name}.png`, fullPage: true }); };
const roomOf = (page) => new URL(page.url()).hash.slice(1);

/** From the hub: open a card's "Matchmaking", fill the name and language (`lang: null` for a game without words), and search. Resolves once in a room. */
async function playOnline(page, { title, slug, name, lang = "English", shotName }) {
  // A dev-server recompile can reload the hub under the test (wiping the panel), so open, fill and check it settled, up to 3 times.
  for (let attempt = 1; ; attempt++) {
    await page.goto(BASE);
    await page.getByRole("button", { name: `Matchmaking for ${title}: play with other players` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Your name").fill(name);
    if (lang) await dialog.getByRole("radio", { name: lang }).click();
    else if (await dialog.getByRole("radiogroup").count()) throw new Error(`${title}'s panel shows a language switch`);
    await page.waitForTimeout(500);
    const find = dialog.getByRole("button", { name: "Find players" });
    if ((await find.isEnabled().catch(() => false)) && (await dialog.getByLabel("Your name").inputValue().catch(() => "")) === name) {
      if (shotName) await shot(page, shotName);
      await find.click();
      break;
    }
    if (attempt === 3) throw new Error(`${title}: the panel kept losing the name`);
    log(`${title}: the panel was reset (a reload?), retrying`);
  }
  await page.waitForURL(new RegExp(`/${slug}#[a-z0-9]{6}$`), { timeout: 30000 });
  return roomOf(page);
}

try {
  // ---- Buzzer Quiz: search, join, separate language queue, auto-start ----------------------
  const A = await player("desktop", "A (desktop)");
  const B = await player("iphone", "B (iPhone)");
  const C = await player("android", "C (Android, FR)");

  const roomA = await playOnline(A, { title: "Buzzer Quiz", slug: "buzzerquiz", name: "Sam", shotName: "panel-desktop" });
  await A.getByText("Waiting for more players…").waitFor({ timeout: 15000 });
  const metaA = await adminRead(`games/${roomA}/meta`);
  if (metaA.publicLang !== "en") throw new Error(`room ${roomA} isn't public EN: ${JSON.stringify(metaA)}`);
  await until(async () => (await adminRead(`queue/buzzerquiz/en/${roomA}`))?.players === 1, "A's room listed with 1 player");
  await shot(A, "waiting-desktop");
  log("A waits alone in new public room", roomA);

  const roomB = await playOnline(B, { title: "Buzzer Quiz", slug: "buzzerquiz", name: "Léa", shotName: "panel-iphone" });
  if (roomB !== roomA) throw new Error(`B landed in ${roomB}, not A's room ${roomA}`);
  for (const page of [A, B]) await page.getByText(/^Starting in \d+ s$/).waitFor({ timeout: 15000 });
  await shot(B, "starting-iphone");
  log("B was matched into", roomB, "- the countdown is on");

  const roomC = await playOnline(C, { title: "Buzzer Quiz", slug: "buzzerquiz", name: "Max", lang: "Français" });
  if (roomC === roomA) throw new Error("the French player was matched into the English room");
  log("C (French) got a room of their own:", roomC);

  const started = await until(async () => { const s = await adminRead(`games/${roomA}/buzzerquiz`); return s && s.phase !== "lobby" ? s : null; }, "the auto-start", 40000);
  if (JSON.stringify(started.players) !== JSON.stringify(["p1", "p2"])) throw new Error(`started with ${JSON.stringify(started.players)}`);
  for (const page of [A, B]) await page.getByText("Thumb on the buzzer…").waitFor({ timeout: 10000 });
  await until(async () => (await adminRead(`queue/buzzerquiz/en/${roomA}`)) == null, "the room to leave the queue");
  await until(async () => (await adminRead(`games/${roomA}/autoStart`)) == null, "autoStart to be cleared");
  log("the EN room started by itself with p1 + p2 and left the queue");

  // ---- Back = Leave room -----------------------------------------------------------------------
  // Presence would only mark H offline; Back must give up the seat at once and stop the countdown.
  const H = await player("desktop", "H (desktop, FR)");
  const roomH = await playOnline(H, { title: "Buzzer Quiz", slug: "buzzerquiz", name: "Hugo", lang: "Français" });
  if (roomH !== roomC) throw new Error(`H landed in ${roomH}, not C's room ${roomC}`);
  await C.getByText(/^Starting in \d+ s$/).waitFor({ timeout: 15000 });
  await H.goBack();
  await H.waitForURL(`${BASE}/`, { timeout: 15000 });
  await H.getByRole("button", { name: "Matchmaking for Buzzer Quiz: play with other players" }).waitFor({ timeout: 15000 });
  await until(async () => Object.keys((await adminRead(`games/${roomC}/seats`)) ?? {}).length === 1, "H's seat to be given up");
  await until(async () => (await adminRead(`games/${roomC}/autoStart`)) == null, "C's countdown to stop");
  await C.getByText("Waiting for more players…").waitFor({ timeout: 15000 });
  await until(async () => (await adminRead(`queue/buzzerquiz/fr/${roomC}`))?.players === 1, "C's room listed with 1 player again");
  log("H pressed Back: back on the hub, seat given up, C waits alone again");

  // ---- Leave room ------------------------------------------------------------------------------
  await C.getByRole("button", { name: "Leave room" }).click();
  await C.waitForURL(`${BASE}/`, { timeout: 15000 });
  const seatsC = await adminRead(`games/${roomC}/seats`);
  if (seatsC) throw new Error(`C still holds a seat: ${JSON.stringify(seatsC)}`);
  await until(async () => (await adminRead(`queue/buzzerquiz/fr/${roomC}`)) == null, "C's room to leave the queue");
  log("C left: seat and queue entry gone");

  // ---- Word Scramble: simultaneous searches merge, then a 1v1 auto-start -------------------------
  const D = await player("desktop", "D (desktop)");
  const E = await player("iphone-se", "E (iPhone SE)");
  const roomD = await playOnline(D, { title: "Word Scramble", slug: "wordscramble", name: "Dee" });
  await until(async () => (await adminRead(`queue/wordscramble/en/${roomD}`))?.players === 1, "D's room listed");
  await adminDelete(`queue/wordscramble/en/${roomD}`);
  const roomE = await playOnline(E, { title: "Word Scramble", slug: "wordscramble", name: "Eli" });
  if (roomE === roomD) throw new Error("E found D's room although it was hidden from the queue");
  log("D and E each wait alone:", roomD, roomE);
  const together = await until(() => (roomOf(D) === roomOf(E) ? roomOf(D) : null), "D and E to end up in one room", 45000);
  if (together !== [roomD, roomE].sort()[0]) throw new Error(`merged into ${together}, expected the lower code`);
  const left = together === roomD ? roomE : roomD;
  await until(async () => (await adminRead(`games/${left}/seats`)) == null && (await adminRead(`queue/wordscramble/en/${left}`)) == null, "the abandoned room to be emptied and unlisted");
  log("the lone players merged into", together);
  for (const page of [D, E]) await page.getByText(/^Starting in \d+ s$/).waitFor({ timeout: 15000 });
  await shot(E, "ws-starting-iphone-se");
  const ws = await until(async () => { const s = await adminRead(`games/${together}/wordscramble`); return s && s.phase !== "lobby" ? s : null; }, "Word Scramble's auto-start", 40000);
  const teams = Object.values(ws.teams ?? {});
  if (teams.length !== 2 || teams[0] === teams[1]) throw new Error(`uneven teams: ${JSON.stringify(ws.teams)}`);
  log("Word Scramble started by itself, 1v1:", JSON.stringify(ws.teams));

  // ---- Night Highway: one queue, 1v1, the first race starts by itself ---------------------------
  const F = await player("desktop", "F (desktop)");
  const G = await player("iphone", "G (iPhone)");
  const roomF = await playOnline(F, { title: "Night Highway", slug: "nighthighway", name: "Fox", lang: null });
  if ((await adminRead(`games/${roomF}/meta`)).publicLang !== "any") throw new Error(`room ${roomF} isn't in the 'any' queue`);
  await F.getByText("Waiting for a driver…").waitFor({ timeout: 30000 });
  await until(async () => (await adminRead(`queue/nighthighway/any/${roomF}`))?.players === 1, "F's room listed");
  await shot(F, "nh-waiting-desktop");
  const roomG = await playOnline(G, { title: "Night Highway", slug: "nighthighway", name: "Gil", lang: null });
  if (roomG !== roomF) throw new Error(`G landed in ${roomG}, not F's room ${roomF}`);
  for (const page of [F, G]) await page.getByText(/^Starting in \d+ s$/).waitFor({ timeout: 30000 });
  await shot(G, "nh-starting-iphone");
  const nh = await until(async () => { const s = await adminRead(`games/${roomF}/nighthighway`); return s?.phase === "RACING" ? s : null; }, "Night Highway's auto-start", 40000);
  if (nh.race !== 1) throw new Error(`started race ${nh.race}`);
  await until(async () => (await adminRead(`queue/nighthighway/any/${roomF}`)) == null && (await adminRead(`games/${roomF}/autoStart`)) == null, "the race room to leave the queue");
  log("Night Highway: matched", roomF, "and the race started by itself");

  // Back on the results screen leaves too (not mid-race).
  await until(async () => (await adminRead(`games/${roomF}/nighthighway`))?.phase === "DONE", "the race to finish", 120000);
  await G.getByRole("button", { name: "Leave room" }).waitFor({ timeout: 15000 });
  await G.goBack();
  await G.waitForURL(`${BASE}/`, { timeout: 15000 });
  await until(async () => Object.keys((await adminRead(`games/${roomF}/seats`)) ?? {}).length === 1, "G's seat to be given up");
  await F.getByText("The other driver left the room.").waitFor({ timeout: 15000 });
  await shot(F, "nh-other-left-desktop");
  log("G pressed Back on the results: seat given up, F sees they left");

  if (errors.length) throw new Error(`console errors:\n${errors.join("\n")}`);
  console.log("PASS matchmaking");
} catch (error) {
  console.error("FAIL", error.message);
  if (errors.length) console.error(errors.join("\n"));
  process.exitCode = 1;
} finally {
  await closeBrowsers();
}
