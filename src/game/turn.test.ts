import { describe, expect, it } from "vitest";
import { cityState, playerById, totalIncome, incomeBreakdown } from "./rules";
import type { GameState } from "./types";
import { act, current, data, newGame, passTurn, setFlock, step, tweak } from "./testHelpers";

describe("the first turn", () => {
  it("starts with the first player, skips Draw (hand is full), and collects 1 base income", () => {
    const g = newGame();
    expect(g.phase).toMatchObject({ name: "turn", player: "p1", round: 1, step: "economy" });
    expect(playerById(g, "p1").reserve).toBe(1);
    expect(g.log).toContain("Ana collects 1 Flock income (Base income +1). Reserve is now 1.");
  });

  it("passes play clockwise and counts rounds", () => {
    let g = newGame();
    g = passTurn(g);
    expect(current(g)).toBe("p2");
    g = passTurn(passTurn(g));
    expect(g.phase).toMatchObject({ player: "p1", round: 2 });
  });
});

describe("placing Flock (Economy)", () => {
  it("moves Flock from reserve to cities, keeping the rest", () => {
    let g = tweak(newGame(), (g) => (playerById(g, "p1").reserve = 5));
    g = act(g, { type: "placeFlock", playerId: "p1", placements: { Ashgrove: 3 } });
    expect(cityState(g, "Ashgrove").flock.p1).toBe(13);
    expect(playerById(g, "p1").reserve).toBe(2);
    expect(step(g)).toBe("action");
  });

  it("only allows cities you control or already have Flock in", () => {
    const g = newGame();
    expect(() => act(g, { type: "placeFlock", playerId: "p1", placements: { Stonevale: 1 } })).toThrow(
      /only place Flock in cities they control or already have Flock in/,
    );
    // Ben's city is fine once Ana has Flock there.
    const shared = tweak(g, (g) => (cityState(g, "Goldmere").flock.p1 = 1));
    expect(cityState(act(shared, { type: "placeFlock", playerId: "p1", placements: { Goldmere: 1 } }), "Goldmere").flock.p1).toBe(2);
  });

  it("refuses more than your reserve, negative numbers, and other players", () => {
    const g = newGame();
    expect(() => act(g, { type: "placeFlock", playerId: "p1", placements: { Ashgrove: 2 } })).toThrow(/only has 1 Flock/);
    expect(() => act(g, { type: "placeFlock", playerId: "p1", placements: { Ashgrove: -1 } })).toThrow(/Can't place -1/);
    expect(() => act(g, { type: "placeFlock", playerId: "p2", placements: {} })).toThrow(/It's Ana's turn/);
  });

  it("can't end the turn before placing", () => {
    expect(() => act(newGame(), { type: "endTurn", playerId: "p1" })).toThrow(/while placing Flock/);
  });
});

describe("conversion", () => {
  it("waits until the start of your next turn", () => {
    // Ana has 10 in Ashgrove and needs 11 (41%, it's a Nature city).
    let g = act(newGame(), { type: "placeFlock", playerId: "p1", placements: { Ashgrove: 1 } });
    g = act(g, { type: "endTurn", playerId: "p1" });
    expect(cityState(g, "Ashgrove").controller).toBeNull(); // not yet
    g = passTurn(passTurn(g)); // Ben and Cy
    expect(current(g)).toBe("p1");
    expect(cityState(g, "Ashgrove").controller).toBe("p1");
    expect(playerById(g, "p1").convertedCities).toEqual(["Ashgrove"]);
    expect(g.log).toContain("Ashgrove converts to Ana (11 Flock, needed 11).");
  });

  it("doesn't happen if a rival pushed you back below the threshold in the meantime", () => {
    let g = act(newGame(), { type: "placeFlock", playerId: "p1", placements: { Ashgrove: 1 } });
    g = act(g, { type: "endTurn", playerId: "p1" });
    g = tweak(g, (g) => (cityState(g, "Ashgrove").flock.p1 = 10)); // stands in for a rival's Calamity
    g = passTurn(passTurn(g));
    expect(cityState(g, "Ashgrove").controller).toBeNull();
  });

  it("switches all rival Flock to the converter", () => {
    let g = tweak(newGame(), (g) => setFlock(g, "Ashgrove", { p1: 11, p2: 6 }));
    g = passTurn(passTurn(passTurn(g)));
    expect(cityState(g, "Ashgrove").flock).toEqual({ p1: 17 });
    expect(g.log).toContain("Ashgrove converts to Ana (11 Flock, needed 11). 6 of Ben's Flock switched over.");
  });

  it("uses 51% when the city doesn't match your domain", () => {
    let g = tweak(newGame(), (g) => setFlock(g, "Crossmarch", { p1: 17 }));
    g = passTurn(passTurn(passTurn(g)));
    expect(cityState(g, "Crossmarch").controller).toBeNull(); // needs 18
    g = tweak(g, (g) => setFlock(g, "Crossmarch", { p1: 18 }));
    g = passTurn(passTurn(passTurn(g)));
    expect(cityState(g, "Crossmarch").controller).toBe("p1");
  });

  it("needs 10 points more to take a rival's city with a Temple, which then drops to a Shrine", () => {
    // Ben controls Crossmarch (35) with a Temple; Ana needs 61% = 22, not 18.
    let g = tweak(newGame(), (g) => {
      setFlock(g, "Crossmarch", { p1: 21, p2: 9 }, "p2");
      cityState(g, "Crossmarch").holySite = "Temple";
    });
    g = passTurn(passTurn(passTurn(g)));
    expect(cityState(g, "Crossmarch").controller).toBe("p2");
    g = tweak(g, (g) => (cityState(g, "Crossmarch").flock.p1 = 22));
    g = passTurn(passTurn(passTurn(g)));
    expect(cityState(g, "Crossmarch")).toMatchObject({ controller: "p1", holySite: "Shrine", flock: { p1: 31 } });
  });

  it("counts each city once per game", () => {
    let g = tweak(newGame(), (g) => {
      setFlock(g, "Ashgrove", { p1: 11 });
      playerById(g, "p1").convertedCities = ["Ashgrove"];
    });
    g = passTurn(passTurn(passTurn(g)));
    expect(playerById(g, "p1").convertedCities).toEqual(["Ashgrove"]);
  });
});

describe("losing a city", () => {
  it("becomes uncontrolled below 25% at the start of your turn, and its Holy Site drops a level", () => {
    // Stonevale (50): kept with 13, lost with 12.
    let g = tweak(newGame(), (g) => {
      setFlock(g, "Stonevale", { p1: 13 }, "p1");
      setFlock(g, "Goldmere", { p1: 12, p2: 10 }, "p1");
      cityState(g, "Goldmere").holySite = "Cathedral";
    });
    g = passTurn(passTurn(passTurn(g)));
    expect(cityState(g, "Stonevale").controller).toBe("p1");
    expect(cityState(g, "Goldmere")).toMatchObject({ controller: null, holySite: "Temple", flock: { p1: 12, p2: 10 } });
  });

  it("removes a Shrine, and converting an uncontrolled city doesn't drop it again", () => {
    let g = tweak(newGame(), (g) => {
      setFlock(g, "Crossmarch", { p1: 8 }, "p1");
      cityState(g, "Crossmarch").holySite = "Temple";
    });
    g = passTurn(passTurn(passTurn(g)));
    expect(cityState(g, "Crossmarch")).toMatchObject({ controller: null, holySite: "Shrine" });
    g = tweak(g, (g) => setFlock(g, "Crossmarch", { p2: 18 }));
    g = passTurn(g); // Ana
    expect(cityState(g, "Crossmarch")).toMatchObject({ controller: "p2", holySite: "Shrine" });
  });
});

describe("income", () => {
  it("adds base, city income, domain match and Holy Site bonus", () => {
    const g = tweak(newGame(), (g) => {
      setFlock(g, "Stonevale", { p1: 21 }, "p1"); // large Nature city: 2 + 1 match
      setFlock(g, "Crossmarch", { p1: 18 }, "p1"); // medium, no match: 1
      cityState(g, "Crossmarch").holySite = "Temple"; // +2
    });
    expect(incomeBreakdown(data, g, "p1")).toEqual([
      { label: "Base income", amount: 1 },
      { label: "Crossmarch (medium city)", amount: 1 },
      { label: "Crossmarch Temple", amount: 2 },
      { label: "Stonevale (large city)", amount: 2 },
      { label: "Stonevale matches your domain", amount: 1 },
    ]);
    expect(totalIncome(data, g, "p1")).toBe(7);
  });

  it("gives nothing for an uncontrolled city's Holy Site", () => {
    const g = tweak(newGame(), (g) => {
      setFlock(g, "Crossmarch", { p1: 10 });
      cityState(g, "Crossmarch").holySite = "Shrine";
    });
    expect(totalIncome(data, g, "p1")).toBe(1);
  });
});

describe("drawing at the start of a turn", () => {
  it("waits for the player to refill to 5 before income", () => {
    let g = tweak(passTurn(newGame()), (g) => {
      // Give Cy (next) a 3-card hand, as if 2 cards had been played.
      playerById(g, "p3").hand.splice(0, 2);
    });
    g = passTurn(g); // Ben
    expect(g.phase).toMatchObject({ player: "p3", step: "draw" });
    expect(() => act(g, { type: "placeFlock", playerId: "p3", placements: {} })).toThrow(/while drawing cards/);
    const favorTop = g.decks.Favor.at(-1);
    g = act(g, { type: "drawCard", playerId: "p3", deck: "Favor" });
    expect(playerById(g, "p3").hand).toContain(favorTop);
    expect(step(g)).toBe("draw");
    g = act(g, { type: "drawCard", playerId: "p3", deck: "Calamity" });
    expect(step(g)).toBe("economy");
    expect(playerById(g, "p3").reserve).toBe(1);
  });
});

describe("winning", () => {
  /** Ana controls Ashgrove + Crossmarch (region A) and Havenspring + Stonevale (region B). */
  const twoRegions = (g: GameState) => {
    setFlock(g, "Ashgrove", { p1: 11 }, "p1");
    setFlock(g, "Crossmarch", { p1: 18 }, "p1");
    setFlock(g, "Havenspring", { p1: 13 }, "p1");
    setFlock(g, "Stonevale", { p1: 21 }, "p1");
  };

  it("marks you at the End when you hold 2 regions, and you win at your next Start", () => {
    let g = tweak(newGame(), twoRegions);
    g = passTurn(g);
    expect(playerById(g, "p1").holdingRegions).toBe(true);
    g = passTurn(passTurn(g));
    expect(g.phase).toEqual({ name: "gameOver", winner: "p1" });
    expect(g.log.at(-1)).toBe("Ana still holds regions A and B. Ana wins!");
    expect(() => act(g, { type: "endTurn", playerId: "p1" })).toThrow(/game is over/);
  });

  it("doesn't win if a rival broke the hold during the round", () => {
    let g = passTurn(tweak(newGame(), twoRegions));
    // Ben's turn: Ana drops below 25% in Stonevale, so she loses it at her next Start.
    g = tweak(g, (g) => (cityState(g, "Stonevale").flock.p1 = 12));
    g = passTurn(passTurn(g));
    expect(g.phase).toMatchObject({ name: "turn", player: "p1" });
    expect(playerById(g, "p1").holdingRegions).toBe(false);
    expect(g.log).toContain("Ana's hold on 2 regions was broken.");
  });

  it("isn't marked for a single region", () => {
    const g = passTurn(tweak(newGame(), (g) => {
      setFlock(g, "Ashgrove", { p1: 11 }, "p1");
      setFlock(g, "Crossmarch", { p1: 18 }, "p1");
    }));
    expect(playerById(g, "p1").holdingRegions).toBe(false);
  });
});
