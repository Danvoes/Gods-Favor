import { describe, expect, it } from "vitest";
import { loadGameData } from "../data";
import { RULES, RuleError, cityState, conversionThreshold, cityInfo, thresholdFor, waitingFor } from "./rules";
import { applyAction, createGame } from "./engine";
import type { Action, GameState, NewPlayer } from "./types";

const data = loadGameData();

const THREE: NewPlayer[] = [
  { name: "Ana", domain: "Nature" },
  { name: "Ben", domain: "Harvest" },
  { name: "Cy", domain: "Health/Fertility" },
];

function play(state: GameState, ...actions: Action[]): GameState {
  return actions.reduce((s, a) => applyAction(data, s, a), state);
}

function chooseStarts(state: GameState, cities: string[]): GameState {
  return play(
    state,
    ...cities.map((city, i): Action => ({ type: "chooseStartingCity", playerId: `p${i + 1}`, city })),
  );
}

describe("creating a game", () => {
  it("seats players in the order entered, with empty hands and reserves", () => {
    const g = createGame(data, THREE, 1);
    expect(g.players.map((p) => [p.id, p.name, p.seat])).toEqual([["p1", "Ana", 0], ["p2", "Ben", 1], ["p3", "Cy", 2]]);
    expect(g.players.every((p) => p.reserve === 0 && p.hand.length === 0)).toBe(true);
  });

  it("lays out all 9 cities, empty and uncontrolled", () => {
    const g = createGame(data, THREE, 1);
    expect(g.cities).toHaveLength(9);
    expect(g.cities.every((c) => c.controller === null && Object.keys(c.flock).length === 0)).toBe(true);
  });

  it("shuffles all three decks, and the same seed gives the same shuffle", () => {
    const a = createGame(data, THREE, 42);
    const b = createGame(data, THREE, 42);
    const c = createGame(data, THREE, 43);
    expect(a.decks).toEqual(b.decks);
    expect(a.decks.Calamity).not.toEqual(c.decks.Calamity);
    expect(a.decks.Calamity).toHaveLength(50);
    expect(a.decks.Favor).toHaveLength(50);
    expect(a.decks["Free Will"]).toHaveLength(30);
    const unshuffled = data.cards.filter((x) => x.deck === "Calamity").map((x) => x.id);
    expect([...a.decks.Calamity].sort()).toEqual([...unshuffled].sort());
    expect(a.decks.Calamity).not.toEqual(unshuffled);
  });

  it.each([
    [[{ name: "Solo", domain: "Nature" }], /2 to 4 players/],
    [[...THREE, { name: "Di", domain: "Production/Technology" }, { name: "Ed", domain: "Nature" }], /2 to 4 players/],
    [[{ name: "Ana", domain: "Nature" }, { name: " ", domain: "Harvest" }], /needs a name/],
    [[{ name: "Ana", domain: "Nature" }, { name: "ana", domain: "Harvest" }], /different name/],
    [[{ name: "Ana", domain: "Nature" }, { name: "Ben", domain: "Nature" }], /different domain/],
  ] as [NewPlayer[], RegExp][])("refuses a bad player list (%#)", (players, message) => {
    expect(() => createGame(data, players, 1)).toThrow(message);
  });
});

describe("choosing starting cities", () => {
  it("keeps choices secret until everyone has chosen", () => {
    const g = play(createGame(data, THREE, 1), { type: "chooseStartingCity", playerId: "p1", city: "Ashgrove" });
    expect(cityState(g, "Ashgrove").flock).toEqual({});
    expect(g.log.at(-1)).toBe("Ana chose a starting city in secret.");
    expect(waitingFor(g)).toBe("p2");
  });

  it("places 10 Flock for everyone at once, and no one controls a city", () => {
    const g = chooseStarts(createGame(data, THREE, 1), ["Ashgrove", "Goldmere", "Brightwell"]);
    expect(cityState(g, "Ashgrove").flock).toEqual({ p1: 10 });
    expect(cityState(g, "Goldmere").flock).toEqual({ p2: 10 });
    expect(g.cities.every((c) => c.controller === null)).toBe(true);
    expect(g.phase.name).toBe("drawStartingHands");
  });

  it("allows a shared, contested starting city", () => {
    const g = chooseStarts(createGame(data, THREE, 1), ["Stonevale", "Stonevale", "Wheatfield"]);
    expect(cityState(g, "Stonevale").flock).toEqual({ p1: 10, p2: 10 });
    expect(g.log).toContain("Stonevale is contested from the start.");
  });

  it("refuses a second choice, an unknown city, or a choice after the reveal", () => {
    const g = play(createGame(data, THREE, 1), { type: "chooseStartingCity", playerId: "p1", city: "Ashgrove" });
    expect(() => play(g, { type: "chooseStartingCity", playerId: "p1", city: "Goldmere" })).toThrow(/already chosen/);
    expect(() => play(g, { type: "chooseStartingCity", playerId: "p2", city: "Atlantis" })).toThrow(RuleError);
    const done = chooseStarts(createGame(data, THREE, 1), ["Ashgrove", "Goldmere", "Brightwell"]);
    expect(() => play(done, { type: "chooseStartingCity", playerId: "p1", city: "Ashgrove" })).toThrow(/already been chosen/);
  });

  it("never changes the state it was given", () => {
    const before = createGame(data, THREE, 1);
    const copy = structuredClone(before);
    play(before, { type: "chooseStartingCity", playerId: "p1", city: "Ashgrove" });
    expect(before).toEqual(copy);
  });
});

describe("turn order", () => {
  it("smallest starting city goes first, then clockwise (seat order)", () => {
    // Cy (seat 3) picks the only small city, so Cy, then Ana, then Ben.
    const g = chooseStarts(createGame(data, THREE, 1), ["Goldmere", "Cogsworth", "Havenspring"]);
    expect(g.turnOrder).toEqual(["p3", "p1", "p2"]);
  });

  it("breaks ties randomly, but the same seed always breaks them the same way", () => {
    const firsts = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const g = chooseStarts(createGame(data, THREE, seed), ["Ashgrove", "Goldmere", "Wheatfield"]);
      expect(["p1", "p3"]).toContain(g.turnOrder[0]);
      expect(g.turnOrder).toEqual(
        chooseStarts(createGame(data, THREE, seed), ["Ashgrove", "Goldmere", "Wheatfield"]).turnOrder,
      );
      firsts.add(g.turnOrder[0]);
    }
    expect(firsts).toEqual(new Set(["p1", "p3"])); // both tied players win sometimes
  });
});

describe("drawing starting hands", () => {
  const ready = () => chooseStarts(createGame(data, THREE, 7), ["Goldmere", "Cogsworth", "Havenspring"]);

  it("goes in turn order and takes the top card of the chosen deck", () => {
    const g = ready();
    const top = g.decks.Favor.at(-1);
    const after = play(g, { type: "drawCard", playerId: "p3", deck: "Favor" });
    expect(after.players[2].hand).toEqual([top]);
    expect(after.decks.Favor).toHaveLength(49);
    expect(() => play(g, { type: "drawCard", playerId: "p1", deck: "Favor" })).toThrow(/Cy's turn to draw/);
  });

  it("finishes setup once everyone has 5 cards", () => {
    let g = ready();
    for (const id of g.turnOrder) {
      for (let i = 0; i < RULES.handSize; i++) {
        g = play(g, { type: "drawCard", playerId: id, deck: i % 2 ? "Favor" : "Calamity" });
      }
    }
    expect(g.players.every((p) => p.hand.length === 5)).toBe(true);
    expect(g.decks.Calamity.length + g.decks.Favor.length).toBe(100 - 15);
    expect(g.phase).toMatchObject({ name: "turn", player: g.turnOrder[0], round: 1 });
    expect(waitingFor(g)).toBe(g.turnOrder[0]);
    expect(g.log).toContain("Ana drew 3 Calamity and 2 Favor.");
  });
});

describe("conversion thresholds", () => {
  it("uses 41% for a matching domain and 51% otherwise", () => {
    expect(conversionThreshold(cityInfo(data, "Stonevale"), "Nature")).toBe(21);
    expect(conversionThreshold(cityInfo(data, "Stonevale"), "Harvest")).toBe(26);
    expect(conversionThreshold(cityInfo(data, "Crossmarch"), "Nature")).toBe(18);
  });

  it("adds 10 points against a rival's Temple, but not your own", () => {
    let g = chooseStarts(createGame(data, THREE, 1), ["Goldmere", "Cogsworth", "Havenspring"]);
    g = structuredClone(g);
    const goldmere = cityState(g, "Goldmere");
    goldmere.controller = "p1";
    goldmere.holySite = "Temple";
    expect(thresholdFor(data, g, "Goldmere", "p2")).toBe(26); // Ben matches Harvest: 51%
    expect(thresholdFor(data, g, "Goldmere", "p3")).toBe(31); // Cy: 61%
    expect(thresholdFor(data, g, "Goldmere", "p1")).toBe(26); // Ana's own Temple: plain 51%
  });
});
