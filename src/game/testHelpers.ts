// Shared helpers for the engine tests.

import { loadGameData } from "../data";
import { applyAction, createGame } from "./engine";
import { expect } from "vitest";
import { RULES, cityState, playerById } from "./rules";
import type { Action, GameState, PlayerId } from "./types";

export const data = loadGameData();

/**
 * A 3-player game, set up and on Ana's first turn.
 * Ana (Nature) starts in Ashgrove, Ben (Harvest) in Goldmere, Cy (Health) in
 * Brightwell. Ashgrove is the only small city, so Ana goes first.
 */
export function newGame(): GameState {
  let g = createGame(
    data,
    [
      { name: "Ana", domain: "Nature" },
      { name: "Ben", domain: "Harvest" },
      { name: "Cy", domain: "Health/Fertility" },
    ],
    123,
  );
  const starts = { p1: "Ashgrove", p2: "Goldmere", p3: "Brightwell" };
  for (const [playerId, city] of Object.entries(starts)) g = act(g, { type: "chooseStartingCity", playerId, city });
  for (const playerId of g.turnOrder) {
    for (let i = 0; i < RULES.handSize; i++) g = act(g, { type: "drawCard", playerId, deck: "Favor" });
  }
  return g;
}

export function act(g: GameState, action: Action): GameState {
  return applyAction(data, g, action);
}

/** Changes a game directly, to set up a situation for a test. */
export function tweak(g: GameState, change: (g: GameState) => void): GameState {
  const copy = structuredClone(g);
  change(copy);
  return copy;
}

export function setFlock(g: GameState, city: string, flock: Record<PlayerId, number>, controller: PlayerId | null = null) {
  const c = cityState(g, city);
  c.flock = flock;
  c.controller = controller;
}

/** Finishes whatever's left of the current player's turn without doing anything. */
export function passTurn(g: GameState): GameState {
  if (g.phase.name !== "turn") throw new Error("not a turn");
  const id = g.phase.player;
  while (g.phase.name === "turn" && g.phase.step === "draw") g = act(g, { type: "drawCard", playerId: id, deck: "Favor" });
  if (g.phase.name === "turn" && g.phase.step === "economy") g = act(g, { type: "placeFlock", playerId: id, placements: {} });
  return act(g, { type: "endTurn", playerId: id });
}

export const step = (g: GameState) => (g.phase.name === "turn" ? g.phase.step : g.phase.name);
export const current = (g: GameState) => (g.phase.name === "turn" ? g.phase.player : null);


/**
 * Ana's Action step, holding exactly `hand`, with `reserve` Flock in reserve.
 * Board: Ana 10 in Ashgrove, Ben 10 in Goldmere, Cy 10 in Brightwell.
 */
export function anaToAct(hand: string[], reserve = 6, change: (g: GameState) => void = () => {}): GameState {
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

export const cast = (g: GameState, cardId: string, targets: Record<string, string> = {}, payFrom?: Record<string, number>) =>
  act(g, { type: "castCard", playerId: "p1", cardId, targets, payFrom });

export const flock = (g: GameState, city: string) => cityState(g, city).flock;

