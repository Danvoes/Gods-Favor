// The map: 3 regions of 3 cities, with each player's Flock on every city.

import type { City, Domain, GameData } from "../data/types";
import { domainClass } from "../components/Faces";
import { conversionThreshold, flockIn, playerById, thresholdFor } from "../game/rules";
import type { GameState, PlayerId } from "../game/types";

const REGIONS = ["A", "B", "C"] as const;

const shortDomain = (d: string) => d.split("/")[0];

const STATUS_HELP = {
  on: "Working",
  idle: "Idle: the city changed hands. Works again after the controller's next Economy Phase, or now for 2 Flock.",
  off: "Switched off: the city went uncontrolled. The controller must pay 2 Flock to turn it on.",
};

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
                <CityCard key={city.name} data={data} city={city} state={state} pickFor={pickFor} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CityCard({ data, city, state, pickFor }: { data: GameData; city: City; state?: GameState; pickFor?: BoardProps["pickFor"] }) {
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
      {cityState && (cityState.structures.length > 0 || cityState.ruin > 0 || cityState.holySite) && (
        <ul className="city-tokens" aria-label={`On ${city.name}`}>
          {cityState.holySite && <li className="token holy">{cityState.holySite}</li>}
          {cityState.structures.map((st, i) => (
            <li key={i} className={`token structure ${st.status}`} title={STATUS_HELP[st.status]}>
              {st.kind}
              {st.status !== "on" && ` (${st.status === "idle" ? "Idle" : "off"})`}
            </li>
          ))}
          {cityState.ruin > 0 && <li className="token ruin">Ruin{cityState.ruin > 1 ? ` ×${cityState.ruin}` : ""}</li>}
        </ul>
      )}

      {state && cityState && (
        <ul className="flock-list">
          {present.length === 0 && <li className="muted">No Flock yet</li>}
          {present.map((p) => {
            const n = flockIn(cityState, p.id);
            const controls = cityState.controller === p.id;
            // The controller sees how safe their hold is; everyone else sees
            // how close they are to converting.
            const target = controls ? city.loseBelow : thresholdFor(data, state, city.name, p.id);
            const label = controls ? `${n} (keep ${target}+)` : `${n}/${target}`;
            const title = controls
              ? `${n} Flock; lost if below ${target} at the start of ${p.name}'s turn`
              : `${n} Flock; converts at ${target}`;
            return (
              <li key={p.id} className={`flock-row ${domainClass(p.domain)}`}>
                <span className="flock-name">{p.name}</span>
                <span className={`flock-bar${controls ? " held" : ""}`} aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (n / (controls ? n || 1 : target)) * 100)}%` }} />
                </span>
                <span className="flock-count" title={title}>
                  {label}
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
