// What things cost, and paying for them.

import type { DivineCard, GameData } from "../data/types";
import { activeOngoing } from "./ongoing";
import { RULES, RuleError, cityState, flockIn, playerById, workingStructures } from "./rules";
import type { GameState, PlayerId, PlayerState } from "./types";

export interface CostLine {
  label: string;
  amount: number;
}

/**
 * A card's cost for this player, line by line:
 *   printed cost
 *   + next-card changes (Red Tape +2, Rusted Gears +1, Efficient Tools -2)
 *   - 1 per working Workshop in a city you control (at most -2)
 *   + 2 per working City Walls in a Calamity's target city
 *   + 2 during the affected player's turns under Sabotage
 * A cost never goes below 0.
 */
export function cardCost(
  data: GameData,
  state: GameState,
  playerId: PlayerId,
  card: DivineCard,
  answers: Record<string, string> = {},
): { total: number; lines: CostLine[] } {
  const player = playerById(state, playerId);
  const lines: CostLine[] = [{ label: `${card.name}`, amount: card.cost }];
  if (player.nextCardCost !== 0) lines.push({ label: "Next-card effects on you", amount: player.nextCardCost });
  // Sabotage: only during the affected player's own turns.
  if (state.phase.name === "turn" && state.phase.player === playerId) {
    for (const m of activeOngoing(state, playerId, "costUp")) lines.push({ label: "Sabotage", amount: m.amount });
  }

  const workshops = state.cities
    .filter((c) => c.controller === playerId)
    .reduce((n, c) => n + workingStructures(c, "Workshop"), 0);
  if (workshops > 0) lines.push({ label: "Workshop", amount: -Math.min(RULES.maxWorkshopDiscount, workshops) });

  if (card.deck === "Calamity" && answers.city) {
    const walls = workingStructures(cityState(state, answers.city), "City Walls");
    if (walls > 0) lines.push({ label: `City Walls in ${answers.city}`, amount: 2 * walls });
  }
  void data;
  const total = Math.max(0, lines.reduce((sum, l) => sum + l.amount, 0));
  return { total, lines };
}

/** All the Flock a player could spend: reserve plus every Flock on the board. */
export function totalFlock(state: GameState, playerId: PlayerId): number {
  return playerById(state, playerId).reserve + state.cities.reduce((sum, c) => sum + flockIn(c, playerId), 0);
}

/**
 * Pays a cost: "from reserve first. If reserve runs short, the rest comes from
 * your Flock in any cities you choose." `payFrom` lists those cities.
 * Returns a short description for the log ("" if reserve covered it).
 */
export function payCost(state: GameState, payer: PlayerState, cost: number, payFrom: Record<string, number> = {}): string {
  const fromReserve = Math.min(payer.reserve, cost);
  const shortfall = cost - fromReserve;
  const entries = Object.entries(payFrom).filter(([, n]) => n !== 0);
  const fromCities = entries.reduce((sum, [, n]) => sum + n, 0);

  if (shortfall === 0 && fromCities > 0) {
    throw new RuleError(`${payer.name}'s reserve covers the whole cost, so nothing should come from cities.`);
  }
  if (fromCities !== shortfall) {
    throw new RuleError(
      `${payer.name}'s reserve covers ${fromReserve} of the ${cost}; choose cities to pay the other ${shortfall} (chosen so far: ${fromCities}).`,
    );
  }
  for (const [city, n] of entries) {
    const have = flockIn(cityState(state, city), payer.id);
    if (!Number.isInteger(n) || n < 0 || n > have) {
      throw new RuleError(`${payer.name} can't pay ${n} from ${city}; they have ${have} Flock there.`);
    }
  }

  payer.reserve -= fromReserve;
  for (const [city, n] of entries) {
    const c = cityState(state, city);
    const left = flockIn(c, payer.id) - n;
    if (left > 0) c.flock[payer.id] = left;
    else delete c.flock[payer.id];
  }
  if (shortfall === 0) return "";
  return `, paid ${fromReserve} from reserve and ${entries.map(([c, n]) => `${n} from ${c}`).join(", ")}`;
}
