/**
 * Source tracking and games finished (docs/tracking.md):
 * - users/{uid}/firstTouch: the guest's first source, written once by its owner;
 * - finished/games/{key}: one header per finished game, created once, by a
 *   guest seated in the room (room games) or whose uid starts the key (solo);
 * - finished/players/{key}_{uid}: each finisher's own entry.
 * Nobody reads or lists `finished` (the dashboard uses firebase-admin).
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { entryKey, FINISHED_GAMES, FINISHED_PLAYERS, finishedEntry, finishedHeader, firstTouchPath, gameKey, type FinishedInput } from "@/lib/tracking/events";
import { dbAs, ROOM, seed, seedRoom, setupEnv, TS } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupEnv("demo-rules-tracking");
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const touch = (over: Record<string, unknown> = {}) => ({ src: "tiktok", cmp: "test1", at: TS, ...over });
const write = (uid: string, path: string, value: unknown) => dbAs(env, uid).ref(path).set(value);

describe("users/{uid}/firstTouch", () => {
  it("lets the owner write it once, with server time", async () => {
    await assertSucceeds(write("alice", firstTouchPath("alice"), touch({ med: "social" })));
    await assertSucceeds(write("bob", firstTouchPath("bob"), { src: "direct", at: TS }));
  });

  it("refuses anyone else, and signed-out writes", async () => {
    await assertFails(write("bob", firstTouchPath("alice"), touch()));
    await assertFails(dbAs(env, null).ref(firstTouchPath("alice")).set(touch()));
  });

  it("can't be changed, extended or removed once written", async () => {
    await assertSucceeds(write("alice", firstTouchPath("alice"), touch()));
    await assertFails(write("alice", firstTouchPath("alice"), touch({ src: "instagram" })));
    await assertFails(write("alice", `${firstTouchPath("alice")}/src`, "instagram"));
    await assertFails(write("alice", `${firstTouchPath("alice")}/med`, "social"));
    await assertFails(dbAs(env, "alice").ref(`${firstTouchPath("alice")}/cmp`).remove());
    await assertFails(dbAs(env, "alice").ref(firstTouchPath("alice")).remove());
    await assertFails(dbAs(env, "alice").ref("users/alice").remove());
  });

  it("leaves the guest's other writes alone", async () => {
    await assertSucceeds(write("alice", firstTouchPath("alice"), touch()));
    await assertSucceeds(write("alice", `users/alice/rooms/${ROOM}`, { gameSlug: "ftw", addedAt: TS }));
    await assertSucceeds(dbAs(env, "alice").ref(`users/alice/rooms/${ROOM}`).remove());
  });

  it("refuses bad shapes", async () => {
    for (const bad of [
      touch({ src: "TikTok" }),
      touch({ src: "a b" }),
      touch({ src: "x".repeat(41) }),
      touch({ cmp: "spring sale" }),
      touch({ at: Date.now() - 5 * 60_000 }),
      touch({ at: Date.now() + 60_000 }),
      touch({ extra: 1 }),
      { at: TS },
      { src: "tiktok" },
    ]) {
      await assertFails(write("alice", firstTouchPath("alice"), bad));
    }
  });

  it("is never readable by others", async () => {
    await assertSucceeds(write("alice", firstTouchPath("alice"), touch()));
    await assertFails(dbAs(env, "bob").ref(firstTouchPath("alice")).get());
  });
});

const roomGame = (over: Partial<FinishedInput> = {}): FinishedInput => ({ slug: "ftw", mode: "room", id: "3", room: ROOM, players: 2, lang: "en", ...over });
const soloGame = (over: Partial<FinishedInput> = {}): FinishedInput => ({ slug: "regions", mode: "solo", id: "k2x9-1", players: 1, lang: "fr", ...over });
const header = (game: FinishedInput) => finishedHeader(game, TS)!;
const headerPath = (key: string) => `${FINISHED_GAMES}/${key}`;
const entryPath = (key: string, uid: string) => `${FINISHED_PLAYERS}/${entryKey(key, uid)}`;
const entry = (key: string, uid: string, src = "tiktok") => finishedEntry(key, uid, { src, cmp: "test1" }, TS);

describe("finished/games (room games)", () => {
  const key = gameKey(ROOM, "3");

  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
  });

  it("lets a seated guest create the header once; a second device's is refused", async () => {
    await assertSucceeds(write("alice", headerPath(key), header(roomGame())));
    await assertFails(write("bob", headerPath(key), header(roomGame())));
    await assertFails(write("alice", `${headerPath(key)}/players`, 3));
    await assertFails(dbAs(env, "alice").ref(headerPath(key)).remove());
  });

  it("takes races, matchmade ones included", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob", "carol"], gameSlug: "regions", maxPlayers: 8, room: "xyz789" });
    await assertSucceeds(write("carol", headerPath(gameKey("xyz789", "r1")), header(roomGame({ slug: "regions", mode: "challenge", room: "xyz789", id: "r1", players: 3, matchmade: true }))));
  });

  it("refuses a guest who isn't seated there", async () => {
    await assertFails(write("mallory", headerPath(key), header(roomGame())));
    await assertFails(dbAs(env, null).ref(headerPath(key)).set(header(roomGame())));
  });

  it("refuses a key that isn't the room's, or another game's slug", async () => {
    await assertFails(write("alice", headerPath(gameKey("zzz999", "3")), header(roomGame())));
    await assertFails(write("alice", headerPath(key), header(roomGame({ slug: "buzzerquiz" }))));
  });

  it("refuses bad shapes", async () => {
    const good = header(roomGame());
    for (const bad of [
      { ...good, mode: "daily" },
      { ...good, mode: "solo" },
      { ...good, mode: "party" },
      { ...good, players: 0 },
      { ...good, players: 9 },
      { ...good, players: 2.5 },
      { ...good, lang: "de" },
      { ...good, at: Date.now() - 5 * 60_000 },
      { ...good, matchmade: false },
      { ...good, extra: 1 },
      { slug: "ftw", mode: "room", players: 2, at: TS, room: ROOM },
    ]) {
      await assertFails(write("alice", headerPath(key), bad));
    }
    await assertFails(write("alice", headerPath(`${ROOM}_bad~id`), good));
    await assertFails(write("alice", headerPath(`${ROOM}-3`), good));
  });

  it("is never readable or listable", async () => {
    await assertSucceeds(write("alice", headerPath(key), header(roomGame())));
    await assertFails(dbAs(env, "alice").ref(headerPath(key)).get());
    await assertFails(dbAs(env, "alice").ref(FINISHED_GAMES).get());
    await assertFails(dbAs(env, "alice").ref("finished").get());
  });
});

describe("finished/games (solo games)", () => {
  it("takes a key starting with the writer's own uid", async () => {
    await assertSucceeds(write("alice", headerPath(gameKey("alice", "k2x9-1")), header(soloGame())));
  });

  it("refuses another guest's key, a room on a solo game, and daily (the server records those)", async () => {
    await assertFails(write("mallory", headerPath(gameKey("alice", "k2x9-2")), header(soloGame())));
    await assertFails(write("alice", headerPath(gameKey("alice", "k2x9-3")), { ...header(soloGame()), room: ROOM }));
    await assertFails(write("alice", headerPath(gameKey("alice", "daily-regions-2026-11-09")), { ...header(soloGame()), mode: "daily" }));
  });
});

describe("finished/players", () => {
  const key = gameKey(ROOM, "3");

  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
    await write("alice", headerPath(key), header(roomGame()));
  });

  it("lets each seated finisher add their own entry once, after the header", async () => {
    await assertSucceeds(write("alice", entryPath(key, "alice"), entry(key, "alice")));
    await assertSucceeds(write("bob", entryPath(key, "bob"), entry(key, "bob", "direct")));
    await assertFails(write("bob", entryPath(key, "bob"), entry(key, "bob", "instagram")));
    await assertFails(dbAs(env, "bob").ref(entryPath(key, "bob")).remove());
  });

  it("refuses someone else's entry, a guest not seated there, or a game with no header", async () => {
    await assertFails(write("alice", entryPath(key, "bob"), entry(key, "bob")));
    await assertFails(write("alice", entryPath(key, "alice"), { ...entry(key, "alice"), uid: "bob" }));
    await assertFails(write("mallory", entryPath(key, "mallory"), entry(key, "mallory")));
    const missing = gameKey(ROOM, "4");
    await assertFails(write("alice", entryPath(missing, "alice"), entry(missing, "alice")));
  });

  it("solo: only the game's own guest", async () => {
    const solo = gameKey("alice", "k2x9-1");
    await write("alice", headerPath(solo), header(soloGame()));
    await assertSucceeds(write("alice", entryPath(solo, "alice"), entry(solo, "alice")));
    await assertFails(write("mallory", entryPath(solo, "mallory"), entry(solo, "mallory")));
  });

  it("refuses bad shapes", async () => {
    const good = entry(key, "alice");
    for (const bad of [
      { ...good, src: "TikTok" },
      { ...good, cmp: "x".repeat(41) },
      { ...good, at: Date.now() - 5 * 60_000 },
      { ...good, extra: 1 },
      { game: key, uid: "alice", at: TS },
    ]) {
      await assertFails(write("alice", entryPath(key, "alice"), bad));
    }
  });

  it("is never readable", async () => {
    await assertSucceeds(write("alice", entryPath(key, "alice"), entry(key, "alice")));
    await assertFails(dbAs(env, "alice").ref(entryPath(key, "alice")).get());
    await assertFails(dbAs(env, "alice").ref(FINISHED_PLAYERS).get());
  });

  it("a header still counts when seeded by the server (daily)", async () => {
    await seed(env, { [headerPath("alice_daily-regions-2026-11-09")]: { slug: "regions", mode: "daily", players: 1, lang: "en", at: Date.now() } });
    await assertFails(write("alice", headerPath("alice_daily-regions-2026-11-09"), header(soloGame())));
  });
});
