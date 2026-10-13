import { describe, expect, it } from "vitest";
import { guesserOf, lockIn, makeRound, masterOf, newGame, nextRound, setPrompt, submitGuess } from "./game";

const LABELS = ["Pepperoni", "Mushrooms", "Pineapple", "Anchovies", "Jalapenos"];

function freshGame() {
  return newGame(makeRound("Pizza toppings", LABELS));
}

describe("masterOf / guesserOf", () => {
  it("alternates p1/p2 by round parity, and guesserOf is always the other player", () => {
    expect(masterOf(1)).toBe("p1");
    expect(masterOf(2)).toBe("p2");
    expect(masterOf(3)).toBe("p1");
    expect(guesserOf(1)).toBe("p2");
    expect(guesserOf(2)).toBe("p1");
  });
});

describe("makeRound", () => {
  it("builds exactly ITEMS_PER_ROUND items with unique, stable IDs", () => {
    const round = makeRound("Pizza toppings", LABELS);
    expect(round.items).toHaveLength(5);
    expect(round.status).toBe("RANKING");
    const ids = round.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(5);
  });

  it("rejects anything other than exactly 5 items", () => {
    expect(() => makeRound("Too few", ["A", "B"])).toThrow();
    expect(() => makeRound("Too many", ["A", "B", "C", "D", "E", "F"])).toThrow();
  });
});

describe("newGame", () => {
  it("starts at round 1 with zeroed totals and a RANKING round", () => {
    const game = freshGame();
    expect(game.round).toBe(1);
    expect(game.totals).toEqual({ p1: 0, p2: 0 });
    expect(game.current.status).toBe("RANKING");
  });
});

describe("lockIn", () => {
  it("transitions RANKING -> GUESSING and stores the master's order", () => {
    const game = freshGame();
    const order = game.current.items.map((i) => i.id);
    const next = lockIn(game, order);
    expect(next.current.status).toBe("GUESSING");
    expect(next.current.masterOrder).toEqual(order);
  });

  it("rejects locking in when not RANKING", () => {
    const game = freshGame();
    const order = game.current.items.map((i) => i.id);
    const guessing = lockIn(game, order);
    expect(() => lockIn(guessing, order)).toThrow();
  });

  it("rejects an order with the wrong length", () => {
    const game = freshGame();
    const order = game.current.items.slice(0, 4).map((i) => i.id);
    expect(() => lockIn(game, order)).toThrow();
  });

  it("rejects an order with a duplicate or foreign ID", () => {
    const game = freshGame();
    const ids = game.current.items.map((i) => i.id);
    const duplicated = [ids[0], ids[0], ids[2], ids[3], ids[4]];
    expect(() => lockIn(game, duplicated)).toThrow();
    const foreign = ["nope", ids[1], ids[2], ids[3], ids[4]];
    expect(() => lockIn(game, foreign)).toThrow();
  });
});

describe("submitGuess", () => {
  it("transitions GUESSING -> REVEALED, scores the round, and credits the guesser's total", () => {
    const game = freshGame(); // round 1: master is p1, guesser is p2
    const masterOrder = game.current.items.map((i) => i.id);
    const guessing = lockIn(game, masterOrder);
    const revealed = submitGuess(guessing, [...masterOrder]); // identical order -> score 5
    expect(revealed.current.status).toBe("REVEALED");
    expect(revealed.current.score).toBe(5);
    expect(revealed.totals.p2).toBe(5);
    expect(revealed.totals.p1).toBe(0);
  });

  it("rejects submitting a guess when not GUESSING", () => {
    const game = freshGame();
    const order = game.current.items.map((i) => i.id);
    expect(() => submitGuess(game, order)).toThrow();
  });

  it("rejects an invalid guess order", () => {
    const game = freshGame();
    const order = game.current.items.map((i) => i.id);
    const guessing = lockIn(game, order);
    expect(() => submitGuess(guessing, order.slice(0, 3))).toThrow();
  });
});

describe("setPrompt", () => {
  it("replaces the current round's prompt/items while still RANKING", () => {
    const game = freshGame();
    const swapped = setPrompt(game, makeRound("Vacation spots", ["Beach", "Mountains", "Big city", "Countryside", "Cruise"]));
    expect(swapped.current.prompt).toBe("Vacation spots");
    expect(swapped.current.status).toBe("RANKING");
    expect(swapped.round).toBe(game.round);
  });

  it("rejects changing the prompt once the master has locked in", () => {
    const game = freshGame();
    const order = game.current.items.map((i) => i.id);
    const guessing = lockIn(game, order);
    expect(() => setPrompt(guessing, makeRound("X", ["A", "B", "C", "D", "E"]))).toThrow();
  });
});

describe("nextRound", () => {
  it("advances to a fresh RANKING round, keeps totals, bumps round number", () => {
    const game = freshGame();
    const order = game.current.items.map((i) => i.id);
    const revealed = submitGuess(lockIn(game, order), order);
    const round2 = nextRound(revealed, makeRound("Vacation spots", ["Beach", "Mountains", "Big city", "Countryside", "Cruise"]));
    expect(round2.round).toBe(2);
    expect(round2.totals).toEqual(revealed.totals);
    expect(round2.current.status).toBe("RANKING");
    expect(round2.current.masterOrder).toBeUndefined();
    expect(round2.current.guessOrder).toBeUndefined();
  });

  it("rejects advancing before the round is REVEALED", () => {
    const game = freshGame();
    expect(() => nextRound(game, makeRound("X", ["A", "B", "C", "D", "E"]))).toThrow();
  });
});
