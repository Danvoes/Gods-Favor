// The shapes of the game's data. Every card, character and city loaded from
// the CSV files is checked against these, so a typo in a CSV shows up as an
// error instead of a silently broken card.

export const DOMAINS = [
  "Nature",
  "Harvest",
  "Production/Technology",
  "Health/Fertility",
] as const;
export type Domain = (typeof DOMAINS)[number];

/** Calamity and Favor cards belong to a domain or are Neutral. */
export type CardDomain = Domain | "Neutral";

export const DECKS = ["Calamity", "Favor", "Free Will"] as const;
export type Deck = (typeof DECKS)[number];

/** Power tiers for Calamity and Favor cards, strongest first. */
export const POWER_TIERS = ["Severe", "Medium", "Moderate", "Light"] as const;
export type PowerTier = (typeof POWER_TIERS)[number];

/** Free Will cards use the tier column for their outcome type instead. */
export const FREE_WILL_TYPES = ["Loss", "Roll", "Gain"] as const;
export type FreeWillType = (typeof FREE_WILL_TYPES)[number];

export type CharacterRole = "Prophet" | "Hero";

/** A Calamity or Favor card: a disaster or miracle a god casts. */
export interface DivineCard {
  kind: "divine";
  id: string;
  name: string;
  deck: "Calamity" | "Favor";
  domain: CardDomain;
  tier: PowerTier;
  cost: number;
  effect: string;
  flavor: string;
}

/**
 * A Free Will card: an event caused by a Prophet or Hero.
 * In cards.csv the "domain" column holds Prophet/Hero and the "tier" column
 * holds Loss/Roll/Gain. They get their own field names here so they can't be
 * mixed up with real domains and tiers.
 */
export interface FreeWillCard {
  kind: "freeWill";
  id: string;
  name: string;
  deck: "Free Will";
  character: CharacterRole;
  type: FreeWillType;
  effect: string;
  flavor: string;
}

export type Card = DivineCard | FreeWillCard;

export interface Character {
  id: string;
  name: string;
  role: CharacterRole;
  domain: Domain;
  /** Heroes only. Prophets don't fight, so these are null for them. */
  might: number | null;
  resolve: number | null;
  /** The powers unlocked at Tier I, II and III, in that order. */
  tiers: [string, string, string];
  flavor: string;
}

export type CitySize = "Small" | "Medium" | "Large";
export type HolySiteLevel = "Shrine" | "Temple" | "Cathedral";

export interface City {
  name: string;
  region: "A" | "B" | "C";
  size: CitySize;
  /** The domain this city needs. Crossmarch needs none. */
  need: Domain | null;
  population: number;
  convertAt: number;
  convertAtMatched: number;
  income: number;
  holySiteCap: HolySiteLevel;
}

export interface GameData {
  cards: Card[];
  characters: Character[];
  cities: City[];
}
