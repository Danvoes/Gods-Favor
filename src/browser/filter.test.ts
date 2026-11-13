import { describe, expect, it } from "vitest";
import { loadGameData } from "../data";
import { NO_FILTERS, allItems, applyFilters, optionCounts, DECK_OPTIONS } from "./filter";

const items = allItems(loadGameData());

describe("card browser filters", () => {
  it("shows all 130 cards and 16 characters with no filters", () => {
    expect(applyFilters(items, NO_FILTERS)).toHaveLength(146);
  });

  it("filters by deck, including Prophets and Heroes", () => {
    expect(applyFilters(items, { ...NO_FILTERS, deck: "Favor" })).toHaveLength(50);
    expect(applyFilters(items, { ...NO_FILTERS, deck: "Prophet" })).toHaveLength(8);
  });

  it("a domain includes its cards and its characters", () => {
    // 9 Calamity + 9 Favor + 2 Prophets + 2 Heroes
    expect(applyFilters(items, { ...NO_FILTERS, domain: "Harvest" })).toHaveLength(22);
  });

  it("combines all three filters", () => {
    const result = applyFilters(items, { deck: "Calamity", domain: "Nature", tier: "Severe" });
    expect(result.map((i) => i.id)).toEqual(["NAT-C-01", "NAT-C-02"]);
  });

  it("Free Will types work as tiers", () => {
    expect(applyFilters(items, { ...NO_FILTERS, deck: "Free Will", tier: "Roll" })).toHaveLength(12);
  });

  it("counts what each deck button would show under the current filters", () => {
    const counts = optionCounts(items, { ...NO_FILTERS, domain: "Nature" }, "deck", DECK_OPTIONS);
    expect(Object.fromEntries(counts)).toEqual({
      null: 22, Calamity: 9, Favor: 9, "Free Will": 0, Prophet: 2, Hero: 2,
    });
  });
});
