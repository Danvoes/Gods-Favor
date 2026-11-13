# Open rules questions

Found while reading `docs/RULES.md` and the CSVs for the digital build. A computer has to do *something* in each case, so each one needs a ruling. Write the ruling under the question (or put it in RULES.md) and the code will follow it.

## Open

### Conversion and control

1. **Conversion in the same turn.** Conversion happens "at the start of your next Economy Phase", which "gives rivals one round to push you back". But if you reach a threshold during your own Prophecy phase (e.g. a Free Will gain), your next Economy Phase starts moments later and rivals get no round. Should a threshold reached during your own turn wait until your *following* turn's Economy Phase?
2. **Holy Sites in uncontrolled cities.** When a controller drops below 25% and the city becomes uncontrolled: is its Holy Site desecrated (does that count as "changing hands")? And while no one controls it, does a Temple still add +10 points, and for whom?
3. **"Cities converted" and "a new city".** Prophet tiers count "every city you have ever converted", and strikes reset "when you convert a new city". If you lose a city and convert it again, does it count a second time, and does it reset strikes?

### Free Will

4. **Losses that aren't Flock.** Steps 2–3 apply "if the result costs you Flock". Some results cost something else: Blood on Their Hands (lose 1 Renown), The Long Fast 1-2 and The King's Summons 1-2 (Prophet can't move), A Challenge Refused (can't fight), Deserters, Wounded. When a result costs Renown or a restriction but no Flock, can you cancel it with a Favor, and must you still take a strike or punish?
5. **Mixed results.** The Merchant's Gold gives 2 reserve and costs 3 Flock. If you cancel the loss with a Favor, do you still get the 2?
6. **Punish + redirect loophole.** Punishing lets you play a Calamity on yourself for free. If it's your own domain, the redirect rule lets you then pay its cost to send it at an opponent. That turns a Free Will loss into an extra, off-turn Calamity attack. Is that allowed? (Also: can another player redirect or Cure a punishment Calamity?)

### Cards

7. **Favor spill-over to new cities.** Favors can target cities you control or have Flock in. When a Favor also adds Flock to "one neighbor" or "every other city in the region" (Great Migration, Gentle Rain, Morning Dew, A Sign in the Sky…), can that neighbor be a city where you have no Flock yet? Same for Animal Guides moving Flock into a neighbor, and The Young Disciple placing 2 "in a neighboring city".
8. **Tailwind.** "Take 1 of an opponent's Flock from a neighboring city": neighboring to what? A city you control, a city where you have Flock, or your Prophet's city?

### Combat and Heroes

9. **Yield with 1 Flock.** Yielding hands over 2 Flock in that city. Can a defender with only 1 Flock there yield?
10. **Where the defending Hero ends up.** If the attacker wins, does the defending Hero stay in the city (now outnumbered) or go somewhere else?
11. **Regaining a Hero tier.** When a Hero drops below a tier and later reaches it again, does the player choose the +1 stat again (possibly a different stat)? And if a stat is already at 3 (e.g. from Armory), is the tier's +1 lost?

## Answered in the 2nd rules update

All 38 questions from the first read-through are settled by the updated RULES.md and CSVs:

- **Contradictions:** only Shelter of the Wild and Cure are counters; conversion happens at the start of your next Economy Phase; taking a strike is always possible; Heroes lose tiers when Renown drops; Free Will has its own discard pile.
- **Setup:** secret simultaneous starting cities, shared starts allowed; smallest starting city goes first, then clockwise; no facilitator.
- **Flock:** placement, reserve-first payment, no cap per city, losing a city below 25%.
- **Holy Sites:** Temple = +10 percentage points (thresholds now in `cities.csv`); upgrade costs are per step; a Shrine is removed when desecrated; Crossmarch costs 5 to reach.
- **Cards:** any card can be held; Calamities name a target player; Favors add your own Flock; self-targeting allowed; redirect rule; seed placement; tier names changed to Cataclysmic/Major/Minor/Slight; Cathedral of Industry renamed Grand Foundry.
- **Free Will:** roll first; a Favor cancels the loss; otherwise strike or punish (free, no strike); losses come from the character's city then reserve; missing character = discard; strikes cleared only by conversion and three named cards.
- **Combat:** a defender without a Hero adds 0; defend with any number up to the attacker's army; armies can mix city and reserve; retreat rules; where Heroes go; domain bonus for either side; Armory is permanent; yield gives 2 Flock and no Renown.
