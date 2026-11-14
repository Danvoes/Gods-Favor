// Small rule calculations shared by the engine and the screens.

import type { City, Domain, GameData, HolySiteLevel } from "../data/types";
import type { CityState, GameState, PlayerId, PlayerState, StructureKind } from "./types";

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
  baseIncome: 1,
  /** Extra income from a city whose need matches your domain. */
  domainMatchIncome: 1,
  /** Total income bonus from a Holy Site at each level. */
  holySiteIncome: { Shrine: 1, Temple: 2, Cathedral: 3 } satisfies Record<HolySiteLevel, number>,
  /** You control a region when you control this many of its 3 cities. */
  citiesToControlRegion: 2,
  /** You win by holding this many regions from the end of one turn to the start of your next. */
  regionsToWin: 2,
  maxStructuresPerCity: 2,
  /** "Your cards cost 1 less while you control this city (maximum -2 from Workshops)." */
  maxWorkshopDiscount: 2,
  /** Cost to turn on an Idle or switched-off structure. */
  restoreStructureCost: 2,
  structureIncome: { "Grand Foundry": 2, Market: 1 } as Partial<Record<StructureKind, number>>,
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
  if (phase.name === "turn") return phase.player;
  return null;
}

export const REGIONS = ["A", "B", "C"] as const;

/** "A city's neighbors are the other cities in its region." */
export function neighborsOf(data: GameData, cityName: string): string[] {
  const region = cityInfo(data, cityName).region;
  return data.cities.filter((c) => c.region === region && c.name !== cityName).map((c) => c.name);
}

export function citiesInRegion(data: GameData, region: string): string[] {
  return data.cities.filter((c) => c.region === region).map((c) => c.name);
}

export function citiesControlledBy(state: GameState, playerId: PlayerId): CityState[] {
  return state.cities.filter((c) => c.controller === playerId);
}

/** The regions where a player controls at least 2 of the 3 cities. */
export function regionsControlledBy(data: GameData, state: GameState, playerId: PlayerId): string[] {
  return REGIONS.filter(
    (region) =>
      citiesControlledBy(state, playerId).filter((c) => cityInfo(data, c.name).region === region).length >=
      RULES.citiesToControlRegion,
  );
}

/** "Flock can be placed in any city you control, or any city where you already have Flock." */
export function placeableCities(state: GameState, playerId: PlayerId): string[] {
  return state.cities.filter((c) => c.controller === playerId || flockIn(c, playerId) > 0).map((c) => c.name);
}

export interface IncomeLine {
  label: string;
  amount: number;
}

/**
 * Income, line by line: 1 base, plus each controlled city's income (2 for a
 * large city), +1 if its need matches your domain, plus its Holy Site bonus.
 */
export function incomeBreakdown(data: GameData, state: GameState, playerId: PlayerId): IncomeLine[] {
  const domain = playerById(state, playerId).domain;
  const lines: IncomeLine[] = [{ label: "Base income", amount: RULES.baseIncome }];
  for (const city of citiesControlledBy(state, playerId)) {
    const info = cityInfo(data, city.name);
    const cityLines: IncomeLine[] = [{ label: `${city.name} (${info.size.toLowerCase()} city)`, amount: info.income }];
    if (info.need === domain) cityLines.push({ label: `${city.name} matches your domain`, amount: RULES.domainMatchIncome });
    if (city.holySite) cityLines.push({ label: `${city.name} ${city.holySite}`, amount: RULES.holySiteIncome[city.holySite] });
    for (const st of city.structures) {
      const extra = RULES.structureIncome[st.kind];
      if (extra && st.status === "on") cityLines.push({ label: `${city.name} ${st.kind}`, amount: extra });
    }
    if (city.ruin > 0) {
      // Ruin cuts the city's income, but a city never gives less than nothing.
      const before = cityLines.reduce((a, l) => a + l.amount, 0);
      const cut = Math.min(before, city.ruin);
      cityLines.push({ label: `${city.name} Ruin`, amount: -cut });
    }
    lines.push(...cityLines);
  }
  return lines;
}

export function totalIncome(data: GameData, state: GameState, playerId: PlayerId): number {
  return incomeBreakdown(data, state, playerId).reduce((sum, line) => sum + line.amount, 0);
}

/** How many working structures of a kind a city has. Structures only work in a controlled city. */
export function workingStructures(city: CityState, kind: StructureKind): number {
  if (city.controller === null) return 0;
  return city.structures.filter((s) => s.kind === kind && s.status === "on").length;
}
