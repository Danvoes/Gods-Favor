// A "hand the device over" screen. Nothing private is shown until the named
// player says they're holding the device.

import { useState, type ReactNode } from "react";
import { domainClass } from "../components/Faces";
import type { PlayerState } from "../game/types";

export function PassDevice({ player, purpose, children }: { player: PlayerState; purpose: string; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  if (shown) return <>{children}</>;
  return (
    <section className={`pass-device ${domainClass(player.domain)}`}>
      <p className="pass-kicker">Pass the device to</p>
      <h2 className="pass-name">{player.name}</h2>
      <p className="pass-purpose">{purpose}</p>
      <p className="pass-hint">Everyone else, look away.</p>
      <button type="button" className="button primary" onClick={() => setShown(true)}>
        I'm {player.name}, show me
      </button>
    </section>
  );
}
