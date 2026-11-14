import { describe, expect, it } from "vitest";
import { canCast, castingQuestions } from "./cast";
import { EFFECTS, isPlayable } from "./effects";
import { cityState, playerById } from "./rules";
import { act, data, newGame, passTurn, setFlock, step, tweak } from "./testHelpers";
import type { GameState } from "./types";

/**
 * Ana's Action step, holding exactly `hand`, with `reserve` Flock in reserve.
 * Board: Ana 10 in Ashgrove, Ben 10 in Goldmere, Cy 10 in Brightwell.
 */
function anaToAct(hand: string[], reserve = 6, change: (g: GameState) => void = () => {}): GameState {
  let g = act(newGame(), { type: "placeFlock", playerId: "p1", placements: {} });
  g = tweak(g, (g) => {
    const ana = playerById(g, "p1");
    ana.hand = [...hand];
    ana.reserve = reserve;
    change(g);
  });
  expect(step(g)).toBe("action");
  return g;
}

const cast = (g: GameState, cardId: string, targets: Record<string, string> = {}, payFrom?: Record<string, number>) =>
  act(g, { type: "castCard", playerId: "p1", cardId, targets, payFrom });

const flock = (g: GameState, city: string) => cityState(g, city).flock;

describe("every card is accounted for", () => {
  it("has an entry for each Calamity and Favor in cards.csv", () => {
    const ids = data.cards.filter((c) => c.kind === "divine").map((c) => c.id);
    expect(Object.keys(EFFECTS).sort()).toEqual(ids.sort());
  });

  // If this fails, a card's text in cards.csv changed: update its code in
  // src/game/effects.ts to match, then copy the new text into its entry.
  it.each(Object.entries(EFFECTS).filter(([, e]) => isPlayable(e)))("%s's code matches its text in cards.csv", (id, effect) => {
    const card = data.cards.find((c) => c.id === id)!;
    expect(isPlayable(effect) && effect.text).toBe(card.effect);
  });

  it("can play about half the deck in milestone 4a", () => {
    const playable = Object.values(EFFECTS).filter(isPlayable).length;
    expect(playable).toBe(49);
  });
});

describe("casting a card", () => {
  it("pays from reserve, resolves, discards and moves to the End step", () => {
    let g = anaToAct(["NEU-C-01"], 8); // War: target city loses 5
    g = cast(g, "NEU-C-01", { player: "p2", city: "Goldmere" });
    expect(flock(g, "Goldmere")).toEqual({ p2: 5 });
    expect(playerById(g, "p1").reserve).toBe(2);
    expect(playerById(g, "p1").hand).toEqual([]);
    expect(g.discards.Calamity).toEqual(["NEU-C-01"]);
    expect(step(g)).toBe("end");
    expect(g.log).toContain("Ana casts War at Ben (Calamity, cost 6).");
    expect(g.log).toContain("  Goldmere: Ben loses 5 Flock.");
  });

  it("takes the rest of the cost from cities the caster picks when reserve runs short", () => {
    let g = anaToAct(["NEU-C-01"], 2);
    expect(() => cast(g, "NEU-C-01", { player: "p2", city: "Goldmere" })).toThrow(/choose cities to pay the other 4/);
    expect(() => cast(g, "NEU-C-01", { player: "p2", city: "Goldmere" }, { Ashgrove: 3 })).toThrow(/chosen so far: 3/);
    expect(() => cast(g, "NEU-C-01", { player: "p2", city: "Goldmere" }, { Goldmere: 4 })).toThrow(/can't pay 4 from Goldmere/);
    g = cast(g, "NEU-C-01", { player: "p2", city: "Goldmere" }, { Ashgrove: 4 });
    expect(playerById(g, "p1").reserve).toBe(0);
    expect(flock(g, "Ashgrove")).toEqual({ p1: 6 });
    expect(g.log).toContain("Ana casts War at Ben (Calamity, cost 6, paid 2 from reserve and 4 from Ashgrove).");
  });

  it("refuses to take from cities when reserve already covers the cost", () => {
    const g = anaToAct(["NEU-C-11"], 3);
    expect(() => cast(g, "NEU-C-11", { player: "p2", city: "Goldmere" }, { Ashgrove: 1 })).toThrow(/reserve covers the whole cost/);
  });

  it("can't be afforded with fewer Flock in total than the cost", () => {
    const g = anaToAct(["NEU-C-01"], 0, (g) => setFlock(g, "Ashgrove", { p1: 5 }));
    expect(canCast(data, g, "p1", "NEU-C-01")).toEqual({ ok: false, reason: "Costs 6, but you only have 5 Flock in all." });
  });

  it("refuses cards not in hand, cards not playable yet, and casting outside the Action step", () => {
    const g = anaToAct(["HAR-F-01"]);
    expect(() => cast(g, "NEU-C-01", { player: "p2", city: "Goldmere" })).toThrow(/doesn't have War in hand/);
    expect(() => cast(g, "HAR-F-01")).toThrow(/Coming in milestone 4b: this card plants a seed/);
    const economy = newGame();
    expect(() => cast(economy, "HAR-F-01")).toThrow(/while placing Flock/);
  });

  it("allows only one action: after casting, the turn can only end", () => {
    let g = anaToAct(["NEU-C-11", "NEU-C-12"]);
    g = cast(g, "NEU-C-11", { player: "p2", city: "Goldmere" });
    expect(() => cast(g, "NEU-C-12", { player: "p2", city: "Goldmere" })).toThrow(/while ending the turn/);
    g = act(g, { type: "endTurn", playerId: "p1" });
    expect(g.phase).toMatchObject({ player: "p2" });
  });

  it("leaves a smaller hand, so next turn starts with a Draw step", () => {
    let g = anaToAct(["NEU-C-11", "NEU-F-11", "NEU-F-12", "NEU-F-13", "NEU-F-14"]);
    g = cast(g, "NEU-F-13"); // Alms
    g = passTurn(passTurn(passTurn(g)));
    expect(g.phase).toMatchObject({ player: "p1", step: "draw" });
  });

  it("refuses an answer that isn't one of the allowed choices", () => {
    const g = anaToAct(["NEU-F-03"]); // Pilgrimage: a city you control or have Flock in
    expect(() => cast(g, "NEU-F-03", { city: "Goldmere" })).toThrow(/"Which of your cities\?" needs one of: Ashgrove/);
  });
});

describe("asking the card's questions one at a time", () => {
  it("offers each next question once the previous one is answered", () => {
    const g = anaToAct(["NAT-C-01"]); // Wildfire: player, city, neighbor
    const first = castingQuestions(data, g, "p1", "NAT-C-01", {});
    expect(first.map((q) => q.key)).toEqual(["player"]);
    expect(first[0].options.map((o) => o.label)).toEqual(["Ben", "Cy", "Ana (you)"]);
    const third = castingQuestions(data, g, "p1", "NAT-C-01", { player: "p2", city: "Goldmere" });
    expect(third.map((q) => q.key)).toEqual(["player", "city", "neighbor"]);
    expect(third[2].options.map((o) => o.value)).toEqual(["Havenspring", "Stonevale"]);
    expect(third[1].options.find((o) => o.value === "Goldmere")?.label).toBe("Goldmere (Ben has 10)");
  });
});

describe("Calamities", () => {
  it("only hit the target player's Flock, in the city and where it spreads", () => {
    const g = cast(
      anaToAct(["NAT-C-01"], 6, (g) => {
        setFlock(g, "Goldmere", { p2: 10, p3: 4 });
        setFlock(g, "Stonevale", { p2: 2 });
      }),
      "NAT-C-01",
      { player: "p2", city: "Goldmere", neighbor: "Stonevale" },
    );
    expect(flock(g, "Goldmere")).toEqual({ p2: 5, p3: 4 });
    expect(flock(g, "Stonevale")).toEqual({});
    expect(g.log).toContain("  Stonevale: Ben loses 2 Flock (all they had).");
  });

  it("can target your own city", () => {
    const g = cast(anaToAct(["NEU-C-11"]), "NEU-C-11", { player: "p1", city: "Ashgrove" });
    expect(flock(g, "Ashgrove")).toEqual({ p1: 9 });
  });

  it("Great Flood hits every city in a region", () => {
    const g = cast(
      anaToAct(["NAT-C-02"], 6, (g) => setFlock(g, "Stonevale", { p2: 5 })),
      "NAT-C-02",
      { player: "p2", region: "B" },
    );
    expect(flock(g, "Goldmere")).toEqual({ p2: 7 });
    expect(flock(g, "Stonevale")).toEqual({ p2: 2 });
  });

  it("Strong Winds moves 1 Flock into a neighbor the target doesn't control", () => {
    const g0 = anaToAct(["NAT-C-09"], 6, (g) => setFlock(g, "Stonevale", { p2: 21 }, "p2"));
    const q = castingQuestions(data, g0, "p1", "NAT-C-09", { player: "p2", city: "Goldmere" });
    expect(q[2].options.map((o) => o.value)).toEqual(["Havenspring"]); // not Stonevale, Ben controls it
    const g = cast(g0, "NAT-C-09", { player: "p2", city: "Goldmere", neighbor: "Havenspring" });
    expect(flock(g, "Goldmere")).toEqual({ p2: 9 });
    expect(flock(g, "Havenspring")).toEqual({ p2: 1 });
  });

  it("reserve losses stop at zero", () => {
    const g = cast(
      anaToAct(["HAR-C-06"], 6, (g) => (playerById(g, "p2").reserve = 1)),
      "HAR-C-06",
      { player: "p2" },
    );
    expect(playerById(g, "p2").reserve).toBe(0);
    expect(g.log).toContain("  Ben loses 1 Flock from reserve (all they had).");
  });

  it("Fever hits harder when another Health Calamity is in the discard pile", () => {
    const plain = cast(anaToAct(["HEA-C-03"]), "HEA-C-03", { player: "p2", city: "Goldmere" });
    expect(flock(plain, "Goldmere")).toEqual({ p2: 8 });
    const worse = cast(
      anaToAct(["HEA-C-03"], 6, (g) => g.discards.Calamity.push("HEA-C-08")),
      "HEA-C-03",
      { player: "p2", city: "Goldmere" },
    );
    expect(flock(worse, "Goldmere")).toEqual({ p2: 6 });
  });

  it("Withering counts Health Calamities in the discard pile, up to 3", () => {
    const g = cast(
      anaToAct(["HEA-C-07"], 6, (g) => g.discards.Calamity.push("HEA-C-08", "HEA-C-09", "HEA-C-03", "HEA-C-05", "NEU-C-01")),
      "HEA-C-07",
      { player: "p2", city: "Goldmere" },
    );
    expect(flock(g, "Goldmere")).toEqual({ p2: 7 });
  });

  it("Chills discards a random card, the same one for the same seed", () => {
    const g0 = anaToAct(["HEA-C-08"]);
    const benHand = playerById(g0, "p2").hand;
    const a = cast(g0, "HEA-C-08", { player: "p2" });
    const b = cast(g0, "HEA-C-08", { player: "p2" });
    expect(playerById(a, "p2").hand).toHaveLength(4);
    expect(playerById(a, "p2").hand).toEqual(playerById(b, "p2").hand);
    const discarded = benHand.find((id) => !playerById(a, "p2").hand.includes(id))!;
    expect(a.discards.Favor).toContain(discarded);
  });

  it("records which cities a Calamity hit this turn", () => {
    const g = cast(anaToAct(["NAT-C-08"]), "NAT-C-08", { player: "p2", city: "Goldmere", neighbor: "Stonevale" });
    expect(g.phase).toMatchObject({ calamityHits: ["Goldmere", "Stonevale"] });
  });
});

describe("Favors", () => {
  it("add your own Flock to a city you have Flock in, and a neighbor can be anywhere next door", () => {
    const g = cast(anaToAct(["NAT-F-01"]), "NAT-F-01", { city: "Ashgrove", neighbor: "Ironhold" });
    expect(flock(g, "Ashgrove")).toEqual({ p1: 15 });
    expect(flock(g, "Ironhold")).toEqual({ p1: 3 });
  });

  it("Sacred Grove only spreads to other cities where you have Flock", () => {
    const g = cast(
      anaToAct(["NAT-F-04"], 6, (g) => setFlock(g, "Ironhold", { p1: 1 })),
      "NAT-F-04",
      { city: "Ashgrove" },
    );
    expect(flock(g, "Ashgrove")).toEqual({ p1: 12 });
    expect(flock(g, "Ironhold")).toEqual({ p1: 2 });
    expect(flock(g, "Crossmarch")).toEqual({});
  });

  it("Animal Guides moves up to 2 Flock to a neighbor, then adds 1", () => {
    const g = cast(anaToAct(["NAT-F-07"]), "NAT-F-07", { city: "Ashgrove", neighbor: "Crossmarch", amount: "2" });
    expect(flock(g, "Ashgrove")).toEqual({ p1: 8 });
    expect(flock(g, "Crossmarch")).toEqual({ p1: 3 });
  });

  it("Tailwind takes 1 of an opponent's Flock from a neighbor of your city", () => {
    const g0 = anaToAct(["NAT-F-09"], 6, (g) => setFlock(g, "Crossmarch", { p2: 4 }));
    expect(castingQuestions(data, g0, "p1", "NAT-F-09", { city: "Ashgrove" })[1].options).toEqual([
      { value: "p2@Crossmarch", label: "Ben in Crossmarch (has 4)" },
    ]);
    const g = cast(g0, "NAT-F-09", { city: "Ashgrove", steal: "p2@Crossmarch" });
    expect(flock(g, "Crossmarch")).toEqual({ p2: 3 });
    expect(flock(g, "Ashgrove")).toEqual({ p1: 11 });
  });

  it("Tailwind can't be cast with no opponent next door", () => {
    expect(() => cast(anaToAct(["NAT-F-09"]), "NAT-F-09", { city: "Ashgrove", steal: "p2@Goldmere" })).toThrow(
      /No opponent has Flock in a neighboring city/,
    );
  });

  it("Golden Age needs two cities you control", () => {
    const g0 = anaToAct(["NEU-F-02"]);
    expect(canCast(data, g0, "p1", "NEU-F-02")).toEqual({ ok: false, reason: "You need to control two cities." });
    const g = cast(
      anaToAct(["NEU-F-02"], 6, (g) => {
        setFlock(g, "Ashgrove", { p1: 11 }, "p1");
        setFlock(g, "Crossmarch", { p1: 18 }, "p1");
      }),
      "NEU-F-02",
      { city: "Ashgrove", city2: "Crossmarch" },
    );
    expect(flock(g, "Ashgrove")).toEqual({ p1: 13 });
    expect(flock(g, "Crossmarch")).toEqual({ p1: 20 });
    expect(playerById(g, "p1").reserve).toBe(1); // 6 - 6 + 1
  });

  it("Midwives adds 1 per Health Favor in the discard pile, at most 3", () => {
    const g = cast(
      anaToAct(["HEA-F-04"], 6, (g) => g.discards.Favor.push("HEA-F-08", "HEA-F-09", "HEA-F-06", "HEA-F-07")),
      "HEA-F-04",
      { city: "Ashgrove" },
    );
    expect(flock(g, "Ashgrove")).toEqual({ p1: 15 });
  });

  it("Second Life takes a cheap Favor back from the discard pile", () => {
    const g0 = anaToAct(["HEA-F-07"], 6, (g) => g.discards.Favor.push("NEU-F-01", "NEU-F-11"));
    expect(castingQuestions(data, g0, "p1", "HEA-F-07", {})[0].options.map((o) => o.value)).toEqual(["NEU-F-11"]);
    const g = cast(g0, "HEA-F-07", { card: "NEU-F-11" });
    expect(playerById(g, "p1").hand).toEqual(["NEU-F-11"]);
    expect(g.discards.Favor).toEqual(["NEU-F-01", "HEA-F-07"]);
  });

  it("Testimony adds to a city and to reserve", () => {
    const g = cast(anaToAct(["NEU-F-14"], 2), "NEU-F-14", { city: "Ashgrove" });
    expect(flock(g, "Ashgrove")).toEqual({ p1: 11 });
    expect(playerById(g, "p1").reserve).toBe(1);
  });
});
