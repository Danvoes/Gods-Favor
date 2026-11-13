# Gods' Favor

A digital, pass-and-play version of the board game Gods' Favor, for 2–4 players on one screen in a web browser.

- Rules: [`docs/RULES.md`](docs/RULES.md)
- Card, character and city data: [`data/`](data)
- Open rules questions: [`docs/RULES-QUESTIONS.md`](docs/RULES-QUESTIONS.md)

## Running it on your computer

You need [Node.js](https://nodejs.org) (version 20 or newer) installed once. Then, in this folder:

```bash
npm install
```

```bash
npm run dev
```

Open the address it prints (usually http://localhost:5173). If you edit a CSV in `data/` while it's running, the page reloads with the new data.

Run the checks:

```bash
npm test
```

## Status

Milestone 1: a card browser showing every card, Prophet and Hero, filterable by deck, domain and tier.
