// Small rule calculations shared by the engine and the screens.

import type { City, Domain, GameData } from "../data/types";
import type { CityState, GameState, PlayerId, PlayerState } from "./types";

/** Every rule number in one place, so a rules change is a one-line edit. */
export const RULES = {
  minPlayers: 2,
  maxPlayers: 4,
  startingFlock: 10,
  handSize: 5,
  /**
   * The rulebook doesn't say whether two players may pick the same domain.
   * See docs/RULES-QUESTIONS.md. Change this to `true` to allow it.
   */
  allowSharedDomains: false,
};

/** Thrown when someone tries something the rules don't allow. The message is shown to players. */
export class RuleError extends Error {}

export function cityInfo(data: GameData, name: string): City {
  const city = data.cities.find((c) => c.name === name);
  if (!city) throw new RuleError(`There's no city called "${name}".`);
  return city;
}

export function playerById(state: GameState, id: PlayerId): PlayerState {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new RuleError(`There's no player "${id}".`);
  return player;
}

export function cityState(state: GameState, name: string): CityState {
  const city = state.cities.find((c) => c.name === name);
  if (!city) throw new RuleError(`There's no city called "${name}".`);
  return city;
}

export function flockIn(city: CityState, playerId: PlayerId): number {
  return city.flock[playerId] ?? 0;
}

/**
 * How many Flock a player needs in a city to convert it: 51%, or 41% if the
 * city's need matches their domain, plus 10 points for a rival's Temple or
 * Cathedral. The numbers come straight from cities.csv.
 */
export function conversionThreshold(
  city: City,
  domain: Domain,
  opts: { rivalTemple: boolean } = { rivalTemple: false },
): number {
  const matched = city.need === domain;
  if (opts.rivalTemple && city.convertAtTemple !== null && city.convertAtTempleMatched !== null) {
    return matched ? city.convertAtTempleMatched : city.convertAtTemple;
  }
  return matched ? city.convertAtMatched : city.convertAt;
}

/** The threshold for one player in the game as it stands. */
export function thresholdFor(data: GameData, state: GameState, cityName: string, playerId: PlayerId): number {
  const city = cityState(state, cityName);
  const rivalTemple =
    city.controller !== null &&
    city.controller !== playerId &&
    (city.holySite === "Temple" || city.holySite === "Cathedral");
  return conversionThreshold(cityInfo(data, cityName), playerById(state, playerId).domain, { rivalTemple });
}

/** The player whose action the game is waiting for, if any. */
export function waitingFor(state: GameState): PlayerId | null {
  const phase = state.phase;
  if (phase.name === "chooseStartingCities") {
    return state.players.find((p) => !(p.id in phase.choices))?.id ?? null;
  }
  if (phase.name === "drawStartingHands") return state.turnOrder[phase.drawer] ?? null;
  return null;
}
