// Casting a Calamity or Favor as your action.
//
//   1. Check it's your Action step and the card is in your hand and playable.
//   2. Check every answer to the card's questions is one of its allowed choices.
//   3. Pay the cost: "from reserve first. If reserve runs short, the rest comes
//      from your Flock in any cities you choose."
//   4. Resolve the effect, then put the card on its discard pile.

import type { DivineCard, GameData } from "../data/types";
import { cardCost, payCost, totalFlock } from "./costs";
import { effectFor, isPlayable, resolveEffect, specsFor, type EffectContext, type Option, type Playable, type Targets } from "./effects";
import { openResponses } from "./respond";
import { RuleError, playerById } from "./rules";
import { checkTurn } from "./turn";
import type { GameState, PlayerId, PlayerState } from "./types";

export { totalFlock };

export function cardById(data: GameData, cardId: string): DivineCard {
  const card = data.cards.find((c) => c.id === cardId);
  if (!card || card.kind !== "divine") throw new RuleError(`"${cardId}" isn't a Calamity or Favor card.`);
  return card;
}

export function makeContext(
  data: GameData,
  state: GameState,
  caster: PlayerState,
  card: DivineCard,
  lines: string[],
): EffectContext {
  return { data, state, caster, card, report: (line) => lines.push(line) };
}

export type Castability = { ok: true } | { ok: false; reason: string };

/** Whether a card in hand can be cast right now, and if not, why. */
export function canCast(data: GameData, state: GameState, playerId: PlayerId, cardId: string): Castability {
  const card = cardById(data, cardId);
  const effect = effectFor(cardId);
  if (!isPlayable(effect)) {
    if (effect.later === "a rules ruling") return { ok: false, reason: `Waiting for a rules ruling: this card ${effect.why}.` };
    return { ok: false, reason: `Coming in ${effect.later}: this card ${effect.why}.` };
  }
  if (effect.counter) return { ok: false, reason: "A counter: play it when a Calamity is cast at you." };
  const cost = cardCost(data, state, playerId, card).total;
  if (totalFlock(state, playerId) < cost) {
    return { ok: false, reason: `Costs ${cost}, but you only have ${totalFlock(state, playerId)} Flock in all.` };
  }
  const ctx = makeContext(data, state, playerById(state, playerId), card, []);
  const blocked = deadEnd(effect, ctx, {});
  if (blocked !== null) return { ok: false, reason: blocked };
  return { ok: true };
}

/**
 * Tries every combination of answers. Returns null if at least one complete
 * set of answers exists, or the reason the card can't be finished (e.g.
 * Tailwind with no opponent next to any of your cities).
 */
export function deadEnd(effect: Playable, ctx: EffectContext, chosen: Targets): string | null {
  const walk = walkQuestions(effect, ctx, chosen);
  if (walk.complete) return null;
  const q = walk.questions[walk.questions.length - 1];
  if (q.options.length === 0) return q.noneReason;
  let reason = q.noneReason;
  for (const o of q.options) {
    const result = deadEnd(effect, ctx, { ...walk.answers, [q.key]: o.value });
    if (result === null) return null;
    reason = result;
  }
  return reason;
}

export interface Question {
  key: string;
  question: string;
  options: Option[];
  noneReason: string;
}

/**
 * Walks a card's questions in order with the given answers. Optional
 * questions with nothing to choose are skipped. Returns the questions asked
 * (stopping at the first unanswered or wrongly answered one), the valid
 * answers so far, and whether every question is answered.
 */
export function walkQuestions(effect: Playable, ctx: EffectContext, chosen: Targets) {
  const questions: Question[] = [];
  const answers: Targets = {};
  for (let i = 0; ; i++) {
    const spec = specsFor(effect, ctx, answers)[i];
    if (!spec) return { questions, answers, complete: true };
    const options = spec.options(ctx, answers);
    if (options.length === 0 && spec.optional) continue;
    questions.push({ key: spec.key, question: spec.question, options, noneReason: spec.noneReason });
    const answer = chosen[spec.key];
    if (answer === undefined || !options.some((o) => o.value === answer)) return { questions, answers, complete: false };
    answers[spec.key] = answer;
  }
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
  return withoutDeadEnds(effect, ctx, walkQuestions(effect, ctx, chosen));
}

/**
 * Drops choices that can't lead to a finished cast (e.g. Strong Winds aimed at
 * a player with no Flock on the board), so players are only offered choices
 * that work. A question left with no choices keeps its explanation.
 */
export function withoutDeadEnds(effect: Playable, ctx: EffectContext, walk: ReturnType<typeof walkQuestions>): Question[] {
  const before: Targets = {};
  return walk.questions.map((q) => {
    const options = q.options.filter((o) => deadEnd(effect, ctx, { ...before, [q.key]: o.value }) === null);
    if (walk.answers[q.key] !== undefined) before[q.key] = walk.answers[q.key];
    return { ...q, options };
  });
}

/** Checks a full set of answers, throwing a RuleError naming the first problem. */
export function checkAnswers(effect: Playable, ctx: EffectContext, targets: Targets): Targets {
  const walk = walkQuestions(effect, ctx, targets);
  if (!walk.complete) {
    const q = walk.questions[walk.questions.length - 1];
    if (q.options.length === 0) throw new RuleError(`${ctx.card.name} can't be cast: ${q.noneReason}`);
    throw new RuleError(`${ctx.card.name}: "${q.question}" needs one of: ${q.options.map((o) => o.label).join(", ")}.`);
  }
  return walk.answers;
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
  const effect = effectFor(cardId) as Playable;

  // 2. Every answer must be one of the allowed choices.
  const lines: string[] = [];
  const ctx = makeContext(data, state, caster, card, lines);
  const answers = checkAnswers(effect, ctx, targets);

  // 3. Pay: reserve first, then the cities the caster chose. Next-card effects are used up.
  const cost = cardCost(data, state, playerId, card, answers).total;
  const paid = payCost(state, caster, cost, payFrom);
  caster.nextCardCost = 0;

  // 4. A Calamity aimed at a player waits for responses (redirect, counter)
  //    before it resolves. Anything else resolves now, then is discarded.
  caster.hand.splice(caster.hand.indexOf(cardId), 1);
  const aimedAt = answers.player && answers.player !== caster.id ? ` at ${playerById(state, answers.player).name}` : "";
  state.log.push(`${caster.name} casts ${card.name}${aimedAt} (${card.deck}, cost ${cost}${paid}).`);
  if (card.deck === "Calamity" && answers.player) {
    openResponses(data, state, cardId, caster.id, answers);
    return;
  }
  resolveEffect(ctx, effect, answers);
  for (const line of lines) state.log.push(`  ${line}`);
  state.discards[card.deck].push(cardId);
  phase.step = "end";
}
