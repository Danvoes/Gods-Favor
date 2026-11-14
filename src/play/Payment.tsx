// Choosing how to pay: reserve first, then Flock from cities you pick.

import type { CostLine } from "../game/costs";
import { cityState, flockIn } from "../game/rules";
import type { GameState, PlayerState } from "../game/types";

/** How much of a cost the reserve can't cover. */
export function shortfallOf(player: PlayerState, cost: number): number {
  return cost - Math.min(player.reserve, cost);
}

export function sumOf(payFrom: Record<string, number>): number {
  return Object.values(payFrom).reduce((a, b) => a + b, 0);
}

interface Props {
  game: GameState;
  player: PlayerState;
  cost: number;
  /** The cost broken into lines, shown when it differs from a single printed number. */
  lines?: CostLine[];
  payFrom: Record<string, number>;
  setPayFrom: (p: Record<string, number>) => void;
}

export function PaymentPicker({ game, player, cost, lines, payFrom, setPayFrom }: Props) {
  const fromReserve = Math.min(player.reserve, cost);
  const shortfall = cost - fromReserve;
  const paying = sumOf(payFrom);
  const cities = game.cities.filter((c) => flockIn(c, player.id) > 0).map((c) => c.name);
  const change = (city: string, by: number) => {
    const have = flockIn(cityState(game, city), player.id);
    setPayFrom({ ...payFrom, [city]: Math.min(have, Math.max(0, (payFrom[city] ?? 0) + by)) });
  };

  return (
    <fieldset className="question">
      <legend>Pay {cost} Flock</legend>
      {lines && lines.length > 1 && (
        <p className="muted small cost-lines">
          {lines.map((l, i) => `${i === 0 ? "" : l.amount < 0 ? " − " : " + "}${i === 0 ? `${l.label} ${l.amount}` : `${l.label} ${Math.abs(l.amount)}`}`).join("")}
          {` = ${cost}`}
        </p>
      )}
      {shortfall === 0 ? (
        <p className="muted small">All {cost} from reserve (you have {player.reserve}).</p>
      ) : (
        <>
          <p className="muted small">
            {fromReserve > 0 ? `${fromReserve} from reserve, ` : "Your reserve is empty, so "}
            choose where the other {shortfall} come from ({paying} chosen).
          </p>
          <ul className="placement-list">
            {cities.map((city) => {
              const n = payFrom[city] ?? 0;
              const have = flockIn(cityState(game, city), player.id);
              return (
                <li key={city} className="placement-row">
                  <span className="placement-city">
                    <strong>{city}</strong>
                    <span className="muted small">you have {have}</span>
                  </span>
                  <span className="stepper">
                    <button type="button" className="step-btn" aria-label={`Pay one fewer from ${city}`} disabled={n === 0} onClick={() => change(city, -1)}>
                      −
                    </button>
                    <output className="step-value">{n}</output>
                    <button type="button" className="step-btn" aria-label={`Pay one more from ${city}`} disabled={paying >= shortfall || n >= have} onClick={() => change(city, 1)}>
                      +
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </fieldset>
  );
}
