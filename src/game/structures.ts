// Turning structures back on.

import type { GameData } from "../data/types";
import { payCost } from "./costs";
import { RULES, RuleError, cityState, playerById } from "./rules";
import { checkTurn } from "./turn";
import type { GameState, PlayerId } from "./types";

/**
 * Pay 2 Flock to turn on an Idle structure (city changed hands) or a
 * switched-off one (city had gone uncontrolled) in a city you control.
 * Not an action: allowed any time during your own turn after drawing.
 */
export function restoreStructure(
  data: GameData,
  state: GameState,
  playerId: PlayerId,
  cityName: string,
  index: number,
  payFrom: Record<string, number> = {},
) {
  void data;
  checkTurn(state, playerId, "economy", "action", "end");
  const player = playerById(state, playerId);
  const city = cityState(state, cityName);
  if (city.controller !== playerId) throw new RuleError(`${player.name} doesn't control ${cityName}.`);
  const st = city.structures[index];
  if (!st) throw new RuleError(`${cityName} has no structure ${index + 1}.`);
  if (st.status === "on") throw new RuleError(`${cityName}'s ${st.kind} is already working.`);
  const paid = payCost(state, player, RULES.restoreStructureCost, payFrom);
  st.status = "on";
  state.log.push(`${player.name} pays ${RULES.restoreStructureCost} Flock${paid} to turn on ${cityName}'s ${st.kind}.`);
}
