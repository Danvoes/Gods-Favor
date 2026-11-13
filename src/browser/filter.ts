// The card browser's filtering rules, kept apart from the display code so
// they can be tested without a browser.

import type { Card, Character, GameData } from "../data/types";

/** One thing the browser can show: a card, or a Prophet/Hero character. */
export type BrowserItem =
  | { type: "card"; id: string; card: Card }
  | { type: "character"; id: string; character: Character };

export const DECK_OPTIONS = ["Calamity", "Favor", "Free Will", "Prophet", "Hero"] as const;
export const DOMAIN_OPTIONS = [
  "Nature", "Harvest", "Production/Technology", "Health/Fertility", "Neutral",
] as const;
export const TIER_OPTIONS = ["Severe", "Medium", "Moderate", "Light", "Loss", "Roll", "Gain"] as const;

export type DeckOption = (typeof DECK_OPTIONS)[number];
export type DomainOption = (typeof DOMAIN_OPTIONS)[number];
export type TierOption = (typeof TIER_OPTIONS)[number];

/** null means "All". */
export interface Filters {
  deck: DeckOption | null;
  domain: DomainOption | null;
  tier: TierOption | null;
}

export const NO_FILTERS: Filters = { deck: null, domain: null, tier: null };

export function allItems(data: GameData): BrowserItem[] {
  return [
    ...data.cards.map((card): BrowserItem => ({ type: "card", id: card.id, card })),
    ...data.characters.map((character): BrowserItem => ({ type: "character", id: character.id, character })),
  ];
}

/** Which deck an item belongs to. Prophets and Heroes count as their own decks. */
export function deckOf(item: BrowserItem): DeckOption {
  return item.type === "card" ? item.card.deck : item.character.role;
}

/** Free Will cards have no domain, so they're hidden when a domain is picked. */
export function domainOf(item: BrowserItem): DomainOption | null {
  if (item.type === "character") return item.character.domain;
  return item.card.kind === "divine" ? item.card.domain : null;
}

/**
 * Calamity and Favor cards have a power tier, and Free Will cards have an
 * outcome type (Loss/Roll/Gain). Characters have all three power tiers at
 * once, so they don't match a single tier and are hidden when one is picked.
 */
export function tierOf(item: BrowserItem): TierOption | null {
  if (item.type === "character") return null;
  return item.card.kind === "divine" ? item.card.tier : item.card.type;
}

export function matches(item: BrowserItem, f: Filters): boolean {
  return (
    (f.deck === null || deckOf(item) === f.deck) &&
    (f.domain === null || domainOf(item) === f.domain) &&
    (f.tier === null || tierOf(item) === f.tier)
  );
}

export function applyFilters(items: BrowserItem[], f: Filters): BrowserItem[] {
  return items.filter((item) => matches(item, f));
}

/**
 * How many items each option would show, given the other two filters.
 * The browser shows these numbers on the buttons so you can see what's there
 * before you click.
 */
export function optionCounts<K extends keyof Filters>(
  items: BrowserItem[],
  f: Filters,
  key: K,
  options: readonly NonNullable<Filters[K]>[],
): Map<NonNullable<Filters[K]> | null, number> {
  const counts = new Map<NonNullable<Filters[K]> | null, number>();
  counts.set(null, applyFilters(items, { ...f, [key]: null }).length);
  for (const option of options) {
    counts.set(option, applyFilters(items, { ...f, [key]: option }).length);
  }
  return counts;
}
