/**
 * Visits (T-062): `users/{uid}/visits/{yyyymmdd}/{roomCode}` records that a
 * seated guest was in a room that UTC day. It's the dashboard's lasting
 * record of who played what and when, since "Leave room" clears the guest's
 * room list.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { leaveRoomUpdate, visitDay, visitUpdate } from "@/lib/session/shared/updates";
import { dbAs, ROOM, seedRoom, setupEnv, TS } from "./helpers";

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
const visit = (uid: string, over: Partial<{ code: string; gameSlug: string; day: string }> = {}) =>
  visitUpdate({ uid, code: ROOM, gameSlug: "ftw", day: today, ts: TS, ...over });
const path = (uid: string, day = today) => `users/${uid}/visits/${day}/${ROOM}`;

describe("users/{uid}/visits", () => {
  it("lets a seated guest mark today's visit with the app's own builder", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await assertSucceeds(dbAs(env, "alice").ref().update(visit("alice")));
  });

  it("survives Leave room (unlike the room list)", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
    const bob = dbAs(env, "bob");
    await assertSucceeds(bob.ref().update(visit("bob")));
    await assertSucceeds(bob.ref().update(leaveRoomUpdate({ code: ROOM, uid: "bob", seat: "p2" })));
    await assertSucceeds(bob.ref(path("bob")).get());
  });

  it("refuses a guest who isn't seated in the room, or another guest's visit", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await assertFails(dbAs(env, "bob").ref().update(visit("bob")));
    await assertFails(dbAs(env, "bob").ref().update(visit("alice")));
  });

  it("refuses the wrong game, a malformed day, or a value that isn't a recent server time", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    const alice = dbAs(env, "alice");
    await assertFails(alice.ref().update(visit("alice", { gameSlug: "cocounsel" })));
    await assertFails(alice.ref().update(visit("alice", { day: "2026-10-25" })));
    await assertFails(alice.ref(path("alice")).set({ gameSlug: "ftw", at: Date.now() + 60 * 60 * 1000 }));
    await assertFails(alice.ref(path("alice")).set({ gameSlug: "ftw", at: Date.now() - 3 * 24 * 60 * 60 * 1000 }));
    await assertFails(alice.ref(path("alice")).set({ gameSlug: "ftw", at: TS, extra: 1 }));
    await assertFails(alice.ref(`users/alice/visits/${today}`).set(TS));
  });
});
