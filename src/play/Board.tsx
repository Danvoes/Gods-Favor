// The map: 3 regions of 3 cities, with each player's Flock on every city.

import type { City, Domain, GameData } from "../data/types";
import { domainClass } from "../components/Faces";
import { conversionThreshold, flockIn, playerById } from "../game/rules";
import type { GameState, PlayerId } from "../game/types";

const REGIONS = ["A", "B", "C"] as const;

const shortDomain = (d: string) => d.split("/")[0];

interface BoardProps {
  data: GameData;
  /** Omit to show an empty map (used while picking a starting city). */
  state?: GameState;
  /** Makes cities clickable, and shows this player's thresholds. */
  pickFor?: { playerId: PlayerId; domain: Domain; selected: string | null; onPick: (city: string) => void };
}

export function Board({ data, state, pickFor }: BoardProps) {
  return (
    <div className="board">
      {REGIONS.map((region) => (
        <section key={region} className="region" aria-label={`Region ${region}`}>
          <h3 className="region-name">Region {region}</h3>
          <div className="region-cities">
            {data.cities
              .filter((c) => c.region === region)
              .map((city) => (
                <CityCard key={city.name} city={city} state={state} pickFor={pickFor} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CityCard({ city, state, pickFor }: { city: City; state?: GameState; pickFor?: BoardProps["pickFor"] }) {
  const cityState = state?.cities.find((c) => c.name === city.name);
  const present = state && cityState ? state.players.filter((p) => flockIn(cityState, p.id) > 0) : [];
  const controller = state && cityState?.controller ? playerById(state, cityState.controller) : null;
  const needClass = city.need ? domainClass(city.need) : "d-neutral";

  const body = (
    <>
      <header className="city-top">
        <h4 className="city-name">{city.name}</h4>
        <span className={`need-chip ${needClass}`} title={city.need ? `Needs ${city.need}` : "Needs nothing"}>
          {city.need ? shortDomain(city.need) : "No need"}
        </span>
      </header>
      <p className="city-meta">
        {city.size} · pop {city.population} · income {city.income}
      </p>
      <p className="city-meta">
        Converts at <strong>{city.convertAt}</strong>
        {city.need && <> ({city.convertAtMatched} for {shortDomain(city.need)})</>}
      </p>
      <p className="city-control">{controller ? `Controlled by ${controller.name}` : "Uncontrolled"}</p>

      {state && cityState && (
        <ul className="flock-list">
          {present.length === 0 && <li className="muted">No Flock yet</li>}
          {present.map((p) => {
            const n = flockIn(cityState, p.id);
            const target = conversionThreshold(city, p.domain);
            return (
              <li key={p.id} className={`flock-row ${domainClass(p.domain)}`}>
                <span className="flock-name">{p.name}</span>
                <span className="flock-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (n / target) * 100)}%` }} />
                </span>
                <span className="flock-count" title={`${n} Flock; converts at ${target}`}>
                  {n}/{target}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {pickFor && (
        <p className="city-pick-note">
          You'd need <strong>{conversionThreshold(city, pickFor.domain)}</strong> to convert
          {city.need === pickFor.domain && " (your domain!)"}
        </p>
      )}
    </>
  );

  if (pickFor) {
    const selected = pickFor.selected === city.name;
    return (
      <button
        type="button"
        className={`city pickable ${needClass}`}
        aria-pressed={selected}
        onClick={() => pickFor.onPick(city.name)}
      >
        {body}
      </button>
    );
  }
  return <article className={`city ${needClass}`}>{body}</article>;
}
