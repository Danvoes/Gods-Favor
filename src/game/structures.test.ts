import { describe, expect, it } from "vitest";
import { canCast, cardById } from "./cast";
import { cardCost } from "./costs";
import { cityState, playerById, totalIncome } from "./rules";
import { act, anaToAct, cast, data, flock, passTurn, setFlock, step, tweak } from "./testHelpers";
import type { GameState, StructureKind } from "./types";

/** Ana controls Ashgrove (and Crossmarch if asked). */
function anaControls(...cities: string[]) {
  return (g: GameState) => {
    const need: Record<string, number> = { Ashgrove: 11, Crossmarch: 18, Stonevale: 21 };
    for (const c of cities) setFlock(g, c, { p1: need[c] }, "p1");
  };
}

const withStructure = (city: string, kind: StructureKind, status: "on" | "idle" | "off" = "on") => (g: GameState) =>
  cityState(g, city).structures.push({ kind, status });

/** A full hand, so the next turn skips the Draw step. */
const FULL_HAND = ["NEU-F-10", "NEU-F-11", "NEU-F-12", "NEU-F-13", "NEU-F-14"];

const cost = (g: GameState, playerId: string, cardId: string, answers = {}) =>
  cardCost(data, g, playerId, cardById(data, cardId), answers).total;

describe("building structures", () => {
  it("builds in a city you control, and Grand Foundry adds 2 income", () => {
    const g = cast(anaToAct(["PRO-F-01"], 6, anaControls("Ashgrove")), "PRO-F-01", { city: "Ashgrove" });
    expect(cityState(g, "Ashgrove").structures).toEqual([{ kind: "Grand Foundry", status: "on" }]);
    expect(totalIncome(data, g, "p1")).toBe(1 + 1 + 1 + 2); // base, small city, domain match, Foundry
  });

  it("can't build without a controlled city with a free slot (2 at most)", () => {
    expect(canCast(data, anaToAct(["PRO-F-06"]), "p1", "PRO-F-06")).toMatchObject({ ok: false });
    const full = anaToAct(["PRO-F-06"], 6, (g) => {
      anaControls("Ashgrove")(g);
      withStructure("Ashgrove", "Market")(g);
      withStructure("Ashgrove", "Workshop")(g);
    });
    expect(canCast(data, full, "p1", "PRO-F-06")).toEqual({
      ok: false,
      reason: "You need to control a city with a free structure slot (at most 2 per city).",
    });
  });

  it("Railway gives 1 Flock to each city you control in that region", () => {
    const g = cast(anaToAct(["PRO-F-02"], 6, anaControls("Ashgrove", "Crossmarch")), "PRO-F-02", { city: "Ashgrove" });
    expect(flock(g, "Ashgrove")).toEqual({ p1: 12 });
    expect(flock(g, "Crossmarch")).toEqual({ p1: 19 });
  });
});

describe("cost changes", () => {
  it("Workshops take 1 off each card, at most 2", () => {
    const one = anaToAct([], 6, (g) => {
      anaControls("Ashgrove", "Crossmarch")(g);
      withStructure("Ashgrove", "Workshop")(g);
    });
    expect(cost(one, "p1", "NEU-C-01")).toBe(5);
    const three = tweak(one, (g) => {
      withStructure("Ashgrove", "Workshop")(g);
      withStructure("Crossmarch", "Workshop")(g);
    });
    expect(cost(three, "p1", "NEU-C-01")).toBe(4);
  });

  it("an Idle Workshop, or one in a city you don't control, gives nothing", () => {
    const g = anaToAct([], 6, (g) => {
      anaControls("Ashgrove")(g);
      withStructure("Ashgrove", "Workshop", "idle")(g);
      setFlock(g, "Goldmere", { p2: 21 }, "p2");
      withStructure("Goldmere", "Workshop")(g);
    });
    expect(cost(g, "p1", "NEU-C-01")).toBe(6);
    expect(cost(g, "p2", "NEU-C-01")).toBe(5);
  });

  it("Red Tape makes the target's next card cost 2 more, once", () => {
    let g = cast(anaToAct(["PRO-C-07"]), "PRO-C-07", { player: "p2" });
    expect(cost(g, "p2", "NEU-F-11")).toBe(3);
    g = tweak(act(g, { type: "endTurn", playerId: "p1" }), (g) => {
      playerById(g, "p2").hand = ["NEU-F-11"];
      playerById(g, "p2").reserve = 5;
    });
    g = act(g, { type: "placeFlock", playerId: "p2", placements: {} });
    g = act(g, { type: "castCard", playerId: "p2", cardId: "NEU-F-11", targets: { city: "Goldmere" } });
    expect(playerById(g, "p2").reserve).toBe(2); // paid 3 (Omen of Hope 1 + 2)
    expect(cost(g, "p2", "NEU-F-11")).toBe(1); // used up
  });

  it("Efficient Tools makes your next card 2 cheaper, but never below 0", () => {
    let g = cast(anaToAct(["PRO-F-08", "NEU-F-11"], 1), "PRO-F-08");
    expect(cost(g, "p1", "NEU-F-11")).toBe(0);
    expect(cost(g, "p1", "NEU-C-01")).toBe(4);
    g = passTurn(passTurn(passTurn(g)));
    expect(g.phase).toMatchObject({ player: "p1" });
  });

  it("City Walls make Calamities against the city cost 2 more and hit for 1 less", () => {
    const g0 = anaToAct(["NAT-C-01"], 8, (g) => {
      setFlock(g, "Goldmere", { p2: 21 }, "p2");
      withStructure("Goldmere", "City Walls")(g);
      setFlock(g, "Stonevale", { p2: 5 });
    });
    expect(cost(g0, "p1", "NAT-C-01", { city: "Goldmere" })).toBe(8);
    expect(cost(g0, "p1", "NAT-C-01", { city: "Stonevale" })).toBe(6);
    const g = cast(g0, "NAT-C-01", { player: "p2", city: "Goldmere", neighbor: "Stonevale" });
    expect(flock(g, "Goldmere")).toEqual({ p2: 17 }); // 5 - 1
    expect(flock(g, "Stonevale")).toEqual({ p2: 2 }); // no walls there
    expect(playerById(g, "p1").reserve).toBe(0);
  });
});

describe("Ruin and destroying structures", () => {
  it("Factory Explosion leaves a Ruin token that cuts income by 1, and Repair Crews clears it", () => {
    let g = cast(anaToAct(["PRO-C-01"], 6, (g) => setFlock(g, "Goldmere", { p2: 21 }, "p2")), "PRO-C-01", {
      player: "p2",
      city: "Goldmere",
    });
    expect(cityState(g, "Goldmere")).toMatchObject({ ruin: 1, flock: { p2: 17 } });
    expect(totalIncome(data, g, "p2")).toBe(1 + 2 + 1 - 1);
    g = tweak(act(g, { type: "endTurn", playerId: "p1" }), (g) => {
      playerById(g, "p2").hand = ["PRO-F-05"];
      playerById(g, "p2").reserve = 4;
    });
    g = act(g, { type: "placeFlock", playerId: "p2", placements: {} });
    g = act(g, { type: "castCard", playerId: "p2", cardId: "PRO-F-05", targets: { repair: "ruin@Goldmere" } });
    expect(cityState(g, "Goldmere")).toMatchObject({ ruin: 0, flock: { p2: 18 } });
  });

  it("Mine Collapse destroys the structure the caster picks", () => {
    const g = cast(
      anaToAct(["PRO-C-05"], 6, (g) => {
        setFlock(g, "Goldmere", { p2: 21 }, "p2");
        withStructure("Goldmere", "Market")(g);
        withStructure("Goldmere", "City Walls")(g);
      }),
      "PRO-C-05",
      { player: "p2", city: "Goldmere", structure: "1" },
    );
    expect(cityState(g, "Goldmere").structures).toEqual([{ kind: "Market", status: "on" }]);
    expect(flock(g, "Goldmere")).toEqual({ p2: 19 }); // 3, minus 1 for the Walls still standing as it hit
    expect(g.destroyed).toEqual([{ city: "Goldmere", kind: "City Walls", turn: g.turnCount }]);
  });

  it("Machine Breakdown hits for 2 when there's no structure to break", () => {
    const g = cast(anaToAct(["PRO-C-06"]), "PRO-C-06", { player: "p2", city: "Goldmere" });
    expect(flock(g, "Goldmere")).toEqual({ p2: 8 });
  });

  it("Collapse of the Works destroys every structure in a region, and each city loses 1", () => {
    const g = cast(
      anaToAct(["PRO-C-02"], 6, (g) => {
        setFlock(g, "Goldmere", { p2: 21 }, "p2");
        withStructure("Goldmere", "Market")(g);
        setFlock(g, "Stonevale", { p2: 3 });
      }),
      "PRO-C-02",
      { player: "p2", region: "B" },
    );
    expect(cityState(g, "Goldmere").structures).toEqual([]);
    expect(flock(g, "Goldmere")).toEqual({ p2: 20 });
    expect(flock(g, "Stonevale")).toEqual({ p2: 2 });
  });

  it("Repair Crews rebuilds a structure destroyed since your last turn", () => {
    let g = anaToAct(["PRO-C-06"], 6, (g) => {
      setFlock(g, "Goldmere", { p2: 21 }, "p2");
      withStructure("Goldmere", "Market")(g);
    });
    g = cast(g, "PRO-C-06", { player: "p2", city: "Goldmere", structure: "0" });
    g = tweak(act(g, { type: "endTurn", playerId: "p1" }), (g) => {
      playerById(g, "p2").hand = ["PRO-F-05"];
      playerById(g, "p2").reserve = 4;
    });
    g = act(g, { type: "placeFlock", playerId: "p2", placements: {} });
    g = act(g, { type: "castCard", playerId: "p2", cardId: "PRO-F-05", targets: { repair: "rebuild@Goldmere@0" } });
    expect(cityState(g, "Goldmere").structures).toEqual([{ kind: "Market", status: "on" }]);
    expect(g.destroyed).toEqual([]);
  });
});

describe("Idle and switched-off structures", () => {
  it("go Idle when a rival converts the city, and work again after the new owner's Economy Phase", () => {
    let g = anaToAct(FULL_HAND, 0, (g) => {
      setFlock(g, "Ashgrove", { p1: 11, p2: 8 }, "p2");
      withStructure("Ashgrove", "Market")(g);
    });
    g = passTurn(passTurn(passTurn(g))); // Ana's next Start converts Ashgrove
    expect(cityState(g, "Ashgrove")).toMatchObject({ controller: "p1", structures: [{ kind: "Market", status: "idle" }] });
    // This turn's income doesn't include the Idle Market...
    expect(playerById(g, "p1").reserve).toBe(3);
    g = act(g, { type: "placeFlock", playerId: "p1", placements: {} });
    // ...but it's working from now on.
    expect(cityState(g, "Ashgrove").structures).toEqual([{ kind: "Market", status: "on" }]);
  });

  it("can be turned on straight away for 2 Flock", () => {
    let g = anaToAct(FULL_HAND, 0, (g) => {
      setFlock(g, "Ashgrove", { p1: 11, p2: 8 }, "p2");
      withStructure("Ashgrove", "Market")(g);
    });
    g = passTurn(passTurn(passTurn(g)));
    expect(step(g)).toBe("economy");
    g = act(g, { type: "restoreStructure", playerId: "p1", city: "Ashgrove", index: 0 });
    expect(cityState(g, "Ashgrove").structures).toEqual([{ kind: "Market", status: "on" }]);
    expect(playerById(g, "p1").reserve).toBe(1);
  });

  it("switch off when the city goes uncontrolled, and stay off when it's converted", () => {
    let g = anaToAct(FULL_HAND, 0, (g) => {
      setFlock(g, "Ashgrove", { p1: 6 }, "p1"); // below 7: lost at Ana's next Start
      withStructure("Ashgrove", "Market")(g);
    });
    g = passTurn(passTurn(passTurn(g)));
    expect(cityState(g, "Ashgrove")).toMatchObject({ controller: null, structures: [{ kind: "Market", status: "off" }] });
    g = tweak(g, (g) => setFlock(g, "Ashgrove", { p1: 11 }));
    g = passTurn(passTurn(passTurn(g)));
    expect(cityState(g, "Ashgrove")).toMatchObject({ controller: "p1", structures: [{ kind: "Market", status: "off" }] });
    g = act(g, { type: "placeFlock", playerId: "p1", placements: {} });
    expect(cityState(g, "Ashgrove").structures[0].status).toBe("off"); // no free wait
  });

  it("switched-off structures can't be restored by Repair Crews (designer ruling)", () => {
    const g = anaToAct(["PRO-F-05"], 6, (g) => {
      anaControls("Ashgrove")(g);
      withStructure("Ashgrove", "Market", "off")(g);
    });
    expect(canCast(data, g, "p1", "PRO-F-05")).toMatchObject({ ok: false });
    const idle = anaToAct(["PRO-F-05"], 6, (g) => {
      anaControls("Ashgrove")(g);
      withStructure("Ashgrove", "Market", "idle")(g);
    });
    expect(canCast(data, idle, "p1", "PRO-F-05")).toEqual({ ok: true });
  });

  it("only the controller can turn a structure on, and not one that's working", () => {
    const g = anaToAct([], 6, (g) => {
      anaControls("Ashgrove")(g);
      withStructure("Ashgrove", "Market")(g);
      setFlock(g, "Goldmere", { p2: 21 }, "p2");
      withStructure("Goldmere", "Market", "idle")(g);
    });
    expect(() => act(g, { type: "restoreStructure", playerId: "p1", city: "Ashgrove", index: 0 })).toThrow(/already working/);
    expect(() => act(g, { type: "restoreStructure", playerId: "p1", city: "Goldmere", index: 0 })).toThrow(/doesn't control/);
  });
});
