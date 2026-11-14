// The setup screens: secret starting cities, the reveal, and starting hands.

import { useState } from "react";
import type { GameData } from "../data/types";
import { CardFace } from "../components/Faces";
import { RULES, cityInfo, playerById } from "../game/rules";
import type { Action, DrawDeck, GameState, PlayerState } from "../game/types";
import { Board } from "./Board";
import { PassDevice } from "./PassDevice";

interface StepProps {
  data: GameData;
  game: GameState;
  act: (action: Action) => void;
}

export function ChooseStartingCity({ data, player, act }: { data: GameData; player: PlayerState; act: StepProps["act"] }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <PassDevice player={player} purpose="Choose your starting city in secret.">
      <section className="panel">
        <h2>{player.name}, choose your starting city</h2>
        <p className="muted">
          You'll place {RULES.startingFlock} Flock there. Others choose in secret too; everyone is revealed at once,
          and several players may pick the same city. The smallest starting city goes first.
        </p>
        <Board data={data} pickFor={{ playerId: player.id, domain: player.domain, selected, onPick: setSelected }} />
        <div className="form-actions sticky-actions">
          <button
            type="button"
            className="button primary"
            disabled={!selected}
            onClick={() => selected && act({ type: "chooseStartingCity", playerId: player.id, city: selected })}
          >
            {selected ? `Start in ${selected}` : "Pick a city"}
          </button>
        </div>
      </section>
    </PassDevice>
  );
}

export function Reveal({ data, game, onContinue }: { data: GameData; game: GameState; onContinue: () => void }) {
  return (
    <section className="panel">
      <h2>Starting cities revealed</h2>
      <ol className="reveal-list">
        {game.turnOrder.map((id, i) => {
          const p = playerById(game, id);
          const city = cityInfo(data, game.startingCities[id]);
          return (
            <li key={id}>
              <span className="turn-number">{i + 1}</span>
              <strong>{p.name}</strong> starts in <strong>{city.name}</strong>
              <span className="muted"> ({city.size}, population {city.population})</span>
            </li>
          );
        })}
      </ol>
      <p className="muted">Turn order is shown above: the smallest starting city goes first, then play passes clockwise.</p>
      <Board data={data} state={game} />
      <div className="form-actions">
        <button type="button" className="button primary" onClick={onContinue}>
          Draw starting hands
        </button>
      </div>
    </section>
  );
}

export function DrawStartingHand({
  data, game, act, player, onLastCard,
}: StepProps & { player: PlayerState; onLastCard: (playerId: string) => void }) {
  const draw = (deck: DrawDeck) => {
    // Drawing the last card moves the game on to the next player, so tell the
    // play screen to keep showing this hand until its owner hides it.
    if (player.hand.length === RULES.handSize - 1) onLastCard(player.id);
    act({ type: "drawCard", playerId: player.id, deck });
  };
  return (
    <PassDevice player={player} purpose="Draw your starting hand.">
      <section className="panel">
        <h2>{player.name}, draw your starting hand</h2>
        <p className="muted">
          Draw {RULES.handSize} cards, choosing a deck for each one. Calamities are disasters you inflict; Favors are
          miracles you grant.
        </p>
        <DrawButtons game={game} handSize={player.hand.length} onDraw={draw} />
        <HandView data={data} cardIds={player.hand} />
      </section>
    </PassDevice>
  );
}

/** The "Draw a Calamity / Draw a Favor" buttons, with cards left in each deck. */
export function DrawButtons({ game, handSize, onDraw }: { game: GameState; handSize: number; onDraw: (deck: DrawDeck) => void }) {
  return (
    <div className="draw-buttons">
      {(["Calamity", "Favor"] as const).map((deck) => (
        <button key={deck} type="button" className={`button draw-${deck.toLowerCase()}`} onClick={() => onDraw(deck)}>
          Draw a {deck}
          <span className="muted"> ({game.decks[deck].length} left)</span>
        </button>
      ))}
      <span className="draw-count">
        {handSize} of {RULES.handSize}
      </span>
    </div>
  );
}

/** Shows a player's hand, privately, until they hide it. */
export function ReviewHand({ data, player, onDone }: { data: GameData; player: PlayerState; onDone: () => void }) {
  return (
    <section className="panel">
      <h2>{player.name}'s hand</h2>
      <HandView data={data} cardIds={player.hand} />
      <p className="muted">Hide your hand before passing the device on.</p>
      <div className="form-actions">
        <button type="button" className="button primary" onClick={onDone}>
          Done, hide my hand
        </button>
      </div>
    </section>
  );
}

export function HandView({ data, cardIds }: { data: GameData; cardIds: string[] }) {
  if (cardIds.length === 0) return <p className="muted">No cards yet.</p>;
  return (
    <ul className="grid hand">
      {cardIds.map((id) => {
        const card = data.cards.find((c) => c.id === id);
        return card ? (
          <li key={id}>
            <CardFace card={card} />
          </li>
        ) : null;
      })}
    </ul>
  );
}
