// Game setup, following "Setup" in docs/RULES.md:
//   1. players pick a god and domain        -> createGame
//   2. lay out the 9 cities                 -> createGame
//   3. shuffle the three decks              -> createGame
//   4. secretly choose starting cities      -> "chooseStartingCity" actions
//   5. work out turn order                  -> when the last city is chosen
//   6. draw 5 cards, Calamity or Favor each -> "drawCard" actions
//

import type { GameData } from "../data/types";
import { takeTopCard } from "./deck";
import { newSeed, randomInt, shuffle } from "./random";
import { RULES, RuleError, cityInfo, playerById } from "./rules";
import { beginTurn } from "./turn";
import type { DrawDeck, GameState, NewPlayer, PlayerId } from "./types";

export function createGame(data: GameData, newPlayers: NewPlayer[], seed: number = newSeed()): GameState {
  checkNewPlayers(newPlayers);

  const state: GameState = {
    seed,
    rng: seed,
    players: newPlayers.map((p, seat) => ({
      id: `p${seat + 1}`,
      name: p.name.trim(),
      domain: p.domain,
      seat,
      reserve: 0,
      hand: [],
      convertedCities: [],
      holdingRegions: false,
    })),
    turnOrder: [],
    cities: data.cities.map((c) => ({ name: c.name, flock: {}, controller: null, holySite: null })),
    startingCities: {},
    decks: {
      Calamity: data.cards.filter((c) => c.deck === "Calamity").map((c) => c.id),
      Favor: data.cards.filter((c) => c.deck === "Favor").map((c) => c.id),
      "Free Will": data.cards.filter((c) => c.deck === "Free Will").map((c) => c.id),
    },
    discards: { Calamity: [], Favor: [], "Free Will": [] },
    phase: { name: "chooseStartingCities", choices: {} },
    log: [],
  };

  shuffle(state, state.decks.Calamity);
  shuffle(state, state.decks.Favor);
  shuffle(state, state.decks["Free Will"]);

  const names = state.players.map((p) => `${p.name} (${p.domain})`).join(", ");
  state.log.push(`New game: ${names}. Decks shuffled (seed ${seed}).`);
  return state;
}

function checkNewPlayers(newPlayers: NewPlayer[]) {
  if (newPlayers.length < RULES.minPlayers || newPlayers.length > RULES.maxPlayers) {
    throw new RuleError(`Gods' Favor needs ${RULES.minPlayers} to ${RULES.maxPlayers} players.`);
  }
  const names = newPlayers.map((p) => p.name.trim());
  if (names.some((n) => n === "")) throw new RuleError("Every player needs a name.");
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
    throw new RuleError("Each player needs a different name.");
  }
  if (!RULES.allowSharedDomains) {
    const domains = newPlayers.map((p) => p.domain);
    if (new Set(domains).size !== domains.length) {
      throw new RuleError("Each player needs a different domain.");
    }
  }
}

export function chooseStartingCity(data: GameData, state: GameState, playerId: PlayerId, city: string) {
  const phase = state.phase;
  if (phase.name !== "chooseStartingCities") throw new RuleError("Starting cities have already been chosen.");
  const player = playerById(state, playerId);
  if (playerId in phase.choices) throw new RuleError(`${player.name} has already chosen a starting city.`);
  cityInfo(data, city); // checks the city exists

  // Kept secret: the log only says someone chose, not what.
  phase.choices[playerId] = city;
  state.log.push(`${player.name} chose a starting city in secret.`);

  if (Object.keys(phase.choices).length === state.players.length) {
    revealStartingCities(data, state, phase.choices);
  }
}

/** Setup steps 4 and 5: everyone reveals, places 10 Flock, and turn order is set. */
function revealStartingCities(data: GameData, state: GameState, choices: Record<PlayerId, string>) {
  state.startingCities = { ...choices };
  for (const player of state.players) {
    const cityName = choices[player.id];
    const city = state.cities.find((c) => c.name === cityName)!;
    city.flock[player.id] = (city.flock[player.id] ?? 0) + RULES.startingFlock;
    state.log.push(`${player.name} starts in ${cityName} with ${RULES.startingFlock} Flock.`);
  }
  const contested = state.cities.filter((c) => Object.keys(c.flock).length > 1);
  for (const c of contested) state.log.push(`${c.name} is contested from the start.`);

  state.turnOrder = decideTurnOrder(data, state, choices);
  const first = playerById(state, state.turnOrder[0]);
  state.log.push(`${first.name} goes first. Turn order: ${state.turnOrder.map((id) => playerById(state, id).name).join(" → ")}.`);

  state.phase = { name: "drawStartingHands", drawer: 0 };
}

/**
 * "The player whose starting city has the smallest population goes first.
 * Ties are broken randomly. Play then passes clockwise." Clockwise means the
 * seating order players were entered in.
 */
export function decideTurnOrder(data: GameData, state: GameState, choices: Record<PlayerId, string>): PlayerId[] {
  const population = (id: PlayerId) => cityInfo(data, choices[id]).population;
  const smallest = Math.min(...state.players.map((p) => population(p.id)));
  const tied = state.players.filter((p) => population(p.id) === smallest);
  const first = tied.length === 1 ? tied[0] : tied[randomInt(state, tied.length)];
  if (tied.length > 1) {
    state.log.push(`${tied.map((p) => p.name).join(" and ")} tied for smallest starting city; ${first.name} won the random tie-break.`);
  }
  const bySeat = [...state.players].sort((a, b) => a.seat - b.seat);
  const start = bySeat.indexOf(first);
  return [...bySeat.slice(start), ...bySeat.slice(0, start)].map((p) => p.id);
}

/** Setup step 6: draw one card at a time, choosing the deck each time. */
export function drawStartingCard(data: GameData, state: GameState, playerId: PlayerId, deck: DrawDeck) {
  const phase = state.phase;
  if (phase.name !== "drawStartingHands") throw new RuleError("It isn't time to draw starting hands.");
  const drawerId = state.turnOrder[phase.drawer];
  const player = playerById(state, playerId);
  if (playerId !== drawerId) {
    throw new RuleError(`It's ${playerById(state, drawerId).name}'s turn to draw, not ${player.name}'s.`);
  }
  if (player.hand.length >= RULES.handSize) throw new RuleError(`${player.name} already has ${RULES.handSize} cards.`);

  player.hand.push(takeTopCard(state, deck));

  if (player.hand.length === RULES.handSize) {
    const counts = countByDeck(data, player.hand);
    state.log.push(`${player.name} drew ${counts.Calamity} Calamity and ${counts.Favor} Favor.`);
    phase.drawer += 1;
    if (phase.drawer === state.turnOrder.length) {
      state.log.push("Setup complete.");
      beginTurn(data, state, state.turnOrder[0], 1);
    }
  }
}

function countByDeck(data: GameData, cardIds: string[]) {
  const counts = { Calamity: 0, Favor: 0 };
  for (const id of cardIds) {
    const deck = data.cards.find((c) => c.id === id)?.deck;
    if (deck === "Calamity" || deck === "Favor") counts[deck]++;
  }
  return counts;
}
