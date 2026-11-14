// Responding to a Calamity, between it being cast and it resolving.
//
//   1. Redirect: "Whenever anyone plays a Calamity of your domain, at anyone,
//      you may pay its cost to choose a new target player for it. Each
//      Calamity can be redirected only once."
//   2. Counter: Shelter of the Wild or Cure, "right after a Calamity is
//      announced (and after any redirect), before it resolves." Only the
//      target can counter, and the target is always asked, even with no
//      counter in hand, so being asked never gives anything away.
//   3. The target's own choice, if the card gives them one (Barren Years).
//   4. Resolve, and hand the device back to the caster.
//
// Only players who could respond are asked (the designer's choice), apart
// from the target, who is always asked.

import type { DivineCard, GameData } from "../data/types";
import { cardById, checkAnswers, deadEnd, makeContext, walkQuestions, withoutDeadEnds, type Castability, type Question } from "./cast";
import { cardCost, payCost, totalFlock } from "./costs";
import { effectFor, isPlayable, resolveEffect, type Playable, type Targets } from "./effects";
import { RuleError, playerById } from "./rules";
import { currentTurn } from "./turn";
import type { GameState, PendingCalamity, PlayerId, Response } from "./types";

type Turn = ReturnType<typeof currentTurn>;

/** Who should be holding the device right now. */
const holder = (phase: Turn) => phase.pending?.responder ?? phase.player;

/** Moves the game on to wait for `next` (or the active player), counting a hand-off if the device changes hands. */
function waitFor(phase: Turn, pending: PendingCalamity | undefined) {
  const before = holder(phase);
  phase.pending = pending;
  phase.step = pending ? "respond" : "end";
  if (holder(phase) !== before) phase.handoffs += 1;
}

/** The player who may redirect this Calamity, if anyone: matching domain, not the caster, can afford it. */
export function redirectorFor(data: GameData, state: GameState, cardId: string, caster: PlayerId): PlayerId | null {
  const card = cardById(data, cardId);
  const cost = redirectCost(card);
  const p = state.players.find((pl) => pl.id !== caster && pl.domain === card.domain);
  return p && totalFlock(state, p.id) >= cost ? p.id : null;
}

/** "Pay its cost": the printed cost (+2 for a punishment Calamity, from milestone 5). */
export function redirectCost(card: DivineCard): number {
  return card.cost;
}

/** Called once a Calamity at a player has been cast and paid for. */
export function openResponses(data: GameData, state: GameState, cardId: string, caster: PlayerId, answers: Targets) {
  const phase = currentTurn(state);
  const redirector = redirectorFor(data, state, cardId, caster);
  const base: PendingCalamity = { cardId, caster, answers, stage: "redirect", responder: caster, redirected: false };
  if (redirector) {
    waitFor(phase, { ...base, responder: redirector });
    return;
  }
  toCounterStage(data, state, base);
}

function toCounterStage(data: GameData, state: GameState, pending: PendingCalamity) {
  const target = pending.answers.player;
  if (target !== pending.caster) {
    waitFor(currentTurn(state), { ...pending, stage: "counter", responder: target });
    return;
  }
  toChooseStage(data, state, pending);
}

function toChooseStage(data: GameData, state: GameState, pending: PendingCalamity) {
  const effect = effectFor(pending.cardId) as Playable;
  const target = playerById(state, pending.answers.player);
  if (effect.targetChooses && target.hand.length > 0) {
    waitFor(currentTurn(state), { ...pending, stage: "choose", responder: target.id });
    return;
  }
  resolvePending(data, state, pending);
}

function resolvePending(data: GameData, state: GameState, pending: PendingCalamity) {
  const card = cardById(data, pending.cardId);
  const lines: string[] = [];
  const ctx = makeContext(data, state, playerById(state, pending.caster), card, lines);
  resolveEffect(ctx, effectFor(pending.cardId) as Playable, pending.answers);
  for (const line of lines) state.log.push(`  ${line}`);
  state.discards.Calamity.push(pending.cardId);
  waitFor(currentTurn(state), undefined);
}

export function respond(data: GameData, state: GameState, playerId: PlayerId, response: Response) {
  const phase = currentTurn(state);
  const pending = phase.pending;
  if (!pending) throw new RuleError("No Calamity is waiting for a response.");
  const responder = playerById(state, playerId);
  if (pending.responder !== playerId) {
    throw new RuleError(`The game is waiting for ${playerById(state, pending.responder).name}, not ${responder.name}.`);
  }
  const card = cardById(data, pending.cardId);
  const targetName = playerById(state, pending.answers.player).name;

  if (pending.stage === "redirect") {
    if (response.kind === "decline") {
      state.log.push(`${responder.name} doesn't redirect it.`);
      toCounterStage(data, state, pending);
      return;
    }
    if (response.kind !== "redirect") throw new RuleError(`${responder.name} can only redirect ${card.name} or let it pass.`);
    if (!state.players.some((p) => p.id === response.newTarget) || response.newTarget === pending.answers.player) {
      throw new RuleError(`Choose a new target for ${card.name}, other than ${targetName}.`);
    }
    const cost = redirectCost(card);
    const paid = payCost(state, responder, cost, response.payFrom);
    const answers = { ...pending.answers, player: response.newTarget };
    state.log.push(
      `${responder.name} pays ${cost}${paid} to redirect ${card.name} from ${targetName} to ${playerById(state, response.newTarget).name}.`,
    );
    toCounterStage(data, state, { ...pending, answers, redirected: true });
    return;
  }

  if (pending.stage === "counter") {
    if (response.kind === "decline") {
      state.log.push(`${responder.name} lets it happen.`);
      toChooseStage(data, state, pending);
      return;
    }
    if (response.kind !== "counter") throw new RuleError(`${responder.name} can only counter ${card.name} or let it happen.`);
    playCounter(data, state, pending, responder.id, response.cardId, response.targets, response.payFrom);
    return;
  }

  // "choose": the target picks, e.g. Barren Years' 2 discards.
  if (response.kind !== "choose") throw new RuleError(`${responder.name} needs to make ${card.name}'s choice.`);
  const effect = effectFor(pending.cardId) as Playable;
  const choice = effect.targetChooses!;
  const need = Math.min(choice.count, responder.hand.length);
  const ids = response.cardIds;
  if (ids.length !== need || new Set(ids).size !== ids.length || ids.some((id) => !responder.hand.includes(id))) {
    throw new RuleError(`${responder.name} needs to choose ${need} different card${need === 1 ? "" : "s"} from their hand.`);
  }
  resolvePending(data, state, { ...pending, answers: { ...pending.answers, [choice.key]: ids.join(",") } });
}

function playCounter(
  data: GameData,
  state: GameState,
  pending: PendingCalamity,
  playerId: PlayerId,
  counterId: string,
  targets: Targets,
  payFrom: Record<string, number> = {},
) {
  const player = playerById(state, playerId);
  const counter = cardById(data, counterId);
  const calamity = cardById(data, pending.cardId);
  if (!player.hand.includes(counterId)) throw new RuleError(`${player.name} doesn't have ${counter.name} in hand.`);
  const check = canCounter(data, state, playerId, counterId);
  if (!check.ok) throw new RuleError(`${counter.name} can't be played: ${check.reason}`);

  const lines: string[] = [];
  const ctx = makeContext(data, state, player, counter, lines);
  const effect = effectFor(counterId) as Playable;
  const answers = checkAnswers(effect, ctx, targets);
  const cost = cardCost(data, state, playerId, counter).total;
  const paid = payCost(state, player, cost, payFrom);
  player.nextCardCost = 0;
  player.hand.splice(player.hand.indexOf(counterId), 1);

  state.log.push(`${player.name} plays ${counter.name} (cost ${cost}${paid}) and cancels ${calamity.name}.`);
  // Cure: "put it on the bottom of its deck instead of the discard pile."
  if (counterId === "HEA-F-05") {
    state.decks.Calamity.unshift(pending.cardId);
    lines.push(`${calamity.name} goes to the bottom of the Calamity deck.`);
  } else {
    state.discards.Calamity.push(pending.cardId);
  }
  effect.resolve(ctx, answers);
  for (const line of lines) state.log.push(`  ${line}`);
  state.discards.Favor.push(counterId);
  waitFor(currentTurn(state), undefined);
}

/** Whether a player can counter the waiting Calamity with this card, and if not, why. */
export function canCounter(data: GameData, state: GameState, playerId: PlayerId, cardId: string): Castability {
  const phase = state.phase;
  if (phase.name !== "turn" || !phase.pending || phase.pending.stage !== "counter") {
    return { ok: false, reason: "There's no Calamity to counter right now." };
  }
  if (phase.pending.responder !== playerId) return { ok: false, reason: "Only the Calamity's target can counter it." };
  const effect = effectFor(cardId);
  if (!isPlayable(effect) || !effect.counter) return { ok: false, reason: "This card isn't a counter." };
  const card = cardById(data, cardId);
  const cost = cardCost(data, state, playerId, card).total;
  if (totalFlock(state, playerId) < cost) return { ok: false, reason: `Costs ${cost}, but you only have ${totalFlock(state, playerId)} Flock in all.` };
  const blocked = deadEnd(effect, makeContext(data, state, playerById(state, playerId), card, []), {});
  return blocked === null ? { ok: true } : { ok: false, reason: blocked };
}

/** A counter's questions (Shelter of the Wild: which neighbor), for the screen. */
export function counterQuestions(data: GameData, state: GameState, playerId: PlayerId, cardId: string, chosen: Targets): Question[] {
  const effect = effectFor(cardId) as Playable;
  const ctx = makeContext(data, state, playerById(state, playerId), cardById(data, cardId), []);
  return withoutDeadEnds(effect, ctx, walkQuestions(effect, ctx, chosen));
}
