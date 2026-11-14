// The screen for a player responding to a Calamity: redirect it, counter it,
// or make the choice it gives them (Barren Years). Shown behind a
// "pass the device" screen, since it can show the responder's hand.

import { useState } from "react";
import type { DivineCard, GameData } from "../data/types";
import { CardFace, domainClass } from "../components/Faces";
import { cardCost } from "../game/costs";
import { effectFor } from "../game/effects";
import { canCounter, counterQuestions, redirectCost } from "../game/respond";
import { playerById } from "../game/rules";
import type { Action, GameState, PendingCalamity, PlayerState } from "../game/types";
import { Board } from "./Board";
import { PaymentPicker, shortfallOf, sumOf } from "./Payment";
import { HandView } from "./SetupSteps";

interface Props {
  data: GameData;
  game: GameState;
  act: (action: Action) => void;
}

export function ResponseView({ data, game, act }: Props) {
  if (game.phase.name !== "turn" || !game.phase.pending) return null;
  const pending = game.phase.pending;
  const responder = playerById(game, pending.responder);
  const card = data.cards.find((c) => c.id === pending.cardId) as DivineCard;
  const caster = playerById(game, pending.caster);
  const target = playerById(game, pending.answers.player);
  const where = pending.answers.city ?? (pending.answers.region ? `region ${pending.answers.region}` : null);

  return (
    <>
    <section className={`panel response-panel ${domainClass(responder.domain)}`}>
      <p className="turn-kicker">Response</p>
      <h2>{responder.name}, a Calamity needs your answer</h2>
      <div className="cast-layout">
        <CardFace card={card} />
        <div className="cast-questions">
          <p className="response-summary">
            <strong>{caster.name}</strong> cast <strong>{card.name}</strong> at <strong>{target.id === responder.id ? "you" : target.name}</strong>
            {where && <> in {where}</>}
            {pending.redirected && " (redirected)"}.
          </p>
          {pending.stage === "redirect" && <Redirect data={data} game={game} act={act} pending={pending} responder={responder} card={card} />}
          {pending.stage === "counter" && <Counter data={data} game={game} act={act} responder={responder} />}
          {pending.stage === "choose" && <Choose data={data} act={act} pending={pending} responder={responder} />}
        </div>
      </div>
    </section>
    <Board data={data} state={game} />
    </>
  );
}

interface StageProps extends Props {
  responder: PlayerState;
}

function Redirect({ game, act, pending, responder, card }: StageProps & { pending: PendingCalamity; card: DivineCard }) {
  const [newTarget, setNewTarget] = useState<string | null>(null);
  const [payFrom, setPayFrom] = useState<Record<string, number>>({});
  const cost = redirectCost(card);
  const shortfall = shortfallOf(responder, cost);
  const ready = newTarget !== null && sumOf(payFrom) === shortfall;
  const choices = game.players.filter((p) => p.id !== pending.answers.player);
  return (
    <>
      <p className="muted">
        It's a {card.domain} Calamity, your domain, so you may pay its cost ({cost} Flock) to choose a new target
        player. The city stays the same. A Calamity can only be redirected once.
      </p>
      <fieldset className="question">
        <legend>Send it at whom instead?</legend>
        <div className="chips">
          {choices.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={newTarget === p.id} onClick={() => setNewTarget(p.id)}>
              {p.id === responder.id ? `${p.name} (you)` : p.name}
            </button>
          ))}
        </div>
      </fieldset>
      {newTarget && <PaymentPicker game={game} player={responder} cost={cost} payFrom={payFrom} setPayFrom={setPayFrom} />}
      <div className="form-actions">
        <button type="button" className="button" onClick={() => act({ type: "respond", playerId: responder.id, response: { kind: "decline" } })}>
          Let it pass
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!ready}
          onClick={() =>
            act({
              type: "respond",
              playerId: responder.id,
              response: { kind: "redirect", newTarget: newTarget!, payFrom: shortfall > 0 ? payFrom : undefined },
            })
          }
        >
          {newTarget ? `Redirect to ${playerById(game, newTarget).name} for ${cost}` : "Choose a new target"}
        </button>
      </div>
    </>
  );
}

function Counter({ data, game, act, responder }: StageProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [payFrom, setPayFrom] = useState<Record<string, number>>({});
  const counters = responder.hand.filter((id) => {
    const e = effectFor(id);
    return "resolve" in e && e.counter;
  });
  const decline = () => act({ type: "respond", playerId: responder.id, response: { kind: "decline" } });

  if (picked) {
    const card = data.cards.find((c) => c.id === picked) as DivineCard;
    const { total: cost, lines } = cardCost(data, game, responder.id, card);
    const questions = counterQuestions(data, game, responder.id, picked, targets);
    const answered = questions.every((q) => q.options.some((o) => o.value === targets[q.key]));
    const shortfall = shortfallOf(responder, cost);
    return (
      <>
        <p className="muted">{card.effect}</p>
        {questions.map((q) => (
          <fieldset key={q.key} className="question">
            <legend>{q.question}</legend>
            <div className="chips">
              {q.options.map((o) => (
                <button key={o.value} type="button" className="chip" aria-pressed={targets[q.key] === o.value} onClick={() => setTargets({ ...targets, [q.key]: o.value })}>
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <PaymentPicker game={game} player={responder} cost={cost} lines={lines} payFrom={payFrom} setPayFrom={setPayFrom} />
        <div className="form-actions">
          <button type="button" className="button" onClick={() => setPicked(null)}>
            Back
          </button>
          <button
            type="button"
            className="button primary"
            disabled={!answered || sumOf(payFrom) !== shortfall}
            onClick={() =>
              act({
                type: "respond",
                playerId: responder.id,
                response: { kind: "counter", cardId: picked, targets, payFrom: shortfall > 0 ? payFrom : undefined },
              })
            }
          >
            Play {card.name}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="muted">It's aimed at you. You can counter it with Shelter of the Wild or Cure if you hold one, or let it happen.</p>
      {counters.length === 0 ? (
        <p className="muted small">You have no counters in hand.</p>
      ) : (
        <ul className="placement-list">
          {counters.map((id) => {
            const card = data.cards.find((c) => c.id === id)!;
            const check = canCounter(data, game, responder.id, id);
            return (
              <li key={id} className="placement-row">
                <span className="placement-city">
                  <strong>{card.name}</strong>
                  {!check.ok && <span className="muted small">{check.reason}</span>}
                </span>
                <button type="button" className="button" disabled={!check.ok} onClick={() => setPicked(id)}>
                  Counter with {card.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="form-actions">
        <button type="button" className="button primary" onClick={decline}>
          Let it happen
        </button>
      </div>
    </>
  );
}

function Choose({ data, act, pending, responder }: Omit<StageProps, "game"> & { pending: PendingCalamity }) {
  const effect = effectFor(pending.cardId);
  const choice = "resolve" in effect ? effect.targetChooses! : { count: 0, question: "", key: "" };
  const need = Math.min(choice.count, responder.hand.length);
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < need ? [...p, id] : p));
  return (
    <>
      <p className="muted">
        {choice.question} ({picked.length} of {need} chosen).
      </p>
      <ul className="grid hand">
        {responder.hand.map((id) => (
          <li key={id} className="hand-card">
            <HandView data={data} cardIds={[id]} />
            <button type="button" className="chip" aria-pressed={picked.includes(id)} onClick={() => toggle(id)}>
              {picked.includes(id) ? "Discarding" : "Discard this"}
            </button>
          </li>
        ))}
      </ul>
      <div className="form-actions">
        <button
          type="button"
          className="button primary"
          disabled={picked.length !== need}
          onClick={() => act({ type: "respond", playerId: responder.id, response: { kind: "choose", cardIds: picked } })}
        >
          Discard these
        </button>
      </div>
    </>
  );
}
