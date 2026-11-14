// The shape of a game in progress.
//
// Everything about a game lives in one GameState object: who is playing,
// what's on each city, what's in each deck and hand. Cards are stored by id
// (like "NAT-C-01"); their text is looked up from the CSV data when needed.
// Keeping it as plain data means it can later be saved to the browser and
// loaded again.

import type { Deck, Domain, HolySiteLevel } from "../data/types";

export type PlayerId = string;

export interface PlayerState {
  id: PlayerId;
  name: string;
  domain: Domain;
  /** Position around the table, 0-based, in the order players were entered. */
  seat: number;
  reserve: number;
  /** Card ids in hand. Only shown to the player whose turn it is. */
  hand: string[];
  /** Every distinct city this player has ever converted, in order. Drives Prophet tiers and strike resets. */
  convertedCities: string[];
  /** Set at the End of a turn when this player controls 2 regions; they win if they still do at their next Start. */
  holdingRegions: boolean;
}

export interface CityState {
  name: string;
  /** How many Flock each player has here. Players with none are left out. */
  flock: Record<PlayerId, number>;
  controller: PlayerId | null;
  holySite: HolySiteLevel | null;
}

/** Calamity and Favor are the two decks players draw into their hands. */
export type DrawDeck = "Calamity" | "Favor";

export type Phase =
  /** Players secretly pick starting cities, one at a time, passing the device. */
  | { name: "chooseStartingCities"; choices: Record<PlayerId, string> }
  /** Each player draws 5 cards, in turn order. `drawer` indexes turnOrder. */
  | { name: "drawStartingHands"; drawer: number }
  /** A player's turn. Start and End happen on their own; these steps wait for the player. */
  | { name: "turn"; player: PlayerId; round: number; step: TurnStep; logStart: number }
  | { name: "gameOver"; winner: PlayerId };

/**
 * The parts of a turn that need a decision. (Start, Prophecy and End
 * currently need none, so the game runs them by itself.)
 *   draw    - refill your hand to 5, choosing a deck each time
 *   economy - place income and reserve Flock on the board, or keep it
 *   action  - do one action (for now: end the turn)
 */
export type TurnStep = "draw" | "economy" | "action";

export interface GameState {
  /** The seed this game started from, kept so the game can be replayed. */
  seed: number;
  /** The current random state. Changes every time something random happens. */
  rng: number;
  players: PlayerState[];
  /** Player ids in the order they take turns. Set once starting cities are revealed. */
  turnOrder: PlayerId[];
  cities: CityState[];
  startingCities: Record<PlayerId, string>;
  /** Top of each deck is the end of the list. */
  decks: Record<Deck, string[]>;
  discards: Record<Deck, string[]>;
  phase: Phase;
  /** A plain-language record of what happened, newest last. */
  log: string[];
}

export interface NewPlayer {
  name: string;
  domain: Domain;
}

export type Action =
  | { type: "chooseStartingCity"; playerId: PlayerId; city: string }
  | { type: "drawCard"; playerId: PlayerId; deck: DrawDeck }
  /** How many Flock to move from reserve to each city. Anything left stays in reserve. */
  | { type: "placeFlock"; playerId: PlayerId; placements: Record<string, number> }
  | { type: "endTurn"; playerId: PlayerId };
