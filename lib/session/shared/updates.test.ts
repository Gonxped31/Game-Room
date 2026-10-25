import { describe, expect, it } from "vitest";
import {
  claimSeatUpdate,
  createRoomUpdate,
  leaveRoomUpdate,
  nameKey,
  nextActiveMinutes,
  queueEntryUpdate,
  queueRemoveUpdate,
  type RoomMeta,
  roomNameUpdate,
  swapSeatsUpdate,
  switchSeatUpdate,
  takeOverSeatUpdate,
  visitDay,
  visitUpdate,
} from "./updates";

const TS = "<ts>";
const meta: RoomMeta = { gameSlug: "ftw", maxPlayers: 2, createdAt: 1, createdBy: "alice" };

describe("nameKey", () => {
  it("lowercases, trims and turns spaces into dashes", () => {
    expect(nameKey("  Birthday Crew ")).toBe("birthday-crew");
    expect(nameKey("Game   Night")).toBe("game-night");
  });

  it("drops anything that isn't a-z, 0-9 or -", () => {
    expect(nameKey("Sam's Room #2!")).toBe("sams-room-2");
    expect(nameKey("Café")).toBe("caf");
  });

  it("is null when the result is under 3 or over 40 characters", () => {
    expect(nameKey("ab")).toBeNull();
    expect(nameKey("!!!")).toBeNull();
    expect(nameKey("a".repeat(41))).toBeNull();
    expect(nameKey("a".repeat(40))).toBe("a".repeat(40));
  });
});

describe("createRoomUpdate", () => {
  it("writes meta, the initial game state and the creator's room entry - and seats nobody", () => {
    const update = createRoomUpdate({ code: "abc234", uid: "alice", gameSlug: "ftw", maxPlayers: 2, initialState: { round: 1 }, ts: TS });
    expect(update).toEqual({
      "games/abc234/meta": { gameSlug: "ftw", maxPlayers: 2, createdAt: TS, createdBy: "alice" },
      "games/abc234/ftw": { round: 1 },
      "users/alice/rooms/abc234": { gameSlug: "ftw", addedAt: TS, createdByMe: true },
    });
    expect(Object.keys(update).some((k) => k.includes("seats") || k.includes("members"))).toBe(false);
  });
});

describe("claimSeatUpdate", () => {
  it("writes the seat and its members entry together, plus the name and room entry", () => {
    expect(claimSeatUpdate({ code: "abc234", seat: "p2", uid: "bob", name: "Bob", meta, ts: TS })).toEqual({
      "games/abc234/seats/p2": "bob",
      "games/abc234/members/bob": "p2",
      "games/abc234/players/p2": { name: "Bob" },
      "users/bob/rooms/abc234": { gameSlug: "ftw", addedAt: TS },
    });
  });

  it("marks the creator's own entry, and carries the room name", () => {
    const update = claimSeatUpdate({ code: "abc234", seat: "p1", uid: "alice", name: "Alice", meta: { ...meta, name: "Crew", nameKey: "crew" }, ts: TS });
    expect(update["users/alice/rooms/abc234"]).toEqual({ gameSlug: "ftw", addedAt: TS, createdByMe: true, name: "Crew" });
  });
});

describe("switchSeatUpdate", () => {
  it("vacates the old seat and repoints members in one update", () => {
    expect(switchSeatUpdate({ code: "abc234", uid: "alice", from: "p1", to: "p2", name: "Leo" })).toEqual({
      "games/abc234/seats/p1": null,
      "games/abc234/seats/p2": "alice",
      "games/abc234/members/alice": "p2",
      "games/abc234/players/p2": { name: "Leo" },
    });
  });
});

describe("swapSeatsUpdate", () => {
  it("trades both seats and both members entries, leaving names with their seats", () => {
    expect(swapSeatsUpdate({ code: "abc234", a: { uid: "alice", seat: "p1" }, b: { uid: "bob", seat: "p2" } })).toEqual({
      "games/abc234/seats/p1": "bob",
      "games/abc234/seats/p2": "alice",
      "games/abc234/members/alice": "p2",
      "games/abc234/members/bob": "p1",
    });
  });
});

describe("leaveRoomUpdate", () => {
  it("removes the seat, membership, presence and the guest's own room-list entry together", () => {
    expect(leaveRoomUpdate({ code: "abc234", uid: "alice", seat: "p1" })).toEqual({
      "games/abc234/seats/p1": null,
      "games/abc234/members/alice": null,
      "games/abc234/presence/alice": null,
      "users/alice/rooms/abc234": null,
    });
  });
});

describe("takeOverSeatUpdate", () => {
  it("removes the old holder's membership in the same update", () => {
    const update = takeOverSeatUpdate({ code: "abc234", seat: "p1", uid: "carol", oldUid: "alice", mySeat: null, name: "Alice", meta, ts: TS });
    expect(update).toMatchObject({
      "games/abc234/seats/p1": "carol",
      "games/abc234/members/carol": "p1",
      "games/abc234/members/alice": null,
      "games/abc234/players/p1": { name: "Alice" },
    });
    expect("games/abc234/seats/p2" in update).toBe(false);
  });

  it("vacates a seat the taker already held", () => {
    const update = takeOverSeatUpdate({ code: "abc234", seat: "p1", uid: "bob", oldUid: "alice", mySeat: "p2", name: "Bob", meta, ts: TS });
    expect(update["games/abc234/seats/p2"]).toBeNull();
  });
});

describe("roomNameUpdate", () => {
  it("names an unnamed room, claiming the index entry", () => {
    expect(roomNameUpdate({ code: "abc234", name: "Crew", key: "crew", previousKey: undefined })).toEqual({
      "games/abc234/meta/name": "Crew",
      "games/abc234/meta/nameKey": "crew",
      "roomsByName/crew": "abc234",
    });
  });

  it("renames, moving the index entry", () => {
    expect(roomNameUpdate({ code: "abc234", name: "New Crew", key: "new-crew", previousKey: "crew" })).toEqual({
      "games/abc234/meta/name": "New Crew",
      "games/abc234/meta/nameKey": "new-crew",
      "roomsByName/crew": null,
      "roomsByName/new-crew": "abc234",
    });
  });

  it("only changes the display name when the key stays the same", () => {
    expect(roomNameUpdate({ code: "abc234", name: "CREW", key: "crew", previousKey: "crew" })).toEqual({
      "games/abc234/meta/name": "CREW",
      "games/abc234/meta/nameKey": "crew",
    });
  });

  it("clears the name and frees the index entry", () => {
    expect(roomNameUpdate({ code: "abc234", name: null, key: null, previousKey: "crew" })).toEqual({
      "games/abc234/meta/name": null,
      "games/abc234/meta/nameKey": null,
      "roomsByName/crew": null,
    });
  });
});

describe("public rooms (matchmaking)", () => {
  it("createRoomUpdate with publicLang marks the room public and lists it, empty, in that language's queue", () => {
    const update = createRoomUpdate({ code: "abc234", uid: "alice", gameSlug: "buzzerquiz", maxPlayers: 4, initialState: { phase: "lobby" }, ts: TS, publicLang: "fr" });
    expect(update["games/abc234/meta"]).toEqual({ gameSlug: "buzzerquiz", maxPlayers: 4, createdAt: TS, createdBy: "alice", publicLang: "fr" });
    expect(update["queue/buzzerquiz/fr/abc234"]).toEqual({ players: 0, updatedAt: TS });
  });

  it("queueEntryUpdate and queueRemoveUpdate write one queue entry", () => {
    expect(queueEntryUpdate({ code: "abc234", gameSlug: "wordscramble", lang: "en", players: 3, ts: TS })).toEqual({ "queue/wordscramble/en/abc234": { players: 3, updatedAt: TS } });
    expect(queueRemoveUpdate({ code: "abc234", gameSlug: "wordscramble", lang: "en" })).toEqual({ "queue/wordscramble/en/abc234": null });
  });
});

describe("nextActiveMinutes", () => {
  it("counts the first minute, then one more once the last count is 55 s old", () => {
    expect(nextActiveMinutes(null, 1_000_000, TS)).toEqual({ n: 1, at: TS });
    expect(nextActiveMinutes({ n: 4, at: 1_000_000 }, 1_055_000, TS)).toEqual({ n: 5, at: TS });
  });

  it("writes nothing while another device's count for this minute is fresh", () => {
    expect(nextActiveMinutes({ n: 4, at: 1_000_000 }, 1_054_999, TS)).toBeUndefined();
  });
});

describe("visitDay and visitUpdate", () => {
  it("keys a visit by its UTC day", () => {
    expect(visitDay(Date.UTC(2026, 9, 25, 23, 59))).toBe("20261025");
    expect(visitDay(Date.UTC(2026, 0, 2, 0, 0))).toBe("20260102");
    expect(visitUpdate({ uid: "alice", code: "abc234", gameSlug: "ftw", day: "20261025", ts: TS })).toEqual({
      "users/alice/visits/20261025/abc234": { gameSlug: "ftw", at: TS },
    });
  });
});
