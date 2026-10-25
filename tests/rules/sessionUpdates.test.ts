/**
 * The session layer's own multi-path updates (lib/session/shared/updates.ts),
 * sent through the emulator exactly as the app builds them - so the client
 * and database.rules.json can't drift apart unnoticed. Also covers rooms
 * with more than 2 seats: a `maxPlayers: 3` room (via the test-only 'mptest'
 * slug - the deployed rules only know 2-player games) seats three guests and
 * refuses a fourth.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  claimSeatUpdate,
  createRoomUpdate,
  leaveRoomUpdate,
  nameKey,
  type RoomMeta,
  roomNameUpdate,
  swapSeatsUpdate,
  switchSeatUpdate,
  takeOverSeatUpdate,
} from "@/lib/session/shared/updates";
import { seatIds } from "@/lib/session/types";
import { newGame as newFtwGame } from "@/lib/games/ftw/game";
import { randomRound } from "@/lib/games/ftw/prompts";
import { newGame as newCcGame } from "@/lib/games/cocounsel/game";
import { dbAs, ROOM, seed, setupEnv, TS } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupEnv("demo-rules-session", "mptest");
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const send = (uid: string, update: Record<string, unknown>) => dbAs(env, uid).ref().update(update);

async function readMeta(): Promise<RoomMeta> {
  const snap = await dbAs(env, "anyone").ref(`games/${ROOM}/meta`).get();
  return snap.val();
}

async function createAndSeat(gameSlug: "ftw" | "cocounsel", seats: string[]) {
  const initialState = plain(gameSlug === "ftw" ? newFtwGame(randomRound()) : newCcGame("ruined-birthday"));
  await assertSucceeds(send(seats[0], createRoomUpdate({ code: ROOM, uid: seats[0], gameSlug, maxPlayers: 2, initialState, ts: TS })));
  const meta = await readMeta();
  for (const [i, uid] of seats.entries()) {
    await assertSucceeds(send(uid, claimSeatUpdate({ code: ROOM, seat: `p${i + 1}`, uid, name: uid, meta, ts: TS })));
  }
  return meta;
}

describe("a 1v1 room's lifecycle, with the app's own updates", () => {
  it("creates a First to Worst room and seats both players", async () => {
    await createAndSeat("ftw", ["alice", "bob"]);
    const seats = (await dbAs(env, "alice").ref(`games/${ROOM}/seats`).get()).val();
    expect(seats).toEqual({ p1: "alice", p2: "bob" });
  });

  it("creates a Co-Counsel room where the creator takes p2 first", async () => {
    const initialState = plain(newCcGame("ruined-birthday"));
    await assertSucceeds(send("alice", createRoomUpdate({ code: ROOM, uid: "alice", gameSlug: "cocounsel", maxPlayers: 2, initialState, ts: TS })));
    const meta = await readMeta();
    await assertSucceeds(send("alice", claimSeatUpdate({ code: ROOM, seat: "p2", uid: "alice", name: "Leo", meta, ts: TS })));
    await assertSucceeds(send("bob", claimSeatUpdate({ code: ROOM, seat: "p1", uid: "bob", name: "Maya", meta, ts: TS })));
  });

  it("refuses the loser of a race for the same seat", async () => {
    await createAndSeat("ftw", ["alice"]);
    const meta = await readMeta();
    await assertFails(send("bob", claimSeatUpdate({ code: ROOM, seat: "p1", uid: "bob", name: "Bob", meta, ts: TS })));
  });

  it("switches to the empty seat, then trades seats once both are seated", async () => {
    await createAndSeat("cocounsel", ["alice"]);
    await assertSucceeds(send("alice", switchSeatUpdate({ code: ROOM, uid: "alice", from: "p1", to: "p2", name: "Leo" })));
    const meta = await readMeta();
    await assertSucceeds(send("bob", claimSeatUpdate({ code: ROOM, seat: "p1", uid: "bob", name: "Maya", meta, ts: TS })));
    await assertSucceeds(send("bob", swapSeatsUpdate({ code: ROOM, a: { uid: "bob", seat: "p1" }, b: { uid: "alice", seat: "p2" } })));
    const seats = (await dbAs(env, "alice").ref(`games/${ROOM}/seats`).get()).val();
    expect(seats).toEqual({ p1: "alice", p2: "bob" });
  });

  it("takes over an offline seat after 2 minutes", async () => {
    const meta = await createAndSeat("ftw", ["alice", "bob"]);
    await seed(env, { [`games/${ROOM}/presence/alice`]: { online: false, lastSeen: Date.now() - 3 * 60_000 } });
    await assertSucceeds(send("carol", takeOverSeatUpdate({ code: ROOM, seat: "p1", uid: "carol", oldUid: "alice", mySeat: null, name: "alice", meta, ts: TS })));
  });

  it("leaves the room, which drops it from the leaver's own room list", async () => {
    await createAndSeat("ftw", ["alice", "bob"]);
    await assertSucceeds(dbAs(env, "alice").ref(`games/${ROOM}/presence/alice`).set({ online: true, lastSeen: TS }));
    expect((await dbAs(env, "alice").ref(`users/alice/rooms/${ROOM}`).get()).exists()).toBe(true);
    await assertSucceeds(send("alice", leaveRoomUpdate({ code: ROOM, uid: "alice", seat: "p1" })));
    expect((await dbAs(env, "alice").ref(`users/alice/rooms/${ROOM}`).get()).exists()).toBe(false);
    expect((await dbAs(env, "bob").ref(`games/${ROOM}/seats`).get()).val()).toEqual({ p2: "bob" });
  });

  it("names, renames and un-names the room as its creator; a second room can't take the name", async () => {
    const meta = await createAndSeat("ftw", ["alice", "bob"]);
    await assertSucceeds(send("alice", roomNameUpdate({ code: ROOM, name: "Birthday Crew", key: nameKey("Birthday Crew"), previousKey: meta.nameKey })));
    await assertFails(send("bob", roomNameUpdate({ code: ROOM, name: "Bob's", key: nameKey("Bob's room"), previousKey: "birthday-crew" })));

    const other = "xyz234";
    await assertSucceeds(send("dave", createRoomUpdate({ code: other, uid: "dave", gameSlug: "ftw", maxPlayers: 2, initialState: plain(newFtwGame(randomRound())), ts: TS })));
    await assertFails(send("dave", roomNameUpdate({ code: other, name: "birthday crew", key: nameKey("birthday crew"), previousKey: undefined })));

    await assertSucceeds(send("alice", roomNameUpdate({ code: ROOM, name: "Game Night", key: nameKey("Game Night"), previousKey: "birthday-crew" })));
    await assertSucceeds(send("dave", roomNameUpdate({ code: other, name: "Birthday Crew", key: nameKey("Birthday Crew"), previousKey: undefined })));
    await assertSucceeds(send("alice", roomNameUpdate({ code: ROOM, name: null, key: null, previousKey: "game-night" })));
  });

  it("lets a seated player write presence and lastActive", async () => {
    await createAndSeat("ftw", ["alice", "bob"]);
    await assertSucceeds(dbAs(env, "alice").ref(`games/${ROOM}/presence/alice`).set({ online: true, lastSeen: TS }));
    await assertSucceeds(dbAs(env, "alice").ref(`games/${ROOM}/lastActive`).set(TS));
  });
});

describe("rooms with more than 2 seats", () => {
  it("seats three guests in a maxPlayers: 3 room, and a fourth finds it full", async () => {
    // 'mptest' has no game-state node in the rules (a real game adds one -
    // see the checklist in rooms.test.ts), so leave its state out.
    const create: Record<string, unknown> = createRoomUpdate({ code: ROOM, uid: "u1", gameSlug: "mptest", maxPlayers: 3, initialState: {}, ts: TS });
    delete create[`games/${ROOM}/mptest`];
    await assertSucceeds(send("u1", create));
    const meta = await readMeta();
    const seats = seatIds(meta.maxPlayers);
    expect(seats).toEqual(["p1", "p2", "p3"]);
    for (const [i, seat] of seats.entries()) {
      const uid = `u${i + 1}`;
      await assertSucceeds(send(uid, claimSeatUpdate({ code: ROOM, seat, uid, name: uid, meta, ts: TS })));
    }
    // Room full: every seat in range is taken, and the next seat is out of range.
    for (const seat of [...seats, "p4"]) {
      await assertFails(send("u4", claimSeatUpdate({ code: ROOM, seat, uid: "u4", name: "u4", meta, ts: TS })));
    }
  });
});
