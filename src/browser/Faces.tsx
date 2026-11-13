// How a single card or character looks in the browser.

import type { Card, Character } from "../data/types";

/** A CSS-safe name for each domain, used to pick its colour in styles.css. */
export function domainClass(domain: string): string {
  return "d-" + domain.toLowerCase().split("/")[0];
}

export function CardFace({ card }: { card: Card }) {
  const isDivine = card.kind === "divine";
  const colour = isDivine ? domainClass(card.domain) : "d-freewill";
  return (
    <article className={`face ${colour}`}>
      <header className="face-top">
        <span className="face-deck">{card.deck}</span>
        {isDivine && (
          <span className="cost" title={`Costs ${card.cost} Flock`} aria-label={`Cost ${card.cost} Flock`}>
            {card.cost}
          </span>
        )}
      </header>
      <h2 className="face-name">{card.name}</h2>
      <p className="face-meta">
        {isDivine ? `${card.domain} · ${card.tier}` : `${card.character} · ${card.type}`}
      </p>
      <p className="face-effect">{card.effect}</p>
      {card.flavor && <p className="face-flavor">{card.flavor}</p>}
      <footer className="face-id">{card.id}</footer>
    </article>
  );
}

const TIER_NAMES = ["Tier I", "Tier II", "Tier III"];
const TIER_UNLOCKS = {
  Prophet: ["On arrival", "2 cities converted", "4 cities converted"],
  Hero: ["On arrival", "2 Renown", "4 Renown"],
};

export function CharacterFace({ character: c }: { character: Character }) {
  return (
    <article className={`face character ${domainClass(c.domain)}`}>
      <header className="face-top">
        <span className="face-deck">{c.role}</span>
        {c.role === "Hero" && (
          <span className="stats">
            <span title="Might">⚔ {c.might}</span>
            <span title="Resolve">🛡 {c.resolve}</span>
          </span>
        )}
      </header>
      <h2 className="face-name">{c.name}</h2>
      <p className="face-meta">{c.domain}</p>
      <ol className="tiers">
        {c.tiers.map((power, i) => (
          <li key={i}>
            <span className="tier-name">
              {TIER_NAMES[i]} <span className="tier-unlock">· {TIER_UNLOCKS[c.role][i]}</span>
            </span>
            {power}
          </li>
        ))}
      </ol>
      {c.flavor && <p className="face-flavor">{c.flavor}</p>}
      <footer className="face-id">{c.id}</footer>
    </article>
  );
}
