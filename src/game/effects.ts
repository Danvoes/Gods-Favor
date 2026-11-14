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
import { REGIONS, citiesInRegion, cityInfo, cityState, flockIn, neighborsOf, placeableCities, playerById } from "./rules";
import { addOngoing, cannotMoveOut, cannotReceive, describeOngoing } from "./ongoing";
import { RULES, workingStructures } from "./rules";
import { STRUCTURE_CARDS, type GameState, type Ongoing, type PlayerState, type StructureKind } from "./types";

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
  /** Skipped when there's nothing to choose (e.g. "Which structure?" in a city with none). */
  optional?: boolean;
}

export interface Playable {
  text: string;
  /** The questions, or a function giving them from the answers so far (when later questions depend on earlier ones). */
  targets: TargetSpec[] | ((ctx: EffectContext, chosen: Targets) => TargetSpec[]);
  resolve: (ctx: EffectContext, t: Targets) => void;
  /** Counters are only played in response to a Calamity, not as an action. */
  counter?: boolean;
  /** The target player makes a choice when it resolves (Barren Years: discard 2 of their choice). */
  targetChooses?: { key: string; count: number; question: string };
}

export function specsFor(effect: Playable, ctx: EffectContext, chosen: Targets): TargetSpec[] {
  return typeof effect.targets === "function" ? effect.targets(ctx, chosen) : effect.targets;
}

export interface NotYet {
  later: "milestone 5" | "a rules ruling";
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

/**
 * A Calamity hitting a city: removes the target player's Flock and remembers
 * the hit. Each working City Walls there means 1 less Flock lost.
 */
function hit(ctx: EffectContext, city: string, playerId: string, n: number) {
  const phase = ctx.state.phase;
  if (phase.name === "turn" && !phase.calamityHits.includes(city)) phase.calamityHits.push(city);
  const walls = workingStructures(cityState(ctx.state, city), "City Walls");
  if (walls > 0 && n > 0) ctx.report(`${city}'s City Walls soften the blow by ${Math.min(walls, n)}.`);
  loseFlock(ctx, city, playerId, Math.max(0, n - walls));
}

// --------------------------------------------------------------- structures

const structureLabel = (kind: string, status: string) => (status === "on" ? kind : `${kind} (${status})`);

function build(ctx: EffectContext, city: string, kind: StructureKind) {
  const c = cityState(ctx.state, city);
  c.structures.push({ kind, status: "on" });
  ctx.report(`${ctx.caster.name} builds a ${kind} in ${city}.`);
}

function destroyStructure(ctx: EffectContext, city: string, index: number) {
  const c = cityState(ctx.state, city);
  const [gone] = c.structures.splice(index, 1);
  ctx.state.destroyed.push({ city, kind: gone.kind, turn: ctx.state.turnCount });
  ctx.report(`${city}'s ${gone.kind} is destroyed.`);
}

/** "Build:" cards go in a city you control with a free structure slot. */
const buildCity: TargetSpec = {
  key: "city",
  question: "Build in which city you control?",
  noneReason: "You need to control a city with a free structure slot (at most 2 per city).",
  options: (ctx) =>
    ctx.state.cities
      .filter((c) => c.controller === ctx.caster.id && c.structures.length < RULES.maxStructuresPerCity)
      .map((c) => ({ value: c.name, label: `${c.name} (${c.structures.length}/2 structures)` })),
};

function structureCard(cardId: keyof typeof STRUCTURE_CARDS, text: string, extra?: (ctx: EffectContext, t: Targets) => void): Playable {
  return {
    text,
    targets: [buildCity],
    resolve: (ctx, t) => {
      build(ctx, t.city, STRUCTURE_CARDS[cardId]);
      extra?.(ctx, t);
    },
  };
}

/** "Which structure?" in the chosen city. Skipped if it has none. */
const whichStructure: TargetSpec = {
  key: "structure",
  question: "Which structure?",
  noneReason: "",
  optional: true,
  options: (ctx, t) =>
    cityState(ctx.state, t.city).structures.map((st, i) => ({ value: String(i), label: structureLabel(st.kind, st.status) })),
};

function nextCardCost(text: string, who: "target" | "self", amount: number): Playable {
  return {
    text,
    targets: who === "target" ? [targetPlayer] : [],
    resolve: (ctx, t) => {
      const p = who === "target" ? playerById(ctx.state, t.player) : ctx.caster;
      p.nextCardCost += amount;
      ctx.report(`${p.name}'s next card costs ${Math.abs(amount)} ${amount > 0 ? "more" : "less"}.`);
    },
  };
}

function gainFlock(ctx: EffectContext, city: string, n: number) {
  const id = ctx.caster.id;
  if (cannotReceive(ctx.state, id, city)) {
    ctx.report(`${city}: ${ctx.caster.name} can't receive Flock there this turn (Earthquake).`);
    return;
  }
  setFlock(ctx.state, city, id, flockIn(cityState(ctx.state, city), id) + n);
  ctx.report(`${city}: ${ctx.caster.name} gains ${n} Flock.`);
}

/** Adds a lasting effect and reports it. It starts at the affected player's next turn. */
function lasting(ctx: EffectContext, marker: Omit<Ongoing, "id" | "active" | "card">) {
  const m = addOngoing(ctx.state, { ...marker, card: ctx.card.id });
  ctx.report(`${playerName(ctx, m.player)}: ${describeOngoing(m)}.`);
}

/** "Plant a seed. It yields N Flock at your next Economy Phase." */
function seedCard(text: string, amount: (ctx: EffectContext, city: string) => number): Playable {
  return {
    text,
    targets: [{ ...favorCity, question: "Plant the seed in which city?" }],
    resolve: (ctx, t) => {
      const n = amount(ctx, t.city);
      cityState(ctx.state, t.city).seeds.push({ owner: ctx.caster.id, amount: n, card: ctx.card.id, plantedTurn: ctx.state.turnCount });
      ctx.report(`${ctx.caster.name} plants a seed in ${t.city}. It yields ${n} Flock at their next Economy Phase.`);
    },
  };
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

const ruling = (why: string): NotYet => ({ later: "a rules ruling", why });

/** The Calamity waiting on responses, if any (counters use it). */
function pendingCalamity(ctx: EffectContext) {
  const phase = ctx.state.phase;
  return phase.name === "turn" ? phase.pending : undefined;
}

/** Contagion and Remembered Prayers: play a card from the discard pile for free, asking its own questions. */
function playFromDiscard(
  text: string,
  deck: "Calamity" | "Favor",
  maxCost: number,
): Playable {
  const pick: TargetSpec = {
    key: "inner",
    question: `Which ${deck} from the discard pile?`,
    noneReason: `There's no playable ${deck} costing ${maxCost} or less in the discard pile.`,
    options: (ctx) =>
      [...new Set(ctx.state.discards[deck])]
        .map((id) => ctx.data.cards.find((c) => c.id === id) as DivineCard)
        .filter((c) => {
          const e = EFFECTS[c.id];
          return c.cost <= maxCost && e && isPlayable(e) && !e.counter && typeof e.targets !== "function" && !e.targetChooses;
        })
        .map((c) => ({ value: c.id, label: `${c.name} (cost ${c.cost}): ${c.effect}` })),
  };
  const innerCtx = (ctx: EffectContext, id: string): EffectContext => ({
    ...ctx,
    card: ctx.data.cards.find((c) => c.id === id) as DivineCard,
  });
  // The inner card's answers are stored with an "in_" prefix, apart from the shared target player.
  const unprefix = (t: Targets): Targets => {
    const out: Targets = {};
    for (const [k, v] of Object.entries(t)) if (k.startsWith("in_")) out[k.slice(3)] = v;
    if (t.player) out.player = t.player;
    return out;
  };
  return {
    text,
    targets: (ctx, chosen) => {
      const base = deck === "Calamity" ? [targetPlayer, pick] : [pick];
      if (!chosen.inner) return base;
      const inner = EFFECTS[chosen.inner] as Playable;
      const ictx = innerCtx(ctx, chosen.inner);
      const innerSpecs = (inner.targets as TargetSpec[])
        .filter((spec) => spec.key !== "player")
        .map((spec) => ({ ...spec, key: `in_${spec.key}`, options: (_: EffectContext, t: Targets) => spec.options(ictx, unprefix(t)) }));
      return [...base, ...innerSpecs];
    },
    resolve: (ctx, t) => {
      const inner = EFFECTS[t.inner] as Playable;
      const ictx = innerCtx(ctx, t.inner);
      ctx.report(`It plays ${ictx.card.name} from the discard pile for free.`);
      resolveEffect(ictx, inner, unprefix(t));
    },
  };
}
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
  "NAT-C-04": {
    text: "Target loses 3 Flock, and one neighbor loses 1. Neither city can receive Flock next turn.",
    targets: [targetPlayer, calamityCity, neighbor("Which neighbor does it spread to?")],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 3);
      hit(ctx, t.neighbor, t.player, 1);
      for (const city of [t.city, t.neighbor]) lasting(ctx, { kind: "noReceive", player: t.player, city, amount: 0, turnsLeft: 1 });
    },
  },
  "NAT-C-05": {
    text: "Target loses 2 Flock, and every other city in the region loses 1.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 2);
      neighborsOf(ctx.data, t.city).forEach((c) => hit(ctx, c, t.player, 1));
    },
  },
  "NAT-C-06": cityLoss("Target loses 2 Flock, and one neighbor loses 1.", 2, 1),
  "NAT-C-07": {
    text: "Target loses 2 Flock, and its owner can't move Flock out of that city next turn.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 2);
      lasting(ctx, { kind: "noMoveOut", player: t.player, city: t.city, amount: 0, turnsLeft: 1 });
    },
  },
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
      if (flockIn(from, t.player) === 0) {
        ctx.report(`${playerName(ctx, t.player)} has no Flock in ${t.city}, so nothing happens.`);
        return;
      }
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
  "NAT-F-05": {
    text: "Counter: cancel a Calamity just played on one of your cities, then that city and one neighbor each gain 1.",
    counter: true,
    targets: [
      {
        key: "neighbor",
        question: "Which neighbor also gains 1?",
        noneReason: "Shelter of the Wild only works on a Calamity aimed at one of your cities.",
        options: (ctx) => {
          const city = pendingCalamity(ctx)?.answers.city;
          if (!city) return [];
          const c = cityState(ctx.state, city);
          if (c.controller !== ctx.caster.id && flockIn(c, ctx.caster.id) === 0) return [];
          return neighborsOf(ctx.data, city).map((n) => withFlockLabel(ctx, ctx.caster.id, n));
        },
      },
    ],
    resolve: (ctx, t) => {
      gainFlock(ctx, pendingCalamity(ctx)!.answers.city, 1);
      gainFlock(ctx, t.neighbor, 1);
    },
  },
  "NAT-F-06": cityGain("Target gains 2 Flock, and one neighbor gains 1.", 2, 1),
  "NAT-F-07": {
    text: "Move up to 2 of your Flock into a neighboring city, then add 1 more there.",
    targets: [
      {
        key: "city",
        question: "Move Flock out of which city?",
        noneReason: "You have no Flock you're free to move (Wild Beasts stops moves out of a city).",
        options: (ctx) =>
          ctx.state.cities
            .filter((c) => flockIn(c, ctx.caster.id) > 0 && !cannotMoveOut(ctx.state, ctx.caster.id, c.name))
            .map((c) => withFlockLabel(ctx, ctx.caster.id, c.name)),
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
  "HAR-C-01": {
    text: "Target player gains no Flock income for their next 2 Economy Phases.",
    targets: [targetPlayer],
    resolve: (ctx, t) => lasting(ctx, { kind: "noIncome", player: t.player, amount: 0, turnsLeft: 2 }),
  },
  "HAR-C-02": {
    text: "Target city loses 2 Flock now, then 1 more at the start of each of its owner's next 3 turns.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 2);
      lasting(ctx, { kind: "startLoss", player: t.player, city: t.city, amount: 1, turnsLeft: 3 });
    },
  },
  "HAR-C-03": ruling("needs a ruling on who picks which cities pay (see rules questions)"),
  "HAR-C-04": {
    text: "Target city produces no income for 2 turns.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      lasting(ctx, { kind: "cityNoIncome", player: t.player, city: t.city, amount: 0, turnsLeft: 2 });
    },
  },
  "HAR-C-05": {
    text: "Target city loses 1 Flock at the start of each of its owner's next 3 turns.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => lasting(ctx, { kind: "startLoss", player: t.player, city: t.city, amount: 1, turnsLeft: 3 }),
  },
  "HAR-C-06": reserveLoss("Target player loses 2 Flock from reserve.", 2),
  "HAR-C-07": {
    text: "Target city loses 1 Flock now and 1 next turn.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 1);
      lasting(ctx, { kind: "startLoss", player: t.player, city: t.city, amount: 1, turnsLeft: 1 });
    },
  },
  "HAR-C-08": reserveLoss("Target player loses 1 Flock from reserve.", 1),
  "HAR-C-09": {
    text: "Target player's next income is halved, rounded down.",
    targets: [targetPlayer],
    resolve: (ctx, t) => lasting(ctx, { kind: "halveIncome", player: t.player, amount: 0, turnsLeft: 1 }),
  },

  // Harvest Favors: time
  "HAR-F-01": seedCard("Plant a seed. It yields 8 Flock at your next Economy Phase.", () => 8),
  "HAR-F-02": {
    text: "For your next 3 Economy Phases, every city you control gives +1 extra income.",
    targets: [],
    resolve: (ctx) => lasting(ctx, { kind: "extraCityIncome", player: ctx.caster.id, amount: 1, turnsLeft: 3 }),
  },
  "HAR-F-03": seedCard("Plant a seed. It yields 5 Flock at your next Economy Phase.", () => 5),
  "HAR-F-04": {
    text: "Gain 3 Flock in reserve now and 1 more next turn.",
    targets: [],
    resolve: (ctx) => {
      gainReserve(ctx, 3);
      lasting(ctx, { kind: "delayedReserve", player: ctx.caster.id, amount: 1, turnsLeft: 1 });
    },
  },
  "HAR-F-05": {
    text: "Cancel one ongoing effect on you or your cities (e.g. Famine, Blight or Drought), then gain 2 in reserve.",
    targets: [
      {
        key: "effect",
        question: "Which ongoing effect do you cancel?",
        noneReason: "There's no ongoing effect on you or your cities.",
        options: (ctx) =>
          ctx.state.ongoing
            .filter((m) => m.player === ctx.caster.id || (m.city && cityState(ctx.state, m.city).controller === ctx.caster.id))
            .map((m) => ({ value: String(m.id), label: `${playerName(ctx, m.player)}: ${describeOngoing(m)}` })),
      },
    ],
    resolve: (ctx, t) => {
      const m = ctx.state.ongoing.find((x) => String(x.id) === t.effect)!;
      ctx.state.ongoing = ctx.state.ongoing.filter((x) => x !== m);
      ctx.report(`${describeOngoing(m).split(":")[0]} on ${playerName(ctx, m.player)} is cancelled.`);
      gainReserve(ctx, 2);
    },
  },
  "HAR-F-06": seedCard("Plant a seed. It yields 4 Flock at your next Economy Phase.", () => 4),
  "HAR-F-07": {
    text: "Gain 2 Flock in reserve now and 1 more at your next Economy Phase.",
    targets: [],
    resolve: (ctx) => {
      gainReserve(ctx, 2);
      lasting(ctx, { kind: "delayedReserve", player: ctx.caster.id, amount: 1, turnsLeft: 1 });
    },
  },
  "HAR-F-08": reserveGain("Gain 1 Flock in reserve.", 1),
  "HAR-F-09": seedCard(
    "Plant a seed. It yields 3 Flock at your next Economy Phase, or 4 if the city matches your domain.",
    (ctx, city) => (cityInfo(ctx.data, city).need === ctx.caster.domain ? 4 : 3),
  ),

  // Production Calamities: permanence
  "PRO-C-01": {
    text: "Target city loses 4 Flock and gets a Ruin token, which cuts its income by 1 until cleared.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 4);
      cityState(ctx.state, t.city).ruin += 1;
      ctx.report(`${t.city} gets a Ruin token (-1 income until cleared).`);
    },
  },
  "PRO-C-02": {
    text: "Destroy every structure in the target region, and each city there loses 1 Flock.",
    targets: [targetPlayer, anyRegion],
    resolve: (ctx, t) => {
      for (const city of citiesInRegion(ctx.data, t.region)) {
        const c = cityState(ctx.state, city);
        while (c.structures.length > 0) destroyStructure(ctx, city, 0);
        hit(ctx, city, t.player, 1);
      }
    },
  },
  "PRO-C-03": {
    text: "Target player's cards cost 2 more for their next 2 turns.",
    targets: [targetPlayer],
    resolve: (ctx, t) => lasting(ctx, { kind: "costUp", player: t.player, amount: 2, turnsLeft: 2 }),
  },
  "PRO-C-04": later5("locks a Prophet"),
  "PRO-C-05": {
    text: "Target city loses 3 Flock, and one structure there is destroyed.",
    targets: [targetPlayer, calamityCity, whichStructure],
    resolve: (ctx, t) => {
      hit(ctx, t.city, t.player, 3);
      if (t.structure !== undefined) destroyStructure(ctx, t.city, Number(t.structure));
    },
  },
  "PRO-C-06": {
    text: "Destroy one structure in the target city. If it has none, the city loses 2 Flock instead.",
    targets: [targetPlayer, calamityCity, whichStructure],
    resolve: (ctx, t) => {
      if (t.structure !== undefined) destroyStructure(ctx, t.city, Number(t.structure));
      else hit(ctx, t.city, t.player, 2);
    },
  },
  "PRO-C-07": nextCardCost("Target player's next card costs 2 more.", "target", 2),
  "PRO-C-08": nextCardCost("Target player's next card costs 1 more.", "target", 1),
  "PRO-C-09": later5("locks a Prophet"),

  // Production Favors: permanence
  "PRO-F-01": structureCard("PRO-F-01", "Build: this city gives +2 income every turn."),
  "PRO-F-02": structureCard(
    "PRO-F-02",
    "Build, linked to the city's region: your Prophet moves between cities in that region for free, and each city you control there gains 1 Flock now.",
    (ctx, t) => {
      ctx.report("(Free Prophet moves start working when Prophets arrive in milestone 5.)");
      const region = cityInfo(ctx.data, t.city).region;
      citiesInRegion(ctx.data, region)
        .filter((c) => cityState(ctx.state, c).controller === ctx.caster.id)
        .forEach((c) => gainFlock(ctx, c, 1));
    },
  ),
  "PRO-F-03": structureCard("PRO-F-03", "Build: your cards cost 1 less while you control this city (maximum -2 from Workshops)."),
  "PRO-F-04": structureCard("PRO-F-04", "Build: Calamities against this city cost the caster 2 more, and the city loses 1 less Flock from each."),
  "PRO-F-05": {
    text: "Remove a Ruin token, restore an Idle structure, or rebuild one destroyed since your last turn, then gain 1 Flock there.",
    targets: [
      {
        key: "repair",
        question: "What do you repair?",
        noneReason: "There's no Ruin token, Idle structure or recently destroyed structure in a city you can target.",
        options: (ctx) => {
          const opts: Option[] = [];
          for (const city of placeableCities(ctx.state, ctx.caster.id)) {
            const c = cityState(ctx.state, city);
            if (c.ruin > 0) opts.push({ value: `ruin@${city}`, label: `Remove a Ruin token in ${city}` });
            // Only Idle structures: switched-off ones (city went uncontrolled) can't be repaired.
            c.structures.forEach((st, i) => {
              if (st.status === "idle") opts.push({ value: `restore@${city}@${i}`, label: `Restore the Idle ${st.kind} in ${city}` });
            });
            if (c.structures.length < RULES.maxStructuresPerCity) {
              ctx.state.destroyed.forEach((d, i) => {
                if (d.city === city && d.turn > ctx.caster.previousTurn) {
                  opts.push({ value: `rebuild@${city}@${i}`, label: `Rebuild the ${d.kind} in ${city}` });
                }
              });
            }
          }
          return opts;
        },
      },
    ],
    resolve: (ctx, t) => {
      const [kind, city, n] = t.repair.split("@");
      const c = cityState(ctx.state, city);
      if (kind === "ruin") {
        c.ruin -= 1;
        ctx.report(`A Ruin token is cleared from ${city}.`);
      } else if (kind === "restore") {
        c.structures[Number(n)].status = "on";
        ctx.report(`${city}'s ${c.structures[Number(n)].kind} is working again.`);
      } else {
        const [d] = ctx.state.destroyed.splice(Number(n), 1);
        c.structures.push({ kind: d.kind, status: c.controller ? "on" : "off" });
        ctx.report(`${city}'s ${d.kind} is rebuilt.`);
      }
      gainFlock(ctx, city, 1);
    },
  },
  "PRO-F-06": structureCard("PRO-F-06", "Build: this city gives +1 income."),
  "PRO-F-07": structureCard(
    "PRO-F-07",
    "Build: moving your Prophet into or out of this city always costs 1 Flock, ignoring the domain wheel.",
    (ctx) => ctx.report("(Its effect on Prophet moves starts working when Prophets arrive in milestone 5.)"),
  ),
  "PRO-F-08": nextCardCost("Your next card costs 2 less.", "self", -2),
  "PRO-F-09": later5("moves your Prophet"),

  // Health Calamities: the graveyard
  "HEA-C-01": ruling("needs a ruling on who picks the second city it hits (see rules questions)"),
  "HEA-C-02": {
    text: "Target player discards 2 cards from their hand (their choice) and loses 1 Flock in each city they control.",
    targets: [targetPlayer],
    targetChooses: { key: "discards", count: 2, question: "Choose 2 cards to discard" },
    resolve: (ctx, t) => {
      const p = playerById(ctx.state, t.player);
      for (const id of (t.discards ?? "").split(",").filter(Boolean)) {
        p.hand.splice(p.hand.indexOf(id), 1);
        const card = ctx.data.cards.find((c) => c.id === id)!;
        ctx.state.discards[card.deck].push(id);
        ctx.report(`${p.name} discards ${card.name}.`);
      }
      const controlled = ctx.state.cities.filter((c) => c.controller === t.player).map((c) => c.name);
      if (controlled.length === 0) ctx.report(`${p.name} controls no cities, so no Flock is lost.`);
      controlled.forEach((c) => hit(ctx, c, t.player, 1));
    },
  },
  "HEA-C-03": {
    text: "Target city loses 2 Flock, or 4 if another Health Calamity is in the discard pile.",
    targets: [targetPlayer, calamityCity],
    resolve: (ctx, t) => hit(ctx, t.city, t.player, inDiscard(ctx, "Calamity", "Health/Fertility") > 0 ? 4 : 2),
  },
  "HEA-C-04": playFromDiscard("Choose a Calamity in the discard pile costing 3 or less and play it for free against the target.", "Calamity", 3),
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
  "HEA-F-02": ruling("needs a ruling on whose Flock counts (see rules questions)"),
  "HEA-F-03": playFromDiscard("Choose a Favor card in the discard pile costing 4 or less and play it for free.", "Favor", 4),
  "HEA-F-04": {
    text: "Target city gains 2 Flock, plus 1 more for each Health Favor in the discard pile (maximum +3).",
    targets: [favorCity],
    resolve: (ctx, t) => gainFlock(ctx, t.city, 2 + Math.min(3, inDiscard(ctx, "Favor", "Health/Fertility"))),
  },
  "HEA-F-05": {
    text: "Counter: cancel a Calamity just played on you, and put it on the bottom of its deck instead of the discard pile.",
    counter: true,
    targets: [],
    resolve: () => {},
  },
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

/**
 * Runs a card's effect. One rule comes first: "a Harvest Calamity on that
 * city destroys the seed instead of its usual effect."
 */
export function resolveEffect(ctx: EffectContext, effect: Playable, answers: Targets) {
  const { card, state } = ctx;
  if (card.deck === "Calamity" && card.domain === "Harvest" && answers.city && answers.player) {
    const city = cityState(state, answers.city);
    const seed = city.seeds.find((sd) => sd.owner === answers.player);
    if (seed) {
      city.seeds.splice(city.seeds.indexOf(seed), 1);
      ctx.report(`It destroys ${playerById(state, answers.player).name}'s seed in ${answers.city} instead of its usual effect.`);
      return;
    }
  }
  effect.resolve(ctx, answers);
}

/** Looks up a card's effect. Throws if a card has no entry, which a test guards against. */
export function effectFor(cardId: string): CardEffect {
  const effect = EFFECTS[cardId];
  if (!effect) throw new Error(`No effect is written for card ${cardId}.`);
  return effect;
}
