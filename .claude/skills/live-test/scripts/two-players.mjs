// Two-player end-to-end check against a dev server running on the emulators
// (see dev-against-emulators.mjs). Each Playwright browser context is a
// separate guest ID, like two people's devices - and the players are real
// device profiles (shared with the ui-review skill): an iPhone in WebKit
// (Safari's engine) plays against a desktop browser, the way the games are
// actually played.
//
//   node .claude/skills/live-test/scripts/two-players.mjs [baseUrl]
//
// Checks, in order:
// - Same Page (slug ftw): create, name the room, join it by name through the
//   hub card's Join panel, play a full round (the guesser watching the
//   ranker's notes appear face down, the ranker watching the guess count) and
//   start round 2. The old /ftw route still opens the room.
// - Presence: closing one player shows "can play later" on the other.
// - A third guest can read the room but not take a seat.
// - "Your rooms" and the Continue chip list the room, also after a reload;
//   the back gesture closes the sheet.
// - Leave room (no back link in a room): it asks first while both are
//   seated, gives up the seat and drops the room from "Your rooms"; Start
//   then opens a fresh room.
// - Co-Counsel: the creator picks a case and Defendant, the joiner is
//   auto-assigned, then "Switch role instead" swaps both seats; Part 1 is
//   solved and "Continue to Part 2" advances. The owner switches case from
//   the picker mid-game (both devices follow); three misses adjourn it, the
//   joiner waits while the owner picks the next case from "Start a new case".
//   The joiner never gets a back link; they leave with the Footer's Leave room.
// Exits non-zero on the first failure; prints any browser console errors.
import { closeBrowsers, newProfileContext } from "../../ui-review/scripts/screenshots.mjs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const DB = "http://127.0.0.1:9000";
const NS = "demo-game-room-default-rtdb";
const errors = [];
const log = (...a) => console.log("•", ...a);

/** Reads the emulator's data directly, bypassing the rules ("owner" token). */
async function adminRead(path) {
  const res = await fetch(`${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } });
  return res.json();
}
async function until(fn, what, ms = 15000) {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > ms) throw new Error(`Timed out waiting for: ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
/** A player on a device profile (see ui-review's PROFILES): "iphone", "android", "desktop", ... */
async function newPlayer(profile, label) {
  const ctx = await newProfileContext(profile);
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`[${label}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${label}] ${e.message}`));
  return { ctx, page };
}
const hashOf = (page) => new URL(page.url()).hash.slice(1);

/**
 * Joins a room from the hub: opens the Same Page card's Join panel
 * (popover on desktop, sheet on phones), picks Code or Name, types, submits.
 * Joining a room of another game through this card is fine - routing follows
 * the room's own game, so this also covers that spec rule.
 */
async function joinFromHub(page, mode, value) {
  await page.getByRole("button", { name: "Join a Same Page room" }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: mode }).click();
  await dialog.getByLabel(mode === "code" ? "Room code" : "Room name").fill(value);
  await dialog.getByRole("button", { name: "Join", exact: true }).click({ timeout: 10000 });
}

/** Places notes on this player's items from `from` (0-based) up to (not including) `to`: tap a hand note, then an item. */
async function placeNotes(page, from, to) {
  const items = page.getByRole("list", { name: "Items" }).getByRole("button");
  for (let i = from; i < to; i++) {
    await page.getByRole("group", { name: "Your notes" }).getByRole("button").first().click();
    await items.nth(i).click();
  }
}

/**
 * Live placement progress: places 2 notes and checks the watcher sees "2 of 5
 * placed" (before anything is locked in) - and, while the ranker ranks,
 * exactly 2 face-down notes on the guesser's sheet - then places the rest and
 * locks in.
 */
async function placeWhileWatched(placer, watcher, placerName, submitLabel) {
  await placeNotes(placer, 0, 2);
  await watcher.getByText("2 of 5 placed").waitFor();
  if (submitLabel === "Lock my ranking") {
    const faceDown = await watcher.getByRole("listitem", { name: new RegExp(`, ${placerName} placed a note$`) }).count();
    if (faceDown !== 2) throw new Error(`watcher saw ${faceDown} face-down notes, expected 2`);
  }
  await placeNotes(placer, 2, 5);
  await watcher.getByText("5 of 5 placed").waitFor();
  await placer.getByRole("button", { name: submitLabel }).click();
}

try {
  const A = await newPlayer("iphone", "A (iPhone)");
  const B = await newPlayer("desktop", "B (desktop)");

  // --- Same Page ---
  await A.page.goto(`${BASE}/same-page`);
  await until(() => hashOf(A.page).length === 6, "room code in the URL");
  const code = hashOf(A.page);
  log("A created a Same Page room", code);
  await A.page.getByLabel("Your name").fill("Sam");
  await A.page.getByRole("button", { name: "Continue" }).click();
  await A.page.getByText("Copy invite link").waitFor();
  const roomName = `Crew ${code}`;
  const nameField = A.page.getByPlaceholder(code);
  await nameField.fill(roomName);
  await nameField.blur();
  await until(async () => (await adminRead(`roomsByName/crew-${code}`)) === code, "room name saved");
  log(`A named the room "${roomName}"`);

  await B.page.goto(BASE);
  await joinFromHub(B.page, "name", roomName.toLowerCase());
  await B.page.waitForURL(`**/same-page#${code}`);
  await B.page.getByLabel("Your name").fill("Alex");
  await B.page.getByRole("button", { name: "Continue" }).click();
  log("B joined by name");

  await A.page.getByRole("button", { name: "Place 5 more notes" }).waitFor();
  await placeWhileWatched(A.page, B.page, "Sam", "Lock my ranking");
  log("live progress: B watched A's notes appear face down");
  await B.page.getByText("Sam locked in their order").waitFor();
  await placeWhileWatched(B.page, A.page, "Alex", "Lock my guess");
  log("live progress: A watched B's guess count go up");
  await A.page.getByRole("button", { name: "Next round · you guess" }).waitFor();
  await B.page.getByRole("button", { name: "Next round · you rank" }).waitFor();
  log("full round played and revealed on both sides");

  // Click through, and check the database - a refused write leaves the
  // button on screen with nothing happening.
  await A.page.getByRole("button", { name: "Next round · you guess" }).click();
  await until(async () => (await adminRead(`games/${code}/ftw/round`)) === 2, "round 2 written to the database");
  await B.page.getByRole("button", { name: "Place 5 more notes" }).waitFor(); // roles swapped: B ranks now
  await A.page.getByText("Alex is ranking.", { exact: false }).waitFor();
  log("Next round: round 2 started, roles swapped");

  const closedAt = Date.now();
  await B.ctx.close();
  await A.page.getByText("Alex can play later.").waitFor({ timeout: 30000 });
  log(`B shown away ${((Date.now() - closedAt) / 1000).toFixed(1)}s after closing`);

  const C = await newPlayer("android", "C (Android)");
  await C.page.goto(`${BASE}/ftw#${code}`); // the old route still opens the room
  await C.page.getByText("Both seats are taken").waitFor();
  const disabled = await C.page.getByRole("button", { name: /is playing/ }).evaluateAll((els) => els.every((e) => e.disabled));
  if (!disabled) throw new Error("third guest could pick a held seat");
  log("third guest can read the room; both seats disabled");

  // "Your rooms" (a sheet behind the floating pill on A's phone) and the
  // Continue chip both list the room - also after a reload.
  for (const pass of ["first visit", "after a reload"]) {
    if (pass === "first visit") await A.page.goto(BASE);
    else await A.page.reload();
    await A.page.getByRole("link", { name: new RegExp(`Continue.*${roomName}`) }).waitFor();
    await A.page.getByRole("button", { name: /^Your rooms, \d+ saved$/ }).filter({ visible: true }).click();
    await A.page.getByRole("dialog").getByRole("link", { name: new RegExp(roomName) }).waitFor();
    // The back gesture closes the sheet without leaving the hub.
    await A.page.goBack();
    await A.page.getByRole("dialog").waitFor({ state: "detached" });
    if (new URL(A.page.url()).pathname !== "/") throw new Error(`back left the hub (${pass})`);
  }
  log('"Your rooms" and Continue list the room, also after a reload; Back closes the sheet');

  // Leave room: asks first (B still holds a seat), frees A's seat, unlists the room for A.
  const uidA = (await adminRead(`games/${code}/seats`)).p1;
  await A.page.goto(`${BASE}/same-page#${code}`);
  let asked = "";
  A.page.once("dialog", (dialog) => {
    asked = dialog.message();
    void dialog.accept();
  });
  await A.page.getByRole("button", { name: "Leave room" }).click();
  await A.page.waitForURL(`${BASE}/`);
  if (!asked.startsWith("Leave this room?")) throw new Error(`Leave room didn't ask first (${JSON.stringify(asked)})`);
  await until(async () => {
    const seats = await adminRead(`games/${code}/seats`);
    return seats && !seats.p1 && seats.p2;
  }, "A's seat given up, B's kept");
  if (await adminRead(`users/${uidA}/rooms/${code}`)) throw new Error("the room is still in A's Your rooms");
  log("Leave room asked first, gave up A's seat and dropped the room from A's Your rooms");

  // Start: "Starting…", then the game's page creates a fresh room.
  await A.page.getByRole("button", { name: "Start a Same Page room" }).filter({ visible: true }).click();
  await A.page.waitForURL(/\/same-page#[a-z0-9]{6}$/);
  log("Start on the hub opens a fresh Same Page room");

  // --- Co-Counsel ---
  const D = await newPlayer("desktop", "D (desktop)");
  const E = await newPlayer("iphone-se", "E (iPhone SE)");
  await D.page.goto(`${BASE}/cocounsel`);
  await D.page.getByRole("button", { name: "Choose The Case of the Missed Arrival" }).click();
  await D.page.getByRole("button", { name: "I'm the Defendant" }).click();
  await D.page.getByText("Copy invite link").waitFor();
  const cc = hashOf(D.page);
  await E.page.goto(BASE);
  await joinFromHub(E.page, "code", cc);
  await E.page.waitForURL(`**/cocounsel#${cc}`);
  const before = await until(async () => {
    const s = await adminRead(`games/${cc}/seats`);
    return s?.p1 && s?.p2 ? s : null;
  }, "both Co-Counsel seats held (auto-assign)");
  log("Co-Counsel: joiner auto-assigned the remaining role");
  await D.page.reload();
  await D.page.getByRole("button", { name: "Switch role instead" }).click();
  await until(async () => {
    const s = await adminRead(`games/${cc}/seats`);
    return s?.p1 === before.p2 && s?.p2 === before.p1;
  }, "seats swapped");
  log("Co-Counsel: Switch role instead swapped both seats");

  // Solve Part 1 (its correct pair is card 1 in each hand), then continue.
  for (const player of [D, E]) {
    await player.page.getByRole("radiogroup", { name: "Your cards" }).getByRole("radio").first().click();
    await player.page.getByRole("button", { name: "Lock in card 1" }).click();
  }
  await D.page.getByRole("button", { name: "Continue to Part 2" }).click();
  await until(async () => (await adminRead(`games/${cc}/cocounsel/partIndex`)) === 1, "Part 2 written to the database");
  await E.page.getByRole("radiogroup", { name: "Your cards" }).waitFor();
  log("Co-Counsel: Part 1 solved, Continue to Part 2 works");

  // The owner's back link opens the case picker, with the current case
  // marked in progress; choosing another case restarts it for both.
  await D.page.getByRole("button", { name: "Back to case selection" }).click();
  await D.page.getByRole("button", { name: "Resume The Case of the Missed Arrival" }).waitFor();
  await D.page.getByRole("button", { name: "Choose The Case of the Empty Frame" }).click();
  await until(async () => (await adminRead(`games/${cc}/cocounsel/caseId`)) === "empty-frame", "case switched in the database");
  await E.page.getByText("The Empty Frame").first().waitFor();
  log("Co-Counsel: the owner switched case mid-game and the joiner followed");

  // Three misses (card 2 is never Part 1's correct card) adjourn the case.
  for (let miss = 1; miss <= 3; miss++) {
    for (const player of [D, E]) {
      await player.page.getByRole("radiogroup", { name: "Your cards" }).getByRole("radio").nth(1).click();
      await player.page.getByRole("button", { name: "Lock in card 2" }).click();
    }
    await D.page.getByRole("button", { name: miss < 3 ? "Pick again" : "See what happened" }).click();
  }
  await E.page.getByText("Waiting for your partner to pick the next case…").waitFor();
  if (await E.page.getByRole("button", { name: "Start a new case" }).count()) throw new Error("the joiner was offered Start a new case");
  await D.page.getByRole("button", { name: "Start a new case" }).click();
  await D.page.getByText("Just played").waitFor();
  await D.page.getByRole("button", { name: "Choose The Case of the Unlocked Session" }).click();
  await until(async () => (await adminRead(`games/${cc}/cocounsel/caseId`)) === "unlocked-session", "next case in the database");
  await E.page.getByRole("radiogroup", { name: "Your cards" }).waitFor();
  await E.page.getByText("The Flag").first().waitFor();
  log("Co-Counsel: adjourned; the joiner waited while the owner picked the next case");

  // The joiner has no back link; Leave room (asks first) gives up their seat.
  if (await E.page.getByRole("button", { name: "Back to case selection" }).count()) throw new Error("the joiner got a back link");
  E.page.once("dialog", (dialog) => void dialog.accept());
  await E.page.getByRole("button", { name: "Leave room" }).click();
  await E.page.waitForURL(`${BASE}/`);
  await until(async () => Object.keys((await adminRead(`games/${cc}/seats`)) ?? {}).length === 1, "the joiner's seat given up");
  log("Co-Counsel: the joiner has no back link and left with Leave room");

  console.log(errors.length ? `\nCONSOLE ERRORS:\n  ${errors.join("\n  ")}` : "\nPASS - no console errors");
  process.exitCode = errors.length ? 1 : 0;
} catch (error) {
  console.error(`\nFAILED: ${error.message}`);
  if (errors.length) console.error(`console errors so far:\n  ${errors.join("\n  ")}`);
  process.exitCode = 1;
} finally {
  await closeBrowsers();
}
