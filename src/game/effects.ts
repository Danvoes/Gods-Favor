// What each Calamity and Favor card does.
//
// Every card has an entry here. A playable card lists:
//   text     - a copy of its effect text from cards.csv. A test checks the two
//              match, so if the CSV changes, the test names the card whose
//              code needs updating.
//   targets  - the questions the caster answers, in order ("Which player?",
//              "Which city?"). Each question offers only the choices the
//              rules allow, so a wrong choice can't be made.
//   resolve  - what happens.
// A card that isn't playable yet says which milestone brings it.
//
// The caster makes every choice on their card unless the card says otherwise
// (see docs/RULES-QUESTIONS.md).

import type { Card, DivineCard, GameData } from "../data/types";
import { randomInt } from "./random";
import { REGIONS, citiesInRegion, cityState, flockIn, neighborsOf, placeableCities, playerById } from "./rules";
import type { GameState, PlayerState } from "./types";

export interface Option {
  value: string;
  label: string;
}

/** Everything an effect needs while it runs. */
export interface EffectContext {
  data: GameData;
  state: GameState;
  caster: PlayerState;
  card: DivineCard;
  /** Adds a line to the description of what the card did. */
  report: (line: string) => void;
}

/** The caster's answers so far, keyed by question. */
export type Targets = Record<string, string>;

export interface TargetSpec {
  key: string;
  question: string;
  /** Shown if there are no valid choices, which means the card can't be cast right now. */
  noneReason: string;
  options: (ctx: EffectContext, chosen: Targets) => Option[];
}

export interface Playable {
  text: string;
  targets: TargetSpec[];
  resolve: (ctx: EffectContext, t: Targets) => void;
}

export interface NotYet {
  later: "4b" | "milestone 5";
  why: string;
}

export type CardEffect = Playable | NotYet;

export function isPlayable(effect: CardEffect): effect is Playable {
  return "resolve" in effect;
}

// ------------------------------------------------------------------ helpers

function setFlock(state: GameState, city: string, playerId: string, n: number) {
  const c = cityState(state, city);
  if (n > 0) c.flock[playerId] = n;
  else delete c.flock[playerId];
}

/** Removes up to n of a player's Flock from a city. Returns how many were actually lost. */
function loseFlock(ctx: EffectContext, city: string, playerId: string, n: number): number {
  const have = flockIn(cityState(ctx.state, city), playerId);
  const lost = Math.min(have, n);
  setFlock(ctx.state, city, playerId, have - lost);
  const who = playerById(ctx.state, playerId).name;
  ctx.report(
    lost > 0 ? `${city}: ${who} loses ${lost} Flock${lost < n ? ` (all they had)` : ""}.` : `${city}: ${who} has no Flock there, so nothing happens.`,
  );
  return lost;
}

/** A Calamity hitting a city: removes the target player's Flock and remembers the hit. */
function hit(ctx: EffectContext, city: string, playerId: string, n: number) {
  const phase = ctx.state.phase;
  if (phase.name === "turn" && !phase.calamityHits.includes(city)) phase.calamityHits.push(city);
  loseFlock(ctx, city, playerId, n);
}

function gainFlock(ctx: EffectContext, city: string, n: number) {
  const id = ctx.caster.id;
  setFlock(ctx.state, city, id, flockIn(cityState(ctx.state, city), id) + n);
  ctx.report(`${city}: ${ctx.caster.name} gains ${n} Flock.`);
}

function loseReserve(ctx: EffectContext, playerId: string, n: number) {
  const p = playerById(ctx.state, playerId);
  const lost = Math.min(p.reserve, n);
  p.reserve -= lost;
  ctx.report(`${p.name} loses ${lost} Flock from reserve${lost < n ? " (all they had)" : ""}.`);
}

function gainReserve(ctx: EffectContext, n: number) {
  ctx.caster.reserve += n;
  ctx.report(`${ctx.caster.name} gains ${n} Flock in reserve.`);
}

/** How many cards of a domain are in a deck's discard pile. */
function inDiscard(ctx: EffectContext, deck: "Calamity" | "Favor", domain: string): number {
  return ctx.state.discards[deck].filter((id) => {
    const card = ctx.data.cards.find((c) => c.id === id);
    return card?.kind === "divine" && card.domain === domain;
  }).length;
}

const playerName = (ctx: EffectContext, id: string) => playerById(ctx.state, id).name;

// --------------------------------------------------------- target questions

/** "Which player?" for a Calamity. Any player, yourself included, rivals first. */
const targetPlayer: TargetSpec = {
  key: "player",
  question: "Which player does it hit?",
  noneReason: "",
  options: (ctx) =>
    [...ctx.state.players]
      .sort((a, b) => Number(a.id === ctx.caster.id) - Number(b.id === ctx.caster.id))
      .map((p) => ({ value: p.id, label: p.id === ctx.caster.id ? `${p.name} (you)` : p.name })),
};

const withFlockLabel = (ctx: EffectContext, playerId: string | undefined, city: string): Option => {
  if (!playerId) return { value: city, label: city };
  const n = flockIn(cityState(ctx.state, city), playerId);
  return { value: city, label: `${city} (${playerName(ctx, playerId)} has ${n})` };
};

/** Any city, labelled with how many Flock the target player has there. */
const calamityCity: TargetSpec = {
  key: "city",
  question: "Which city?",
  noneReason: "",
  options: (ctx, t) => ctx.data.cities.map((c) => withFlockLabel(ctx, t.player, c.name)),
};

/** A city where the target player has Flock. */
const cityWithTargetFlock: TargetSpec = {
  key: "city",
  question: "Which of their cities?",
  noneReason: "The target player has no Flock on the board.",
  options: (ctx, t) =>
    ctx.state.cities.filter((c) => flockIn(c, t.player) > 0).map((c) => withFlockLabel(ctx, t.player, c.name)),
};

/** "Their main target must be a city you control or where you already have Flock." */
const favorCity: TargetSpec = {
  key: "city",
  question: "Which of your cities?",
  noneReason: "You have no cities to target.",
  options: (ctx) => placeableCities(ctx.state, ctx.caster.id).map((c) => withFlockLabel(ctx, ctx.caster.id, c)),
};

/** "One neighbor" of the chosen city: any neighboring city. */
function neighbor(question: string): TargetSpec {
  return {
    key: "neighbor",
    question,
    noneReason: "",
    options: (ctx, t) =>
      neighborsOf(ctx.data, t.city).map((c) =>
        withFlockLabel(ctx, ctx.card.deck === "Calamity" ? t.player : ctx.caster.id, c),
      ),
  };
}

const anyRegion: TargetSpec = {
  key: "region",
  question: "Which region?",
  noneReason: "",
  options: (ctx) => REGIONS.map((r) => ({ value: r, label: `Region ${r} (${citiesInRegion(ctx.data, r).join(", ")})` })),
};

// ------------------------------------------------------------ card patterns

/** "Target city loses X Flock[, and one neighbor loses Y]." */
function cityLoss(text: string, main: number, nextDoor = 0): Playable {
  return {
    text,
    targets: nextDoor ? [targetPlayer, calamityCity, neighbor("Which neighbor does it spread to?")] : [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, main);
      if (nextDoor) hit(ctx, t.neighbor, t.player, nextDoor);
    },
  };
}

/** "Target city gains X Flock[, and one neighbor gains Y]." */
function cityGain(text: string, main: number, nextDoor = 0): Playable {
  return {
    text,
    targets: nextDoor ? [favorCity, neighbor("Which neighbor also gains?")] : [favorCity],
    resolve: (ctx, t) => {
      gainFlock(ctx, t.city, main);
      if (nextDoor) gainFlock(ctx, t.neighbor, nextDoor);
    },
  };
}

function reserveLoss(text: string, n: number): Playable {
  return { text, targets: [targetPlayer], resolve: (ctx, t) => loseReserve(ctx, t.player, n) };
}

function reserveGain(text: string, n: number): Playable {
  return { text, targets: [], resolve: (ctx) => gainReserve(ctx, n) };
}

/** "Target city loses/gains 1 Flock, and its owner/you lose/gain 1 in reserve." */
function cityLossAndReserve(text: string): Playable {
  return {
    text,
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 1);
      // "Its owner" is read as the target player (see docs/RULES-QUESTIONS.md).
      loseReserve(ctx, t.player, 1);
    },
  };
}

function cityGainAndReserve(text: string, city: number, reserve: number): Playable {
  return {
    text,
    targets: [favorCity],
    resolve: (ctx, t) => {
      if (reserve) gainReserve(ctx, reserve);
      gainFlock(ctx, t.city, city);
    },
  };
}

const later4b = (why: string): NotYet => ({ later: "4b", why });
const later5 = (why: string): NotYet => ({ later: "milestone 5", why });

// --------------------------------------------------------------- the cards

export const EFFECTS: Record<string, CardEffect> = {
  // Nature Calamities: spread
  "NAT-C-01": cityLoss("Target city loses 5 Flock, and one neighbor loses 3.", 5, 3),
  "NAT-C-02": {
    text: "Every city in the target region loses 3 Flock.",
    targets: [targetPlayer, anyRegion],
    resolve: (ctx, t) => citiesInRegion(ctx.data, t.region).forEach((c) => hit(ctx, c, t.player, 3)),
  },
  "NAT-C-03": cityLoss("Target loses 3 Flock, and one neighbor loses 2.", 3, 2),
  "NAT-C-04": later4b("blocks Flock from arriving next turn (an ongoing effect)"),
  "NAT-C-05": {
    text: "Target loses 2 Flock, and every other city in the region loses 1.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 2);
      neighborsOf(ctx.data, t.city).forEach((c) => hit(ctx, c, t.player, 1));
    },
  },
  "NAT-C-06": cityLoss("Target loses 2 Flock, and one neighbor loses 1.", 2, 1),
  "NAT-C-07": later4b("stops Flock moving out next turn (an ongoing effect)"),
  "NAT-C-08": cityLoss("Target and one neighbor each lose 1 Flock.", 1, 1),
  "NAT-C-09": {
    text: "Move 1 of the target player's Flock to a neighboring city they don't control.",
    targets: [
      targetPlayer,
      { ...cityWithTargetFlock, question: "Move 1 of their Flock out of which city?" },
      {
        key: "neighbor",
        question: "Into which neighboring city?",
        noneReason: "They control every neighboring city.",
        options: (ctx, t) =>
          neighborsOf(ctx.data, t.city)
            .filter((c) => cityState(ctx.state, c).controller !== t.player)
            .map((c) => withFlockLabel(ctx, t.player, c)),
      },
    ],
    resolve: (ctx, t) => {
      const from = cityState(ctx.state, t.city);
      setFlock(ctx.state, t.city, t.player, flockIn(from, t.player) - 1);
      setFlock(ctx.state, t.neighbor, t.player, flockIn(cityState(ctx.state, t.neighbor), t.player) + 1);
      ctx.report(`1 of ${playerName(ctx, t.player)}'s Flock is blown from ${t.city} to ${t.neighbor}.`);
    },
  },

  // Nature Favors: spread
  "NAT-F-01": cityGain("Target gains 5 Flock, and one neighbor gains 3.", 5, 3),
  "NAT-F-02": {
    text: "Every city in the target region where you have Flock gains 2.",
    targets: [
      {
        ...anyRegion,
        noneReason: "You have no Flock on the board.",
        options: (ctx) =>
          REGIONS.filter((r) => citiesInRegion(ctx.data, r).some((c) => flockIn(cityState(ctx.state, c), ctx.caster.id) > 0)).map(
            (r) => ({ value: r, label: `Region ${r}` }),
          ),
      },
    ],
    resolve: (ctx, t) =>
      citiesInRegion(ctx.data, t.region)
        .filter((c) => flockIn(cityState(ctx.state, c), ctx.caster.id) > 0)
        .forEach((c) => gainFlock(ctx, c, 2)),
  },
  "NAT-F-03": cityGain("Target gains 3 Flock, and one neighbor gains 2.", 3, 2),
  "NAT-F-04": {
    text: "Target gains 2 Flock, and every other city in the region where you have Flock gains 1.",
    targets: [favorCity],
    resolve: (ctx, t) => {
      const others = neighborsOf(ctx.data, t.city).filter((c) => flockIn(cityState(ctx.state, c), ctx.caster.id) > 0);
      gainFlock(ctx, t.city, 2);
      others.forEach((c) => gainFlock(ctx, c, 1));
    },
  },
  "NAT-F-05": later4b("is a counter, played in response to a Calamity"),
  "NAT-F-06": cityGain("Target gains 2 Flock, and one neighbor gains 1.", 2, 1),
  "NAT-F-07": {
    text: "Move up to 2 of your Flock into a neighboring city, then add 1 more there.",
    targets: [
      {
        key: "city",
        question: "Move Flock out of which city?",
        noneReason: "You have no Flock on the board.",
        options: (ctx) =>
          ctx.state.cities.filter((c) => flockIn(c, ctx.caster.id) > 0).map((c) => withFlockLabel(ctx, ctx.caster.id, c.name)),
      },
      neighbor("Into which neighboring city?"),
      {
        key: "amount",
        question: "How many to move?",
        noneReason: "",
        options: (ctx, t) => {
          const max = Math.min(2, flockIn(cityState(ctx.state, t.city), ctx.caster.id));
          return Array.from({ length: max + 1 }, (_, n) => ({ value: String(n), label: String(n) }));
        },
      },
    ],
    resolve: (ctx, t) => {
      const n = Number(t.amount);
      const id = ctx.caster.id;
      setFlock(ctx.state, t.city, id, flockIn(cityState(ctx.state, t.city), id) - n);
      setFlock(ctx.state, t.neighbor, id, flockIn(cityState(ctx.state, t.neighbor), id) + n);
      ctx.report(`${ctx.caster.name} moves ${n} Flock from ${t.city} to ${t.neighbor}.`);
      gainFlock(ctx, t.neighbor, 1);
    },
  },
  "NAT-F-08": cityGain("Target and one neighbor each gain 1 Flock.", 1, 1),
  "NAT-F-09": {
    text: "Choose a city where you have Flock. Take 1 of an opponent's Flock from one of its neighbors and add it to the chosen city as yours.",
    targets: [
      {
        key: "city",
        question: "Add the Flock to which of your cities?",
        noneReason: "You have no Flock on the board.",
        options: (ctx) =>
          ctx.state.cities.filter((c) => flockIn(c, ctx.caster.id) > 0).map((c) => withFlockLabel(ctx, ctx.caster.id, c.name)),
      },
      {
        key: "steal",
        question: "Take 1 Flock from whom, and where?",
        noneReason: "No opponent has Flock in a neighboring city.",
        options: (ctx, t) =>
          neighborsOf(ctx.data, t.city).flatMap((c) =>
            ctx.state.players
              .filter((p) => p.id !== ctx.caster.id && flockIn(cityState(ctx.state, c), p.id) > 0)
              .map((p) => ({ value: `${p.id}@${c}`, label: `${p.name} in ${c} (has ${flockIn(cityState(ctx.state, c), p.id)})` })),
          ),
      },
    ],
    resolve: (ctx, t) => {
      const [victim, from] = t.steal.split("@");
      setFlock(ctx.state, from, victim, flockIn(cityState(ctx.state, from), victim) - 1);
      setFlock(ctx.state, t.city, ctx.caster.id, flockIn(cityState(ctx.state, t.city), ctx.caster.id) + 1);
      ctx.report(`1 of ${playerName(ctx, victim)}'s Flock leaves ${from} and joins ${ctx.caster.name} in ${t.city}.`);
    },
  },

  // Harvest Calamities: time
  "HAR-C-01": later4b("stops income for 2 turns (an ongoing effect)"),
  "HAR-C-02": later4b("keeps hitting for 3 turns (an ongoing effect)"),
  "HAR-C-03": later4b("needs a ruling on who picks which cities pay (see rules questions)"),
  "HAR-C-04": later4b("stops a city's income for 2 turns (an ongoing effect)"),
  "HAR-C-05": later4b("keeps hitting for 3 turns (an ongoing effect)"),
  "HAR-C-06": reserveLoss("Target player loses 2 Flock from reserve.", 2),
  "HAR-C-07": later4b("hits again next turn (an ongoing effect)"),
  "HAR-C-08": reserveLoss("Target player loses 1 Flock from reserve.", 1),
  "HAR-C-09": later4b("changes next turn's income (an ongoing effect)"),

  // Harvest Favors: time
  "HAR-F-01": later4b("plants a seed"),
  "HAR-F-02": later4b("lasts 3 Economy Phases (an ongoing effect)"),
  "HAR-F-03": later4b("plants a seed"),
  "HAR-F-04": later4b("pays again next turn (an ongoing effect)"),
  "HAR-F-05": later4b("cancels ongoing effects"),
  "HAR-F-06": later4b("plants a seed"),
  "HAR-F-07": later4b("pays again next turn (an ongoing effect)"),
  "HAR-F-08": reserveGain("Gain 1 Flock in reserve.", 1),
  "HAR-F-09": later4b("plants a seed"),

  // Production Calamities: permanence
  "PRO-C-01": later4b("leaves a Ruin token"),
  "PRO-C-02": later4b("destroys structures"),
  "PRO-C-03": later4b("changes card costs"),
  "PRO-C-04": later4b("locks a Prophet (Prophets arrive in milestone 5)"),
  "PRO-C-05": later4b("destroys a structure"),
  "PRO-C-06": later4b("destroys a structure"),
  "PRO-C-07": later4b("changes card costs"),
  "PRO-C-08": later4b("changes card costs"),
  "PRO-C-09": later4b("locks a Prophet (Prophets arrive in milestone 5)"),

  // Production Favors: permanence
  "PRO-F-01": later4b("builds a structure"),
  "PRO-F-02": later4b("builds a structure"),
  "PRO-F-03": later4b("builds a structure"),
  "PRO-F-04": later4b("builds a structure"),
  "PRO-F-05": later4b("repairs structures"),
  "PRO-F-06": later4b("builds a structure"),
  "PRO-F-07": later4b("builds a structure"),
  "PRO-F-08": later4b("changes card costs"),
  "PRO-F-09": later5("moves your Prophet"),

  // Health Calamities: the graveyard
  "HEA-C-01": later4b("rises again next turn (an ongoing effect)"),
  "HEA-C-02": later4b("lets the target choose their discards"),
  "HEA-C-03": {
    text: "Target city loses 2 Flock, or 4 if another Health Calamity is in the discard pile.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => hit(ctx, t.city, t.player, inDiscard(ctx, "Calamity", "Health/Fertility") > 0 ? 4 : 2),
  },
  "HEA-C-04": later4b("plays a card from the discard pile"),
  "HEA-C-05": {
    text: "Target player discards 1 card at random, and one of their cities loses 2 Flock.",
    targets: [targetPlayer, cityWithTargetFlock],
    resolve: (ctx, t) => {
      discardAtRandom(ctx, t.player);
      hit(ctx, t.city, t.player, 2);
    },
  },
  "HEA-C-06": later5("gives a Prophet a strike"),
  "HEA-C-07": {
    text: "Target city loses 1 Flock for each Health Calamity in the discard pile, up to 3.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      const n = Math.min(3, inDiscard(ctx, "Calamity", "Health/Fertility"));
      if (n === 0) ctx.report("There are no Health Calamities in the discard pile, so nothing happens.");
      else hit(ctx, t.city, t.player, n);
    },
  },
  "HEA-C-08": {
    text: "Target player discards 1 card at random.",
    targets: [targetPlayer],
    resolve: (ctx, t) => discardAtRandom(ctx, t.player),
  },
  "HEA-C-09": {
    text: "Target city loses 1 Flock, plus 1 from the target's reserve if another Health Calamity is in the discard pile.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 1);
      if (inDiscard(ctx, "Calamity", "Health/Fertility") > 0) loseReserve(ctx, t.player, 1);
    },
  },

  // Health Favors: the graveyard
  "HEA-F-01": later5("brings back a Prophet or Hero"),
  "HEA-F-02": later4b("needs a ruling on whose Flock counts (see rules questions)"),
  "HEA-F-03": later4b("plays a card from the discard pile"),
  "HEA-F-04": {
    text: "Target city gains 2 Flock, plus 1 more for each Health Favor in the discard pile (maximum +3).",
    targets: [favorCity],
    resolve: (ctx, t) => gainFlock(ctx, t.city, 2 + Math.min(3, inDiscard(ctx, "Favor", "Health/Fertility"))),
  },
  "HEA-F-05": later4b("is a counter, played in response to a Calamity"),
  "HEA-F-06": later5("removes a strike"),
  "HEA-F-07": {
    text: "Take a Favor card costing 3 or less from the discard pile into your hand.",
    targets: [
      {
        key: "card",
        question: "Which Favor do you take back?",
        noneReason: "There's no Favor costing 3 or less in the discard pile.",
        options: (ctx) =>
          ctx.state.discards.Favor.map((id) => ctx.data.cards.find((c) => c.id === id)!)
            .filter((c): c is DivineCard => c.kind === "divine" && c.cost <= 3)
            .map((c) => ({ value: c.id, label: `${c.name} (cost ${c.cost})` })),
      },
    ],
    resolve: (ctx, t) => {
      const pile = ctx.state.discards.Favor;
      pile.splice(pile.indexOf(t.card), 1);
      ctx.caster.hand.push(t.card);
      ctx.report(`${ctx.caster.name} takes ${cardName(ctx, t.card)} back from the discard pile.`);
    },
  },
  "HEA-F-08": {
    text: "Target city gains 1 Flock, or 2 if a Calamity hit it this turn.",
    targets: [favorCity],
    resolve: (ctx, t) => {
      const phase = ctx.state.phase;
      const wasHit = phase.name === "turn" && phase.calamityHits.includes(t.city);
      gainFlock(ctx, t.city, wasHit ? 2 : 1);
    },
  },
  "HEA-F-09": {
    text: "Target city gains 1 Flock, plus 1 more if a Health Favor is in the discard pile.",
    targets: [favorCity],
    resolve: (ctx, t) => gainFlock(ctx, t.city, inDiscard(ctx, "Favor", "Health/Fertility") > 0 ? 2 : 1),
  },

  // Neutral Calamities
  "NEU-C-01": cityLoss("Target city loses 5 Flock.", 5),
  "NEU-C-02": later5("gives a Prophet a strike"),
  "NEU-C-03": cityLoss("Target city loses 3 Flock.", 3),
  "NEU-C-04": later5("gives a Prophet a strike"),
  "NEU-C-05": {
    text: "Target player loses 2 Flock from one city and 1 from reserve.",
    targets: [targetPlayer, cityWithTargetFlock],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 2);
      loseReserve(ctx, t.player, 1);
    },
  },
  "NEU-C-06": cityLoss("Target city loses 3 Flock.", 3),
  "NEU-C-07": cityLoss("Target city loses 2 Flock.", 2),
  "NEU-C-08": cityLoss("Target city loses 2 Flock.", 2),
  "NEU-C-09": later5("gives a Hero a strike"),
  "NEU-C-10": cityLossAndReserve("Target city loses 1 Flock, and its owner loses 1 from reserve."),
  "NEU-C-11": cityLoss("Target city loses 1 Flock.", 1),
  "NEU-C-12": cityLoss("Target city loses 1 Flock.", 1),
  "NEU-C-13": cityLossAndReserve("Target city loses 1 Flock, and its owner loses 1 from reserve."),
  "NEU-C-14": cityLoss("Target city loses 2 Flock.", 2),

  // Neutral Favors
  "NEU-F-01": cityGain("Target city gains 5 Flock.", 5),
  "NEU-F-02": {
    text: "Two cities you control each gain 2 Flock, and you gain 1 in reserve.",
    targets: [
      {
        key: "city",
        question: "First city you control?",
        noneReason: "You need to control two cities.",
        options: (ctx) =>
          ctx.state.cities.filter((c) => c.controller === ctx.caster.id).length >= 2
            ? ctx.state.cities.filter((c) => c.controller === ctx.caster.id).map((c) => withFlockLabel(ctx, ctx.caster.id, c.name))
            : [],
      },
      {
        key: "city2",
        question: "Second city you control?",
        noneReason: "You need to control two cities.",
        options: (ctx, t) =>
          ctx.state.cities
            .filter((c) => c.controller === ctx.caster.id && c.name !== t.city)
            .map((c) => withFlockLabel(ctx, ctx.caster.id, c.name)),
      },
    ],
    resolve: (ctx, t) => {
      gainFlock(ctx, t.city, 2);
      gainFlock(ctx, t.city2, 2);
      gainReserve(ctx, 1);
    },
  },
  "NEU-F-03": cityGain("Target city gains 3 Flock.", 3),
  "NEU-F-04": later5("needs your Prophet"),
  "NEU-F-05": later5("needs your Hero"),
  "NEU-F-06": cityGainAndReserve("Gain 2 in reserve, and target city gains 1 Flock.", 1, 2),
  "NEU-F-07": cityGain("Target city gains 2 Flock.", 2),
  "NEU-F-08": cityGain("Target city gains 2 Flock.", 2),
  "NEU-F-09": later5("removes a strike"),
  "NEU-F-10": cityGainAndReserve("Target city gains 1 Flock, and you gain 1 in reserve.", 1, 1),
  "NEU-F-11": cityGain("Target city gains 1 Flock.", 1),
  "NEU-F-12": cityGain("Target city gains 1 Flock.", 1),
  "NEU-F-13": reserveGain("Gain 2 in reserve.", 2),
  "NEU-F-14": cityGainAndReserve("Target city gains 1 Flock, and you gain 1 in reserve.", 1, 1),
};

function cardName(ctx: EffectContext, id: string): string {
  return ctx.data.cards.find((c: Card) => c.id === id)?.name ?? id;
}

function discardAtRandom(ctx: EffectContext, playerId: string) {
  const p = playerById(ctx.state, playerId);
  if (p.hand.length === 0) {
    ctx.report(`${p.name} has no cards to discard.`);
    return;
  }
  const [id] = p.hand.splice(randomInt(ctx.state, p.hand.length), 1);
  const card = ctx.data.cards.find((c) => c.id === id)!;
  ctx.state.discards[card.deck].push(id);
  ctx.report(`${p.name} discards ${card.name} at random.`);
}

/** Looks up a card's effect. Throws if a card has no entry, which a test guards against. */
export function effectFor(cardId: string): CardEffect {
  const effect = EFFECTS[cardId];
  if (!effect) throw new Error(`No effect is written for card ${cardId}.`);
  return effect;
}
