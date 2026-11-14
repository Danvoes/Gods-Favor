// The "Play" tab. It holds the game state and decides which screen to show.
//
// The game state only changes through `act`, which asks the rules engine to
// apply an action. If the engine refuses (a RuleError), the reason is shown
// and nothing changes.

import { useState } from "react";
import type { GameData } from "../data/types";
import { RuleError, playerById, waitingFor } from "../game/rules";
import { applyAction, createGame } from "../game/engine";
import type { Action, GameState, NewPlayer, PlayerId } from "../game/types";
import { NewGameForm } from "./NewGameForm";
import { PassDevice } from "./PassDevice";
import { ChooseStartingCity, DrawStartingHand, Reveal, ReviewHand } from "./SetupSteps";
import { GameOver, TurnView } from "./TurnView";

export function PlayScreen({ data }: { data: GameData }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Screen-only memory (not part of the rules): has the reveal been seen,
  // and whose hand is still on show after they finished drawing.
  const [revealSeen, setRevealSeen] = useState(false);
  const [reviewing, setReviewing] = useState<PlayerId | null>(null);

  const attempt = (fn: () => GameState) => {
    try {
      setGame(fn());
      setError(null);
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      setError(e.message);
    }
  };
  const act = (action: Action) => game && attempt(() => applyAction(data, game, action));

  if (!game) {
    return <NewGameForm error={error} onStart={(players: NewPlayer[]) => attempt(() => createGame(data, players))} />;
  }

  const newGame = () => {
    if (!window.confirm("Abandon this game and start a new one?")) return;
    setGame(null);
    setRevealSeen(false);
    setReviewing(null);
    setError(null);
  };

  return (
    <div className="play">
      {error && <p className="form-error" role="alert">{error}</p>}
      {screenFor()}
      <div className="play-footer">
        <button type="button" className="link-button" onClick={newGame}>
          Start a new game
        </button>
      </div>
    </div>
  );

  function screenFor() {
    const g = game!;
    if (reviewing) {
      return <ReviewHand data={data} player={playerById(g, reviewing)} onDone={() => setReviewing(null)} />;
    }
    const nextId = waitingFor(g);
    switch (g.phase.name) {
      case "chooseStartingCities":
        // `key` gives each player a fresh screen, so one player's selection
        // never carries over to the next.
        return <ChooseStartingCity key={nextId} data={data} player={playerById(g, nextId!)} act={act} />;
      case "drawStartingHands":
        if (!revealSeen) return <Reveal data={data} game={g} onContinue={() => setRevealSeen(true)} />;
        return (
          <DrawStartingHand
            key={nextId}
            data={data}
            game={g}
            act={act}
            player={playerById(g, nextId!)}
            onLastCard={setReviewing}
          />
        );
      case "turn":
        // A new pass-the-device screen at the start of every turn, because
        // the turn shows that player's hand.
        return (
          <PassDevice key={`${g.phase.round}-${g.phase.player}`} player={playerById(g, g.phase.player)} purpose="It's your turn.">
            <TurnView data={data} game={g} act={act} />
          </PassDevice>
        );
      case "gameOver":
        return <GameOver data={data} game={g} />;
    }
  }
}
