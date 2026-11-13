import { CardBrowser } from "./browser/CardBrowser";
import { loadGameData } from "./data";
import { DataError } from "./data/parse";
import type { GameData } from "./data/types";

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

export function App() {
  return (
    <main className="app">
      <header className="app-header">
        <h1>Gods' Favor</h1>
        <p className="subtitle">Card browser</p>
      </header>
      {loadError ? (
        <div className="load-error" role="alert">
          <h2>The game data has a problem</h2>
          <p>{loadError}</p>
          <p>Fix that row in the CSV file and save. The page reloads on its own.</p>
        </div>
      ) : (
        <CardBrowser data={data!} />
      )}
    </main>
  );
}
