/**
 * Daily visits (T-062): `users/{uid}/visits/{yyyymmdd}` holds the server
 * time of a guest's first room visit that day, so the dashboard's return
 * rate sees a guest coming back to the same room on another day.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { visitDay, visitUpdate } from "@/lib/session/shared/updates";
import { dbAs, setupEnv, TS } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupEnv("demo-rules-visits");
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const today = visitDay(Date.now());

describe("users/{uid}/visits", () => {
  it("lets a guest mark today's visit with the app's own builder", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(visitUpdate({ uid: "alice", day: today, ts: TS })));
  });

  it("refuses marking another guest's visit", async () => {
    await assertFails(dbAs(env, "bob").ref().update(visitUpdate({ uid: "alice", day: today, ts: TS })));
  });

  it("refuses a malformed day or a value that isn't a recent server time", async () => {
    const alice = dbAs(env, "alice");
    await assertFails(alice.ref(`users/alice/visits/2026-10-25`).set(TS));
    await assertFails(alice.ref(`users/alice/visits/1999`).set(TS));
    await assertFails(alice.ref(`users/alice/visits/${today}`).set(true));
    await assertFails(alice.ref(`users/alice/visits/${today}`).set(Date.now() + 60 * 60 * 1000));
    await assertFails(alice.ref(`users/alice/visits/${today}`).set(Date.now() - 3 * 24 * 60 * 60 * 1000));
    await assertFails(alice.ref(`users/alice/visits/${today}`).set({ at: TS }));
  });
});
