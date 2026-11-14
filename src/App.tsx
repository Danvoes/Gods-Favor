import { useState } from "react";
import { CardBrowser } from "./browser/CardBrowser";
import { loadGameData } from "./data";
import { DataError } from "./data/parse";
import type { GameData } from "./data/types";
import { PlayScreen } from "./play/PlayScreen";

// Load once when the page opens. If a CSV has a mistake, show the error
// message on screen instead of a blank page.
let data: GameData | null = null;
let loadError: string | null = null;
try {
  data = loadGameData();
} catch (e) {
  if (!(e instanceof DataError)) throw e;
  loadError = e.message;
}

type Tab = "play" | "cards";

export function App() {
  const [tab, setTab] = useState<Tab>("play");
  return (
    <main className="app">
      <header className="app-header">
        <h1>Gods' Favor</h1>
        <nav className="tabs" aria-label="Sections">
          <button type="button" className="tab" aria-pressed={tab === "play"} onClick={() => setTab("play")}>
            Play
          </button>
          <button type="button" className="tab" aria-pressed={tab === "cards"} onClick={() => setTab("cards")}>
            Card browser
          </button>
        </nav>
      </header>
      {loadError ? (
        <div className="load-error" role="alert">
          <h2>The game data has a problem</h2>
          <p>{loadError}</p>
          <p>Fix that row in the CSV file and save. The page reloads on its own.</p>
        </div>
      ) : (
        // Both tabs stay mounted, so switching to the card browser mid-game
        // doesn't lose the game in progress.
        <>
          <div hidden={tab !== "play"}>
            <PlayScreen data={data!} />
          </div>
          <div hidden={tab !== "cards"}>
            <CardBrowser data={data!} />
          </div>
        </>
      )}
    </main>
  );
}
