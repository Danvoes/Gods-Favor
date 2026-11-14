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
  /** Added to the cost of this player's next card (Red Tape +2, Rusted Gears +1, Efficient Tools -2), then reset. */
  nextCardCost: number;
  /** The game turn number of this player's current or most recent turn, and of the one before it (0 = none). */
  lastTurn: number;
  previousTurn: number;
}

export const STRUCTURE_CARDS = {
  "PRO-F-01": "Grand Foundry",
  "PRO-F-02": "Railway",
  "PRO-F-03": "Workshop",
  "PRO-F-04": "City Walls",
  "PRO-F-06": "Market",
  "PRO-F-07": "Paved Roads",
} as const;
export type StructureKind = (typeof STRUCTURE_CARDS)[keyof typeof STRUCTURE_CARDS];

/**
 * A structure belongs to its city and benefits whoever controls the city.
 *   on   - working
 *   idle - the city changed hands directly; the new controller waits one
 *          Economy Phase or pays 2 Flock to turn it on
 *   off  - the city went uncontrolled; whoever converts it next must pay
 *          2 Flock to turn it on (no free wait, and Ada/Repair Crews can't help)
 */
export interface Structure {
  kind: StructureKind;
  status: "on" | "idle" | "off";
}

export interface DestroyedStructure {
  city: string;
  kind: StructureKind;
  /** The game turn number it was destroyed on. */
  turn: number;
}

export interface CityState {
  name: string;
  /** How many Flock each player has here. Players with none are left out. */
  flock: Record<PlayerId, number>;
  controller: PlayerId | null;
  holySite: HolySiteLevel | null;
  /** At most 2. */
  structures: Structure[];
  /** Ruin tokens: each cuts the city's income by 1 until cleared. */
  ruin: number;
  /** Seeds planted here. Each pays out to its owner at their next Economy Phase. */
  seeds: Seed[];
}

export interface Seed {
  owner: PlayerId;
  amount: number;
  /** The card that planted it. */
  card: string;
  /** The game turn it was planted on; it pays out at the owner's first Economy Phase after that. */
  plantedTurn: number;
}

/**
 * An effect that lasts. It waits until the affected player's next turn
 * (`active` false), works during their turns, and counts down at the End of
 * each of their turns ("next turn" always means the affected player's turns).
 */
export interface Ongoing {
  id: number;
  /** The card that caused it. */
  card: string;
  kind:
    | "startLoss" //       lose `amount` Flock in `city` at the start of each turn (Blight, Drought, Late Frost)
    | "noReceive" //       can't receive Flock in `city` (Earthquake)
    | "noMoveOut" //       can't move Flock out of `city` (Wild Beasts)
    | "noIncome" //        no income at all (Famine)
    | "cityNoIncome" //    `city` gives no income (Failed Harvest)
    | "halveIncome" //     income halved, rounded down (Rot in the Granary)
    | "costUp" //          cards cost `amount` more (Sabotage)
    | "extraCityIncome" // +`amount` income per controlled city (Season of Plenty)
    | "delayedReserve"; // gain `amount` in reserve at Economy (Full Granary, Stockpile)
  player: PlayerId;
  city?: string;
  amount: number;
  turnsLeft: number;
  active: boolean;
}

/** Calamity and Favor are the two decks players draw into their hands. */
export type DrawDeck = "Calamity" | "Favor";

export type Phase =
  /** Players secretly pick starting cities, one at a time, passing the device. */
  | { name: "chooseStartingCities"; choices: Record<PlayerId, string> }
  /** Each player draws 5 cards, in turn order. `drawer` indexes turnOrder. */
  | { name: "drawStartingHands"; drawer: number }
  /** A player's turn. Start and End happen on their own; these steps wait for the player. */
  | {
      name: "turn";
      player: PlayerId;
      round: number;
      step: TurnStep;
      logStart: number;
      /** Cities a Calamity has hit this turn (Herbal Remedy checks this). */
      calamityHits: string[];
      /** A Calamity waiting for other players to respond, if any. */
      pending?: PendingCalamity;
      /** Counts every time the device must pass to someone else mid-turn, so each pass gets its own "pass the device" screen. */
      handoffs: number;
    }
  | { name: "gameOver"; winner: PlayerId };

/**
 * The parts of a turn that need a decision. (Start, Prophecy and End
 * currently need none, so the game runs them by itself.)
 *   draw    - refill your hand to 5, choosing a deck each time
 *   economy - place income and reserve Flock on the board, or keep it
 *   action  - do one action (cast a card, or skip)
 *   end     - the action is done; the player reviews what happened, then ends the turn
 *   respond - waiting for another player to respond to a Calamity
 */
export type TurnStep = "draw" | "economy" | "action" | "end" | "respond";

/**
 * A Calamity that has been cast and paid for, waiting on responses:
 *   redirect - the player whose domain matches may pay its cost to pick a new target
 *   counter  - the target may play Cure or Shelter of the Wild (always asked)
 *   choose   - the target makes a choice the card gives them (Barren Years' discards)
 */
export interface PendingCalamity {
  cardId: string;
  caster: PlayerId;
  answers: Record<string, string>;
  stage: "redirect" | "counter" | "choose";
  responder: PlayerId;
  redirected: boolean;
}

export type Response =
  | { kind: "decline" }
  | { kind: "redirect"; newTarget: PlayerId; payFrom?: Record<string, number> }
  | { kind: "counter"; cardId: string; targets: Record<string, string>; payFrom?: Record<string, number> }
  | { kind: "choose"; cardIds: string[] };

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
  /** Counts every turn taken, by anyone, starting at 1. */
  turnCount: number;
  /** Structures destroyed so far, so Repair Crews can rebuild recent ones. */
  destroyed: DestroyedStructure[];
  ongoing: Ongoing[];
  nextOngoingId: number;
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
  | { type: "endTurn"; playerId: PlayerId }
  /** Pay 2 Flock to turn on an Idle or switched-off structure in a city you control. */
  | { type: "restoreStructure"; playerId: PlayerId; city: string; index: number; payFrom?: Record<string, number> }
  /**
   * Cast a Calamity or Favor from hand. `targets` answers the card's questions
   * (see castingQuestions). `payFrom` says which cities pay whatever part of
   * the cost the reserve can't cover.
   */
  | {
      type: "castCard";
      playerId: PlayerId;
      cardId: string;
      targets: Record<string, string>;
      payFrom?: Record<string, number>;
    }
  /** A response to a Calamity by the player the game is waiting on. */
  | { type: "respond"; playerId: PlayerId; response: Response };
