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
// - FTW: create, name the room, join it by name through the hub card's Join
//   panel, play a full round.
// - Presence: closing one player shows them offline on the other.
// - A third guest can read the room but not take a seat.
// - "Your rooms" and the Continue chip list the room, also after a reload;
//   the back gesture closes the sheet; Start opens a fresh room.
// - Co-Counsel: the creator picks Defendant, the joiner is auto-assigned,
//   then "Switch role instead" swaps both seats.
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
 * Joins a room from the hub: opens the First to Worst card's Join panel
 * (popover on desktop, sheet on phones), picks Code or Name, types, submits.
 * Joining a room of another game through this card is fine - routing follows
 * the room's own game (and Co-Counsel has no card while it's hidden).
 */
async function joinFromHub(page, mode, value) {
  await page.getByRole("button", { name: "Join a First to Worst room" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: mode }).click();
  await dialog.getByLabel(mode === "code" ? "Room code" : "Room name").fill(value);
  await dialog.getByRole("button", { name: "Join", exact: true }).click({ timeout: 10000 });
}

async function placeAllCards(page, submitLabel) {
  for (let i = 0; i < 5; i++) {
    await page.locator('button[aria-label^="Number"]').first().click();
    await page.locator("[data-drop-id] button").nth(i).click();
  }
  await page.getByRole("button", { name: submitLabel }).click();
}

try {
  const A = await newPlayer("iphone", "A (iPhone)");
  const B = await newPlayer("desktop", "B (desktop)");

  // --- First to Worst ---
  await A.page.goto(`${BASE}/ftw`);
  await until(() => hashOf(A.page).length === 6, "room code in the URL");
  const code = hashOf(A.page);
  log("A created FTW room", code);
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
  await B.page.waitForURL(`**/ftw#${code}`);
  await B.page.getByLabel("Your name").fill("Alex");
  await B.page.getByRole("button", { name: "Continue" }).click();
  log("B joined by name");

  await A.page.getByRole("button", { name: "Lock in my ranking" }).waitFor();
  await placeAllCards(A.page, "Lock in my ranking");
  await B.page.getByRole("button", { name: "Submit final guess" }).waitFor();
  await placeAllCards(B.page, "Submit final guess");
  await A.page.getByRole("button", { name: "Next round (roles swap)" }).waitFor();
  await B.page.getByRole("button", { name: "Next round (roles swap)" }).waitFor();
  log("full round played and revealed on both sides");

  await until(async () => (await A.page.locator('[aria-label="online"]').count()) === 2, "both shown online");
  const closedAt = Date.now();
  await B.ctx.close();
  await until(async () => (await A.page.locator('[aria-label="offline"]').count()) === 1, "B shown offline on A");
  log(`B shown offline ${((Date.now() - closedAt) / 1000).toFixed(1)}s after closing`);

  const C = await newPlayer("android", "C (Android)");
  await C.page.goto(`${BASE}/ftw#${code}`);
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

  // Start: "Starting…", then the game's page creates a fresh room.
  await A.page.getByRole("button", { name: "Start a First to Worst room" }).click();
  await A.page.waitForURL(/\/ftw#[a-z0-9]{6}$/);
  log("Start on the hub opens a fresh First to Worst room");

  // --- Co-Counsel ---
  const D = await newPlayer("desktop", "D (desktop)");
  const E = await newPlayer("iphone-se", "E (iPhone SE)");
  await D.page.goto(`${BASE}/cocounsel`);
  await D.page.getByRole("button", { name: /Choose this case/ }).click();
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

  console.log(errors.length ? `\nCONSOLE ERRORS:\n  ${errors.join("\n  ")}` : "\nPASS - no console errors");
  process.exitCode = errors.length ? 1 : 0;
} catch (error) {
  console.error(`\nFAILED: ${error.message}`);
  if (errors.length) console.error(`console errors so far:\n  ${errors.join("\n  ")}`);
  process.exitCode = 1;
} finally {
  await closeBrowsers();
}
