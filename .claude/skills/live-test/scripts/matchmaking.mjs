// Matchmaking end-to-end ("Matchmaking" button, docs/matchmaking.md), against a dev
// server on the emulators (see dev-against-emulators.mjs). About two minutes.
//
// - Buzzer Quiz: a desktop player searches from the hub and gets a new public
//   room; an iPhone player's search lands in the same room; an Android player
//   searching in French gets a room of their own. The EN room counts down and
//   starts by itself with the two players, and leaves the queue.
// - Word Scramble: two players who each end up alone in a room of their own
//   (the first room is hidden from the queue for a moment, as when two people
//   search at the same instant) are brought together by the lone-player
//   merge, then the game starts by itself, 1v1, with even teams.
// - Leave room: a waiting player leaves; the seat and the queue entry go.
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

/** From the hub: open a card's "Matchmaking", fill the name and language, and search. Resolves once in a room. */
async function playOnline(page, { title, slug, name, lang = "English", shotName }) {
  await page.goto(BASE);
  await page.getByRole("button", { name: `Matchmaking for ${title}: play with other players` }).click();
  const dialog = page.getByRole("dialog");
  // Re-type if a dev-server reload (first compile) wiped the field.
  const input = dialog.getByLabel("Your name");
  await until(async () => (await input.inputValue()) === name || (await input.fill(name), false), "the name to stick", 15000);
  await dialog.getByRole("radio", { name: lang }).click();
  if (shotName) await shot(page, shotName);
  await dialog.getByRole("button", { name: "Find players" }).click();
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

  if (errors.length) throw new Error(`console errors:\n${errors.join("\n")}`);
  console.log("PASS matchmaking");
} catch (error) {
  console.error("FAIL", error.message);
  if (errors.length) console.error(errors.join("\n"));
  process.exitCode = 1;
} finally {
  await closeBrowsers();
}
