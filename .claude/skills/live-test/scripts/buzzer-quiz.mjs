// Buzzer Quiz end-to-end, against a dev server on the emulators (see
// dev-against-emulators.mjs): a desktop host sets up a 5-question quiz, an
// iPhone and an Android player join, and the three play it through - a buzz
// race decided by reaction time, a wrong answer struck out for everyone and
// its player locked out, a right answer scored 2 - then the final ranking and
// a rematch. About a minute.
//
//   node .claude/skills/live-test/scripts/buzzer-quiz.mjs [baseUrl] [screenshotDir]
import { readFileSync } from "node:fs";
import { closeBrowsers, newProfileContext } from "../../ui-review/scripts/screenshots.mjs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const out = process.argv[3];
const DB = "http://127.0.0.1:9000", NS = "demo-game-room-default-rtdb";
const BANK = JSON.parse(readFileSync(new URL("../../../../lib/games/buzzerquiz/questions.json", import.meta.url), "utf8"));
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

try {
  const A = await player("desktop", "A (host, desktop)");
  const B = await player("iphone", "B (iPhone)");
  const C = await player("android", "C (Android)");
  await A.goto(`${BASE}/buzzerquiz`);
  await A.waitForFunction(() => location.hash.length === 7, null, { timeout: 60000 });
  const room = new URL(A.url()).hash.slice(1);
  const state = () => adminRead(`games/${room}/buzzerquiz`);
  await A.getByLabel("What's your name?").fill("Sam");
  await A.getByRole("button", { name: "Continue" }).click();
  await A.getByRole("heading", { name: "New quiz" }).waitFor({ timeout: 30000 });
  log("A created room", room, "and sees the setup");

  // Setup: French, Science + Music, 5 questions.
  await A.getByRole("radio", { name: "Français" }).click();
  await A.getByRole("button", { name: "Science" }).click();
  await A.getByRole("button", { name: "Music" }).click();
  await A.getByRole("radio", { name: "5", exact: true }).click();
  await until(async () => (await state())?.settings?.topics?.length === 2 && (await state()).settings.length === 5, "the settings");
  await shot(A, "setup-desktop");
  await A.getByRole("button", { name: "Continue to the waiting room" }).click();
  await A.getByRole("heading", { name: "Waiting room" }).waitFor();

  for (const [page, name] of [[B, "Léa"], [C, "Max"]]) {
    await page.goto(A.url());
    await page.getByLabel("What's your name?").fill(name);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Waiting for Sam to start").waitFor({ timeout: 30000 });
  }
  await A.getByRole("button", { name: "Start with 3 players" }).waitFor();
  await shot(A, "lobby-desktop");
  await shot(B, "lobby-iphone");
  log("B and C joined the waiting room");
  await A.getByRole("button", { name: "Start with 3 players" }).click();
  await B.getByText("Thumb on the buzzer…").waitFor({ timeout: 10000 });
  await shot(B, "countdown-iphone");

  // Question 1 appears on every device.
  const s1 = await until(async () => { const s = await state(); return s?.phase === "question" || s?.phase === "countdown" ? s : null; }, "question 1");
  const q1 = BANK.find((q) => q.id === s1.questionIds[0]);
  if (q1.lang !== "fr" || !["science", "music"].includes(q1.topic)) throw new Error(`unexpected question ${q1.id}`);
  for (const page of [A, B, C]) await page.getByRole("heading", { name: q1.question }).waitFor({ timeout: 10000 });
  log("question 1 on all three:", q1.question);
  await shot(C, "question-android");

  // B and C buzz together: the lower reaction time wins, whoever's buzz arrived first.
  // Both press at once (a raw pointerdown: a click would wait while the button is disabled).
  await Promise.all([B, C].map((p) => p.getByRole("button", { name: "Buzz" }).dispatchEvent("pointerdown", { button: 0 })));
  const answering = await until(async () => { const s = await state(); return s?.phase === "answering" ? s : null; }, "someone to answer");
  const buzzes = answering.buzzes ?? [];
  if (buzzes.length !== 2) throw new Error(`expected both buzzes in the window, got ${JSON.stringify(buzzes)}`);
  const fastest = [...buzzes].sort((x, y) => x.ms - y.ms || x.seat.localeCompare(y.seat))[0]; // a tie goes to the lower seat
  if (answering.buzzer !== fastest.seat) throw new Error(`buzzer ${answering.buzzer} isn't the fastest ${JSON.stringify(buzzes)}`);
  log("buzzes:", JSON.stringify(buzzes), "→", answering.buzzer, "answers");
  const [winner, other] = answering.buzzer === "p2" ? [B, C] : [C, B];
  await winner.getByText("Your turn! Pick an answer").waitFor();
  await other.getByText(/buzzed!/).waitFor();
  await shot(B, answering.buzzer === "p2" ? "answering-iphone" : "watching-answer-iphone");

  // A wrong pick: struck out everywhere, the picker locked out.
  await winner.getByRole("button", { name: q1.choices[3] }).click();
  await until(async () => (await state())?.struck?.length === 1, "the strike");
  for (const page of [A, B, C]) await page.getByLabel(`${q1.choices[3]}, struck out`).waitFor();
  await winner.getByText("Wrong. You're out for this one.").waitFor();
  await A.getByText(/was wrong\. Buzz again!/).waitFor();
  await shot(A, "wrong-desktop");
  log("wrong answer struck on all three, picker locked out");

  // A buzzes and answers right with 3 choices left: 2 points.
  await A.getByRole("button", { name: "Buzz" }).click();
  await A.getByText("Your turn! Pick an answer").waitFor();
  await A.keyboard.press(String.fromCharCode(65 + (await A.evaluate((text) => [...document.querySelectorAll("main li")].findIndex((li) => li.textContent.includes(text)), q1.choices[0]))));
  await until(async () => (await state())?.outcome?.kind === "right", "the right answer");
  const after1 = await state();
  if (after1.scores.p1 !== 2) throw new Error(`expected 2 points, got ${JSON.stringify(after1.scores)}`);
  for (const page of [B, C]) await page.getByText("Sam got it!").waitFor();
  await shot(B, "right-iphone");
  log("A answered right with the keyboard: +2");

  // Questions 2-5: A buzzes first and answers right.
  for (let i = 1; i < 5; i++) {
    const s = await until(async () => { const v = await state(); return v?.index === i && v.phase === "question" ? v : null; }, `question ${i + 1}`, 20000);
    const q = BANK.find((x) => x.id === s.questionIds[i]);
    await A.getByRole("heading", { name: q.question }).waitFor();
    await A.getByRole("button", { name: "Buzz" }).click();
    await A.getByText("Your turn! Pick an answer").waitFor();
    await A.getByRole("button", { name: q.choices[0] }).click();
    await until(async () => (await state())?.outcome?.kind === "right", `question ${i + 1}'s answer`);
  }
  await until(async () => (await state())?.phase === "final", "the final ranking", 20000);
  for (const page of [A, B, C]) await page.getByRole("heading", { name: "Sam wins!" }).waitFor();
  await shot(A, "final-desktop");
  await shot(B, "final-iphone");
  log("final ranking:", JSON.stringify((await state()).scores));

  // Rematch from a player's device: same settings, scores back to 0.
  await B.getByRole("button", { name: "Rematch" }).click();
  await until(async () => { const s = await state(); return s?.phase === "countdown" && s.index === 0 && s.scores.p1 === 0; }, "the rematch");
  await A.getByText("Thumb on the buzzer…").waitFor();
  log("rematch started");

  if (errors.length) throw new Error(`console errors:\n${errors.join("\n")}`);
  console.log("\nPASS - no console errors");
} catch (e) {
  console.error("\nFAIL:", e.message);
  if (errors.length) console.error(errors.join("\n"));
  process.exitCode = 1;
} finally {
  await closeBrowsers();
}
