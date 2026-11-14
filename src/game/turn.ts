// The turn loop, following "Turn sequence" in docs/RULES.md:
//   1. Start    - lose cities below 25%, convert cities, check for a win
//   2. Draw     - refill your hand to 5 (player chooses decks)
//   3. Prophecy - Free Will cards (milestone 5; skipped for now)
//   4. Economy  - collect income, then place Flock or keep it (player chooses)
//   5. Action   - one action (milestones 4-7; for now just end the turn)
//   6. End      - mark you if you hold 2 regions, then the next player starts
//
// Phases that need no decision run on their own. The game only stops at the
// steps where it's waiting for the player: draw, economy and action.

import type { GameData } from "../data/types";
import { takeTopCard } from "./deck";
import {
  RULES,
  RuleError,
  cityInfo,
  citiesControlledBy,
  flockIn,
  incomeBreakdown,
  placeableCities,
  playerById,
  regionsControlledBy,
  thresholdFor,
} from "./rules";
import type { CityState, DrawDeck, GameState, PlayerId, TurnStep } from "./types";

/** Starts a player's turn: runs the Start phase, then any phases needing no decision. */
export function beginTurn(data: GameData, state: GameState, playerId: PlayerId, round: number) {
  const player = playerById(state, playerId);
  state.log.push(`Round ${round}: ${player.name}'s turn.`);
  state.phase = {
    name: "turn",
    player: playerId,
    round,
    step: "draw",
    logStart: state.log.length - 1,
    calamityHits: [],
  };

  const won = startPhase(data, state, playerId);
  if (!won) advance(data, state);
}

// ---------------------------------------------------------------- 1. Start

/** Returns true if this player has just won. */
function startPhase(data: GameData, state: GameState, playerId: PlayerId): boolean {
  const player = playerById(state, playerId);

  // 1. "Any city you control where your Flock is below 25% of its population becomes uncontrolled."
  for (const city of citiesControlledBy(state, playerId)) {
    const loseBelow = cityInfo(data, city.name).loseBelow;
    if (flockIn(city, playerId) < loseBelow) {
      city.controller = null;
      state.log.push(
        `${player.name} has only ${flockIn(city, playerId)} Flock in ${city.name} (needs ${loseBelow} to keep it), so it becomes uncontrolled.`,
      );
      desecrate(state, city);
    }
  }

  // 2. "Any city where your Flock is at or above its threshold converts to you."
  for (const city of state.cities) {
    if (city.controller === playerId) continue;
    const threshold = thresholdFor(data, state, city.name, playerId);
    if (flockIn(city, playerId) >= threshold) convert(state, city, playerId, threshold);
  }

  // 3. "If you were marked as holding 2 regions at the end of your last turn
  //     and still control 2 regions now, you win."
  if (player.holdingRegions) {
    const regions = regionsControlledBy(data, state, playerId);
    if (regions.length >= RULES.regionsToWin) {
      state.log.push(`${player.name} still holds regions ${regions.join(" and ")}. ${player.name} wins!`);
      state.phase = { name: "gameOver", winner: playerId };
      return true;
    }
    player.holdingRegions = false;
    state.log.push(`${player.name}'s hold on 2 regions was broken.`);
  }
  return false;
}

function convert(state: GameState, city: CityState, playerId: PlayerId, threshold: number) {
  const player = playerById(state, playerId);
  const previous = city.controller;

  // "When a city converts to you, all rival Flock there switches to yours."
  const own = flockIn(city, playerId);
  const switched = Object.entries(city.flock).filter(([id, n]) => id !== playerId && n > 0);
  const total = Object.values(city.flock).reduce((a, b) => a + b, 0);
  city.flock = { [playerId]: total };
  city.controller = playerId;

  const switchText = switched.length
    ? ` ${switched.map(([id, n]) => `${n} of ${playerById(state, id).name}'s Flock`).join(" and ")} switched over.`
    : "";
  state.log.push(`${city.name} converts to ${player.name} (${own} Flock, needed ${threshold}).${switchText}`);

  // A city taken from a rival loses a Holy Site level. Converting an
  // uncontrolled city doesn't: it already dropped when it was lost.
  if (previous !== null) desecrate(state, city);

  // "Cities converted" counts each city once per game.
  if (!player.convertedCities.includes(city.name)) {
    player.convertedCities.push(city.name);
    if (player.convertedCities.length === 1) {
      state.log.push(`This is ${player.name}'s first city. (Prophets and Heroes arrive in a later milestone.)`);
    }
  }
}

/** "Its Holy Site is desecrated and drops one level." */
function desecrate(state: GameState, city: CityState) {
  const drop = { Cathedral: "Temple", Temple: "Shrine", Shrine: null } as const;
  if (!city.holySite) return;
  const before = city.holySite;
  city.holySite = drop[before];
  state.log.push(`${city.name}'s ${before} is desecrated${city.holySite ? ` and becomes a ${city.holySite}` : " and removed"}.`);
}

// ------------------------------------------------- moving between phases

/** Runs phases that need no decision until the game needs the player again. */
function advance(data: GameData, state: GameState) {
  const phase = currentTurn(state);
  const player = playerById(state, phase.player);

  if (phase.step === "draw") {
    if (player.hand.length < RULES.handSize) return; // 2. Draw: wait for the player
    prophecyPhase(state);
    economyPhase(data, state);
    phase.step = "economy";
  }
  if (phase.step === "economy" && player.reserve === 0) {
    state.log.push(`${player.name} has no Flock to place.`);
    phase.step = "action";
  }
}

export function currentTurn(state: GameState) {
  if (state.phase.name !== "turn") throw new RuleError("No one is taking a turn right now.");
  return state.phase;
}

export function checkTurn(state: GameState, playerId: PlayerId, ...steps: TurnStep[]) {
  const phase = currentTurn(state);
  if (phase.player !== playerId) {
    throw new RuleError(`It's ${playerById(state, phase.player).name}'s turn, not ${playerById(state, playerId).name}'s.`);
  }
  if (!steps.includes(phase.step)) {
    const what = { draw: "drawing cards", economy: "placing Flock", action: "taking an action", end: "ending the turn" };
    throw new RuleError(`${playerById(state, playerId).name} can't do that while ${what[phase.step]}.`);
  }
  return phase;
}

// ----------------------------------------------------------------- 2. Draw

export function drawForTurn(data: GameData, state: GameState, playerId: PlayerId, deck: DrawDeck) {
  checkTurn(state, playerId, "draw");
  const player = playerById(state, playerId);
  player.hand.push(takeTopCard(state, deck));
  if (player.hand.length === RULES.handSize) state.log.push(`${player.name} refilled their hand to ${RULES.handSize}.`);
  advance(data, state);
}

// ------------------------------------------------------------- 3. Prophecy

function prophecyPhase(state: GameState) {
  const player = playerById(state, currentTurn(state).player);
  const cities = citiesControlledBy(state, player.id).length;
  if (cities > 0) {
    state.log.push(
      `Prophecy: ${player.name} controls ${cities} ${cities === 1 ? "city" : "cities"}, so would draw ${cities} Free Will ${cities === 1 ? "card" : "cards"}. (Free Will arrives in a later milestone.)`,
    );
  }
}

// -------------------------------------------------------------- 4. Economy

function economyPhase(data: GameData, state: GameState) {
  const player = playerById(state, currentTurn(state).player);
  const lines = incomeBreakdown(data, state, player.id);
  const income = lines.reduce((sum, l) => sum + l.amount, 0);
  player.reserve += income;
  const detail = lines.map((l) => `${l.label} +${l.amount}`).join(", ");
  state.log.push(`${player.name} collects ${income} Flock income (${detail}). Reserve is now ${player.reserve}.`);
}

export function placeFlock(data: GameData, state: GameState, playerId: PlayerId, placements: Record<string, number>) {
  checkTurn(state, playerId, "economy");
  const player = playerById(state, playerId);
  const allowed = placeableCities(state, playerId);
  const entries = Object.entries(placements).filter(([, n]) => n !== 0);

  for (const [city, n] of entries) {
    cityInfo(data, city);
    if (!Number.isInteger(n) || n < 0) throw new RuleError(`Can't place ${n} Flock in ${city}.`);
    if (!allowed.includes(city)) {
      throw new RuleError(`${player.name} can only place Flock in cities they control or already have Flock in, not ${city}.`);
    }
  }
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total > player.reserve) {
    throw new RuleError(`${player.name} only has ${player.reserve} Flock in reserve, not ${total}.`);
  }

  for (const [name, n] of entries) {
    const city = state.cities.find((c) => c.name === name)!;
    city.flock[playerId] = flockIn(city, playerId) + n;
  }
  player.reserve -= total;

  const where = entries.map(([city, n]) => `${n} in ${city}`).join(", ");
  state.log.push(
    total === 0
      ? `${player.name} keeps all ${player.reserve} Flock in reserve.`
      : `${player.name} places ${where}. ${player.reserve} stay in reserve.`,
  );
  // "Then seeds and ongoing effects pay out or tick down." (milestone 4)
  currentTurn(state).step = "action";
}

// ----------------------------------------------------- 5. Action and 6. End

export function endTurn(data: GameData, state: GameState, playerId: PlayerId) {
  // "End turn" works from the action step (skipping the action) or after it.
  const phase = checkTurn(state, playerId, "action", "end");
  const player = playerById(state, playerId);

  // End: "If you control 2 of the 3 regions, you are marked as holding them."
  const regions = regionsControlledBy(data, state, playerId);
  player.holdingRegions = regions.length >= RULES.regionsToWin;
  if (player.holdingRegions) {
    state.log.push(
      `${player.name} holds regions ${regions.join(" and ")}! If they still hold 2 regions at the start of their next turn, they win. Rivals have one round to stop them.`,
    );
  }

  const index = state.turnOrder.indexOf(playerId);
  const nextIndex = (index + 1) % state.turnOrder.length;
  beginTurn(data, state, state.turnOrder[nextIndex], nextIndex === 0 ? phase.round + 1 : phase.round);
}
