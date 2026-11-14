import { describe, expect, it } from "vitest";
import { castingQuestions } from "./cast";
import { canCounter } from "./respond";
import { playerById, waitingFor } from "./rules";
import { act, anaToAct, cast, data, flock, setFlock } from "./testHelpers";
import type { GameState, Response } from "./types";

// Ana is Nature, Ben is Harvest, Cy is Health/Fertility.

const castRaw = (g: GameState, cardId: string, targets: Record<string, string>, playerId = "p1") =>
  act(g, { type: "castCard", playerId, cardId, targets });
const reply = (g: GameState, playerId: string, response: Response) => act(g, { type: "respond", playerId, response });
const handoffs = (g: GameState) => (g.phase.name === "turn" ? g.phase.handoffs : -1);

/** Gives a player cards and reserve. */
const give = (id: string, hand: string[], reserve: number) => (g: GameState) => {
  playerById(g, id).hand.push(...hand);
  playerById(g, id).reserve = reserve;
};

describe("the target is always asked", () => {
  it("waits for the target before a Calamity resolves, even with no counter in hand", () => {
    let g = castRaw(anaToAct(["NEU-C-01"]), "NEU-C-01", { player: "p2", city: "Goldmere" });
    expect(g.phase).toMatchObject({ step: "respond", pending: { stage: "counter", responder: "p2" } });
    expect(waitingFor(g)).toBe("p2");
    expect(flock(g, "Goldmere")).toEqual({ p2: 10 }); // not yet
    expect(() => act(g, { type: "endTurn", playerId: "p1" })).toThrow(/waiting for a response/);
    g = reply(g, "p2", { kind: "decline" });
    expect(flock(g, "Goldmere")).toEqual({ p2: 5 });
    expect(g.phase).toMatchObject({ step: "end" });
    expect(waitingFor(g)).toBe("p1");
    expect(handoffs(g)).toBe(2); // Ana -> Ben -> Ana
    expect(g.log).toContain("Ben lets it happen.");
  });

  it("doesn't ask anyone when you target yourself and no one can redirect", () => {
    const g = castRaw(anaToAct(["NEU-C-11"]), "NEU-C-11", { player: "p1", city: "Ashgrove" });
    expect(g.phase).toMatchObject({ step: "end" });
    expect(handoffs(g)).toBe(0);
  });

  it("only the player being asked can respond", () => {
    const g = castRaw(anaToAct(["NEU-C-01"]), "NEU-C-01", { player: "p2", city: "Goldmere" });
    expect(() => reply(g, "p3", { kind: "decline" })).toThrow(/waiting for Ben, not Cy/);
  });
});

describe("redirecting", () => {
  it("asks the player whose domain matches first, and they can pay to pick a new target", () => {
    // Fever is a Health Calamity: Cy may redirect it.
    let g = castRaw(anaToAct(["HEA-C-03"], 6, give("p3", [], 4)), "HEA-C-03", { player: "p2", city: "Goldmere" });
    expect(g.phase).toMatchObject({ pending: { stage: "redirect", responder: "p3" } });
    expect(() => reply(g, "p3", { kind: "redirect", newTarget: "p2" })).toThrow(/other than Ben/);
    g = reply(g, "p3", { kind: "redirect", newTarget: "p1" });
    expect(playerById(g, "p3").reserve).toBe(0);
    // Now aimed at Ana, the caster, so nobody else is asked: it resolves on Ana's Goldmere Flock (none).
    expect(g.phase).toMatchObject({ step: "end" });
    expect(flock(g, "Goldmere")).toEqual({ p2: 10 });
    expect(g.log).toContain("Cy pays 4 to redirect Fever from Ben to Ana.");
  });

  it("then asks the new target whether to counter", () => {
    let g = castRaw(anaToAct(["HEA-C-03"], 6, give("p3", [], 4)), "HEA-C-03", { player: "p1", city: "Ashgrove" });
    g = reply(g, "p3", { kind: "redirect", newTarget: "p2" });
    expect(g.phase).toMatchObject({ pending: { stage: "counter", responder: "p2", redirected: true } });
    g = reply(g, "p2", { kind: "decline" });
    expect(flock(g, "Ashgrove")).toEqual({ p1: 10 }); // Ben has none in Ashgrove: nothing happens
  });

  it("isn't offered to a player who can't afford it, or for Neutral Calamities", () => {
    const poor = castRaw(anaToAct(["HEA-C-03"], 6, (g) => {
      playerById(g, "p3").reserve = 0;
      setFlock(g, "Brightwell", { p3: 3 });
    }), "HEA-C-03", { player: "p2", city: "Goldmere" });
    expect(poor.phase).toMatchObject({ pending: { stage: "counter", responder: "p2" } });
  });

  it("doesn't pass the device again when the redirector is also the target", () => {
    // Blight is Harvest; Ben is both the Harvest god and the target.
    let g = castRaw(anaToAct(["HAR-C-02"], 6, give("p2", [], 6)), "HAR-C-02", { player: "p2", city: "Goldmere" });
    expect(g.phase).toMatchObject({ pending: { stage: "redirect", responder: "p2" }, handoffs: 1 });
    g = reply(g, "p2", { kind: "decline" });
    expect(g.phase).toMatchObject({ pending: { stage: "counter", responder: "p2" }, handoffs: 1 });
  });

  it("can pay part of the cost from cities", () => {
    let g = castRaw(anaToAct(["HEA-C-03"], 6, give("p3", [], 1)), "HEA-C-03", { player: "p2", city: "Goldmere" });
    g = reply(g, "p3", { kind: "redirect", newTarget: "p1", payFrom: { Brightwell: 3 } });
    expect(flock(g, "Brightwell")).toEqual({ p3: 7 });
  });
});

describe("counters", () => {
  it("Cure cancels a Calamity at you and puts it on the bottom of the Calamity deck", () => {
    let g = castRaw(anaToAct(["NEU-C-01"], 6, give("p2", ["HEA-F-05"], 4)), "NEU-C-01", { player: "p2", city: "Goldmere" });
    expect(canCounter(data, g, "p2", "HEA-F-05")).toEqual({ ok: true });
    g = reply(g, "p2", { kind: "counter", cardId: "HEA-F-05", targets: {} });
    expect(flock(g, "Goldmere")).toEqual({ p2: 10 });
    expect(g.decks.Calamity[0]).toBe("NEU-C-01");
    expect(g.discards.Calamity).toEqual([]);
    expect(g.discards.Favor).toContain("HEA-F-05");
    expect(playerById(g, "p2").reserve).toBe(0);
    expect(g.phase).toMatchObject({ step: "end" });
  });

  it("Shelter of the Wild cancels a Calamity on one of your cities; that city and a neighbor gain 1", () => {
    let g = castRaw(anaToAct(["NEU-C-01"], 6, give("p2", ["NAT-F-05"], 4)), "NEU-C-01", { player: "p2", city: "Goldmere" });
    g = reply(g, "p2", { kind: "counter", cardId: "NAT-F-05", targets: { neighbor: "Stonevale" } });
    expect(flock(g, "Goldmere")).toEqual({ p2: 11 });
    expect(flock(g, "Stonevale")).toEqual({ p2: 1 });
    expect(g.discards.Calamity).toEqual(["NEU-C-01"]);
  });

  it("Shelter of the Wild can't stop a Calamity that isn't aimed at one of your cities", () => {
    const g = castRaw(anaToAct(["HAR-C-06"], 6, give("p2", ["NAT-F-05"], 4)), "HAR-C-06", { player: "p2" });
    expect(g.phase).toMatchObject({ pending: { stage: "redirect" } }); // Ben is Harvest: redirect first
    const atCounter = reply(g, "p2", { kind: "decline" });
    expect(canCounter(data, atCounter, "p2", "NAT-F-05")).toEqual({
      ok: false,
      reason: "Shelter of the Wild only works on a Calamity aimed at one of your cities.",
    });
  });

  it("can't be cast as an ordinary action", () => {
    const g = anaToAct(["NAT-F-05"]);
    expect(() => act(g, { type: "castCard", playerId: "p1", cardId: "NAT-F-05", targets: {} })).toThrow(/A counter/);
  });

  it("must be affordable", () => {
    const g = castRaw(
      anaToAct(["NEU-C-01"], 6, (g) => {
        give("p2", ["HEA-F-05"], 0)(g);
        setFlock(g, "Goldmere", { p2: 3 });
      }),
      "NEU-C-01",
      { player: "p2", city: "Goldmere" },
    );
    expect(canCounter(data, g, "p2", "HEA-F-05")).toEqual({ ok: false, reason: "Costs 4, but you only have 3 Flock in all." });
  });
});

describe("Barren Years: the target chooses", () => {
  it("lets the target pick 2 discards, then hits each city they control", () => {
    let g = castRaw(anaToAct(["HEA-C-02"], 6, (g) => setFlock(g, "Goldmere", { p2: 21 }, "p2")), "HEA-C-02", { player: "p2" });
    g = reply(g, "p3", { kind: "decline" }); // Cy (Health) may redirect it first
    g = reply(g, "p2", { kind: "decline" }); // Ben has no counter
    expect(g.phase).toMatchObject({ pending: { stage: "choose", responder: "p2" } });
    const hand = playerById(g, "p2").hand;
    expect(() => reply(g, "p2", { kind: "choose", cardIds: [hand[0]] })).toThrow(/choose 2 different cards/);
    g = reply(g, "p2", { kind: "choose", cardIds: [hand[0], hand[1]] });
    expect(playerById(g, "p2").hand).toEqual(hand.slice(2));
    expect(flock(g, "Goldmere")).toEqual({ p2: 20 });
  });
});

describe("playing from the discard pile", () => {
  it("Contagion plays a cheap Calamity from the discard pile against its target, asking that card's questions", () => {
    const g0 = anaToAct(["HEA-C-04"], 6, (g) => g.discards.Calamity.push("NEU-C-07", "NEU-C-01"));
    const qs = castingQuestions(data, g0, "p1", "HEA-C-04", { player: "p2", inner: "NEU-C-07" });
    expect(qs.map((q) => q.key)).toEqual(["player", "inner", "in_city"]);
    expect(qs[1].options.map((o) => o.value)).toEqual(["NEU-C-07"]); // War costs 6: not offered
    const g = cast(g0, "HEA-C-04", { player: "p2", inner: "NEU-C-07", in_city: "Goldmere" });
    expect(flock(g, "Goldmere")).toEqual({ p2: 8 });
    expect(g.discards.Calamity).toEqual(["NEU-C-07", "NEU-C-01", "HEA-C-04"]);
  });

  it("Remembered Prayers plays a Favor from the discard pile for free", () => {
    const g = cast(
      anaToAct(["HEA-F-03"], 4, (g) => g.discards.Favor.push("NEU-F-03")),
      "HEA-F-03",
      { inner: "NEU-F-03", in_city: "Ashgrove" },
    );
    expect(flock(g, "Ashgrove")).toEqual({ p1: 13 });
    expect(playerById(g, "p1").reserve).toBe(0);
    expect(g.discards.Favor).toEqual(["NEU-F-03", "HEA-F-03"]);
  });

  it("a redirected Contagion hits the new target", () => {
    let g = castRaw(
      anaToAct(["HEA-C-04"], 6, (g) => {
        g.discards.Calamity.push("NEU-C-07");
        give("p3", [], 4)(g);
        setFlock(g, "Goldmere", { p2: 10, p3: 5 });
      }),
      "HEA-C-04",
      { player: "p2", inner: "NEU-C-07", in_city: "Goldmere" },
    );
    g = reply(g, "p3", { kind: "redirect", newTarget: "p1" });
    expect(flock(g, "Goldmere")).toEqual({ p2: 10, p3: 5 }); // Ana has none there
  });
});
