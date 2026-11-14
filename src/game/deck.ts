// Drawing cards.

import { shuffle } from "./random";
import { RuleError } from "./rules";
import type { DrawDeck, GameState } from "./types";

/** Takes the top card of a deck, reshuffling its discard pile into it if it has run out. */
export function takeTopCard(state: GameState, deck: DrawDeck | "Free Will"): string {
  if (state.decks[deck].length === 0) {
    if (state.discards[deck].length === 0) throw new RuleError(`The ${deck} deck and its discard pile are both empty.`);
    state.decks[deck] = state.discards[deck];
    state.discards[deck] = [];
    shuffle(state, state.decks[deck]);
    state.log.push(`The ${deck} deck ran out, so its discard pile was shuffled into a new deck.`);
  }
  return state.decks[deck].pop()!;
}
