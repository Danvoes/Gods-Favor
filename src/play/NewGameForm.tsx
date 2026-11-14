import { useState } from "react";
import { DOMAINS, type Domain } from "../data/types";
import { RULES } from "../game/rules";
import type { NewPlayer } from "../game/types";

const SUGGESTED_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];

export function NewGameForm({ onStart, error }: { onStart: (players: NewPlayer[]) => void; error: string | null }) {
  const [players, setPlayers] = useState<NewPlayer[]>([
    { name: SUGGESTED_NAMES[0], domain: DOMAINS[0] },
    { name: SUGGESTED_NAMES[1], domain: DOMAINS[1] },
  ]);

  const update = (i: number, change: Partial<NewPlayer>) =>
    setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...change } : p)));

  const addPlayer = () =>
    setPlayers((ps) => {
      const free = DOMAINS.find((d) => !ps.some((p) => p.domain === d)) ?? DOMAINS[0];
      return [...ps, { name: SUGGESTED_NAMES[ps.length], domain: free }];
    });

  const takenBy = (domain: Domain, except: number) =>
    !RULES.allowSharedDomains && players.some((p, j) => j !== except && p.domain === domain);

  return (
    <form
      className="panel new-game"
      onSubmit={(e) => {
        e.preventDefault();
        onStart(players);
      }}
    >
      <h2>New game</h2>
      <p className="muted">
        Enter players in seating order, going clockwise around the table. Turn order follows this seating once the
        first player is known.
      </p>
      <ol className="player-rows">
        {players.map((p, i) => (
          <li key={i} className="player-row">
            <label>
              <span className="sr-only">Player {i + 1} name</span>
              <input value={p.name} onChange={(e) => update(i, { name: e.target.value })} maxLength={20} />
            </label>
            <label>
              <span className="sr-only">Player {i + 1} domain</span>
              <select value={p.domain} onChange={(e) => update(i, { domain: e.target.value as Domain })}>
                {DOMAINS.map((d) => (
                  <option key={d} value={d} disabled={takenBy(d, i)}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            {players.length > RULES.minPlayers && (
              <button
                type="button"
                className="link-button"
                onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))}
                aria-label={`Remove ${p.name}`}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ol>
      {players.length < RULES.maxPlayers && (
        <button type="button" className="button" onClick={addPlayer}>
          Add player
        </button>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="button primary">
          Start game
        </button>
      </div>
    </form>
  );
}
