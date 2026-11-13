# Gods' Favor (digital)

A digital version of the board game Gods' Favor. The owner is the game's designer and is new to coding: **explain choices in plain language** and avoid unexplained jargon.

## The game in brief

Full rules: `docs/RULES.md`. That file and the CSVs in `data/` are the designer's source of truth. Never change rules text or card data to make code easier; ask instead.

- 2–4 players are gods, each with one domain: Nature, Harvest, Production/Technology, Health/Fertility. Domains sit on a wheel: adjacent cost 3, opposite cost 5 (Nature↔Production, Harvest↔Health).
- They compete for **Flock** (followers) across 9 cities in 3 regions (`data/cities.csv`, which lists every threshold; percentages round up). Reaching 51% of a city's population (41% if its need matches your domain, +10 points for rivals of a Temple/Cathedral) makes it convert **at the start of your next turn** if you still meet it (anything that pushes you over during your own turn waits a full round). A controller below 25% loses the city at the start of their turn; losing a city drops its Holy Site one level, once.
- **Win:** control 2 of 3 regions (2 of 3 cities each) at the end of your turn and still hold them at the start of your next turn, after that turn's conversion and loss checks.
- **Turn (6 phases):** Start (lose cities below 25% → convert → win check) → Draw (refill to 5 from Calamity or Favor) → Prophecy (Free Will cards, 1 per controlled city) → Economy (income, place Flock, seeds/ongoing) → Action (one of: cast a card, move Prophet, Hero battle, build/upgrade Holy Site) → End (mark if holding 2 regions, expire markers).
- **Decks** (`data/cards.csv`): Calamity 50, Favor 50 (9 per domain + 14 Neutral each; tiers Cataclysmic 6 / Major 4 / Minor 3 / Slight 1–2), Free Will 30 (15 Prophet + 15 Hero, typed Loss/Roll/Gain). Three discard piles.
- **Characters** (`data/characters.csv`): 2 Prophets + 2 Heroes per domain, each with 3 tiers of powers. You get one of each on your first conversion. Prophets convert; Heroes fight with Might/Resolve dice battles.
- Any card can be held. Costs come from reserve first, then cities of your choice. City Calamities name one target player and hit only their Flock. Favors add your own Flock to cities you control or have Flock in. Only Shelter of the Wild and Cure are counters (playable on any turn). A player whose domain matches a Calamity may pay its cost to redirect it once (+2 for a punishment Calamity). Harmful Free Will results can be cancelled whole by discarding any Favor; otherwise take a strike or punish with a Calamity on yourself.

Open rules questions are tracked in `docs/RULES-QUESTIONS.md`. Don't silently pick an answer for one of those. Ask, or make the choice easy to change and note it there.

## Decisions

- **Pass-and-play in one browser tab**, 2–4 players, no server, no accounts, no network. Saves (later) go in the browser's own storage.
- **TypeScript + React + Vite.** TypeScript catches data and rules mistakes before the game runs; React draws the menus, hands and board; Vite runs the dev server and builds a static site that any host (e.g. GitHub Pages) can serve.
- **PapaParse** reads the CSVs (handles commas and quotes inside card text).
- **CSV files are bundled at build time** with Vite's `?raw` import (`src/data/index.ts`). The CSVs in `data/` stay the single source of truth: edit them, not copies in code.
- **Every row is validated on load** (`src/data/parse.ts`). A bad value shows an error naming the file, row and column instead of a broken card.
- **Rules engine separate from the screen** (from milestone 2 on): game logic in plain TypeScript functions with no React, taking a game state and an action and returning a new state. The UI only displays state and sends actions. This keeps the rules testable and leaves room for online play or AI opponents later.
- **Tests with Vitest.** `src/data/data.test.ts` checks the CSVs against the rulebook's component counts; rules logic gets tests as it's written.

## Data quirk

In `cards.csv`, Free Will rows reuse the `domain` column for **Prophet/Hero** and the `tier` column for **Loss/Roll/Gain**. The code renames these to `character` and `type` on `FreeWillCard` so they're never confused with real domains or tiers.

## Layout

```
data/            cards.csv, characters.csv, cities.csv (designer-owned)
docs/            RULES.md (designer-owned), RULES-QUESTIONS.md
src/data/        types, CSV parsing + validation, data tests
src/browser/     card browser (milestone 1): filter logic + components
src/App.tsx      top-level screen
```

## Commands

- `npm install`: first-time setup
- `npm run dev`: run locally with live reload (http://localhost:5173)
- `npm test`: run all tests
- `npm run build`: type-check and build the static site into `dist/`

Run `npm test` and `npm run build` before committing.

## Milestones

1. ✅ Load all cards, characters and cities from CSV; card browser filterable by deck, domain and tier.
2. Game setup and board: choose players and domains, place starting Flock, show cities and regions.
3. Turn loop and economy: phases, drawing, income, reserve, conversion and victory.
4. Casting cards: costs, targeting, held vs. must-play cards, counters, seeds, ongoing effects, structures.
5. Prophets, Heroes, Free Will and strikes.
6. Combat.
7. Holy Sites, polish, save/resume.
