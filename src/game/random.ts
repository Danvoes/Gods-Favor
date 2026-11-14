// Repeatable randomness.
//
// Instead of the browser's Math.random(), the game uses a small random number
// generator that's driven by a single number stored in the game state. The
// same starting number (the "seed") always produces the same shuffles and
// rolls. That lets tests check exact results and lets a game be replayed.

/** Returns a random number from 0 up to (not including) 1, plus the next state. */
export function nextRandom(state: number): [value: number, nextState: number] {
  // This is a well-known generator called "mulberry32".
  const t = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

/** Anything that carries a random state, like the game state. */
export interface HasRandom {
  rng: number;
}

/** A whole number from 0 to n-1. Advances the random state. */
export function randomInt(holder: HasRandom, n: number): number {
  const [value, next] = nextRandom(holder.rng);
  holder.rng = next;
  return Math.floor(value * n);
}

/** Shuffles a list in place (the "Fisher–Yates" method, a fair shuffle). */
export function shuffle<T>(holder: HasRandom, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(holder, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/** A fresh seed for a new game. */
export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
