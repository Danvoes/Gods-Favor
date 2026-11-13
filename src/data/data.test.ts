// Checks that the real CSV files match the component counts in docs/RULES.md.
// Run with `npm test`. If you edit a CSV and break the deck makeup, these fail
// and tell you what's wrong.

import { describe, expect, it } from "vitest";
import { loadGameData } from "./index";
import { DataError, parseCards, parseCharacters } from "./parse";
import { DOMAINS, POWER_TIERS, type DivineCard } from "./types";

const data = loadGameData();
const divine = data.cards.filter((c): c is DivineCard => c.kind === "divine");

function count<T>(items: T[], key: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

describe("deck makeup matches the rulebook", () => {
  it("has 50 Calamity, 50 Favor and 30 Free Will cards", () => {
    expect(count(data.cards, (c) => c.deck)).toEqual({ Calamity: 50, Favor: 50, "Free Will": 30 });
  });

  it.each(["Calamity", "Favor"] as const)("%s has 9 per domain and 14 neutral", (deck) => {
    const inDeck = divine.filter((c) => c.deck === deck);
    expect(count(inDeck, (c) => c.domain)).toEqual({
      Nature: 9, Harvest: 9, "Production/Technology": 9, "Health/Fertility": 9, Neutral: 14,
    });
  });

  it("each domain's 9 cards split 2 Severe, 3 Medium, 2 Moderate, 2 Light", () => {
    for (const deck of ["Calamity", "Favor"]) {
      for (const domain of DOMAINS) {
        const cards = divine.filter((c) => c.deck === deck && c.domain === domain);
        expect(count(cards, (c) => c.tier), `${deck} / ${domain}`).toEqual({
          Severe: 2, Medium: 3, Moderate: 2, Light: 2,
        });
      }
    }
  });

  it("costs run from 1 (Light) to 6 (Severe) and get cheaper with each tier", () => {
    const range = (tier: string) => {
      const costs = divine.filter((c) => c.tier === tier).map((c) => c.cost);
      return [Math.min(...costs), Math.max(...costs)];
    };
    expect(range("Light")[0]).toBe(1);
    expect(range("Severe")[1]).toBe(6);
    for (let i = 0; i < POWER_TIERS.length - 1; i++) {
      expect(range(POWER_TIERS[i])[0]).toBeGreaterThan(range(POWER_TIERS[i + 1])[1]);
    }
  });

  it("Free Will has 15 Prophet and 15 Hero cards", () => {
    const fw = data.cards.filter((c) => c.kind === "freeWill");
    expect(count(fw, (c) => (c.kind === "freeWill" ? c.character : ""))).toEqual({ Prophet: 15, Hero: 15 });
  });
});

describe("characters match the rulebook", () => {
  it("has 2 Prophets and 2 Heroes per domain", () => {
    for (const domain of DOMAINS) {
      const chars = data.characters.filter((c) => c.domain === domain);
      expect(count(chars, (c) => c.role), domain).toEqual({ Prophet: 2, Hero: 2 });
    }
  });

  it("each domain has one attacker Hero (2/1) and one defender Hero (1/2)", () => {
    for (const domain of DOMAINS) {
      const stats = data.characters
        .filter((c) => c.domain === domain && c.role === "Hero")
        .map((h) => `${h.might}/${h.resolve}`)
        .sort();
      expect(stats, domain).toEqual(["1/2", "2/1"]);
    }
  });
});

describe("cities match the rulebook", () => {
  it("has 9 cities, 3 per region", () => {
    expect(count(data.cities, (c) => c.region)).toEqual({ A: 3, B: 3, C: 3 });
  });

  it("every domain is the need of one large city and one smaller one", () => {
    for (const domain of DOMAINS) {
      const sizes = data.cities.filter((c) => c.need === domain).map((c) => c.size === "Large");
      expect(sizes.sort(), domain).toEqual([false, true]);
    }
    expect(data.cities.filter((c) => c.need === null).map((c) => c.name)).toEqual(["Crossmarch"]);
  });
});

describe("bad data gives a clear error", () => {
  const header = "id,name,deck,domain,tier,cost,effect,flavor\n";

  it("rejects a misspelled domain and names the row", () => {
    expect(() => parseCards(header + "X-1,Test,Calamity,Natur,Light,1,Does a thing.,\n")).toThrow(
      /cards\.csv row 2 \(X-1\): domain is "Natur"/,
    );
  });

  it("rejects a missing cost", () => {
    expect(() => parseCards(header + "X-1,Test,Favor,Nature,Light,,Does a thing.,\n")).toThrow(DataError);
  });

  it("rejects duplicate ids", () => {
    const row = "X-1,Test,Favor,Nature,Light,1,Does a thing.,\n";
    expect(() => parseCards(header + row + row)).toThrow(/used more than once/);
  });

  it("keeps commas inside quoted text", () => {
    const [card] = parseCards(header + 'X-1,Test,Favor,Nature,Light,1,"Gain 1, then 1 more.",\n');
    expect(card.effect).toBe("Gain 1, then 1 more.");
  });

  it("rejects a Prophet with combat stats", () => {
    const h = "id,name,role,domain,might,resolve,tier_1,tier_2,tier_3,flavor\n";
    expect(() => parseCharacters(h + "P-1,Test,Prophet,Nature,1,1,a,b,c,\n")).toThrow(/Prophets should have no/);
  });
});
