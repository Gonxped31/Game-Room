import { describe, expect, it } from "vitest";
import { applyMove, type Board, FALLBACK, findMove, generateBoard, legalMoves, mirrored, playable, solve } from "./board";

const track = (cells: string): Board => ({ w: cells.length, h: 1, cells });

/** A repeatable random source for the generator tests. */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("legalMoves", () => {
  it("slides forward into an empty square, never backward", () => {
    expect(legalMoves(track("A.B"), "A")).toEqual([{ from: 0, to: 1, jump: false }]);
    expect(legalMoves(track("A.B"), "B")).toEqual([{ from: 2, to: 1, jump: false }]);
    expect(legalMoves(track(".A"), "A")).toEqual([]);
  });

  it("jumps exactly one opposing piece into an empty square", () => {
    expect(legalMoves(track("AB."), "A")).toEqual([{ from: 0, to: 2, jump: true }]);
    expect(legalMoves(track(".AB"), "B")).toEqual([{ from: 2, to: 0, jump: true }]);
  });

  it("never jumps its own piece, two pieces, or onto a piece", () => {
    expect(legalMoves(track("AA.B"), "A")).toEqual([{ from: 1, to: 2, jump: false }]);
    expect(legalMoves(track("ABB."), "A")).toEqual([]);
    expect(legalMoves(track("ABA"), "A")).toEqual([]);
  });

  it("moves A right or down and B left or up on a grid", () => {
    const board: Board = { w: 3, h: 3, cells: "A........" };
    expect(legalMoves(board, "A").map((m) => m.to)).toEqual([1, 3]);
    const b: Board = { w: 3, h: 3, cells: "........B" };
    expect(legalMoves(b, "B").map((m) => m.to)).toEqual([7, 5]);
  });

  it("jumps on a grid, and never off its edge or around a row's end", () => {
    const board: Board = { w: 3, h: 3, cells: "A..B....." };
    expect(findMove(board, "A", 0, 6)).toEqual({ from: 0, to: 6, jump: true });
    // A at the end of row 0 can't slide into the start of row 1.
    expect(legalMoves({ w: 3, h: 2, cells: "..A..." }, "A").map((m) => m.to)).toEqual([5]);
  });
});

describe("applyMove", () => {
  it("moves the piece and leaves the board it was given alone", () => {
    const board = track("AB.");
    const after = applyMove(board, { from: 0, to: 2, jump: true });
    expect(after.cells).toBe(".BA");
    expect(board.cells).toBe("AB.");
  });
});

describe("solve", () => {
  it("knows the classic puzzle's duel: the first mover wins in 7", () => {
    expect(solve(track("AAA.BBB"), "A")).toEqual([true, 7]);
  });

  it("finds second-player wins on wider tracks", () => {
    expect(solve(track("AAA...BBB"), "A")).toEqual([false, 24]);
  });

  it("loses at once with no move", () => {
    expect(solve(track(".AB"), "A")).toEqual([false, 0]);
  });
});

describe("generateBoard", () => {
  for (const mode of ["track", "grid"] as const) {
    it(`makes playable ${mode} boards that are never their own mirror image`, () => {
      const random = seededRandom(7);
      for (let i = 0; i < 40; i++) {
        const board = generateBoard(mode, random);
        expect(board.cells).toMatch(/^[AB.]+$/);
        expect(board.cells.length).toBe(board.w * board.h);
        expect(board.cells).not.toBe(mirrored(board).cells);
        expect(legalMoves(board, "A").length).toBeGreaterThan(0);
        expect(legalMoves(board, "B").length).toBeGreaterThan(0);
        const a = [...board.cells].filter((c) => c === "A").length;
        expect([...board.cells].filter((c) => c === "B").length).toBe(a);
        if (mode === "track") {
          expect(board.h).toBe(1);
          expect(board.w).toBeGreaterThanOrEqual(8);
          expect(board.w).toBeLessThanOrEqual(11);
          // Every A starts left of every B.
          expect(board.cells.lastIndexOf("A")).toBeLessThan(board.cells.indexOf("B"));
        } else {
          expect([4, 5]).toContain(board.w);
          expect(board.h).toBe(board.w);
        }
      }
    });
  }

  it("never deals the board it's told to avoid", () => {
    const random = seededRandom(3);
    const first = generateBoard("track", random);
    for (let i = 0; i < 40; i++) expect(generateBoard("track", random, first.cells).cells).not.toBe(first.cells);
  });

  it("keeps fallback boards that pass its own checks", () => {
    expect(playable(FALLBACK.track, "track", seededRandom(1))).toBe(true);
    expect(playable(FALLBACK.grid, "grid", seededRandom(1))).toBe(true);
  });
});
