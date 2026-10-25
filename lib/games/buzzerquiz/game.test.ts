import { describe, expect, it } from "vitest";
import { ANSWER_MS, BUZZ_WINDOW_MS, COUNTDOWN_MS, DEFAULT_LENGTH, QUESTION_MS, RESULT_MS, TOPICS } from "./constants";
import {
  advance,
  answerTimeout,
  backToSetup,
  buzz,
  choiceOrder,
  choicesLeft,
  dueAt,
  newGame,
  newTopics,
  next,
  normalize,
  pick,
  pickQuestions,
  pointsFor,
  publicGame,
  type Question,
  questionTimeout,
  type QuizState,
  ranking,
  rematch,
  resolveBuzz,
  reveal,
  setLang,
  setLength,
  start,
  toggleTopic,
  toLobby,
} from "./game";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `q${i}`);

function lobby(): QuizState {
  return toLobby(setLength(toggleTopic(newGame("en"), "science"), 5));
}

function started(players = ["p1", "p2", "p3"]): QuizState {
  return start(lobby(), { players, questionIds: ids(5), seed: 7, now: T0 });
}

/** A question open for buzzing, revealed at T0 + COUNTDOWN_MS. */
function open(players?: string[]): { game: QuizState; at: number } {
  const at = T0 + COUNTDOWN_MS;
  return { game: reveal(started(players), at), at };
}

/** `seat` buzzes alone and gets the turn. */
function answering(seat = "p1"): { game: QuizState; at: number } {
  const { game, at } = open();
  const buzzed = buzz(game, seat, 400, at + 400);
  return { game: resolveBuzz(buzzed, at + 400 + BUZZ_WINDOW_MS), at: at + 400 + BUZZ_WINDOW_MS };
}

describe("setup and lobby", () => {
  it("starts in setup with no topics and 10 questions", () => {
    const game = newGame("fr");
    expect(game.phase).toBe("setup");
    expect(game.settings).toEqual({ lang: "fr", topics: [], length: 10 });
  });

  it("toggles topics, kept in the canonical order", () => {
    const game = toggleTopic(toggleTopic(toggleTopic(newGame("en"), "music"), "geography"), "music");
    expect(game.settings.topics).toEqual(["geography"]);
    expect(toggleTopic(toggleTopic(newGame("en"), "history"), "cinema").settings.topics).toEqual(["cinema", "history"]);
  });

  it("refuses an unknown topic or length", () => {
    expect(() => toggleTopic(newGame("en"), "cooking" as never)).toThrow();
    expect(() => setLength(newGame("en"), 12)).toThrow();
  });

  it("needs a topic to reach the lobby, and keeps one there", () => {
    expect(() => toLobby(newGame("en"))).toThrow();
    const game = lobby();
    expect(game.phase).toBe("lobby");
    expect(() => toggleTopic(game, "science")).toThrow();
  });

  it("goes back to setup with Edit, and changes the language", () => {
    expect(backToSetup(lobby()).phase).toBe("setup");
    expect(setLang(lobby(), "fr").settings.lang).toBe("fr");
  });

  it("locks the settings once the game has started", () => {
    expect(() => setLang(started(), "fr")).toThrow();
    expect(() => toggleTopic(started(), "music")).toThrow();
  });
});

describe("start", () => {
  it("starts the countdown with every player at 0", () => {
    const game = started();
    expect(game.phase).toBe("countdown");
    expect(game.deadline).toBe(T0 + COUNTDOWN_MS);
    expect(game.scores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it("needs 2 to 4 distinct players and the right number of questions", () => {
    expect(() => start(lobby(), { players: ["p1"], questionIds: ids(5), seed: 1, now: T0 })).toThrow();
    expect(() => start(lobby(), { players: ["p1", "p2", "p3", "p4", "p5"], questionIds: ids(5), seed: 1, now: T0 })).toThrow();
    expect(() => start(lobby(), { players: ["p1", "p1"], questionIds: ids(5), seed: 1, now: T0 })).toThrow();
    expect(() => start(lobby(), { players: ["p1", "p2"], questionIds: ids(4), seed: 1, now: T0 })).toThrow();
  });

  it("only starts from the lobby", () => {
    expect(() => start(newGame("en"), { players: ["p1", "p2"], questionIds: ids(10), seed: 1, now: T0 })).toThrow();
  });
});

describe("reveal", () => {
  it("opens the question at the countdown's end", () => {
    const { game, at } = open();
    expect(game.phase).toBe("question");
    expect(game.openedAt).toBe(at);
    expect(game.questionEnd).toBe(at + QUESTION_MS);
    expect(game.deadline).toBeUndefined();
  });

  it("is a no-op before the countdown ends, or once already revealed", () => {
    expect(() => reveal(started(), T0 + COUNTDOWN_MS - 1)).toThrow();
    const { game, at } = open();
    expect(() => reveal(game, at + 10)).toThrow();
  });
});

describe("buzz and resolveBuzz", () => {
  it("the first buzz opens the window and pauses the question timer", () => {
    const { game, at } = open();
    const buzzed = buzz(game, "p2", 900, at + 900);
    expect(buzzed.phase).toBe("buzzing");
    expect(buzzed.deadline).toBe(at + 900 + BUZZ_WINDOW_MS);
    expect(buzzed.timeLeft).toBe(QUESTION_MS - 900);
    expect(buzzed.questionEnd).toBeUndefined();
  });

  it("the fastest reaction in the window wins, not the first to arrive", () => {
    const { game, at } = open();
    let g = buzz(game, "p2", 900, at + 950);
    g = buzz(g, "p3", 700, at + 1100); // slower connection, faster thumb
    g = resolveBuzz(g, at + 950 + BUZZ_WINDOW_MS);
    expect(g.phase).toBe("answering");
    expect(g.buzzer).toBe("p3");
    expect(g.deadline).toBe(at + 950 + BUZZ_WINDOW_MS + ANSWER_MS);
  });

  it("a tie goes to the lower seat", () => {
    const { game, at } = open();
    const g = buzz(buzz(game, "p3", 500, at + 500), "p2", 500, at + 520);
    expect(resolveBuzz(g, at + 900).buzzer).toBe("p2");
  });

  it("refuses spectators, double buzzes, bad times and closed buzzing", () => {
    const { game, at } = open(["p1", "p2"]);
    expect(() => buzz(game, "p3", 300, at + 300)).toThrow();
    const g = buzz(game, "p1", 300, at + 300);
    expect(() => buzz(g, "p1", 310, at + 310)).toThrow();
    expect(() => buzz(game, "p1", -1, at)).toThrow();
    expect(() => buzz(game, "p1", 1.5, at)).toThrow();
    expect(() => buzz(started(), "p1", 300, T0)).toThrow();
  });

  it("doesn't resolve before the window closes", () => {
    const { game, at } = open();
    const g = buzz(game, "p1", 300, at + 300);
    expect(() => resolveBuzz(g, at + 300 + BUZZ_WINDOW_MS - 1)).toThrow();
  });
});

describe("pick", () => {
  it("a right answer with 4 choices left scores 3 and ends the question", () => {
    const { game, at } = answering("p1");
    const g = pick(game, "p1", 0, at + 1000);
    expect(g.phase).toBe("result");
    expect(g.scores.p1).toBe(3);
    expect(g.outcome).toEqual({ kind: "right", seat: "p1", points: 3 });
    expect(g.lastPick).toEqual({ seat: "p1", choice: 0, right: true });
    expect(g.deadline).toBe(at + 1000 + RESULT_MS);
  });

  it("a wrong answer strikes the choice, locks the buzzer out and reopens buzzing", () => {
    const { game, at } = answering("p1");
    const g = pick(game, "p1", 2, at + 1000);
    expect(g.phase).toBe("question");
    expect(g.struck).toEqual([2]);
    expect(g.locked).toEqual(["p1"]);
    expect(g.round).toBe(1);
    expect(g.buzzes).toEqual([]);
    expect(g.openedAt).toBe(at + 1000);
    expect(g.questionEnd).toBe(at + 1000 + (QUESTION_MS - 400)); // the timer resumes where it paused
    expect(() => buzz(g, "p1", 100, at + 1100)).toThrow();
  });

  it("the next right answer is worth less", () => {
    const { game, at } = answering("p1");
    let g = pick(game, "p1", 1, at + 1000);
    g = resolveBuzz(buzz(g, "p2", 200, at + 1200), at + 1500);
    g = pick(g, "p2", 0, at + 2000);
    expect(g.scores).toEqual({ p1: 0, p2: 2, p3: 0 });
  });

  it("ends with no points when only the answer is left", () => {
    const { game, at } = answering("p1");
    let g = pick(game, "p1", 1, at + 1000);
    g = pick(resolveBuzz(buzz(g, "p2", 200, at + 1200), at + 1500), "p2", 2, at + 1600);
    g = pick(resolveBuzz(buzz(g, "p3", 200, at + 1800), at + 2100), "p3", 3, at + 2200);
    expect(g.phase).toBe("result");
    expect(g.outcome).toEqual({ kind: "none", reason: "one-left" });
    expect(choicesLeft(g)).toBe(1);
  });

  it("ends with no points when every player is locked out", () => {
    const { game: g0, at } = open(["p1", "p2"]);
    let g = pick(resolveBuzz(buzz(g0, "p1", 200, at + 200), at + 500), "p1", 1, at + 600);
    g = pick(resolveBuzz(buzz(g, "p2", 200, at + 800), at + 1100), "p2", 2, at + 1200);
    expect(g.outcome).toEqual({ kind: "none", reason: "all-locked" });
  });

  it("only the buzzer picks, and only a choice still in play", () => {
    const { game, at } = answering("p1");
    expect(() => pick(game, "p2", 0, at)).toThrow();
    expect(() => pick(game, "p1", 4, at)).toThrow();
    const g = pick(game, "p1", 1, at);
    const again = resolveBuzz(buzz(g, "p2", 100, at + 100), at + 400);
    expect(() => pick(again, "p2", 1, at + 500)).toThrow();
  });
});

describe("timeouts", () => {
  it("no pick in time locks the buzzer out without striking anything", () => {
    const { game, at } = answering("p1");
    expect(() => answerTimeout(game, at + ANSWER_MS - 1)).toThrow();
    const g = answerTimeout(game, at + ANSWER_MS);
    expect(g.phase).toBe("question");
    expect(g.locked).toEqual(["p1"]);
    expect(g.struck).toEqual([]);
  });

  it("the question times out with no points when nobody buzzes", () => {
    const { game, at } = open();
    expect(() => questionTimeout(game, at + QUESTION_MS - 1)).toThrow();
    const g = questionTimeout(game, at + QUESTION_MS);
    expect(g.outcome).toEqual({ kind: "none", reason: "timeout" });
  });
});

describe("next, final and rematch", () => {
  function result(game: QuizState, at: number): { game: QuizState; at: number } {
    return { game: questionTimeout(game, at + QUESTION_MS), at: at + QUESTION_MS };
  }

  it("goes to the next countdown, then the final ranking after the last question", () => {
    let g = started();
    let at = T0;
    for (let i = 0; i < 5; i++) {
      at += COUNTDOWN_MS;
      g = reveal(g, at);
      ({ game: g, at } = result(g, at));
      at += RESULT_MS;
      g = next(g, at);
      if (i < 4) expect(g).toMatchObject({ phase: "countdown", index: i + 1 });
    }
    expect(g.phase).toBe("final");
    expect(g.deadline).toBeUndefined();
  });

  it("rematch keeps the settings and resets the scores", () => {
    const final = { ...started(), phase: "final" as const, scores: { p1: 5, p2: 3, p3: 1 } };
    const g = rematch(final, { players: ["p1", "p2"], questionIds: ids(5), seed: 9, now: T0 });
    expect(g).toMatchObject({ phase: "countdown", index: 0, scores: { p1: 0, p2: 0 }, seed: 9 });
    expect(g.settings.topics).toEqual(["science"]);
    expect(() => rematch(started(), { players: ["p1", "p2"], questionIds: ids(5), seed: 9, now: T0 })).toThrow();
  });

  it("New topics goes back to setup", () => {
    const g = newTopics({ ...started(), phase: "final" });
    expect(g.phase).toBe("setup");
    expect(g.deadline).toBeUndefined();
  });
});

describe("advance", () => {
  it("applies the timed step of the current phase, and is a no-op when it isn't due", () => {
    const g = started();
    expect(dueAt(g)).toBe(T0 + COUNTDOWN_MS);
    expect(() => advance(g, T0)).toThrow();
    const revealed = advance(g, T0 + COUNTDOWN_MS);
    expect(revealed.phase).toBe("question");
    expect(dueAt(revealed)).toBe(T0 + COUNTDOWN_MS + QUESTION_MS);
    expect(() => advance(newGame("en"), T0)).toThrow();
  });
});

describe("normalize", () => {
  it("restores the arrays and objects the database drops", () => {
    const stored = { phase: "setup", settings: { lang: "en", length: 10 }, seed: 0, index: 0, round: 0 } as unknown as QuizState;
    expect(normalize(stored)).toMatchObject({ players: [], questionIds: [], buzzes: [], struck: [], locked: [], scores: {}, names: {}, settings: { topics: [] } });
  });
});

describe("scoring and ranking", () => {
  it("pays 3/2/1 by choices left", () => {
    expect([4, 3, 2, 1].map(pointsFor)).toEqual([3, 2, 1, 0]);
  });

  it("ranks by score, ties sharing a rank", () => {
    expect(ranking({ players: ["p1", "p2", "p3"], scores: { p1: 4, p2: 6, p3: 4 } })).toEqual([
      { seat: "p2", score: 6, rank: 1 },
      { seat: "p1", score: 4, rank: 2 },
      { seat: "p3", score: 4, rank: 2 },
    ]);
  });
});

describe("questions", () => {
  const q = (id: string, topic: Question["topic"], lang: Question["lang"] = "en"): Question => ({ id, lang, topic, question: id, choices: ["a", "b", "c", "d"] });
  const bank = [
    ...Array.from({ length: 6 }, (_, i) => q(`s${i}`, "science")),
    ...Array.from({ length: 2 }, (_, i) => q(`m${i}`, "music")),
    q("fr0", "science", "fr"),
  ];
  const random = () => 0.42;

  it("draws evenly across topics, in the chosen language only", () => {
    const picked = pickQuestions(bank, { lang: "en", topics: ["science", "music"], length: 4 }, random);
    expect(picked).toHaveLength(4);
    expect(picked.filter((id) => id.startsWith("m"))).toHaveLength(2);
    expect(picked).not.toContain("fr0");
  });

  it("tops up from the bigger topic when a smaller one runs out", () => {
    const picked = pickQuestions(bank, { lang: "en", topics: ["science", "music"], length: 5 }, random);
    expect(new Set(picked).size).toBe(5);
  });

  it("throws when the bank is too small", () => {
    expect(() => pickQuestions(bank, { lang: "fr", topics: ["science"], length: 5 }, random)).toThrow();
  });

  it("shuffles choices the same way on every device, differently per question", () => {
    expect(choiceOrder(7, 0)).toEqual(choiceOrder(7, 0));
    expect([...choiceOrder(7, 0)].sort()).toEqual([0, 1, 2, 3]);
    const orders = new Set(Array.from({ length: 10 }, (_, i) => choiceOrder(7, i).join("")));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("publicGame", () => {
  it("is ready to start from the lobby: every topic, the default length, the room's language", () => {
    const game = publicGame("fr");
    expect(game.phase).toBe("lobby");
    expect(game.settings).toEqual({ lang: "fr", topics: [...TOPICS], length: DEFAULT_LENGTH });
  });
});
