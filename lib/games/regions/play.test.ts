import { describe, expect, it } from "vitest";
import type { Puzzle } from "./board";
import { clearAll, EMPTY, MARK, newPlay, nextMark, PIECE, replay, ruledOut, setMark, status, undo } from "./play";

// 4x4, regions are the rows: only rows, columns and regions constrain a rook.
const puzzle: Puzzle = {
  size: 4,
  variant: "rook",
  regions: [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3],
  pieces: ["rook", "rook", "rook", "rook"],
};

describe("play", () => {
  it("a tap cycles empty, ✕, piece, empty", () => {
    expect(nextMark(EMPTY)).toBe(MARK);
    expect(nextMark(MARK)).toBe(PIECE);
    expect(nextMark(PIECE)).toBe(EMPTY);
  });

  it("logs every change and solves on the last piece", () => {
    let play = newPlay(puzzle);
    [0, 5, 10, 15].forEach((cell, i) => (play = setMark(play, cell, PIECE, i * 1000)));
    expect(status(play).solved).toBe(true);
    expect(play.moves.map((m) => m.cell)).toEqual([0, 5, 10, 15]);
    expect(() => setMark(play, 1, MARK, 5000)).toThrow("Already solved");
    expect(() => undo(play)).toThrow("Already solved");
  });

  it("setting a cell to what it is changes nothing and logs nothing", () => {
    const play = setMark(newPlay(puzzle), 3, MARK, 0);
    expect(setMark(play, 3, MARK, 10)).toBe(play);
    expect(() => setMark(play, 16, MARK, 10)).toThrow();
  });

  it("undo restores the cell's previous mark", () => {
    let play = setMark(newPlay(puzzle), 2, MARK, 0);
    play = setMark(play, 2, PIECE, 10);
    play = undo(play);
    expect(play.marks[2]).toBe(MARK);
    expect(play.moves).toHaveLength(1);
    expect(() => undo(undo(play))).toThrow("Nothing to undo");
  });

  it("clear empties every cell as logged moves", () => {
    let play = setMark(newPlay(puzzle), 2, MARK, 0);
    play = setMark(play, 7, PIECE, 10);
    play = clearAll(play, 20);
    expect(play.marks.every((m) => m === EMPTY)).toBe(true);
    expect(play.moves).toHaveLength(4);
  });

  it("replay rebuilds the same game, and refuses impossible logs", () => {
    let play = setMark(newPlay(puzzle), 1, PIECE, 0);
    play = setMark(play, 6, MARK, 50);
    expect(replay(puzzle, play.moves)).toEqual(play);
    expect(() => replay(puzzle, [{ cell: 1, to: PIECE, t: 10 }, { cell: 2, to: PIECE, t: 5 }])).toThrow("out of order");
    expect(() => replay(puzzle, [{ cell: 1, to: EMPTY, t: 0 }])).toThrow("changes nothing");
    expect(() => replay(puzzle, [{ cell: 1, to: 7 as never, t: 0 }])).toThrow("Bad mark");
  });

  it("ruledOut covers a piece's row, column and region", () => {
    const play = setMark(newPlay(puzzle), 5, PIECE, 0);
    expect([...ruledOut(play)].sort((a, b) => a - b)).toEqual([1, 4, 6, 7, 9, 13]);
  });
});
