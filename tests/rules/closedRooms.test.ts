/**
 * Closed rooms (T-058): the owner's /admin sets `games/{room}/closedAt`
 * through firebase-admin, which bypasses these rules. From then on clients
 * can still read the room and mark themselves offline, but every other
 * change is refused.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publicGame } from "@/lib/games/buzzerquiz/game";
import { queueEntryUpdate } from "@/lib/session/shared/updates";
import { dbAs, ftwState, ROOM, seed, seedRoom, setupEnv, TS } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupEnv("demo-rules-closed");
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const g = (path: string) => `games/${ROOM}/${path}`;
const close = () => seed(env, { [g("closedAt")]: Date.now() - 1000 });

/** Writes a seated member makes in normal play, each tried in an open room first so a refusal means "closed", not "malformed". */
const memberWrites: Record<string, (uid: string) => Record<string, unknown>> = {
  "the game state": () => ({ [g("ftw")]: ftwState({ round: 2 }) }),
  "part of the game state": () => ({ [g("ftw/current/placed")]: { 0: "i0_pizza" } }),
  "lastActive": () => ({ [g("lastActive")]: TS }),
  "their display name": () => ({ [g("players/p1")]: { name: "Al" } }),
};

describe("closedAt itself", () => {
  it("is readable by any signed-in guest", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await close();
    const snap = await assertSucceeds(dbAs(env, "stranger").ref(g("closedAt")).get());
    expect(typeof snap.val()).toBe("number");
  });

  it("can't be set, changed or removed by any client, even a member", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await assertFails(dbAs(env, "alice").ref(g("closedAt")).set(TS));
    await close();
    await assertFails(dbAs(env, "alice").ref(g("closedAt")).set(TS));
    await assertFails(dbAs(env, "alice").ref(g("closedAt")).remove());
  });
});

describe("a closed room", () => {
  for (const [what, write] of Object.entries(memberWrites)) {
    it(`refuses a member's write to ${what} (accepted while open)`, async () => {
      await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
      await assertSucceeds(dbAs(env, "alice").ref().update(write("alice")));
      await close();
      await assertFails(dbAs(env, "alice").ref().update(write("alice")));
    });
  }

  it("refuses a new player taking the empty seat", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await close();
    await assertFails(
      dbAs(env, "bob").ref().update({
        [g("seats/p2")]: "bob",
        [g("members/bob")]: "p2",
        [g("players/p2")]: { name: "Bob" },
        "users/bob/rooms/abc234": { gameSlug: "ftw", addedAt: TS },
      }),
    );
  });

  it("refuses renaming it", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await close();
    await assertFails(
      dbAs(env, "alice").ref().update({ [g("meta/name")]: "Friday", [g("meta/nameKey")]: "friday", "roomsByName/friday": ROOM }),
    );
  });

  it("refuses Night Highway's live cars", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"], gameSlug: "nighthighway" });
    const car = { race: 1, t: 1, s: 1, x: 0, v: 1, score: 0, paint: 0 };
    await assertSucceeds(dbAs(env, "alice").ref(g("nighthighwayCars/p1")).set(car));
    await close();
    await assertFails(dbAs(env, "alice").ref(g("nighthighwayCars/p1")).set(car));
  });

  it("refuses Word Scramble's typing signal", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"], gameSlug: "wordscramble", maxPlayers: 8 });
    await assertSucceeds(dbAs(env, "alice").ref(g("wordscrambleTyping/p1")).set({ at: TS }));
    await close();
    await assertFails(dbAs(env, "alice").ref(g("wordscrambleTyping/p1")).set({ at: TS }));
  });

  it("still lets a member mark themselves offline, so it stops counting as live", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await close();
    await assertSucceeds(dbAs(env, "alice").ref(g("presence/alice")).set({ online: false, lastSeen: TS }));
  });

  it("can't be put back in the matchmaking queue or auto-started (public rooms)", async () => {
    await seed(env, {
      [g("meta")]: { gameSlug: "buzzerquiz", maxPlayers: 4, createdAt: Date.now() - 5000, createdBy: "alice", publicLang: "en" },
      [g("buzzerquiz")]: JSON.parse(JSON.stringify(publicGame("en"))),
      [g("seats/p1")]: "alice",
      [g("members/alice")]: "p1",
    });
    const listAgain = queueEntryUpdate({ code: ROOM, gameSlug: "buzzerquiz", lang: "en", players: 1, ts: TS });
    const alice = dbAs(env, "alice");
    await assertSucceeds(alice.ref().update(listAgain));
    await assertSucceeds(alice.ref(g("autoStart")).set(Date.now() + 30_000));
    await close();
    await assertFails(alice.ref().update(listAgain));
    await assertFails(alice.ref(g("autoStart")).set(Date.now() + 20_000));
  });

  it("can still be read", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await close();
    await assertSucceeds(dbAs(env, "bob").ref(g("ftw")).get());
  });
});

describe("analytics/archive (deleted rooms' summaries, T-061)", () => {
  it("is out of reach for every client", async () => {
    await seed(env, { [`analytics/archive/${ROOM}`]: { gameSlug: "ftw", createdAt: 1, deletedAt: 2 } });
    await assertFails(dbAs(env, "alice").ref(`analytics/archive/${ROOM}`).get());
    await assertFails(dbAs(env, "alice").ref("analytics").get());
    await assertFails(dbAs(env, "alice").ref(`analytics/archive/${ROOM}`).set({ gameSlug: "ftw", createdAt: 1, deletedAt: 2 }));
    await assertFails(dbAs(env, "alice").ref(`analytics/archive/${ROOM}`).remove());
  });
});
