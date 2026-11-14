// Casting a Calamity or Favor as your action.
//
//   1. Check it's your Action step and the card is in your hand and playable.
//   2. Check every answer to the card's questions is one of its allowed choices.
//   3. Pay the cost: "from reserve first. If reserve runs short, the rest comes
//      from your Flock in any cities you choose."
//   4. Resolve the effect, then put the card on its discard pile.
//
// Calamities resolve straight away for now. Counters (Shelter of the Wild,
// Cure) and redirects arrive in milestone 4b.

import type { DivineCard, GameData } from "../data/types";
import { effectFor, isPlayable, type EffectContext, type Option, type Targets } from "./effects";
import { RuleError, cityState, flockIn, playerById } from "./rules";
import { checkTurn } from "./turn";
import type { GameState, PlayerId, PlayerState } from "./types";

function cardById(data: GameData, cardId: string): DivineCard {
  const card = data.cards.find((c) => c.id === cardId);
  if (!card || card.kind !== "divine") throw new RuleError(`"${cardId}" isn't a Calamity or Favor card.`);
  return card;
}

function makeContext(data: GameData, state: GameState, caster: PlayerState, card: DivineCard, lines: string[]): EffectContext {
  return { data, state, caster, card, report: (line) => lines.push(line) };
}

/** All the Flock a player could spend: reserve plus every Flock on the board. */
export function totalFlock(state: GameState, playerId: PlayerId): number {
  return playerById(state, playerId).reserve + state.cities.reduce((sum, c) => sum + flockIn(c, playerId), 0);
}

export type Castability = { ok: true } | { ok: false; reason: string };

/** Whether a card in hand can be cast right now, and if not, why. */
export function canCast(data: GameData, state: GameState, playerId: PlayerId, cardId: string): Castability {
  const card = cardById(data, cardId);
  const effect = effectFor(cardId);
  if (!isPlayable(effect)) {
    return { ok: false, reason: `Coming in ${effect.later === "4b" ? "milestone 4b" : effect.later}: this card ${effect.why}.` };
  }
  if (totalFlock(state, playerId) < card.cost) {
    return { ok: false, reason: `Costs ${card.cost}, but you only have ${totalFlock(state, playerId)} Flock in all.` };
  }
  const first = effect.targets[0];
  if (first) {
    const ctx = makeContext(data, state, playerById(state, playerId), card, []);
    if (first.options(ctx, {}).length === 0) return { ok: false, reason: first.noneReason };
  }
  return { ok: true };
}

export interface Question {
  key: string;
  question: string;
  options: Option[];
  noneReason: string;
}

/**
 * The card's questions, in order, up to and including the first one not yet
 * answered. Each comes with its allowed choices given the earlier answers.
 * The screen uses this to ask one question at a time.
 */
export function castingQuestions(
  data: GameData,
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  chosen: Targets,
): Question[] {
  const effect = effectFor(cardId);
  if (!isPlayable(effect)) return [];
  const ctx = makeContext(data, state, playerById(state, playerId), cardById(data, cardId), []);
  const questions: Question[] = [];
  const soFar: Targets = {};
  for (const spec of effect.targets) {
    const options = spec.options(ctx, soFar);
    questions.push({ key: spec.key, question: spec.question, options, noneReason: spec.noneReason });
    const answer = chosen[spec.key];
    if (answer === undefined || !options.some((o) => o.value === answer)) break;
    soFar[spec.key] = answer;
  }
  return questions;
}

export function castCard(
  data: GameData,
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  targets: Targets,
  payFrom: Record<string, number> = {},
) {
  // 1. Your action, your card, playable.
  const phase = checkTurn(state, playerId, "action");
  const caster = playerById(state, playerId);
  const card = cardById(data, cardId);
  if (!caster.hand.includes(cardId)) throw new RuleError(`${caster.name} doesn't have ${card.name} in hand.`);
  const castable = canCast(data, state, playerId, cardId);
  if (!castable.ok) throw new RuleError(`${card.name} can't be cast: ${castable.reason}`);
  const effect = effectFor(cardId);
  if (!isPlayable(effect)) throw new RuleError(`${card.name} isn't playable yet.`);

  // 2. Every answer must be one of the allowed choices.
  const lines: string[] = [];
  const ctx = makeContext(data, state, caster, card, lines);
  const answers: Targets = {};
  for (const spec of effect.targets) {
    const options = spec.options(ctx, answers);
    if (options.length === 0) throw new RuleError(`${card.name} can't be cast: ${spec.noneReason}`);
    const answer = targets[spec.key];
    if (!options.some((o) => o.value === answer)) {
      throw new RuleError(`${card.name}: "${spec.question}" needs one of: ${options.map((o) => o.label).join(", ")}.`);
    }
    answers[spec.key] = answer;
  }

  // 3. Pay: reserve first, then the cities the caster chose.
  const paid = payCost(state, caster, card.cost, payFrom);

  // 4. Resolve, then discard.
  caster.hand.splice(caster.hand.indexOf(cardId), 1);
  const aimedAt = answers.player && answers.player !== caster.id ? ` at ${playerById(state, answers.player).name}` : "";
  state.log.push(`${caster.name} casts ${card.name}${aimedAt} (${card.deck}, cost ${card.cost}${paid}).`);
  effect.resolve(ctx, answers);
  for (const line of lines) state.log.push(`  ${line}`);
  state.discards[card.deck].push(cardId);

  phase.step = "end";
}

/** Pays a cost and returns a short description of how it was paid, for the log. */
function payCost(state: GameState, caster: PlayerState, cost: number, payFrom: Record<string, number>): string {
  const fromReserve = Math.min(caster.reserve, cost);
  const shortfall = cost - fromReserve;
  const entries = Object.entries(payFrom).filter(([, n]) => n !== 0);
  const fromCities = entries.reduce((sum, [, n]) => sum + n, 0);

  if (shortfall === 0 && fromCities > 0) {
    throw new RuleError(`${caster.name}'s reserve covers the whole cost, so nothing should come from cities.`);
  }
  if (fromCities !== shortfall) {
    throw new RuleError(
      `${caster.name}'s reserve covers ${fromReserve} of the ${cost}; choose cities to pay the other ${shortfall} (chosen so far: ${fromCities}).`,
    );
  }
  for (const [city, n] of entries) {
    const have = flockIn(cityState(state, city), caster.id);
    if (!Number.isInteger(n) || n < 0 || n > have) {
      throw new RuleError(`${caster.name} can't pay ${n} from ${city}; they have ${have} Flock there.`);
    }
  }

  caster.reserve -= fromReserve;
  for (const [city, n] of entries) {
    const c = cityState(state, city);
    const left = flockIn(c, caster.id) - n;
    if (left > 0) c.flock[caster.id] = left;
    else delete c.flock[caster.id];
  }
  if (shortfall === 0) return "";
  return `, paid ${fromReserve} from reserve and ${entries.map(([c, n]) => `${n} from ${c}`).join(", ")}`;
}
