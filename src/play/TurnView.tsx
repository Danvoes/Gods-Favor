// The screens for a turn in progress, and for the end of the game.

import { useState } from "react";
import type { GameData } from "../data/types";
import { domainClass } from "../components/Faces";
import {
  RULES,
  citiesControlledBy,
  cityState,
  flockIn,
  incomeBreakdown,
  placeableCities,
  playerById,
  regionsControlledBy,
  thresholdFor,
} from "../game/rules";
import type { Action, GameState, PlayerState, TurnStep } from "../game/types";
import { Board } from "./Board";
import { totalFlock } from "../game/costs";
import { ActionStep, EndStep } from "./ActionStep";
import { PaymentPicker, shortfallOf, sumOf } from "./Payment";
import { DrawButtons, HandView } from "./SetupSteps";

type TurnPhase = Extract<GameState["phase"], { name: "turn" }>;

interface TurnProps {
  data: GameData;
  game: GameState;
  act: (action: Action) => void;
}

export function TurnView({ data, game, act }: TurnProps) {
  const phase = game.phase as TurnPhase;
  const player = playerById(game, phase.player);
  return (
    <div className="table">
      <section className={`panel turn-panel ${domainClass(player.domain)}`}>
        <header className="turn-header">
          <p className="turn-kicker">Round {phase.round}</p>
          <h2>{player.name}'s turn</h2>
        </header>
        <PhaseTrack step={phase.step} />
        <ThisTurn lines={game.log.slice(phase.logStart + 1)} />
        {phase.step === "draw" && <DrawStep data={data} player={player} game={game} act={act} />}
        {phase.step === "economy" && <EconomyStep data={data} player={player} game={game} act={act} />}
        {phase.step === "action" && <ActionStep data={data} game={game} player={player} act={act} />}
        {phase.step === "end" && <EndStep player={player} act={act} />}
        {(phase.step === "economy" || phase.step === "action" || phase.step === "end") && (
          <StructuresToRestore game={game} player={player} act={act} />
        )}
      </section>
      <div className="table-layout">
        <Board data={data} state={game} />
        <Sidebar data={data} game={game} />
      </div>
    </div>
  );
}

const PHASES: { name: string; step?: TurnStep; note?: string }[] = [
  { name: "Start" },
  { name: "Draw", step: "draw" },
  { name: "Prophecy", note: "later milestone" },
  { name: "Economy", step: "economy" },
  { name: "Action", step: "action" },
  { name: "End", step: "end" },
];

/** The six phases of a turn, with the current one highlighted. */
function PhaseTrack({ step }: { step: TurnStep }) {
  const currentIndex = PHASES.findIndex((p) => p.step === step);
  return (
    <ol className="phase-track" aria-label="Turn phases">
      {PHASES.map((p, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
        return (
          <li key={p.name} className={`phase ${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="phase-name">{p.name}</span>
            {p.note && <span className="phase-note">{p.note}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function ThisTurn({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="this-turn" aria-label="This turn so far">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

interface StepProps extends TurnProps {
  player: PlayerState;
}

function DrawStep({ data, player, game, act }: StepProps) {
  return (
    <div className="step">
      <h3>Draw</h3>
      <p className="muted">Refill your hand to {RULES.handSize}, choosing a deck for each card.</p>
      <DrawButtons
        game={game}
        handSize={player.hand.length}
        onDraw={(deck) => act({ type: "drawCard", playerId: player.id, deck })}
      />
      <HandView data={data} cardIds={player.hand} />
    </div>
  );
}

function EconomyStep({ data, player, game, act }: StepProps) {
  const income = incomeBreakdown(data, game, player.id);
  const cities = placeableCities(game, player.id);
  const [placements, setPlacements] = useState<Record<string, number>>({});
  const placed = Object.values(placements).reduce((a, b) => a + b, 0);
  const left = player.reserve - placed;
  const change = (city: string, by: number) =>
    setPlacements((p) => ({ ...p, [city]: Math.max(0, (p[city] ?? 0) + by) }));

  return (
    <div className="step">
      <h3>Economy</h3>
      <div className="economy">
        <div>
          <h4 className="small-heading">Income this turn</h4>
          <table className="income-table">
            <tbody>
              {income.map((line) => (
                <tr key={line.label}>
                  <td>{line.label}</td>
                  <td className="num">+{line.amount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Reserve now</td>
                <td className="num">{player.reserve}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div>
          <h4 className="small-heading">Place Flock</h4>
          <p className="muted small">
            Move Flock from reserve to cities you control or already have Flock in. Whatever you don't place stays in
            reserve, where it pays for cards later.
          </p>
          <ul className="placement-list">
            {cities.map((name) => {
              const have = flockIn(cityState(game, name), player.id);
              const adding = placements[name] ?? 0;
              const target = thresholdFor(data, game, name, player.id);
              const controlled = cityState(game, name).controller === player.id;
              const willConvert = !controlled && have + adding >= target;
              return (
                <li key={name} className="placement-row">
                  <span className="placement-city">
                    <strong>{name}</strong>
                    <span className="muted small">
                      {controlled ? "yours" : `${have + adding}/${target} to convert`}
                      {willConvert && " ✓ converts at your next turn"}
                    </span>
                  </span>
                  <span className="stepper">
                    <button type="button" className="step-btn" aria-label={`One fewer to ${name}`} disabled={adding === 0} onClick={() => change(name, -1)}>
                      −
                    </button>
                    <output className="step-value" aria-label={`Placing in ${name}`}>{adding}</output>
                    <button type="button" className="step-btn" aria-label={`One more to ${name}`} disabled={left === 0} onClick={() => change(name, 1)}>
                      +
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="placement-summary">
            Placing <strong>{placed}</strong>, keeping <strong>{left}</strong> in reserve.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="button primary"
              onClick={() => act({ type: "placeFlock", playerId: player.id, placements })}
            >
              {placed === 0 ? "Keep it all in reserve" : "Place Flock"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Idle or switched-off structures in your cities, with a button to pay 2 Flock to turn each on. */
function StructuresToRestore({ game, player, act }: { game: GameState; player: PlayerState; act: TurnProps["act"] }) {
  const [paying, setPaying] = useState<{ city: string; index: number } | null>(null);
  const [payFrom, setPayFrom] = useState<Record<string, number>>({});
  const list = game.cities
    .filter((c) => c.controller === player.id)
    .flatMap((c) => c.structures.map((st, index) => ({ city: c.name, index, st })).filter((x) => x.st.status !== "on"));
  if (list.length === 0) return null;
  const cost = RULES.restoreStructureCost;
  const canAfford = totalFlock(game, player.id) >= cost;
  const restore = (city: string, index: number, from?: Record<string, number>) => {
    act({ type: "restoreStructure", playerId: player.id, city, index, payFrom: from });
    setPaying(null);
    setPayFrom({});
  };
  return (
    <div className="step restore">
      <h4 className="small-heading">Structures not working</h4>
      <ul className="placement-list">
        {list.map(({ city, index, st }) => (
          <li key={`${city}-${index}`} className="placement-row">
            <span className="placement-city">
              <strong>
                {st.kind} in {city}
              </strong>
              <span className="muted small">
                {st.status === "idle" ? "Idle: works again after your next Economy Phase" : "Switched off: only paying turns it on"}
              </span>
            </span>
            <button
              type="button"
              className="button"
              disabled={!canAfford}
              onClick={() => (shortfallOf(player, cost) === 0 ? restore(city, index) : setPaying({ city, index }))}
            >
              Turn on for {cost} Flock
            </button>
          </li>
        ))}
      </ul>
      {paying && (
        <>
          <PaymentPicker game={game} player={player} cost={cost} payFrom={payFrom} setPayFrom={setPayFrom} />
          <div className="form-actions">
            <button type="button" className="button" onClick={() => setPaying(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="button primary"
              disabled={sumOf(payFrom) !== shortfallOf(player, cost)}
              onClick={() => restore(paying.city, paying.index, payFrom)}
            >
              Pay and turn on
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Players in turn order, with their reserve, cards and how close they are to winning. */
export function Sidebar({ data, game }: { data: GameData; game: GameState }) {
  const current = game.phase.name === "turn" ? game.phase.player : null;
  return (
    <aside className="sidebar">
      <section className="panel">
        <h3>Players</h3>
        <ol className="player-list">
          {game.turnOrder.map((id) => {
            const p = playerById(game, id);
            const cities = citiesControlledBy(game, id).length;
            const regions = regionsControlledBy(data, game, id);
            return (
              <li key={id} className={`player-chip ${domainClass(p.domain)}`} aria-current={id === current ? "true" : undefined}>
                <span className="player-swatch" aria-hidden="true" />
                <span className="player-text">
                  <strong>
                    {p.name}
                    {id === current && <span className="badge">playing</span>}
                    {p.holdingRegions && <span className="badge warn">holds 2 regions</span>}
                  </strong>
                  <span className="muted">
                    {p.domain} · reserve {p.reserve} · {p.hand.length} cards
                  </span>
                  <span className="muted">
                    {cities} {cities === 1 ? "city" : "cities"}
                    {regions.length > 0 && ` · region${regions.length > 1 ? "s" : ""} ${regions.join(", ")}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="panel">
        <h3>What happened</h3>
        <ol className="log" ref={(el) => {
            // Keep the newest entry in view.
            if (el) el.scrollTop = el.scrollHeight;
          }}>
          {game.log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

export function GameOver({ data, game }: { data: GameData; game: GameState }) {
  if (game.phase.name !== "gameOver") return null;
  const winner = playerById(game, game.phase.winner);
  return (
    <div className="table">
      <section className={`panel winner-banner ${domainClass(winner.domain)}`}>
        <p className="turn-kicker">Game over</p>
        <h2>{winner.name} wins!</h2>
        <p className="muted">
          {winner.name} held regions {regionsControlledBy(data, game, winner.id).join(" and ")} for a full round.
        </p>
      </section>
      <div className="table-layout">
        <Board data={data} state={game} />
        <Sidebar data={data} game={game} />
      </div>
    </div>
  );
}
