import { useMemo, useState } from "react";
import type { GameData } from "../data/types";
import {
  DECK_OPTIONS,
  DOMAIN_OPTIONS,
  NO_FILTERS,
  TIER_OPTIONS,
  allItems,
  applyFilters,
  optionCounts,
  type Filters,
} from "./filter";
import { CardFace, CharacterFace } from "./Faces";

/** Shorter labels so the filter buttons fit on a phone screen. */
const SHORT_LABELS: Record<string, string> = {
  "Production/Technology": "Production",
  "Health/Fertility": "Health",
  Prophet: "Prophets",
  Hero: "Heroes",
};

interface FilterRowProps<K extends keyof Filters> {
  label: string;
  filterKey: K;
  options: readonly NonNullable<Filters[K]>[];
  filters: Filters;
  counts: Map<NonNullable<Filters[K]> | null, number>;
  onChange: (value: Filters[K]) => void;
}

function FilterRow<K extends keyof Filters>({
  label, options, filters, filterKey, counts, onChange,
}: FilterRowProps<K>) {
  const selected = filters[filterKey];
  const choices: (NonNullable<Filters[K]> | null)[] = [null, ...options];
  return (
    <div className="filter-row" role="group" aria-label={label}>
      <span className="filter-label">{label}</span>
      <div className="chips">
        {choices.map((option) => {
          const n = counts.get(option) ?? 0;
          return (
            <button
              key={option ?? "all"}
              type="button"
              className="chip"
              aria-pressed={selected === option}
              disabled={n === 0 && selected !== option}
              title={option ?? "All"}
              onClick={() => onChange(option as Filters[K])}
            >
              {option === null ? "All" : (SHORT_LABELS[option] ?? option)}
              <span className="chip-count">{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CardBrowser({ data }: { data: GameData }) {
  const items = useMemo(() => allItems(data), [data]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const shown = applyFilters(items, filters);
  const set = <K extends keyof Filters>(key: K) => (value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const anyFilter = filters.deck || filters.domain || filters.tier;

  return (
    <>
      <section className="filters" aria-label="Filters">
        <FilterRow label="Deck" filterKey="deck" options={DECK_OPTIONS} filters={filters}
          counts={optionCounts(items, filters, "deck", DECK_OPTIONS)} onChange={set("deck")} />
        <FilterRow label="Domain" filterKey="domain" options={DOMAIN_OPTIONS} filters={filters}
          counts={optionCounts(items, filters, "domain", DOMAIN_OPTIONS)} onChange={set("domain")} />
        <FilterRow label="Tier" filterKey="tier" options={TIER_OPTIONS} filters={filters}
          counts={optionCounts(items, filters, "tier", TIER_OPTIONS)} onChange={set("tier")} />
        <div className="result-line">
          <span>
            Showing <strong>{shown.length}</strong> of {items.length}
          </span>
          {anyFilter && (
            <button type="button" className="link-button" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
      </section>

      {shown.length === 0 ? (
        <p className="empty">Nothing matches these filters. Free Will cards have no domain, and characters have no single tier.</p>
      ) : (
        <ul className="grid">
          {shown.map((item) => (
            <li key={item.id}>
              {item.type === "card" ? <CardFace card={item.card} /> : <CharacterFace character={item.character} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
