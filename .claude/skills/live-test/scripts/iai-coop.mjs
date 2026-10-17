// Iaï co-op end-to-end, against a dev server on the emulators (see
// dev-against-emulators.mjs): a desktop host and an Android partner join a
// room, ready up, fight on one field (the partner moves and cuts; the host
// must see both), fall, and both see the run's result. About two minutes.
//
//   node .claude/skills/live-test/scripts/iai-coop.mjs [baseUrl] [screenshotDir]
import { closeBrowsers, newProfileContext } from "../../ui-review/scripts/screenshots.mjs";
const BASE = process.argv[2] ?? "http://localhost:3123";
const out = process.argv[3];
const DB = "http://127.0.0.1:9000", NS = "demo-game-room-default-rtdb";
const errors = [];
const log = (...a) => console.log("•", ...a);
const adminRead = async (path) => (await fetch(`${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } })).json();
async function until(fn, what, ms = 30000) {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error(`timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 300)); }
}
async function player(profile, label) {
  const page = await (await newProfileContext(profile)).newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text().slice(0, 300)}`));
  return page;
}
try {
  const A = await player("desktop", "A (host)");
  const B = await player("android", "B (partner)");
  await A.goto(`${BASE}/iai`);
  await A.waitForFunction(() => location.hash.length === 7, null, { timeout: 60000 });
  const room = new URL(A.url()).hash.slice(1);
  await A.getByLabel("Your name").fill("Sam");
  await A.getByRole("button", { name: /Join/ }).click();
  await A.getByText("Waiting for your partner").waitFor({ timeout: 60000 });
  log("A created room", room);
  await B.goto(A.url());
  await B.getByText("Sam waits on the field").waitFor({ timeout: 60000 });
  await B.getByLabel("Your name").fill("Alex");
  await B.getByRole("button", { name: /Join/ }).click();
  await A.getByRole("button", { name: /Ready/ }).waitFor({ timeout: 60000 });
  await B.getByRole("button", { name: /Ready/ }).waitFor({ timeout: 60000 });
  log("both in the lobby");
  await A.getByRole("button", { name: /Ready/ }).click();
  await B.getByText("Sam is ready.").waitFor();
  await B.getByRole("button", { name: /Ready/ }).click();
  await until(async () => (await adminRead(`games/${room}/iai/phase`)) === "RUNNING", "the run to start");
  await until(() => A.evaluate(() => window.Iai.GAME.mode === "play"), "A's run", 20000);
  await until(() => B.evaluate(() => window.Iai.GAME.mode === "play"), "B's run", 20000);
  const roles = await Promise.all([A, B].map((p) => p.evaluate(() => ({ host: window.Iai.COOP.host, players: window.Iai.PLAYERS.length }))));
  log("run started:", JSON.stringify(roles));
  if (!roles[0].host || roles[1].host || roles[0].players !== 2 || roles[1].players !== 2) throw new Error("roles or players wrong");

  // B moves: the host should see B's samurai follow.
  await B.locator("#out").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await B.keyboard.down("KeyD"); await B.waitForTimeout(700); await B.keyboard.up("KeyD");
  await B.waitForTimeout(800);
  const pos = await Promise.all([B.evaluate(() => window.Iai.P.x), A.evaluate(() => window.Iai.R.x)]);
  log(`B's samurai at ${pos[0].toFixed(0)} on B's screen, ${pos[1].toFixed(0)} on the host's`);
  if (Math.abs(pos[0] - pos[1]) > 60) throw new Error("the host doesn't see B where B is");

  // B fights: enemies mirrored from the host, B's cuts applied by the host.
  await until(() => B.evaluate(() => window.Iai.GAME.enemies.length > 0), "enemies on B's screen", 20000);
  const killsBefore = await A.evaluate(() => window.Iai.GAME.kills);
  for (let i = 0; i < 30; i++) {
    await B.evaluate(() => {
      const { GAME, P } = window.Iai;
      const near = GAME.enemies.filter((e) => e.state !== "leave").sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x))[0];
      if (near) P.face = Math.sign(near.x - P.x) || 1;
    });
    await B.keyboard.press("Space");
    await B.waitForTimeout(220);
    if (i === 15 && out) { await A.screenshot({ path: `${out}/coop-host.png` }); await B.screenshot({ path: `${out}/coop-partner.png` }); }
  }
  const after = await Promise.all([A.evaluate(() => ({ kills: window.Iai.GAME.kills, score: window.Iai.GAME.score })), B.evaluate(() => ({ kills: window.Iai.GAME.kills, score: window.Iai.GAME.score }))]);
  log("host:", JSON.stringify(after[0]), "| partner sees:", JSON.stringify(after[1]), "| kills since B started cutting:", after[0].kills - killsBefore);
  if (after[0].kills - killsBefore <= 0) throw new Error("B's cuts don't count");

  // Both nearly dead: the next blows end the run, and the host reports it.
  await A.evaluate(() => { window.Iai.P.hp = 1; window.Iai.R.hp = 1; });
  await until(async () => (await adminRead(`games/${room}/iai/phase`)) === "DONE", "the run to end", 120000);
  const result = await adminRead(`games/${room}/iai/result`);
  log("run over:", JSON.stringify(result));
  await A.getByText("Together you scored").waitFor({ timeout: 20000 });
  await B.getByText("Together you scored").waitFor({ timeout: 20000 });
  if (out) { await A.waitForTimeout(800); await A.screenshot({ path: `${out}/coop-results.png` }); }
  log("both see the results");
  console.log(errors.length ? "\nERRORS:\n  " + errors.join("\n  ") : "\nPASS - no console errors");
  if (errors.length) process.exitCode = 1;
} catch (e) {
  console.error("FAILED:", e.message, errors);
  process.exitCode = 1;
} finally {
  await closeBrowsers();
}
