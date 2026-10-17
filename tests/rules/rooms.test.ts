/**
 * Realtime Database rules tests (database.rules.json), run against the
 * emulator by `npm run test:rules`.
 *
 * Adding a game later:
 *   1. Add its slug to `games/$room/meta/gameSlug`'s .validate (and to the
 *      maxPlayers == 2 check if it's a 1v1 game).
 *   2. Give it its own `games/$room/<slug>` node next to `ftw`, with the same
 *      .write as `ftw` (meta.gameSlug matches + members/{auth.uid} exists, or
 *      the creating write), swapping in the new slug.
 *   3. Write its .validate rules from its TypeScript state type: allowed keys
 *      only ("$other": false at every level), field types, enums, length caps
 *      on free text, and key ranges on arrays.
 *   4. Add valid/invalid state tests for it in tests/rules/gameState.test.ts.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { dbAs, ftwState, metaFor, ROOM, seed, seedRoom, setupEnv, TS } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupEnv("demo-rules-rooms", "mptest");
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const g = (path: string, room = ROOM) => `games/${room}/${path}`;

/** The create-room update, per the agreed shape: no seat at creation (the creator claims one through the picker afterwards). */
function createUpdate(uid: string, opts: { room?: string; gameSlug?: string; maxPlayers?: number; name?: string; nameKey?: string } = {}) {
  const { room = ROOM, gameSlug = "ftw", maxPlayers = 2, name, nameKey } = opts;
  const update: Record<string, unknown> = {
    [g("meta", room)]: metaFor(uid, gameSlug, maxPlayers, name && nameKey ? { name, nameKey } : {}),
    [`users/${uid}/rooms/${room}`]: { gameSlug, addedAt: TS, createdByMe: true },
  };
  if (gameSlug === "ftw" || gameSlug === "cocounsel" || gameSlug === "nighthighway" || gameSlug === "iai") update[g(gameSlug, room)] = ftwOrCc(gameSlug);
  if (nameKey) update[`roomsByName/${nameKey}`] = room;
  return update;
}
function ftwOrCc(slug: string) {
  if (slug === "nighthighway") return { phase: "LOBBY", race: 0, wins: { p1: 0, p2: 0 } };
  if (slug === "iai") return { phase: "LOBBY", run: 0, best: 0 };
  return slug === "ftw" ? ftwState() : { caseId: "ruined-birthday", partIndex: 0, attempts: 0, phase: "SELECTING" };
}

function claimUpdate(uid: string, seat: string, room = ROOM, gameSlug = "ftw") {
  return {
    [g(`seats/${seat}`, room)]: uid,
    [g(`members/${uid}`, room)]: seat,
    [g(`players/${seat}`, room)]: { name: uid },
    [`users/${uid}/rooms/${room}`]: { gameSlug, addedAt: TS },
  };
}

describe("1. unauthenticated access", () => {
  it("denies every read and write", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await seed(env, { "roomsByName/birthday": ROOM, "users/alice/rooms/abc234": { gameSlug: "ftw", addedAt: 1 } });
    const db = dbAs(env, null);
    await assertFails(db.ref(g("meta")).get());
    await assertFails(db.ref(`games/${ROOM}`).get());
    await assertFails(db.ref("roomsByName/birthday").get());
    await assertFails(db.ref("users/alice").get());
    await assertFails(db.ref().update(createUpdate("alice", { room: "xyz234" })));
    await assertFails(db.ref(g("ftw")).set(ftwState()));
  });
});

describe("2. parent nodes and other users", () => {
  it("denies reading /games, /roomsByName and another user's /users/{uid}", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await seed(env, { "users/alice/rooms/abc234": { gameSlug: "ftw", addedAt: 1 } });
    const bob = dbAs(env, "bob");
    await assertFails(bob.ref("games").get());
    await assertFails(bob.ref("roomsByName").get());
    await assertFails(bob.ref("users/alice").get());
    await assertFails(bob.ref("users").get());
  });

  it("lets any signed-in guest read a room it has the code for", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await assertSucceeds(dbAs(env, "stranger").ref(`games/${ROOM}`).get());
  });
});

describe("3. creating a room", () => {
  it("succeeds as one multi-path update with no seat", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice")));
  });

  it("also succeeds in the spec's shape, seating the creator in p1 with presence in the same update", async () => {
    await assertSucceeds(
      dbAs(env, "alice")
        .ref()
        .update({
          ...createUpdate("alice"),
          ...claimUpdate("alice", "p1"),
          [`users/alice/rooms/${ROOM}`]: { gameSlug: "ftw", addedAt: TS, createdByMe: true },
          [g("presence/alice")]: { online: true, lastSeen: TS },
        }),
    );
  });

  it("fails over an existing meta (a room code collision), for anyone", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice")));
    await assertFails(dbAs(env, "bob").ref().update(createUpdate("bob")));
    await assertFails(dbAs(env, "alice").ref().update(createUpdate("alice")));
  });

  it("can't claim someone else as the creator", async () => {
    await assertFails(dbAs(env, "bob").ref().update({ [g("meta")]: metaFor("alice") }));
  });
});

describe("4. room codes", () => {
  it.each(["abci23", "abcl23", "abco23", "abc023", "abc23", "abc2345", "ABC234"])("rejects %s", async (room) => {
    await assertFails(dbAs(env, "alice").ref().update(createUpdate("alice", { room })));
  });
});

describe("5. maxPlayers", () => {
  it("must be 2 for ftw, cocounsel and nighthighway", async () => {
    await assertFails(dbAs(env, "alice").ref().update(createUpdate("alice", { maxPlayers: 3 })));
    await assertFails(dbAs(env, "alice").ref().update(createUpdate("alice", { gameSlug: "cocounsel", maxPlayers: 3 })));
    await assertFails(dbAs(env, "alice").ref().update(createUpdate("alice", { gameSlug: "nighthighway", maxPlayers: 3 })));
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice", { gameSlug: "cocounsel" })));
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice", { gameSlug: "nighthighway", room: "bcd345" })));
    await assertFails(dbAs(env, "alice").ref().update(createUpdate("alice", { gameSlug: "iai", maxPlayers: 3, room: "cde456" })));
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice", { gameSlug: "iai", room: "def567" })));
  });

  it("is required and must be 2 to 8 for other games", async () => {
    await assertFails(dbAs(env, "alice").ref(g("meta")).set({ gameSlug: "mptest", createdAt: TS, createdBy: "alice" }));
    await assertFails(dbAs(env, "alice").ref(g("meta")).set(metaFor("alice", "mptest", 9)));
    await assertFails(dbAs(env, "alice").ref(g("meta")).set(metaFor("alice", "mptest", 1)));
  });

  it("refuses p3 when maxPlayers is 2", async () => {
    await seedRoom(env, { creator: "alice" });
    await assertFails(dbAs(env, "carol").ref().update(claimUpdate("carol", "p3")));
  });

  it("allows p5 but not p6 when maxPlayers is 5", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice", { gameSlug: "mptest", maxPlayers: 5 })));
    await assertSucceeds(dbAs(env, "erin").ref().update(claimUpdate("erin", "p5", ROOM, "mptest")));
    await assertFails(dbAs(env, "fred").ref().update(claimUpdate("fred", "p6", ROOM, "mptest")));
  });

  it("refuses seats that aren't p1..p8", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice", { gameSlug: "mptest", maxPlayers: 8 })));
    await assertFails(dbAs(env, "x").ref().update(claimUpdate("x", "p9", ROOM, "mptest")));
    await assertFails(dbAs(env, "x").ref().update(claimUpdate("x", "host", ROOM, "mptest")));
  });
});

describe("6. claiming seats", () => {
  beforeEach(async () => {
    await seedRoom(env, { creator: "alice" });
  });

  it("works with the matching members write", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(claimUpdate("alice", "p1")));
  });

  it("fails without the members write, or with a mismatched one", async () => {
    await assertFails(dbAs(env, "alice").ref(g("seats/p1")).set("alice"));
    await assertFails(dbAs(env, "alice").ref().update({ [g("seats/p1")]: "alice", [g("members/alice")]: "p2" }));
    await assertFails(dbAs(env, "alice").ref(g("members/alice")).set("p1"));
  });

  it("can't seat someone else", async () => {
    await assertFails(dbAs(env, "alice").ref().update({ [g("seats/p1")]: "bob", [g("members/bob")]: "p1" }));
  });

  it("fails when the seat is already taken (the second racer)", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(claimUpdate("alice", "p1")));
    await assertFails(dbAs(env, "bob").ref().update(claimUpdate("bob", "p1")));
  });

  it("won't let one uid hold two seats", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(claimUpdate("alice", "p1")));
    await assertFails(dbAs(env, "alice").ref().update({ [g("seats/p2")]: "alice", [g("members/alice")]: "p2" }));
  });

  it("switches seats in one update", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(claimUpdate("alice", "p1")));
    await assertSucceeds(dbAs(env, "alice").ref().update({ [g("seats/p1")]: null, [g("seats/p2")]: "alice", [g("members/alice")]: "p2" }));
  });
});

describe("swapping two seated members (Co-Counsel's 'Switch role instead')", () => {
  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
  });
  const swap = { [g("seats/p1")]: "bob", [g("seats/p2")]: "alice", [g("members/alice")]: "p2", [g("members/bob")]: "p1" };

  it("works in one update by either member", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(swap));
    await assertSucceeds(dbAs(env, "alice").ref().update({ [g("seats/p1")]: "alice", [g("seats/p2")]: "bob", [g("members/alice")]: "p1", [g("members/bob")]: "p2" }));
  });

  it("is refused for a non-member", async () => {
    await assertFails(dbAs(env, "mallory").ref().update(swap));
  });

  it("can't be used to kick the other member out", async () => {
    await assertFails(dbAs(env, "alice").ref().update({ [g("seats/p1")]: null, [g("seats/p2")]: "alice", [g("members/alice")]: "p2", [g("members/bob")]: null }));
  });

  it("can't seat a non-member", async () => {
    await assertFails(dbAs(env, "alice").ref().update({ [g("seats/p2")]: "mallory", [g("members/mallory")]: "p2", [g("members/bob")]: null }));
  });

  it("is refused when only half-written", async () => {
    await assertFails(dbAs(env, "alice").ref().update({ [g("seats/p1")]: "bob", [g("seats/p2")]: "alice" }));
    await assertFails(dbAs(env, "alice").ref().update({ [g("members/alice")]: "p2", [g("members/bob")]: "p1" }));
  });
});

describe("7. non-members", () => {
  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
  });

  it("can't write the game state, players, presence, lastActive or a members entry", async () => {
    const m = dbAs(env, "mallory");
    await assertFails(m.ref(g("ftw")).set(ftwState({ round: 2 })));
    await assertFails(m.ref(g("ftw/round")).set(2));
    await assertFails(m.ref(g("players/p1")).set({ name: "x" }));
    await assertFails(m.ref(g("presence/mallory")).set({ online: true, lastSeen: TS }));
    await assertFails(m.ref(g("presence/alice")).set({ online: false, lastSeen: TS }));
    await assertFails(m.ref(g("lastActive")).set(TS));
    await assertFails(m.ref(g("members/alice")).remove());
    await assertFails(m.ref(g("members/mallory")).set("p1"));
  });

  it("can't delete the room or rewrite its meta", async () => {
    const m = dbAs(env, "mallory");
    await assertFails(m.ref(`games/${ROOM}`).remove());
    await assertFails(m.ref(g("meta")).remove());
    await assertFails(m.ref(g("meta/gameSlug")).set("cocounsel"));
  });

  it("lets members write their own presence, players and lastActive", async () => {
    const a = dbAs(env, "alice");
    await assertSucceeds(a.ref(g("presence/alice")).set({ online: true, lastSeen: TS }));
    await assertSucceeds(a.ref(g("players/p1")).set({ name: "Alice" }));
    await assertSucceeds(a.ref(g("lastActive")).set(TS));
    await assertFails(a.ref(g("players/p2")).set({ name: "Not Bob" }));
    await assertFails(a.ref(g("presence/bob")).set({ online: false, lastSeen: TS }));
  });
});

describe("8. game subtree", () => {
  it("members can write only the subtree matching meta.gameSlug", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    const a = dbAs(env, "alice");
    await assertSucceeds(a.ref(g("ftw")).set(ftwState({ round: 2 })));
    await assertFails(a.ref(g("cocounsel")).set({ caseId: "ruined-birthday", partIndex: 0, attempts: 0, phase: "SELECTING" }));
  });

  it("transactions on the game subtree work for members", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await assertSucceeds(dbAs(env, "alice").ref(g("ftw/round")).transaction((r) => (typeof r === "number" ? r + 1 : r)));
  });
});

describe("9. seat takeover", () => {
  const old = () => Date.now() - 3 * 60_000;
  const takeover = { [g("seats/p1")]: "carol", [g("members/carol")]: "p1", [g("members/alice")]: null };

  it("works when the holder is offline and lastSeen is over 2 minutes old", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
    await seed(env, { [g("presence/alice")]: { online: false, lastSeen: old() } });
    await assertSucceeds(dbAs(env, "carol").ref().update(takeover));
  });

  it("fails while the holder is online", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
    await seed(env, { [g("presence/alice")]: { online: true, lastSeen: old() } });
    await assertFails(dbAs(env, "carol").ref().update(takeover));
  });

  it("fails when the holder went offline less than 2 minutes ago", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
    await seed(env, { [g("presence/alice")]: { online: false, lastSeen: Date.now() - 30_000 } });
    await assertFails(dbAs(env, "carol").ref().update(takeover));
  });

  it("fails unless the old members entry is removed in the same update", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
    await seed(env, { [g("presence/alice")]: { online: false, lastSeen: old() } });
    await assertFails(dbAs(env, "carol").ref().update({ [g("seats/p1")]: "carol", [g("members/carol")]: "p1" }));
  });

  it("can't leave the taker holding two seats", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
    await seed(env, { [g("presence/alice")]: { online: false, lastSeen: old() } });
    await assertFails(dbAs(env, "bob").ref().update({ [g("seats/p1")]: "bob", [g("members/bob")]: "p1", [g("members/alice")]: null }));
  });
});

describe("10. leaving", () => {
  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
  });

  it("works when seat, members and presence go together", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update({ [g("seats/p1")]: null, [g("members/alice")]: null, [g("presence/alice")]: null }));
  });

  it("fails when only one of seat/members is removed", async () => {
    await assertFails(dbAs(env, "alice").ref(g("seats/p1")).remove());
    await assertFails(dbAs(env, "alice").ref(g("members/alice")).remove());
  });

  it("can't remove someone else", async () => {
    await assertFails(dbAs(env, "alice").ref().update({ [g("seats/p2")]: null, [g("members/bob")]: null }));
  });
});

describe("11. room names", () => {
  it("the first creator wins; a second room can't take the name", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice", { name: "Birthday Crew", nameKey: "birthday-crew" })));
    await assertFails(dbAs(env, "bob").ref().update(createUpdate("bob", { room: "xyz234", name: "Birthday crew", nameKey: "birthday-crew" })));
    await assertFails(dbAs(env, "bob").ref("roomsByName/birthday-crew").set("xyz234"));
  });

  it("nameKey must match meta.nameKey", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice", { name: "Crew", nameKey: "crew" })));
    await assertFails(dbAs(env, "alice").ref("roomsByName/other-name").set(ROOM));
  });

  it("validates the key's shape", async () => {
    await assertFails(dbAs(env, "alice").ref().update(createUpdate("alice", { name: "No", nameKey: "no" })));
    await assertFails(dbAs(env, "alice").ref().update(createUpdate("alice", { name: "Big Crew", nameKey: "big crew" })));
  });

  it("only the creator can delete the entry", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice", { name: "Crew", nameKey: "crew" })));
    await assertFails(dbAs(env, "bob").ref("roomsByName/crew").remove());
    await assertSucceeds(dbAs(env, "alice").ref("roomsByName/crew").remove());
  });

  it("any signed-in guest can read one entry", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice", { name: "Crew", nameKey: "crew" })));
    await assertSucceeds(dbAs(env, "bob").ref("roomsByName/crew").get());
  });

  describe("naming or renaming later (creator only)", () => {
    beforeEach(async () => {
      await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice")));
    });

    it("the creator can name, rename and clear the room, moving the index entry in the same update", async () => {
      const a = dbAs(env, "alice");
      await assertSucceeds(a.ref().update({ [g("meta/name")]: "Crew", [g("meta/nameKey")]: "crew", "roomsByName/crew": ROOM }));
      await assertSucceeds(a.ref().update({ [g("meta/name")]: "New Crew", [g("meta/nameKey")]: "new-crew", "roomsByName/new-crew": ROOM, "roomsByName/crew": null }));
      await assertSucceeds(a.ref().update({ [g("meta/name")]: null, [g("meta/nameKey")]: null, "roomsByName/new-crew": null }));
    });

    it("someone else can't rename it", async () => {
      await seed(env, { [g("seats/p2")]: "bob", [g("members/bob")]: "p2" });
      await assertFails(dbAs(env, "bob").ref().update({ [g("meta/name")]: "Crew", [g("meta/nameKey")]: "crew", "roomsByName/crew": ROOM }));
    });

    it("can't point meta.nameKey at a name the room doesn't hold", async () => {
      await seed(env, { "roomsByName/taken": "xyz234" });
      await assertFails(dbAs(env, "alice").ref().update({ [g("meta/name")]: "Taken", [g("meta/nameKey")]: "taken" }));
      await assertFails(dbAs(env, "alice").ref().update({ [g("meta/name")]: "Taken", [g("meta/nameKey")]: "taken", "roomsByName/taken": ROOM }));
    });

    it("the rest of meta stays write-once, even for the creator", async () => {
      await assertFails(dbAs(env, "alice").ref(g("meta/maxPlayers")).set(2));
      await assertFails(dbAs(env, "alice").ref(g("meta/gameSlug")).set("cocounsel"));
    });
  });
});

describe("12. users/{uid}", () => {
  it("only that uid can read or write it", async () => {
    await assertSucceeds(dbAs(env, "alice").ref("users/alice/rooms/abc234").set({ gameSlug: "ftw", addedAt: TS }));
    await assertSucceeds(dbAs(env, "alice").ref("users/alice").get());
    await assertFails(dbAs(env, "bob").ref("users/alice").get());
    await assertFails(dbAs(env, "bob").ref("users/alice/rooms/abc234").set({ gameSlug: "ftw", addedAt: TS }));
  });

  it("rejects unknown fields and malformed entries", async () => {
    const a = dbAs(env, "alice");
    await assertFails(a.ref("users/alice/rooms/abc234").set({ gameSlug: "ftw", addedAt: TS, junk: 1 }));
    await assertFails(a.ref("users/alice/junk").set(1));
    await assertFails(a.ref("users/alice/rooms").set("junk"));
    await assertFails(a.ref("users/alice/rooms/abc234").set({ gameSlug: "ftw" }));
    await assertFails(a.ref("users/alice/rooms/toolong1").set({ gameSlug: "ftw", addedAt: TS }));
    await assertSucceeds(a.ref("users/alice/rooms/abc234").set({ gameSlug: "ftw", addedAt: TS, createdByMe: true, name: "Crew" }));
  });
});

describe("13. unknown children", () => {
  it("rejects games/{room}/junk and meta/junk", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await assertFails(dbAs(env, "alice").ref(g("junk")).set(1));
    await assertFails(dbAs(env, "bob").ref().update({ ...createUpdate("bob", { room: "xyz234" }), [g("meta", "xyz234")]: { ...metaFor("bob"), junk: 1 } }));
  });
});

describe("the creator before taking a seat", () => {
  it("can't write presence or lastActive until seated", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice")));
    await assertFails(dbAs(env, "alice").ref(g("presence/alice")).set({ online: true, lastSeen: TS }));
    await assertFails(dbAs(env, "alice").ref(g("lastActive")).set(TS));
  });

  it("can't write the game state again until seated", async () => {
    await assertSucceeds(dbAs(env, "alice").ref().update(createUpdate("alice")));
    await assertFails(dbAs(env, "alice").ref(g("ftw/round")).set(2));
  });
});
