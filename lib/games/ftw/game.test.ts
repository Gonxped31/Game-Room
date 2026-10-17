import { describe, expect, it } from "vitest";
import { setIdentityName as setName } from "@/lib/session/identity";
import { pruneLikeFirebase, undefinedPaths } from "@/lib/store/firebaseShape";
import { addUsedPrompt, guesserOf, lockIn, makeRound, masterOf, newGame, nextRound, setPlaced, setPrompt, submitGuess } from "./game";

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

  it("seeds usedPrompts with the first round's prompt", () => {
    const game = freshGame();
    expect(game.usedPrompts).toEqual(["Pizza toppings"]);
  });

  it("starts with no names set", () => {
    const game = freshGame();
    expect(game.names).toEqual({});
  });

  it("starts with empty history", () => {
    const game = freshGame();
    expect(game.history).toEqual([]);
  });
});

describe("setName", () => {
  it("sets a player's name, trimmed", () => {
    const game = setName(freshGame(), "p1", "  Sam  ");
    expect(game.names.p1).toBe("Sam");
  });

  it("does not touch the other player's name", () => {
    const game = setName(setName(freshGame(), "p1", "Sam"), "p2", "Alex");
    expect(game.names).toEqual({ p1: "Sam", p2: "Alex" });
  });

  it("rejects an empty (or whitespace-only) name", () => {
    expect(() => setName(freshGame(), "p1", "   ")).toThrow();
  });

  it("is valid regardless of round status", () => {
    const game = freshGame();
    const order = game.current.items.map((i) => i.id);
    const revealed = submitGuess(lockIn(game, order), order);
    expect(() => setName(revealed, "p1", "Sam")).not.toThrow();
  });

  it("survives a round transition", () => {
    const game = setName(setName(freshGame(), "p1", "Sam"), "p2", "Alex");
    const order = game.current.items.map((i) => i.id);
    const revealed = submitGuess(lockIn(game, order), order);
    const round2 = nextRound(revealed, makeRound("Vacation spots", ["Beach", "Mountains", "Big city", "Countryside", "Cruise"]));
    expect(round2.names).toEqual({ p1: "Sam", p2: "Alex" });
  });
});

describe("addUsedPrompt", () => {
  it("appends a prompt not seen before", () => {
    expect(addUsedPrompt(["A"], "B")).toEqual(["A", "B"]);
  });

  it("does not duplicate a prompt already seen", () => {
    expect(addUsedPrompt(["A", "B"], "B")).toEqual(["A", "B"]);
  });

  it("treats a missing list as empty", () => {
    expect(addUsedPrompt(undefined, "A")).toEqual(["A"]);
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

  it("appends a record to history", () => {
    const game = freshGame();
    const order = game.current.items.map((i) => i.id);
    const revealed = submitGuess(lockIn(game, order), order);
    expect(revealed.history).toEqual([{ round: 1, prompt: "Pizza toppings", score: 5, master: "p1" }]);
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
    expect(swapped.usedPrompts).toEqual(["Pizza toppings", "Vacation spots"]);
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
    expect(round2.usedPrompts).toEqual(["Pizza toppings", "Vacation spots"]);
    expect(round2.history).toEqual([{ round: 1, prompt: "Pizza toppings", score: 5, master: "p1" }]);
  });

  it("accumulates one history record per completed round", () => {
    const game = freshGame();
    const order1 = game.current.items.map((i) => i.id);
    const revealed1 = submitGuess(lockIn(game, order1), order1);
    const round2 = nextRound(revealed1, makeRound("Vacation spots", ["Beach", "Mountains", "Big city", "Countryside", "Cruise"]));
    const order2 = [...round2.current.items.map((i) => i.id)].reverse(); // fully reversed -> score 1
    const revealed2 = submitGuess(lockIn(round2, round2.current.items.map((i) => i.id)), order2);
    expect(revealed2.history).toEqual([
      { round: 1, prompt: "Pizza toppings", score: 5, master: "p1" },
      { round: 2, prompt: "Vacation spots", score: 1, master: "p2" },
    ]);
  });

  it("rejects advancing before the round is REVEALED", () => {
    const game = freshGame();
    expect(() => nextRound(game, makeRound("X", ["A", "B", "C", "D", "E"]))).toThrow();
  });
});

describe("writes Firebase accepts", () => {
  // Each transition gets the state as Firebase hands it back (empty objects
  // and arrays dropped, so `names` reads back missing). A result with an
  // explicit `undefined` makes the real write throw, and the move silently
  // does nothing - local mode and JSON round-trips hide this.
  const asStored = <T,>(state: T): T => pruneLikeFirebase(state) as T;

  it("never produces an explicit undefined across a full game", () => {
    let game = asStored(freshGame());
    const steps: [string, (g: typeof game) => typeof game][] = [
      ["setPrompt", (g) => setPrompt(g, makeRound("Pizza crusts", LABELS))],
      ["setPlaced (ranking)", (g) => setPlaced(g, "RANKING", g.current.items.slice(0, 2).map((i) => i.id))],
      ["setPlaced (cleared)", (g) => setPlaced(g, "RANKING", [])],
      ["lockIn", (g) => lockIn(g, g.current.items.map((i) => i.id))],
      ["setPlaced (guessing)", (g) => setPlaced(g, "GUESSING", g.current.items.slice(0, 3).map((i) => i.id))],
      ["submitGuess", (g) => submitGuess(g, [...g.current.items.map((i) => i.id)].reverse())],
      ["nextRound", (g) => nextRound(g, makeRound("Breakfasts", LABELS))],
      ["lockIn (round 2)", (g) => lockIn(g, g.current.items.map((i) => i.id))],
    ];
    for (const [name, step] of steps) {
      const next = step(game);
      expect({ step: name, undefinedAt: undefinedPaths(next) }).toEqual({ step: name, undefinedAt: [] });
      game = asStored(next);
    }
  });
});

describe("setPlaced (live placement progress)", () => {
  it("records which slots are filled, as item IDs only", () => {
    const game = freshGame();
    const [a, b] = game.current.items.map((i) => i.id);
    const next = setPlaced(game, "RANKING", [a, b]);
    expect(next.current.placed).toEqual([a, b]);
    expect(next.current.status).toBe("RANKING");
  });

  it("drops the field entirely (no empty array, no undefined) when nothing is placed", () => {
    const game = freshGame();
    const [a] = game.current.items.map((i) => i.id);
    const cleared = setPlaced(setPlaced(game, "RANKING", [a]), "RANKING", []);
    expect("placed" in cleared.current).toBe(false);
  });

  it("refuses a placement from a phase that has already ended", () => {
    const game = freshGame();
    const ids = game.current.items.map((i) => i.id);
    const guessing = lockIn(game, ids);
    expect(() => setPlaced(guessing, "RANKING", [ids[0]])).toThrow();
    expect(setPlaced(guessing, "GUESSING", [ids[0]]).current.placed).toEqual([ids[0]]);
  });

  it("refuses unknown, duplicate or too many IDs", () => {
    const game = freshGame();
    const ids = game.current.items.map((i) => i.id);
    expect(() => setPlaced(game, "RANKING", ["nope"])).toThrow();
    expect(() => setPlaced(game, "RANKING", [ids[0], ids[0]])).toThrow();
    expect(() => setPlaced(game, "RANKING", [...ids, "extra"])).toThrow();
  });

  it("is cleared when the master locks in and when the guess is submitted", () => {
    const game = freshGame();
    const ids = game.current.items.map((i) => i.id);
    const guessing = lockIn(setPlaced(game, "RANKING", ids), ids);
    expect("placed" in guessing.current).toBe(false);
    const revealed = submitGuess(setPlaced(guessing, "GUESSING", ids), ids);
    expect("placed" in revealed.current).toBe(false);
  });
});
