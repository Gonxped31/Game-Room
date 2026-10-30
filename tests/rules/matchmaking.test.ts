/**
 * Matchmaking (docs/matchmaking.md): public rooms (`meta.publicLang`), their
 * queue entries (`queue/{slug}/{lang}/{room}`) and the room-level
 * `autoStart` deadline, written with the app's own update builders.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { claimSeatUpdate, createRoomUpdate, queueEntryUpdate, queueRemoveUpdate, type RoomMeta } from "@/lib/session/shared/updates";
import { publicGame } from "@/lib/games/buzzerquiz/game";
import { newGame as newRace } from "@/lib/games/nighthighway/game";
import { newGame as newScramble } from "@/lib/games/wordscramble/game";
import { newRace as newBorderRun } from "@/lib/games/borderrun/race";
import { newRace as newGridRace } from "@/lib/games/regions/race";
import { newGame as newHop, setMode as setHopMode } from "@/lib/games/lasthop/game";
import { dbAs, ROOM, seed, setupEnv, TS } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupEnv("demo-rules-matchmaking");
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const send = (uid: string, update: Record<string, unknown>) => dbAs(env, uid).ref().update(update);
const entry = (room = ROOM, lang = "en", slug = "buzzerquiz") => `queue/${slug}/${lang}/${room}`;

function createPublic(uid: string, opts: { gameSlug?: string; lang?: string; maxPlayers?: number } = {}) {
  const { gameSlug = "buzzerquiz", lang = "en", maxPlayers = gameSlug === "wordscramble" ? 8 : gameSlug === "nighthighway" ? 2 : 4 } = opts;
  const initialState = plain(
    gameSlug === "wordscramble" ? newScramble("en") : gameSlug === "buzzerquiz" ? publicGame("en") : gameSlug === "nighthighway" ? newRace() : {},
  );
  return createRoomUpdate({ code: ROOM, uid, gameSlug, maxPlayers, initialState, ts: TS, publicLang: lang });
}

const meta = (creator: string): RoomMeta => ({ gameSlug: "buzzerquiz", maxPlayers: 4, createdAt: 1, createdBy: creator, publicLang: "en" });
const claim = (uid: string, seat: string) => claimSeatUpdate({ code: ROOM, seat, uid, name: uid, meta: meta("alice"), ts: TS });

/** A public Buzzer Quiz room by alice, listed in the EN queue, with `seated` in p1, p2, ... */
async function seedPublic(seated: string[], opts: { updatedAt?: number; publicLang?: string | null } = {}) {
  const { updatedAt = Date.now() - 1000, publicLang = "en" } = opts;
  const data: Record<string, unknown> = {
    [`games/${ROOM}/meta`]: { gameSlug: "buzzerquiz", maxPlayers: 4, createdAt: Date.now() - 5000, createdBy: "alice", ...(publicLang ? { publicLang } : {}) },
    [`games/${ROOM}/buzzerquiz`]: plain(publicGame("en")),
    [entry()]: { players: seated.length, updatedAt },
  };
  seated.forEach((uid, i) => {
    data[`games/${ROOM}/seats/p${i + 1}`] = uid;
    data[`games/${ROOM}/members/${uid}`] = `p${i + 1}`;
  });
  await seed(env, data);
}

describe("creating a public room", () => {
  it("lists a new Buzzer Quiz or Word Scramble room in its language's queue", async () => {
    await assertSucceeds(send("alice", createPublic("alice")));
    await env.clearDatabase();
    await assertSucceeds(send("alice", createPublic("alice", { gameSlug: "wordscramble", lang: "fr" })));
  });

  it("lists a new Night Highway room in its one queue, `any`", async () => {
    await assertSucceeds(send("alice", createPublic("alice", { gameSlug: "nighthighway", lang: "any" })));
    await assertSucceeds(send("alice", claimSeatUpdate({ code: ROOM, seat: "p1", uid: "alice", name: "alice", meta: { ...meta("alice"), gameSlug: "nighthighway", maxPlayers: 2, publicLang: "any" }, ts: TS })));
  });

  it("then seats its creator", async () => {
    await assertSucceeds(send("alice", createPublic("alice")));
    await assertSucceeds(send("alice", claim("alice", "p1")));
  });

  it("refuses a public 1v1 game, or a language with no queue", async () => {
    await assertFails(send("alice", createRoomUpdate({ code: ROOM, uid: "alice", gameSlug: "ftw", maxPlayers: 2, initialState: {}, ts: TS, publicLang: "en" })));
    await assertFails(send("alice", createPublic("alice", { lang: "de" })));
    await assertFails(send("alice", createPublic("alice", { lang: "any" })));
    await assertFails(send("alice", createPublic("alice", { gameSlug: "nighthighway", lang: "en" })));
  });

  it("refuses listing a room in the other language's queue", async () => {
    const update: Record<string, unknown> = createPublic("alice");
    delete update[entry()];
    await assertFails(send("alice", { ...update, [entry(ROOM, "fr")]: { players: 0, updatedAt: TS } }));
  });

  it("refuses adding publicLang to an existing room", async () => {
    await seedPublic(["alice"], { publicLang: null });
    await assertFails(send("alice", { [`games/${ROOM}/meta/publicLang`]: "en" }));
  });
});

describe("the queue", () => {
  it("any signed-in guest can list one game's queue in one language, but not the whole queue", async () => {
    await seedPublic(["alice"]);
    await assertSucceeds(dbAs(env, "stranger").ref("queue/buzzerquiz/en").get());
    await assertFails(dbAs(env, "stranger").ref("queue").get());
    await assertFails(dbAs(env, "stranger").ref("queue/buzzerquiz").get());
    await assertFails(dbAs(env, null).ref("queue/buzzerquiz/en").get());
  });

  it("a member refreshes or removes the room's entry", async () => {
    await seedPublic(["alice", "bob"]);
    await assertSucceeds(send("bob", queueEntryUpdate({ code: ROOM, gameSlug: "buzzerquiz", lang: "en", players: 2, ts: TS })));
    await assertSucceeds(send("bob", queueRemoveUpdate({ code: ROOM, gameSlug: "buzzerquiz", lang: "en" })));
  });

  it("refuses an entry from a non-member, for a private room, or with bad fields", async () => {
    await seedPublic(["alice"]);
    await assertFails(send("stranger", queueEntryUpdate({ code: ROOM, gameSlug: "buzzerquiz", lang: "en", players: 1, ts: TS })));
    await assertFails(send("alice", { [entry()]: { players: 9, updatedAt: TS } }));
    await assertFails(send("alice", { [entry()]: { players: 1, updatedAt: TS, extra: true } }));
    await assertFails(send("alice", { [entry(ROOM, "en", "wordscramble")]: { players: 1, updatedAt: TS } }));
    await env.clearDatabase();
    await seedPublic(["alice"], { publicLang: null });
    await assertFails(send("alice", queueEntryUpdate({ code: ROOM, gameSlug: "buzzerquiz", lang: "en", players: 1, ts: TS })));
  });

  it("anyone may clear a stale entry, or one whose room is gone - never a fresh one", async () => {
    await seedPublic(["alice"]);
    await assertFails(send("stranger", queueRemoveUpdate({ code: ROOM, gameSlug: "buzzerquiz", lang: "en" })));
    await seedPublic(["alice"], { updatedAt: Date.now() - 120_000 });
    await assertSucceeds(send("stranger", queueRemoveUpdate({ code: ROOM, gameSlug: "buzzerquiz", lang: "en" })));
    await env.clearDatabase();
    await seed(env, { [entry("zzz234")]: { players: 1, updatedAt: Date.now() } });
    await assertSucceeds(send("stranger", queueRemoveUpdate({ code: "zzz234", gameSlug: "buzzerquiz", lang: "en" })));
  });

  it("a stranger takes a free seat in a public room like any other", async () => {
    await seedPublic(["alice"]);
    await assertSucceeds(send("bob", claim("bob", "p2")));
    await assertFails(send("carol", claim("carol", "p2")));
  });
});

describe("autoStart", () => {
  it("members of a public room set and clear it", async () => {
    await seedPublic(["alice", "bob"]);
    await assertSucceeds(dbAs(env, "bob").ref(`games/${ROOM}/autoStart`).set(Date.now() + 20_000));
    await assertSucceeds(dbAs(env, "alice").ref(`games/${ROOM}/autoStart`).set(null));
  });

  it("refuses a non-member, a private room, or a deadline over a minute away", async () => {
    await seedPublic(["alice", "bob"]);
    await assertFails(dbAs(env, "stranger").ref(`games/${ROOM}/autoStart`).set(Date.now() + 20_000));
    await assertFails(dbAs(env, "alice").ref(`games/${ROOM}/autoStart`).set(Date.now() + 5 * 60_000));
    await assertFails(dbAs(env, "alice").ref(`games/${ROOM}/autoStart`).set("soon"));
    await env.clearDatabase();
    await seedPublic(["alice", "bob"], { publicLang: null });
    await assertFails(dbAs(env, "alice").ref(`games/${ROOM}/autoStart`).set(Date.now() + 20_000));
  });
});

describe.each([
  ["Border Run", "borderrun", newBorderRun],
  ["Checkmate Grid", "regions", newGridRace],
] as const)("%s's public rooms", (_, slug, newRace) => {
  const publicRoom = (mode: string, opts: { maxPlayers?: number; stateMode?: "challenge" | "survival" } = {}) =>
    createRoomUpdate({
      code: ROOM,
      uid: "alice",
      gameSlug: slug,
      maxPlayers: opts.maxPlayers ?? (mode === "challenge" ? 4 : 8),
      initialState: plain(newRace(opts.stateMode ?? (mode as "challenge" | "survival"))),
      ts: TS,
      publicLang: mode,
    });

  it("queues by mode: a challenge room has 4 seats, a survival room 8", async () => {
    await assertSucceeds(send("alice", publicRoom("challenge")));
    await env.clearDatabase();
    await assertSucceeds(send("alice", publicRoom("survival")));
  });

  it("refuses the wrong seat count, a language queue, or a game in another mode than its queue", async () => {
    await assertFails(send("alice", publicRoom("challenge", { maxPlayers: 8 })));
    await assertFails(send("alice", publicRoom("survival", { maxPlayers: 4 })));
    await assertFails(send("alice", publicRoom("en", { maxPlayers: 8, stateMode: "challenge" })));
    await assertFails(send("alice", publicRoom("challenge", { stateMode: "survival" })));
  });

  it("keeps a public room in its mode; a private room changes it freely", async () => {
    await assertSucceeds(send("alice", publicRoom("challenge")));
    const publicMeta = { ...meta("alice"), gameSlug: slug, maxPlayers: 4, publicLang: "challenge" };
    await assertSucceeds(send("alice", claimSeatUpdate({ code: ROOM, seat: "p1", uid: "alice", name: "alice", meta: publicMeta, ts: TS })));
    await assertFails(send("alice", { [`games/${ROOM}/${slug}/mode`]: "survival" }));
    await env.clearDatabase();
    await assertSucceeds(send("alice", createRoomUpdate({ code: ROOM, uid: "alice", gameSlug: slug, maxPlayers: 8, initialState: plain(newRace("challenge")), ts: TS })));
    const privateMeta = { gameSlug: slug, maxPlayers: 8, createdAt: 1, createdBy: "alice" };
    await assertSucceeds(send("alice", claimSeatUpdate({ code: ROOM, seat: "p1", uid: "alice", name: "alice", meta: privateMeta, ts: TS })));
    await assertSucceeds(send("alice", { [`games/${ROOM}/${slug}/mode`]: "survival" }));
  });
});

describe("Last Hop's public rooms", () => {
  const publicRoom = (mode: string, opts: { maxPlayers?: number; stateMode?: "track" | "grid" } = {}) =>
    createRoomUpdate({
      code: ROOM,
      uid: "alice",
      gameSlug: "lasthop",
      maxPlayers: opts.maxPlayers ?? 2,
      initialState: plain(newHop(opts.stateMode ?? (mode as "track" | "grid"))),
      ts: TS,
      publicLang: mode,
    });

  it("queues by mode, a 1v1 in each", async () => {
    await assertSucceeds(send("alice", publicRoom("track")));
    await env.clearDatabase();
    await assertSucceeds(send("alice", publicRoom("grid")));
  });

  it("refuses more seats, a language queue, or a game in another mode than its queue", async () => {
    await assertFails(send("alice", publicRoom("track", { maxPlayers: 4 })));
    await assertFails(send("alice", publicRoom("en", { stateMode: "track" })));
    await assertFails(send("alice", publicRoom("challenge", { stateMode: "track" })));
    await assertFails(send("alice", publicRoom("track", { stateMode: "grid" })));
  });

  it("keeps a public room in its mode; a private room changes it", async () => {
    await assertSucceeds(send("alice", publicRoom("grid")));
    const publicMeta = { ...meta("alice"), gameSlug: "lasthop", maxPlayers: 2, publicLang: "grid" };
    await assertSucceeds(send("alice", claimSeatUpdate({ code: ROOM, seat: "p1", uid: "alice", name: "alice", meta: publicMeta, ts: TS })));
    await assertFails(dbAs(env, "alice").ref(`games/${ROOM}/lasthop`).set(plain(setHopMode(newHop("grid"), "track"))));
    await env.clearDatabase();
    await assertSucceeds(send("alice", createRoomUpdate({ code: ROOM, uid: "alice", gameSlug: "lasthop", maxPlayers: 2, initialState: plain(newHop("track")), ts: TS })));
    const privateMeta = { gameSlug: "lasthop", maxPlayers: 2, createdAt: 1, createdBy: "alice" };
    await assertSucceeds(send("alice", claimSeatUpdate({ code: ROOM, seat: "p1", uid: "alice", name: "alice", meta: privateMeta, ts: TS })));
    await assertSucceeds(dbAs(env, "alice").ref(`games/${ROOM}/lasthop`).set(plain(setHopMode(newHop("track"), "grid"))));
  });
});
