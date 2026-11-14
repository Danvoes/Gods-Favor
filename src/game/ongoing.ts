// Effects that last more than one moment: "Anything lasting more than one
// turn gets a marker on the city or player until it runs out."
//
// Durations count the affected player's own turns. A marker added now waits
// until that player's next turn starts, works during their turns, and counts
// down at the End of each of them.

import type { CityState, GameState, Ongoing, PlayerId } from "./types";

const CARD_NAMES: Record<string, string> = {
  "NAT-C-04": "Earthquake",
  "NAT-C-07": "Wild Beasts",
  "HAR-C-01": "Famine",
  "HAR-C-02": "Blight",
  "HAR-C-04": "Failed Harvest",
  "HAR-C-05": "Drought",
  "HAR-C-07": "Late Frost",
  "HAR-C-09": "Rot in the Granary",
  "HAR-F-02": "Season of Plenty",
  "HAR-F-04": "Full Granary",
  "HAR-F-07": "Stockpile",
  "PRO-C-03": "Sabotage",
};

export function addOngoing(state: GameState, marker: Omit<Ongoing, "id" | "active">): Ongoing {
  const full: Ongoing = { ...marker, id: state.nextOngoingId++, active: false };
  state.ongoing.push(full);
  return full;
}

/** Markers working on a player right now, optionally of one kind and city. */
export function activeOngoing(state: GameState, playerId: PlayerId, kind?: Ongoing["kind"], city?: string): Ongoing[] {
  return state.ongoing.filter(
    (m) => m.active && m.player === playerId && (!kind || m.kind === kind) && (!city || m.city === city),
  );
}

/** Earthquake: this player can't add Flock to this city right now. */
export function cannotReceive(state: GameState, playerId: PlayerId, city: string): boolean {
  return activeOngoing(state, playerId, "noReceive", city).length > 0;
}

/** Wild Beasts: this player can't move Flock out of this city right now. */
export function cannotMoveOut(state: GameState, playerId: PlayerId, city: string): boolean {
  return activeOngoing(state, playerId, "noMoveOut", city).length > 0;
}

/** At the start of a player's turn, their waiting markers start working. */
export function activateFor(state: GameState, playerId: PlayerId) {
  for (const m of state.ongoing) if (m.player === playerId) m.active = true;
}

/** Blight, Drought and Late Frost: lose Flock at the start of the affected player's turn. */
export function startOfTurnLosses(state: GameState, playerId: PlayerId, playerName: string) {
  for (const m of activeOngoing(state, playerId, "startLoss")) {
    const city = state.cities.find((c) => c.name === m.city) as CityState;
    const have = city.flock[playerId] ?? 0;
    const lost = Math.min(have, m.amount);
    if (lost > 0) {
      if (have - lost > 0) city.flock[playerId] = have - lost;
      else delete city.flock[playerId];
    }
    state.log.push(
      lost > 0
        ? `${cardName(m.card)}: ${playerName} loses ${lost} Flock in ${m.city}.`
        : `${cardName(m.card)}: ${playerName} has no Flock left in ${m.city}, so nothing happens.`,
    );
  }
}

/** At the End of a player's turn, their working markers count down; finished ones are removed. */
export function countDown(state: GameState, playerId: PlayerId, playerName: string) {
  for (const m of activeOngoing(state, playerId)) m.turnsLeft -= 1;
  const done = state.ongoing.filter((m) => m.player === playerId && m.active && m.turnsLeft <= 0);
  for (const m of done) state.log.push(`${cardName(m.card)} on ${playerName}${m.city ? ` (${m.city})` : ""} wears off.`);
  state.ongoing = state.ongoing.filter((m) => !done.includes(m));
}

export function cardName(cardId: string): string {
  return CARD_NAMES[cardId] ?? cardId;
}

/** A short plain description, for the board and for Rationing's choices. */
export function describeOngoing(m: Ongoing): string {
  const turns = `${m.turnsLeft} ${m.active ? "more " : ""}turn${m.turnsLeft === 1 ? "" : "s"}`;
  const what: Record<Ongoing["kind"], string> = {
    startLoss: `-${m.amount} Flock in ${m.city} at the start of each turn`,
    noReceive: `can't receive Flock in ${m.city}`,
    noMoveOut: `can't move Flock out of ${m.city}`,
    noIncome: "no income",
    cityNoIncome: `${m.city} gives no income`,
    halveIncome: "next income halved",
    costUp: `cards cost ${m.amount} more`,
    extraCityIncome: `+${m.amount} income per controlled city`,
    delayedReserve: `+${m.amount} in reserve at the next Economy Phase`,
  };
  return `${cardName(m.card)}: ${what[m.kind]} (${turns}${m.active ? "" : ", starts next turn"})`;
}
