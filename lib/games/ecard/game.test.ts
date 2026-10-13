import { describe, expect, it } from "vitest";
import { TOTAL_ROUNDS } from "./constants";
import {
  continueRound,
  ecRoleOfSeat,
  emperorSeatOf,
  type GameState,
  initiativeOf,
  isGameComplete,
  newGame,
  nextRound,
  nextToPlace,
  placeCard,
  seatOfEcRole,
  slaveSeatOf,
} from "./game";

describe("emperorSeatOf / slaveSeatOf", () => {
  it("alternates by 3-round block, giving a 6/6 split over 12 rounds", () => {
    const emperorSeats = Array.from({ length: TOTAL_ROUNDS }, (_, i) => emperorSeatOf(i + 1));
    expect(emperorSeats).toEqual(["p1", "p1", "p1", "p2", "p2", "p2", "p1", "p1", "p1", "p2", "p2", "p2"]);
    expect(emperorSeats.filter((s) => s === "p1")).toHaveLength(6);
    expect(emperorSeats.filter((s) => s === "p2")).toHaveLength(6);
  });

  it("slaveSeatOf is always the other seat", () => {
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      expect(slaveSeatOf(round)).not.toBe(emperorSeatOf(round));
    }
  });
});

describe("ecRoleOfSeat / seatOfEcRole", () => {
  it("are inverses of each other across the whole schedule", () => {
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      expect(seatOfEcRole(round, ecRoleOfSeat(round, "p1"))).toBe("p1");
      expect(seatOfEcRole(round, ecRoleOfSeat(round, "p2"))).toBe("p2");
    }
  });
});

describe("initiativeOf", () => {
  it("alternates by absolute round number, starting with Emperor on round 1", () => {
    expect(initiativeOf(1)).toBe("emperor");
    expect(initiativeOf(2)).toBe("slave");
    expect(initiativeOf(3)).toBe("emperor");
    expect(initiativeOf(12)).toBe("slave");
  });
});

describe("newGame", () => {
  it("starts round 1 with zeroed totals, empty history, and full 5-card hands", () => {
    const game = newGame();
    expect(game.round).toBe(1);
    expect(game.totals).toEqual({ p1: 0, p2: 0 });
    expect(game.history).toEqual([]);
    expect(game.names).toEqual({});
    expect(game.current.status).toBe("PLACING");
    expect(game.current.emperorHand).toHaveLength(5);
    expect(game.current.slaveHand).toHaveLength(5);
  });

  it("gives Emperor exactly 1 emperor + 4 citizens, Slave exactly 1 slave + 4 citizens", () => {
    const game = newGame();
    const emperorArchetypes = game.current.emperorHand.map((c) => c.archetype).sort();
    const slaveArchetypes = game.current.slaveHand.map((c) => c.archetype).sort();
    expect(emperorArchetypes).toEqual(["citizen", "citizen", "citizen", "citizen", "emperor"]);
    expect(slaveArchetypes).toEqual(["citizen", "citizen", "citizen", "citizen", "slave"]);
  });
});

describe("nextToPlace", () => {
  it("is the round's initiative role before any placement", () => {
    const game = newGame(); // round 1: initiative emperor
    expect(nextToPlace(game.current)).toBe("emperor");
  });

  it("is the other role after the first placement", () => {
    const game = newGame();
    const afterFirst = placeCard(game, "emperor", game.current.emperorHand[1].id); // a citizen
    expect(nextToPlace(afterFirst.current)).toBe("slave");
  });

  it("is null once both have placed", () => {
    const game = newGame();
    const afterFirst = placeCard(game, "emperor", game.current.emperorHand[1].id);
    const afterSecond = placeCard(afterFirst, "slave", afterFirst.current.slaveHand[1].id);
    expect(nextToPlace(afterSecond.current)).toBeNull();
  });
});

function citizenId(hand: GameState["current"]["emperorHand"]): string {
  return hand.find((c) => c.archetype === "citizen")!.id;
}
function specialId(hand: GameState["current"]["emperorHand"]): string {
  return hand.find((c) => c.archetype !== "citizen")!.id;
}

describe("placeCard", () => {
  it("rejects placing out of turn", () => {
    const game = newGame(); // round 1, emperor's turn first
    expect(() => placeCard(game, "slave", citizenId(game.current.slaveHand))).toThrow();
  });

  it("rejects a card not in that role's hand", () => {
    const game = newGame();
    expect(() => placeCard(game, "emperor", "slave-special")).toThrow();
  });

  it("rejects placing once the exchange is already REVEALED", () => {
    const game = newGame();
    const afterFirst = placeCard(game, "emperor", citizenId(game.current.emperorHand));
    const revealed = placeCard(afterFirst, "slave", citizenId(afterFirst.current.slaveHand));
    expect(() => placeCard(revealed, "emperor", citizenId(revealed.current.emperorHand))).toThrow();
  });

  it("citizen vs citizen ties: no score change, both discarded, hands shrink by one each", () => {
    const game = newGame();
    const afterFirst = placeCard(game, "emperor", citizenId(game.current.emperorHand));
    const revealed = placeCard(afterFirst, "slave", citizenId(afterFirst.current.slaveHand));
    expect(revealed.current.status).toBe("REVEALED");
    expect(revealed.current.result).toBe("tie");
    expect(revealed.current.emperorHand).toHaveLength(4);
    expect(revealed.current.slaveHand).toHaveLength(4);
    expect(revealed.current.discard).toHaveLength(2);
    expect(revealed.totals).toEqual({ p1: 0, p2: 0 });
    expect(revealed.history).toEqual([]);
  });

  it("emperor's special card beats a citizen - decisive, pays 1x to the Emperor seat", () => {
    const game = newGame(); // round 1: p1 is Emperor
    const afterFirst = placeCard(game, "emperor", specialId(game.current.emperorHand));
    const revealed = placeCard(afterFirst, "slave", citizenId(afterFirst.current.slaveHand));
    expect(revealed.current.result).toBe("emperor");
    expect(revealed.totals).toEqual({ p1: 1, p2: 0 });
    expect(revealed.history).toEqual([{ round: 1, winner: "emperor", winnerSeat: "p1", payout: 1 }]);
  });

  it("slave's special card beats the emperor's special card - decisive, pays 5x to the Slave seat", () => {
    const game = newGame(); // round 1: p1 Emperor, p2 Slave, emperor places first
    const afterFirst = placeCard(game, "emperor", specialId(game.current.emperorHand));
    const revealed = placeCard(afterFirst, "slave", specialId(afterFirst.current.slaveHand));
    expect(revealed.current.result).toBe("slave");
    expect(revealed.totals).toEqual({ p1: 0, p2: 5 });
    expect(revealed.history).toEqual([{ round: 1, winner: "slave", winnerSeat: "p2", payout: 5 }]);
  });

  it("a citizen beats the slave's special card - decisive, pays 1x to the Emperor seat (citizen side)", () => {
    const game = newGame();
    const afterFirst = placeCard(game, "emperor", citizenId(game.current.emperorHand));
    const revealed = placeCard(afterFirst, "slave", specialId(afterFirst.current.slaveHand));
    expect(revealed.current.result).toBe("emperor");
    expect(revealed.totals.p1).toBe(1);
  });
});

describe("continueRound", () => {
  it("rejects continuing when the last exchange wasn't a tie", () => {
    const game = newGame();
    const afterFirst = placeCard(game, "emperor", specialId(game.current.emperorHand));
    const revealed = placeCard(afterFirst, "slave", citizenId(afterFirst.current.slaveHand));
    expect(() => continueRound(revealed)).toThrow();
  });

  it("rejects continuing while still PLACING", () => {
    const game = newGame();
    expect(() => continueRound(game)).toThrow();
  });

  it("resets to PLACING with the same (shrunken) hands and initiative, same round", () => {
    const game = newGame();
    const afterFirst = placeCard(game, "emperor", citizenId(game.current.emperorHand));
    const tied = placeCard(afterFirst, "slave", citizenId(afterFirst.current.slaveHand));
    const continued = continueRound(tied);
    expect(continued.current.status).toBe("PLACING");
    expect(continued.current.round).toBe(1);
    expect(continued.current.initiative).toBe("emperor");
    expect(continued.current.emperorHand).toHaveLength(4);
    expect(continued.current.slaveHand).toHaveLength(4);
    expect(continued.current.firstPlacement).toBeUndefined();
    expect(continued.current.secondPlacement).toBeUndefined();
    expect(nextToPlace(continued.current)).toBe("emperor");
  });
});

describe("nextRound", () => {
  it("rejects advancing before a decisive result", () => {
    const game = newGame();
    expect(() => nextRound(game)).toThrow();
  });

  it("rejects advancing after a tie (continueRound is the only valid move)", () => {
    const game = newGame();
    const afterFirst = placeCard(game, "emperor", citizenId(game.current.emperorHand));
    const tied = placeCard(afterFirst, "slave", citizenId(afterFirst.current.slaveHand));
    expect(() => nextRound(tied)).toThrow();
  });

  it("advances to a fresh round 2 with full hands, keeping totals/history", () => {
    const game = newGame();
    const afterFirst = placeCard(game, "emperor", specialId(game.current.emperorHand));
    const revealed = placeCard(afterFirst, "slave", citizenId(afterFirst.current.slaveHand));
    const round2 = nextRound(revealed);
    expect(round2.round).toBe(2);
    expect(round2.totals).toEqual(revealed.totals);
    expect(round2.history).toEqual(revealed.history);
    expect(round2.current.status).toBe("PLACING");
    expect(round2.current.emperorHand).toHaveLength(5);
    expect(round2.current.slaveHand).toHaveLength(5);
    // round 2 is still block 1 (rounds 1-3) - seats don't swap until block 2 (round 4)
    expect(ecRoleOfSeat(2, "p1")).toBe("emperor");
    expect(ecRoleOfSeat(4, "p1")).toBe("slave");
  });

  it("rejects advancing past round 12", () => {
    let game: GameState = newGame();
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      // emperor's special beats a citizen either way - just place in whichever order this round's initiative requires.
      const afterFirst =
        initiativeOf(round) === "emperor"
          ? placeCard(game, "emperor", specialId(game.current.emperorHand))
          : placeCard(game, "slave", citizenId(game.current.slaveHand));
      game =
        initiativeOf(round) === "emperor"
          ? placeCard(afterFirst, "slave", citizenId(afterFirst.current.slaveHand))
          : placeCard(afterFirst, "emperor", specialId(afterFirst.current.emperorHand));
      if (round < TOTAL_ROUNDS) game = nextRound(game);
    }
    expect(isGameComplete(game)).toBe(true);
    expect(() => nextRound(game)).toThrow();
  });
});

describe("a full 12-round simulated game", () => {
  it("completes with a correct 6/6 Emperor split and consistent payout accounting", () => {
    let game: GameState = newGame();
    const emperorSeatsSeen: string[] = [];
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      emperorSeatsSeen.push(emperorSeatOf(round));
      // deterministic: emperor's special card always beats a slave citizen immediately
      const afterFirst =
        initiativeOf(round) === "emperor"
          ? placeCard(game, "emperor", specialId(game.current.emperorHand))
          : placeCard(game, "slave", citizenId(game.current.slaveHand));
      const second =
        initiativeOf(round) === "emperor"
          ? placeCard(afterFirst, "slave", citizenId(afterFirst.current.slaveHand))
          : placeCard(afterFirst, "emperor", specialId(afterFirst.current.emperorHand));
      game = second;
      if (round < TOTAL_ROUNDS) game = nextRound(game);
    }
    expect(emperorSeatsSeen.filter((s) => s === "p1")).toHaveLength(6);
    expect(emperorSeatsSeen.filter((s) => s === "p2")).toHaveLength(6);
    expect(game.history).toHaveLength(TOTAL_ROUNDS);
    expect(isGameComplete(game)).toBe(true);
    const totalPaidOut = game.totals.p1 + game.totals.p2;
    const totalFromHistory = game.history.reduce((sum, r) => sum + r.payout, 0);
    expect(totalPaidOut).toBe(totalFromHistory);
  });
});
