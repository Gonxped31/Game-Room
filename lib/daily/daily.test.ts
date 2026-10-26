import { describe, expect, it } from "vitest";
import { solutions } from "@/lib/games/regions/solver";
import type { Puzzle } from "@/lib/games/regions/board";
import { regionsDaily, scheduleFor } from "@/lib/games/regions/daily";
import { PIECE, type Move } from "@/lib/games/regions/play";
import { dayKey, dayNumber, msUntilNextDay, previousDay, weekdayOf } from "./day";
import { cleanName, dailyStatus, fallbackName, startDaily, submitDaily, type DailyContext, type DailyStore } from "./service";

/** A DailyStore over a Map of paths, enough for the service: children are found by path prefix. */
function memoryStore(): DailyStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const children = (path: string) =>
    [...data.entries()].filter(([key]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes("/")).map(([key, value]) => [key.slice(path.length + 1), value] as [string, unknown]);
  return {
    data,
    async get(path) {
      if (data.has(path)) return structuredClone(data.get(path)) as never;
      // A parent read assembles its children (finishedAt is claimed under the attempt).
      const kids = [...data.entries()].filter(([key]) => key.startsWith(`${path}/`));
      if (!kids.length) return null;
      const out: Record<string, unknown> = {};
      for (const [key, value] of kids) out[key.slice(path.length + 1)] = value;
      return out as never;
    },
    async set(path, value) {
      for (const key of [...data.keys()]) if (key.startsWith(`${path}/`)) data.delete(key);
      data.set(path, structuredClone(value));
    },
    async claim(path, value) {
      if (!data.has(path)) data.set(path, structuredClone(value));
      return structuredClone(data.get(path)) as never;
    },
    async lowest(path, by, limit) {
      return children(path)
        .sort(([, a], [, b]) => (a as Record<string, number>)[by] - (b as Record<string, number>)[by])
        .slice(0, limit) as never;
    },
    async countBelow(path, by, value) {
      return children(path).filter(([, row]) => (row as Record<string, number>)[by] < value).length;
    },
  };
}

// 2026-11-04 15:00 UTC is a Wednesday in Toronto (knight day).
const NOW = Date.parse("2026-11-04T15:00:00Z");

function ctxFor(store: DailyStore, uid: string, now = NOW): DailyContext {
  return { store, game: regionsDaily, seedFor: (slug, day) => `test-secret|${slug}|${day}`, uid, now };
}

/** The moves that solve a puzzle: a piece on each solution cell, `gap` ms apart (varied a little, like a hand). */
function solvingMoves(puzzle: Puzzle, gap = 900): Move[] {
  const [solution] = solutions(puzzle, 1);
  return solution.map((cell, i) => ({ cell, to: PIECE, t: Math.round((i + 1) * gap + (i % 3) * gap * 0.15) }));
}

describe("day", () => {
  it("changes at midnight in Toronto, not UTC", () => {
    expect(dayKey(Date.parse("2026-11-05T04:30:00Z"))).toBe("2026-11-04"); // 23:30 in Toronto
    expect(dayKey(Date.parse("2026-11-05T05:30:00Z"))).toBe("2026-11-05");
  });
  it("numbers, weekdays and the day before", () => {
    expect(dayNumber("2026-10-25")).toBe(1);
    expect(dayNumber("2026-11-25")).toBe(32);
    expect(weekdayOf("2026-11-02")).toBe(0); // Monday
    expect(weekdayOf("2026-11-08")).toBe(6); // Sunday
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
  });
  it("counts down to the next midnight, through the clocks changing", () => {
    const left = msUntilNextDay(NOW);
    expect(dayKey(NOW + left)).toBe("2026-11-05");
    expect(dayKey(NOW + left - 2000)).toBe("2026-11-04");
    // 2026-11-01 is 25 hours long in Toronto (clocks go back).
    const start = Date.parse("2026-11-01T04:00:00Z");
    expect(Math.round(msUntilNextDay(start) / 3_600_000)).toBe(25);
  });
});

describe("regions daily", () => {
  it("follows the weekly schedule and is the same for everyone", () => {
    expect(scheduleFor("2026-11-04").variant).toBe("knight");
    expect(regionsDaily.describe("2026-11-08")).toBe("Mix · 9×9");
    const a = regionsDaily.generate("seed", "2026-11-04");
    expect(regionsDaily.generate("seed", "2026-11-04")).toEqual(a);
    expect(a.size).toBe(7);
  });
  it("verifies solves and refuses anything else", () => {
    const puzzle = regionsDaily.generate("seed", "2026-11-04");
    const moves = solvingMoves(puzzle);
    expect(regionsDaily.verify(puzzle, moves)).toEqual({ ok: true, moveTimes: moves.map((m) => m.t) });
    expect(regionsDaily.verify(puzzle, moves.slice(1)).ok).toBe(false);
    expect(regionsDaily.verify(puzzle, "nope").ok).toBe(false);
    expect(regionsDaily.verify(puzzle, [{ cell: "1", to: 2, t: 0 }]).ok).toBe(false);
    expect(regionsDaily.verify(puzzle, [...moves, { cell: 0, to: 1, t: 99999 }]).ok).toBe(false);
  });
});

describe("daily service", () => {
  it("start hands out the day's puzzle once, with the server's start time", async () => {
    const store = memoryStore();
    const first = await startDaily(ctxFor(store, "alice"), "ip-a");
    const again = await startDaily(ctxFor(store, "alice", NOW + 60_000), "ip-a");
    expect(again.puzzle).toEqual(first.puzzle);
    expect(again.attempt).toEqual({ startedAt: NOW, ranked: true });
    expect(first.label).toBe("Knight · 7×7");
    const bob = await startDaily(ctxFor(store, "bob"), "ip-b");
    expect(bob.puzzle).toEqual(first.puzzle);
  });

  it("times the solve on the server and ranks it", async () => {
    const store = memoryStore();
    const { puzzle, day } = await startDaily(ctxFor(store, "alice"), "ip-a");
    const result = await submitDaily(ctxFor(store, "alice", NOW + 95_000), { day, moves: solvingMoves(puzzle as Puzzle), name: "  Alice   B " });
    expect(result.attempt).toMatchObject({ ms: 95_000, ranked: true, finishedAt: NOW + 95_000 });
    expect(result.board).toEqual([{ name: "Alice B", ms: 95_000, me: true }]);
    expect(result.rank).toBe(1);
    expect(result.streak).toBe(1);
    // A second submit changes nothing.
    const again = await submitDaily(ctxFor(store, "alice", NOW + 200_000), { day, moves: solvingMoves(puzzle as Puzzle), name: "x" });
    expect(again.attempt.ms).toBe(95_000);
    expect(again.board).toHaveLength(1);
  });

  it("only a connection's first attempt is ranked", async () => {
    const store = memoryStore();
    const { puzzle, day } = await startDaily(ctxFor(store, "alice"), "same-ip");
    const second = await startDaily(ctxFor(store, "alice-private-window"), "same-ip");
    expect(second.attempt.ranked).toBe(false);
    const result = await submitDaily(ctxFor(store, "alice-private-window", NOW + 50_000), { day, moves: solvingMoves(puzzle as Puzzle), name: "Again" });
    expect(result.attempt).toMatchObject({ ranked: false, unranked: "connection", ms: 50_000 });
    expect(result.board).toEqual([]);
    expect(result.rank).toBeNull();
  });

  it("keeps inhumanly fast or machine-regular solves off the board", async () => {
    const store = memoryStore();
    const { puzzle, day } = await startDaily(ctxFor(store, "fast"), "ip-1");
    const fast = await submitDaily(ctxFor(store, "fast", NOW + 1500), { day, moves: solvingMoves(puzzle as Puzzle, 100), name: "F" });
    expect(fast.attempt.unranked).toBe("too-fast");

    await startDaily(ctxFor(store, "bot"), "ip-2");
    const [solution] = solutions(puzzle as Puzzle, 1);
    const marks: Move[] = [0, 1, 2, 3, 4, 5].map((i) => ({ cell: (puzzle as Puzzle).size * (puzzle as Puzzle).size - 1 - i, to: 1, t: i * 500 }));
    const free = marks.filter((m) => !solution.includes(m.cell));
    const robotic = [...free, ...solution.map((cell, i) => ({ cell, to: PIECE, t: (free.length + i) * 500 }))].map((m, i) => ({ ...m, t: i * 500 })) as Move[];
    const bot = await submitDaily(ctxFor(store, "bot", NOW + 60_000), { day, moves: robotic, name: "B" });
    expect(bot.attempt.unranked).toBe("regular");
    expect(bot.board).toEqual([]);
  });

  it("refuses a wrong solve, a submit without start, and an old day", async () => {
    const store = memoryStore();
    const { puzzle, day } = await startDaily(ctxFor(store, "alice"), "ip-a");
    await expect(submitDaily(ctxFor(store, "alice", NOW + 9000), { day, moves: solvingMoves(puzzle as Puzzle).slice(2), name: "A" })).rejects.toMatchObject({ status: 422 });
    await expect(submitDaily(ctxFor(store, "nobody", NOW + 9000), { day, moves: [], name: "N" })).rejects.toMatchObject({ status: 409 });
    await expect(submitDaily(ctxFor(store, "alice", NOW + 3 * 86_400_000), { day, moves: solvingMoves(puzzle as Puzzle), name: "A" })).rejects.toMatchObject({ status: 409 });
  });

  it("a puzzle started before midnight can still be finished after it", async () => {
    const store = memoryStore();
    const late = Date.parse("2026-11-05T04:50:00Z"); // 23:50 in Toronto
    const { puzzle, day } = await startDaily(ctxFor(store, "owl", late), "ip-o");
    const result = await submitDaily(ctxFor(store, "owl", late + 20 * 60_000), { day, moves: solvingMoves(puzzle as Puzzle), name: "Owl" });
    expect(result.day).toBe("2026-11-04");
    expect(result.attempt.ranked).toBe(true);
  });

  it("streaks grow on consecutive days and reset after a missed one", async () => {
    const store = memoryStore();
    const play = async (now: number) => {
      const { puzzle, day } = await startDaily(ctxFor(store, "sam", now), "ip");
      return submitDaily(ctxFor(store, "sam", now + 30_000), { day, moves: solvingMoves(puzzle as Puzzle), name: "Sam" });
    };
    expect((await play(NOW)).streak).toBe(1);
    expect((await play(NOW + 86_400_000)).streak).toBe(2);
    expect((await dailyStatus(ctxFor(store, "sam", NOW + 2 * 86_400_000))).streak).toBe(2);
    expect((await dailyStatus(ctxFor(store, "sam", NOW + 3 * 86_400_000))).streak).toBe(0);
    expect((await play(NOW + 3 * 86_400_000)).streak).toBe(1);
  });

  it("status shows the board in time order with your rank", async () => {
    const store = memoryStore();
    for (const [uid, ip, secs] of [["a", "1", 80], ["b", "2", 40], ["c", "3", 120]] as const) {
      const { puzzle, day } = await startDaily(ctxFor(store, uid), ip);
      await submitDaily(ctxFor(store, uid, NOW + secs * 1000), { day, moves: solvingMoves(puzzle as Puzzle), name: uid.toUpperCase() });
    }
    const status = await dailyStatus(ctxFor(store, "a", NOW + 200_000));
    expect(status.board.map((row) => row.name)).toEqual(["B", "A", "C"]);
    expect(status.board[1].me).toBe(true);
    expect(status.rank).toBe(2);
    expect(status.players).toBe(3);
    expect(status.name).toBe("A");
    expect(status.number).toBe(11);
  });
});

describe("names", () => {
  it("cleans, caps and blocks", () => {
    expect(cleanName("  Sam\u0000  the   Great ")).toBe("Sam the Great");
    expect(cleanName("x".repeat(40))).toHaveLength(20);
    expect(cleanName("   ")).toBeNull();
    expect(cleanName(42)).toBeNull();
    expect(cleanName("F.u.c.K99")).toBeNull();
    expect(cleanName("PD")).toBeNull();
    expect(cleanName("Updike")).toBe("Updike");
    expect(fallbackName("abc")).toMatch(/^Player \d{4}$/);
  });
});
