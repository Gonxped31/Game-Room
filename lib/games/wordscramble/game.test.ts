import { describe, expect, it } from "vitest";
import { RESULT_MS, SCOREBOARD_MS, START_LEAD_MS, TURN_MS } from "./constants";
import {
  advance,
  afterResult,
  canHint,
  dueAt,
  guess,
  hint,
  isOver,
  newGame,
  nextTurn,
  normalize,
  pickTeam,
  pickWord,
  plain,
  playingTeam,
  scramble,
  type ScrambleState,
  setLang,
  setMode,
  setTarget,
  setTurnsPerTeam,
  shuffle,
  start,
  timeUp,
  toLobby,
  type Word,
  winner,
  worth,
} from "./game";

const T0 = 1_000_000;
const SEATED = ["p1", "p2", "p3", "p4"];
const next = (n: number) => ({ wordId: `w${n}`, seed: n });

function lobby(): ScrambleState {
  let g = newGame("en");
  g = pickTeam(g, "p1", "A");
  g = pickTeam(g, "p2", "B");
  g = pickTeam(g, "p3", "A");
  return pickTeam(g, "p4", "B");
}

/** A game whose first turn (Team A) has started. */
function playing(settings?: (g: ScrambleState) => ScrambleState): { game: ScrambleState; at: number } {
  const g = start((settings ?? ((x) => x))(lobby()), { seated: SEATED, next: next(0), now: T0 });
  return { game: g, at: T0 + START_LEAD_MS };
}

describe("lobby", () => {
  it("starts with 5 turns per team, in the chosen language", () => {
    expect(newGame("fr")).toMatchObject({ phase: "lobby", settings: { lang: "fr", mode: "turns", turnsPerTeam: 5, target: 30 }, scores: { A: 0, B: 0 } });
  });

  it("changes the settings, within range", () => {
    expect(setLang(lobby(), "fr").settings.lang).toBe("fr");
    expect(setMode(lobby(), "target").settings.mode).toBe("target");
    expect(setTurnsPerTeam(lobby(), 3).settings.turnsPerTeam).toBe(3);
    expect(setTarget(lobby(), 40).settings.target).toBe(40);
    expect(() => setTurnsPerTeam(lobby(), 2)).toThrow();
    expect(() => setTurnsPerTeam(lobby(), 11)).toThrow();
    expect(() => setTarget(lobby(), 25)).toThrow();
  });

  it("lets players pick and switch teams", () => {
    expect(pickTeam(lobby(), "p3", "B").teams).toEqual({ p1: "A", p2: "B", p3: "B", p4: "B" });
  });

  it("shuffles the seated players into even teams", () => {
    const g = shuffle(lobby(), SEATED, Math.random);
    expect(Object.values(g.teams).filter((t) => t === "A")).toHaveLength(2);
  });

  it("locks settings and teams once the game has started", () => {
    const { game } = playing();
    expect(() => setLang(game, "fr")).toThrow();
    expect(() => pickTeam(game, "p1", "B")).toThrow();
    expect(() => shuffle(game, SEATED, Math.random)).toThrow();
  });
});

describe("start", () => {
  it("starts Team A's first turn after a short lead", () => {
    const { game } = playing();
    expect(game).toMatchObject({ phase: "turn", turn: 0, wordId: "w0", hints: 0, startAt: T0 + START_LEAD_MS, deadline: T0 + START_LEAD_MS + TURN_MS, usedWordIds: ["w0"] });
  });

  it("needs even teams, and a team for everyone seated", () => {
    const uneven = pickTeam(lobby(), "p4", "A");
    expect(() => start(uneven, { seated: SEATED, next: next(0), now: T0 })).toThrow();
    expect(() => start(lobby(), { seated: [...SEATED, "p5"], next: next(0), now: T0 })).toThrow();
    expect(() => start(newGame("en"), { seated: [], next: next(0), now: T0 })).toThrow();
  });

  it("drops the teams of players who have left", () => {
    const g = start(lobby(), { seated: ["p1", "p2"], next: next(0), now: T0 });
    expect(g.teams).toEqual({ p1: "A", p2: "B" });
  });
});

describe("guess", () => {
  it("a right guess scores the word's length and ends the turn", () => {
    const { game, at } = playing();
    const g = guess(game, "p3", "tiger", "TIGER", at + 14_000);
    expect(g).toMatchObject({ phase: "result", found: { seat: "p3", ms: 14_000 }, scores: { A: 5, B: 0 }, deadline: at + 14_000 + RESULT_MS });
    expect(g.history).toEqual([{ team: "A", wordId: "w0", points: 5 }]);
  });

  it("compares without accents or case", () => {
    const { game, at } = playing();
    expect(guess(game, "p1", "  tigre ", "TIGRÉ", at).phase).toBe("result");
    expect(guess(game, "p1", "élève", "ELEVE", at).phase).toBe("result");
  });

  it("a wrong guess costs nothing and goes to the feed", () => {
    const { game, at } = playing();
    const g = guess(game, "p1", "tirge", "TIGER", at + 1000);
    expect(g.phase).toBe("turn");
    expect(g.guesses).toEqual([{ seat: "p1", text: "TIRGE" }]);
    expect(g.scores).toEqual({ A: 0, B: 0 });
  });

  it("only the playing team guesses, only once the word is up", () => {
    const { game, at } = playing();
    expect(() => guess(game, "p2", "tiger", "TIGER", at)).toThrow();
    expect(() => guess(game, "p9", "tiger", "TIGER", at)).toThrow();
    expect(() => guess(game, "p1", "tiger", "TIGER", at - 1)).toThrow();
    expect(() => guess(lobby(), "p1", "tiger", "TIGER", at)).toThrow();
  });

  it("refuses empty or overlong guesses, and caps the feed", () => {
    const { game, at } = playing();
    expect(() => guess(game, "p1", "123", "TIGER", at)).toThrow();
    expect(() => guess(game, "p1", "abcdefghijklm", "TIGER", at)).toThrow();
    let g = game;
    for (let i = 0; i < 30; i++) g = guess(g, "p1", "nope", "TIGER", at);
    expect(() => guess(g, "p1", "nope", "TIGER", at)).toThrow();
    expect(guess(g, "p1", "tiger", "TIGER", at).phase).toBe("result"); // the right answer still counts
  });
});

describe("hint", () => {
  it("each hint takes a point off", () => {
    const { game, at } = playing();
    const g = hint(hint(game, "p1", "TIGER", at), "p3", "TIGER", at);
    expect(g.hints).toBe(2);
    expect(guess(g, "p1", "tiger", "TIGER", at).scores.A).toBe(3);
  });

  it("is refused when it would leave fewer than 2 letters to find", () => {
    const { game, at } = playing();
    let g = game;
    for (let i = 0; i < 3; i++) g = hint(g, "p1", "TIGER", at);
    expect(() => hint(g, "p1", "TIGER", at)).toThrow();
    expect(canHint("TIGER", 3)).toBe(false);
    expect(worth("TIGER", 3)).toBe(2);
  });

  it("only for the playing team", () => {
    const { game, at } = playing();
    expect(() => hint(game, "p2", "TIGER", at)).toThrow();
  });
});

describe("timeUp, scoreboard and the next turn", () => {
  it("time's up scores nothing", () => {
    const { game, at } = playing();
    expect(() => timeUp(game, at + TURN_MS - 1)).toThrow();
    const g = timeUp(game, at + TURN_MS);
    expect(g).toMatchObject({ phase: "result", scores: { A: 0, B: 0 } });
    expect(g.history).toEqual([{ team: "A", wordId: "w0", points: 0 }]);
  });

  it("goes result -> scoreboard -> Team B's turn with a new word", () => {
    const { game, at } = playing();
    let t = at + 5000;
    let g = guess(game, "p1", "tiger", "TIGER", t);
    t += RESULT_MS;
    g = afterResult(g, t);
    expect(g).toMatchObject({ phase: "scoreboard", deadline: t + SCOREBOARD_MS });
    t += SCOREBOARD_MS;
    g = nextTurn(g, next(1), t);
    expect(g).toMatchObject({ phase: "turn", turn: 1, wordId: "w1", hints: 0, guesses: [], startAt: t, usedWordIds: ["w0", "w1"] });
    expect(g.found).toBeUndefined();
    expect(playingTeam(g.turn)).toBe("B");
    expect(() => guess(g, "p1", "x", "WORD", t)).toThrow();
  });

  it("each timed step is a no-op before its deadline, or once applied", () => {
    const { game, at } = playing();
    const g = timeUp(game, at + TURN_MS);
    expect(() => timeUp(g, at + TURN_MS + 10)).toThrow();
    expect(() => afterResult(g, at + TURN_MS + RESULT_MS - 1)).toThrow();
  });
});

describe("the end", () => {
  function playAll(turnsPerTeam: number, scoreFor: (turn: number) => boolean) {
    let { game: g, at: t } = playing((x) => setTurnsPerTeam(x, turnsPerTeam));
    for (let turn = 0; turn < turnsPerTeam * 2; turn++) {
      const seat = playingTeam(turn) === "A" ? "p1" : "p2";
      g = scoreFor(turn) ? guess(g, seat, "tiger", "TIGER", t) : timeUp(g, (t = g.deadline!));
      t += RESULT_MS;
      g = afterResult(g, t);
      if (g.phase === "end") break;
      t += SCOREBOARD_MS;
      g = nextTurn(g, next(turn + 1), t);
    }
    return g;
  }

  it("ends after every team has played its turns", () => {
    const g = playAll(3, (turn) => turn % 2 === 0);
    expect(g).toMatchObject({ phase: "end", turn: 5, scores: { A: 15, B: 0 } });
    expect(g.deadline).toBeUndefined();
    expect(winner(g)).toBe("A");
  });

  it("a tie is a draw", () => {
    expect(winner(playAll(3, () => true))).toBe("draw");
  });

  it("in target mode, ends after a pair of turns once a team reaches the target", () => {
    const settings = { mode: "target" as const, turnsPerTeam: 5, target: 20, lang: "en" as const };
    expect(isOver({ settings, scores: { A: 20, B: 0 } }, 2)).toBe(false); // B still plays its turn
    expect(isOver({ settings, scores: { A: 20, B: 0 } }, 3)).toBe(true);
    expect(isOver({ settings, scores: { A: 10, B: 5 } }, 3)).toBe(false);
  });

  it("Rematch keeps the teams and settings, scores back to 0", () => {
    const end = playAll(3, () => true);
    const g = start(end, { seated: SEATED, next: next(9), now: T0 });
    expect(g).toMatchObject({ phase: "turn", turn: 0, scores: { A: 0, B: 0 }, history: [], usedWordIds: ["w9"], teams: lobby().teams });
    expect(g.settings.turnsPerTeam).toBe(3);
  });

  it("goes back to the lobby, keeping teams", () => {
    const g = toLobby(playAll(3, () => false));
    expect(g).toMatchObject({ phase: "lobby", turn: 0, teams: lobby().teams });
  });
});

describe("advance", () => {
  it("applies the timed step of the current phase", () => {
    const { game, at } = playing();
    expect(dueAt(game)).toBe(at + TURN_MS);
    const g = advance(advance(game, at + TURN_MS, next(1)), at + TURN_MS + RESULT_MS, next(1));
    expect(g.phase).toBe("scoreboard");
    expect(advance(g, g.deadline!, next(1)).wordId).toBe("w1");
    expect(dueAt(lobby())).toBeUndefined();
    expect(() => advance(lobby(), T0, next(1))).toThrow();
  });
});

describe("normalize", () => {
  it("restores what the database drops", () => {
    const stored = { phase: "lobby", settings: newGame("en").settings, turn: 0, seed: 0, hints: 0, scores: { A: 0 } } as unknown as ScrambleState;
    expect(normalize(stored)).toMatchObject({ teams: {}, guesses: [], history: [], usedWordIds: [], scores: { A: 0, B: 0 }, names: {} });
  });
});

describe("letters", () => {
  it("plain() uppercases and strips accents", () => {
    expect(plain("Élève")).toBe("ELEVE");
    expect(plain("garçon")).toBe("GARCON");
  });

  it("scrambles the same way on every device, never to the word itself", () => {
    for (let seed = 0; seed < 200; seed++) {
      const order = scramble("TIGER", seed);
      expect([...order].sort()).toEqual([..."TIGER"].sort());
      expect(order.join("")).not.toBe("TIGER");
      expect(order.filter((l, i) => l !== "TIGER"[i]).length).toBeGreaterThanOrEqual(3);
    }
    expect(scramble("TIGER", 7)).toEqual(scramble("TIGER", 7));
    expect(scramble("ÉCOLE", 1).join("")).toMatch(/^[ECOL]+$/);
  });

  it("scrambles a 4-letter word too", () => {
    for (let seed = 0; seed < 50; seed++) expect(scramble("DOOR", seed).join("")).not.toBe("DOOR");
  });
});

describe("pickWord", () => {
  const bank: Word[] = [
    { id: "a", lang: "en", word: "TIGER" },
    { id: "b", lang: "en", word: "HOUSE" },
    { id: "c", lang: "en", word: "GARDEN" },
    { id: "d", lang: "fr", word: "MAISON" },
  ];
  const settings = newGame("en").settings;

  it("draws an unused word in the room's language, varying the length", () => {
    const w = pickWord(bank, { settings, usedWordIds: ["a"], wordId: "a" }, () => 0);
    expect(w.id).toBe("c");
    expect(pickWord(bank, { settings: { ...settings, lang: "fr" }, usedWordIds: [] }, Math.random).id).toBe("d");
  });

  it("reuses words once every word has been played", () => {
    expect(pickWord(bank, { settings: { ...settings, lang: "fr" }, usedWordIds: ["d"] }, Math.random).id).toBe("d");
  });
});
