// Loads the real game data from the CSV files in /data.
//
// The "?raw" suffix tells Vite to bundle each file's text into the game when
// it's built. The game never fetches files while running, so it works offline
// and from any web host. Editing a CSV while `npm run dev` is running reloads
// the page with the new data.

import cardsCsv from "../../data/cards.csv?raw";
import charactersCsv from "../../data/characters.csv?raw";
import citiesCsv from "../../data/cities.csv?raw";
import { parseGameData } from "./parse";

export function loadGameData() {
  return parseGameData({ cards: cardsCsv, characters: charactersCsv, cities: citiesCsv });
}
