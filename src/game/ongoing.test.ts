import { describe, expect, it } from "vitest";
import { cardById } from "./cast";
import { cardCost } from "./costs";
import { cityState, placeableCities, playerById } from "./rules";
import { act, anaToAct, cast, data, flock, passTurn, setFlock, settle, step, tweak } from "./testHelpers";
import type { GameState } from "./types";

/** Ends Ana's turn, so it's Ben's turn (his Start has run). */
const toBen = (g: GameState) => act(g, { type: "endTurn", playerId: "p1" });
/** From Ben's turn, play on until Ben's next turn. */
const nextBenTurn = (g: GameState) => passTurn(passTurn(passTurn(g)));
const reserveOf = (g: GameState, id: string) => playerById(g, id).reserve;
/** A card plus 5 fillers, so Ana still has 5 after casting and her next turn skips Draw. */
const plus5 = (card: string) => [card, "NEU-F-10", "NEU-F-11", "NEU-F-12", "NEU-F-13", "NEU-F-14"];

describe("Calamities that last", () => {
  it("Blight hits for 2 now, then 1 at the start of each of the target's next 3 turns", () => {
    let g = cast(anaToAct(["HAR-C-02"]), "HAR-C-02", { player: "p2", city: "Goldmere" });
    expect(flock(g, "Goldmere")).toEqual({ p2: 8 });
    g = toBen(g);
    expect(flock(g, "Goldmere")).toEqual({ p2: 7 });
    g = nextBenTurn(g);
    expect(flock(g, "Goldmere").p2).toBe(6); // passTurn keeps income in reserve
    g = nextBenTurn(g);
    const after3 = flock(g, "Goldmere").p2;
    g = nextBenTurn(g);
    expect(flock(g, "Goldmere").p2).toBe(after3); // worn off
    expect(g.log).toContain("Blight on Ben (Goldmere) wears off.");
  });

  it("Late Frost hits for 1 now and 1 at the start of the target's next turn", () => {
    let g = cast(anaToAct(["HAR-C-07"]), "HAR-C-07", { player: "p2", city: "Goldmere" });
    expect(flock(g, "Goldmere")).toEqual({ p2: 9 });
    g = toBen(g);
    expect(flock(g, "Goldmere")).toEqual({ p2: 8 });
    expect(g.ongoing).toHaveLength(1);
    g = passTurn(g);
    expect(g.ongoing).toEqual([]);
  });

  it("Famine stops the target's income for their next 2 Economy Phases", () => {
    let g = toBen(cast(anaToAct(["HAR-C-01"]), "HAR-C-01", { player: "p2" }));
    expect(reserveOf(g, "p2")).toBe(0);
    expect(g.log).toContain("Ben collects 0 Flock income (Base income +1, Famine (no income) -1). Reserve is now 0.");
    g = nextBenTurn(g);
    expect(reserveOf(g, "p2")).toBe(0);
    g = nextBenTurn(g);
    expect(reserveOf(g, "p2")).toBe(1);
  });

  it("Rot in the Granary halves the target's next income, rounded down", () => {
    const g = toBen(
      cast(anaToAct(["HAR-C-09"], 6, (g) => setFlock(g, "Goldmere", { p2: 21 }, "p2")), "HAR-C-09", { player: "p2" }),
    );
    // Income 1 base + 2 large + 1 match = 4, halved = 2.
    expect(reserveOf(g, "p2")).toBe(2);
  });

  it("Failed Harvest stops one city's income for 2 turns", () => {
    const g = toBen(
      cast(anaToAct(["HAR-C-04"], 6, (g) => setFlock(g, "Goldmere", { p2: 21 }, "p2")), "HAR-C-04", {
        player: "p2",
        city: "Goldmere",
      }),
    );
    expect(reserveOf(g, "p2")).toBe(1);
  });

  it("Sabotage raises the target's costs by 2 during their next 2 turns only", () => {
    let g = cast(anaToAct(["PRO-C-03"]), "PRO-C-03", { player: "p2" });
    const omen = cardById(data, "NEU-F-11");
    const costFor = (g: GameState) => cardCost(data, g, "p2", omen).total;
    expect(costFor(g)).toBe(1); // not yet: it's Ana's turn
    g = toBen(g);
    expect(costFor(g)).toBe(3);
    g = passTurn(g);
    expect(costFor(g)).toBe(1); // Cy's turn
    g = passTurn(passTurn(g));
    expect(costFor(g)).toBe(3); // Ben's second turn
    g = nextBenTurn(g);
    expect(costFor(g)).toBe(1);
  });

  it("Earthquake stops the target receiving Flock in both cities on their next turn", () => {
    let g = cast(
      anaToAct(["NAT-C-04"], 6, (g) => setFlock(g, "Stonevale", { p2: 4 })),
      "NAT-C-04",
      { player: "p2", city: "Goldmere", neighbor: "Stonevale" },
    );
    expect(flock(g, "Goldmere")).toEqual({ p2: 7 });
    expect(flock(g, "Stonevale")).toEqual({ p2: 3 });
    g = toBen(g);
    expect(placeableCities(g, "p2")).toEqual([]);
    g = nextBenTurn(passTurn(g));
    expect(placeableCities(g, "p2")).toEqual(["Stonevale", "Goldmere"]);
  });

  it("Wild Beasts stops the target moving Flock out of the city on their next turn", () => {
    let g = cast(anaToAct(["NAT-C-07"]), "NAT-C-07", { player: "p2", city: "Goldmere" });
    g = tweak(toBen(g), (g) => {
      playerById(g, "p2").hand = ["NAT-F-07", "NEU-F-11", "NEU-F-12", "NEU-F-13", "NEU-F-14"];
      playerById(g, "p2").reserve = 3;
    });
    g = act(g, { type: "placeFlock", playerId: "p2", placements: {} });
    expect(() =>
      act(g, { type: "castCard", playerId: "p2", cardId: "NAT-F-07", targets: { city: "Goldmere", neighbor: "Stonevale", amount: "2" } }),
    ).toThrow(/free to move/);
  });
});

describe("Favors that last", () => {
  it("Season of Plenty adds 1 income per controlled city for your next 3 Economy Phases", () => {
    let g = cast(anaToAct(plus5("HAR-F-02"), 6, (g) => setFlock(g, "Ashgrove", { p1: 11 }, "p1")), "HAR-F-02");
    g = passTurn(passTurn(passTurn(g)));
    expect(reserveOf(g, "p1")).toBe(3 + 1);
    g = passTurn(passTurn(passTurn(g)));
    g = passTurn(passTurn(passTurn(g)));
    g = passTurn(passTurn(passTurn(g)));
    expect(g.ongoing).toEqual([]);
  });

  it("Full Granary gives 3 now and 1 more at your next Economy Phase", () => {
    let g = cast(anaToAct(plus5("HAR-F-04"), 4), "HAR-F-04");
    expect(reserveOf(g, "p1")).toBe(3);
    g = passTurn(passTurn(passTurn(g)));
    expect(reserveOf(g, "p1")).toBe(3 + 1 + 1); // kept 3, +1 income, +1 Granary
  });

  it("Rationing cancels an ongoing effect on you and gains 2", () => {
    let g = cast(anaToAct(["HAR-C-02"]), "HAR-C-02", { player: "p2", city: "Goldmere" });
    g = tweak(toBen(g), (g) => {
      playerById(g, "p2").hand = ["HAR-F-05", "NEU-F-11", "NEU-F-12", "NEU-F-13", "NEU-F-14"];
      playerById(g, "p2").reserve = 4;
    });
    g = act(g, { type: "placeFlock", playerId: "p2", placements: {} });
    const id = String(g.ongoing[0].id);
    g = act(g, { type: "castCard", playerId: "p2", cardId: "HAR-F-05", targets: { effect: id } });
    expect(g.ongoing).toEqual([]);
    expect(reserveOf(g, "p2")).toBe(2);
  });
});

describe("seeds", () => {
  it("pay out into their city at the planter's next Economy Phase, not before", () => {
    let g = cast(anaToAct(plus5("HAR-F-03")), "HAR-F-03", { city: "Ashgrove" });
    expect(cityState(g, "Ashgrove").seeds).toHaveLength(1);
    expect(flock(g, "Ashgrove")).toEqual({ p1: 10 });
    g = passTurn(passTurn(passTurn(g)));
    expect(step(g)).toBe("economy");
    g = act(g, { type: "placeFlock", playerId: "p1", placements: {} });
    expect(flock(g, "Ashgrove")).toEqual({ p1: 15 });
    expect(cityState(g, "Ashgrove").seeds).toEqual([]);
  });

  it("Early Sprouts yields 4 in a city matching your domain, 3 otherwise", () => {
    const matched = cast(anaToAct(["HAR-F-09"]), "HAR-F-09", { city: "Ashgrove" });
    expect(cityState(matched, "Ashgrove").seeds[0].amount).toBe(4);
    const plain = cast(anaToAct(["HAR-F-09"], 6, (g) => setFlock(g, "Crossmarch", { p1: 2 })), "HAR-F-09", { city: "Crossmarch" });
    expect(cityState(plain, "Crossmarch").seeds[0].amount).toBe(3);
  });

  it("are lost if an opponent converts the city first", () => {
    let g = cast(anaToAct(["HAR-F-06"], 6, (g) => setFlock(g, "Goldmere", { p1: 3, p2: 21 })), "HAR-F-06", { city: "Goldmere" });
    g = toBen(g); // Ben converts Goldmere at his Start
    expect(cityState(g, "Goldmere")).toMatchObject({ controller: "p2", seeds: [] });
    expect(g.log).toContain("Ana's seed in Goldmere is lost.");
  });

  it("are destroyed by a Harvest Calamity on their city, instead of its usual effect", () => {
    let g = cast(anaToAct(["HAR-F-06"]), "HAR-F-06", { city: "Ashgrove" });
    g = tweak(toBen(g), (g) => {
      playerById(g, "p2").hand = ["HAR-C-07", "NEU-F-11", "NEU-F-12", "NEU-F-13", "NEU-F-14"];
      playerById(g, "p2").reserve = 3;
    });
    g = act(g, { type: "placeFlock", playerId: "p2", placements: {} });
    g = settle(act(g, { type: "castCard", playerId: "p2", cardId: "HAR-C-07", targets: { player: "p1", city: "Ashgrove" } }));
    expect(cityState(g, "Ashgrove").seeds).toEqual([]);
    expect(flock(g, "Ashgrove")).toEqual({ p1: 10 }); // no Flock lost
    expect(g.ongoing).toEqual([]); // and no lasting frost
  });
});
