// The Action step: pick a card from your hand, answer its questions, pay, cast.
// Or skip the action and end the turn.

import { useState } from "react";
import type { DivineCard, GameData } from "../data/types";
import { CardFace } from "../components/Faces";
import { canCast, castingQuestions } from "../game/cast";
import { cardCost } from "../game/costs";
import { playerById } from "../game/rules";
import type { Action, GameState, PlayerState } from "../game/types";
import { PaymentPicker, shortfallOf, sumOf } from "./Payment";

interface Props {
  data: GameData;
  game: GameState;
  player: PlayerState;
  act: (action: Action) => void;
}

export function ActionStep({ data, game, player, act }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  if (picked) {
    return <CastPanel data={data} game={game} player={player} cardId={picked} act={act} onCancel={() => setPicked(null)} />;
  }
  return (
    <div className="step">
      <h3>Action</h3>
      <p className="muted">
        Cast one card from your hand, or end your turn without acting. (Moving your Prophet, battles and Holy Sites
        arrive in later milestones.)
      </p>
      <ul className="grid hand">
        {player.hand.map((id) => {
          const card = data.cards.find((c) => c.id === id)!;
          const castable = canCast(data, game, player.id, id);
          return (
            <li key={id} className="hand-card">
              <CardFace card={card} />
              {castable.ok ? (
                <button type="button" className="button primary cast-button" onClick={() => setPicked(id)}>
                  Cast {card.name}
                  {card.kind === "divine" && cardCost(data, game, player.id, card).total !== card.cost
                    ? ` (now costs ${cardCost(data, game, player.id, card).total})`
                    : ""}
                </button>
              ) : (
                <p className="not-castable">{castable.reason}</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="form-actions">
        <button type="button" className="button" onClick={() => act({ type: "endTurn", playerId: player.id })}>
          End turn without acting
        </button>
      </div>
    </div>
  );
}

function CastPanel({ data, game, player, cardId, act, onCancel }: Props & { cardId: string; onCancel: () => void }) {
  const card = data.cards.find((c) => c.id === cardId) as DivineCard;
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [payFrom, setPayFrom] = useState<Record<string, number>>({});

  const questions = castingQuestions(data, game, player.id, cardId, targets);
  // The list stops at the first unanswered question, so if every listed
  // question has a valid answer, the card is fully answered.
  const allAnswered = questions.every((q) => q.options.some((o) => o.value === targets[q.key]));

  // Answering a question clears every answer after it, since later choices depend on earlier ones.
  const answer = (index: number, key: string, value: string) => {
    const kept: Record<string, string> = {};
    questions.slice(0, index).forEach((q) => (kept[q.key] = targets[q.key]));
    setTargets({ ...kept, [key]: value });
  };

  const { total: cost, lines: costLines } = cardCost(data, game, player.id, card, targets);
  const shortfall = shortfallOf(player, cost);
  const ready = allAnswered && sumOf(payFrom) === shortfall;
  const targetName = targets.player ? playerById(game, targets.player).name : null;

  return (
    <div className="step cast-panel">
      <h3>Cast {card.name}</h3>
      <div className="cast-layout">
        <CardFace card={card} />
        <div className="cast-questions">
          {questions.map((q, i) => (
            <fieldset key={q.key} className="question">
              <legend>{q.question}</legend>
              {q.options.length === 0 ? (
                <p className="not-castable">{q.noneReason}</p>
              ) : (
                <div className="chips">
                  {q.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className="chip"
                      aria-pressed={targets[q.key] === o.value}
                      onClick={() => answer(i, q.key, o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          ))}

          <PaymentPicker game={game} player={player} cost={cost} lines={costLines} payFrom={payFrom} setPayFrom={setPayFrom} />

          <div className="form-actions">
            <button type="button" className="button" onClick={onCancel}>
              Choose a different card
            </button>
            <button
              type="button"
              className="button primary"
              disabled={!ready}
              onClick={() =>
                act({
                  type: "castCard",
                  playerId: player.id,
                  cardId,
                  targets,
                  payFrom: shortfall > 0 ? payFrom : undefined,
                })
              }
            >
              Cast {card.name}
              {targetName && targets.player !== player.id ? ` at ${targetName}` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EndStep({ player, act }: { player: PlayerState; act: (action: Action) => void }) {
  return (
    <div className="step">
      <h3>Action done</h3>
      <p className="muted">
        See what happened above. Ending your turn runs the End phase (checking whether you hold 2 regions) and passes
        play on.
      </p>
      <div className="form-actions">
        <button type="button" className="button primary" onClick={() => act({ type: "endTurn", playerId: player.id })}>
          End turn
        </button>
      </div>
    </div>
  );
}
