// The one entry point for changing a game: applyAction.
//
// applyAction never changes the state it's given. It copies the state, makes
// the change on the copy and returns the copy. That way the screen can always
// trust that an old state still shows what it showed before. If the action
// breaks a rule, it throws a RuleError and nothing changes.

import type { GameData } from "../data/types";
import { RuleError } from "./rules";
import { castCard } from "./cast";
import { chooseStartingCity, drawStartingCard } from "./setup";
import { drawForTurn, endTurn, placeFlock } from "./turn";
import type { Action, GameState } from "./types";

export { createGame } from "./setup";

export function applyAction(data: GameData, state: GameState, action: Action): GameState {
  if (state.phase.name === "gameOver") throw new RuleError("The game is over.");
  const next = structuredClone(state);
  switch (action.type) {
    case "chooseStartingCity":
      chooseStartingCity(data, next, action.playerId, action.city);
      break;
    case "drawCard":
      if (next.phase.name === "drawStartingHands") drawStartingCard(data, next, action.playerId, action.deck);
      else drawForTurn(data, next, action.playerId, action.deck);
      break;
    case "placeFlock":
      placeFlock(data, next, action.playerId, action.placements);
      break;
    case "endTurn":
      endTurn(data, next, action.playerId);
      break;
    case "castCard":
      castCard(data, next, action.playerId, action.cardId, action.targets, action.payFrom);
      break;
  }
  return next;
}
