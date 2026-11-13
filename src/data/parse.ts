// Turns CSV text into checked game objects.
//
// These functions take plain text and return data, with no files or screens
// involved, so the automated tests can run them directly.

import Papa from "papaparse";
import {
  DOMAINS,
  FREE_WILL_TYPES,
  POWER_TIERS,
  type Card,
  type CardDomain,
  type Character,
  type CharacterRole,
  type City,
  type CitySize,
  type Domain,
  type FreeWillType,
  type GameData,
  type HolySiteLevel,
  type PowerTier,
} from "./types";

/** Raised when a CSV row doesn't match what the game expects. */
export class DataError extends Error {}

type Row = Record<string, string>;

function readCsv(text: string, file: string, columns: string[]): Row[] {
  const result = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
  });
  if (result.errors.length > 0) {
    const e = result.errors[0];
    throw new DataError(`${file}: row ${(e.row ?? 0) + 2}: ${e.message}`);
  }
  const missing = columns.filter((c) => !result.meta.fields?.includes(c));
  if (missing.length > 0) {
    throw new DataError(`${file}: missing column(s): ${missing.join(", ")}`);
  }
  return result.data;
}

/** Builds error messages that point at the exact file, row and column. */
function rowContext(file: string, index: number, row: Row) {
  // +2: one for the header line, one because people count rows from 1.
  const where = `${file} row ${index + 2}${row.id ? ` (${row.id})` : ""}`;
  return {
    oneOf<T extends string>(column: string, allowed: readonly T[]): T {
      const value = row[column];
      if (!allowed.includes(value as T)) {
        throw new DataError(
          `${where}: ${column} is "${value}", expected one of: ${allowed.join(", ")}`,
        );
      }
      return value as T;
    },
    text(column: string): string {
      const value = row[column];
      if (!value) throw new DataError(`${where}: ${column} is empty`);
      return value;
    },
    optionalText(column: string): string {
      return row[column] ?? "";
    },
    number(column: string): number {
      const value = Number(row[column]);
      if (row[column] === "" || !Number.isInteger(value)) {
        throw new DataError(`${where}: ${column} is "${row[column]}", expected a whole number`);
      }
      return value;
    },
    optionalNumber(column: string): number | null {
      return row[column] === "" ? null : this.number(column);
    },
    fail(message: string): never {
      throw new DataError(`${where}: ${message}`);
    },
  };
}

function checkUniqueIds(file: string, ids: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new DataError(`${file}: id "${id}" is used more than once`);
    seen.add(id);
  }
}

export function parseCards(text: string): Card[] {
  const file = "cards.csv";
  const rows = readCsv(text, file, ["id", "name", "deck", "domain", "tier", "cost", "effect", "flavor"]);
  const cards = rows.map((row, i): Card => {
    const r = rowContext(file, i, row);
    const deck = r.oneOf("deck", ["Calamity", "Favor", "Free Will"] as const);
    const base = {
      id: r.text("id"),
      name: r.text("name"),
      effect: r.text("effect"),
      flavor: r.optionalText("flavor"),
    };
    if (deck === "Free Will") {
      if (row.cost !== "") r.fail("Free Will cards should have no cost");
      return {
        ...base,
        kind: "freeWill",
        deck,
        character: r.oneOf<CharacterRole>("domain", ["Prophet", "Hero"]),
        type: r.oneOf<FreeWillType>("tier", FREE_WILL_TYPES),
      };
    }
    return {
      ...base,
      kind: "divine",
      deck,
      domain: r.oneOf<CardDomain>("domain", [...DOMAINS, "Neutral"]),
      tier: r.oneOf<PowerTier>("tier", POWER_TIERS),
      cost: r.number("cost"),
    };
  });
  checkUniqueIds(file, cards.map((c) => c.id));
  return cards;
}

export function parseCharacters(text: string): Character[] {
  const file = "characters.csv";
  const rows = readCsv(text, file, [
    "id", "name", "role", "domain", "might", "resolve", "tier_1", "tier_2", "tier_3", "flavor",
  ]);
  const characters = rows.map((row, i): Character => {
    const r = rowContext(file, i, row);
    const role = r.oneOf<CharacterRole>("role", ["Prophet", "Hero"]);
    const might = r.optionalNumber("might");
    const resolve = r.optionalNumber("resolve");
    if (role === "Hero" && (might === null || resolve === null)) {
      r.fail("Heroes need both might and resolve");
    }
    if (role === "Prophet" && (might !== null || resolve !== null)) {
      r.fail("Prophets should have no might or resolve");
    }
    return {
      id: r.text("id"),
      name: r.text("name"),
      role,
      domain: r.oneOf<Domain>("domain", DOMAINS),
      might,
      resolve,
      tiers: [r.text("tier_1"), r.text("tier_2"), r.text("tier_3")],
      flavor: r.optionalText("flavor"),
    };
  });
  checkUniqueIds(file, characters.map((c) => c.id));
  return characters;
}

export function parseCities(text: string): City[] {
  const file = "cities.csv";
  const rows = readCsv(text, file, [
    "name", "region", "size", "need", "population", "convert_at", "convert_at_matched",
    "convert_at_temple", "convert_at_temple_matched", "lose_below", "income", "holy_site_cap",
  ]);
  const cities = rows.map((row, i): City => {
    const r = rowContext(file, i, row);
    const need = r.oneOf<Domain | "None">("need", [...DOMAINS, "None"]);
    const holySiteCap = r.oneOf<HolySiteLevel>("holy_site_cap", ["Shrine", "Temple", "Cathedral"]);
    const convertAtTemple = r.optionalNumber("convert_at_temple");
    const convertAtTempleMatched = r.optionalNumber("convert_at_temple_matched");
    // A city that can't have a Temple shouldn't list Temple thresholds, and one that can, must.
    const canHaveTemple = holySiteCap !== "Shrine";
    if (canHaveTemple !== (convertAtTemple !== null) || canHaveTemple !== (convertAtTempleMatched !== null)) {
      r.fail(
        canHaveTemple
          ? "this city can have a Temple, so it needs convert_at_temple and convert_at_temple_matched"
          : "this city's Holy Site cap is Shrine, so the Temple thresholds should be empty",
      );
    }
    return {
      name: r.text("name"),
      region: r.oneOf("region", ["A", "B", "C"] as const),
      size: r.oneOf<CitySize>("size", ["Small", "Medium", "Large"]),
      need: need === "None" ? null : need,
      population: r.number("population"),
      convertAt: r.number("convert_at"),
      convertAtMatched: r.number("convert_at_matched"),
      convertAtTemple,
      convertAtTempleMatched,
      loseBelow: r.number("lose_below"),
      income: r.number("income"),
      holySiteCap,
    };
  });
  checkUniqueIds(file, cities.map((c) => c.name));
  return cities;
}

export function parseGameData(csv: { cards: string; characters: string; cities: string }): GameData {
  return {
    cards: parseCards(csv.cards),
    characters: parseCharacters(csv.characters),
    cities: parseCities(csv.cities),
  };
}
