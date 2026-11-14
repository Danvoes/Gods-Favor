# Open rules questions

Found while reading `docs/RULES.md` and the CSVs for the digital build. A computer has to do *something* in each case, so each one needs a ruling. Write the ruling under the question (or put it in RULES.md) and the code will follow it. Where there's an obvious likely answer, it's given as **Proposed**. Confirm it or correct it.

## Open

1. **An exiled Hero.** While a Hero is in exile off the board, is it a "character you no longer have" (its Free Will cards are discarded with no effect, and Scandal can't target it)? Or does it still draw Free Will cards and take strikes, with no city to lose Flock from?
   **Proposed:** treat it as missing until it returns.
2. **Can two players pick the same domain?** Setup says each player "picks a god and its domain" but not whether domains must be different. Each domain has 2 Prophets and 2 Heroes, so two players could share one, but domain-matched cities and redirects would be contested.
   **For now:** the game requires different domains. This is one setting (`allowSharedDomains` in `src/game/rules.ts`), so changing it is quick.
3. **Who makes choices on a card?** Several cards leave a choice open without saying who makes it: Heresy ("loses 2 Flock from one city"), Miasma ("one of their cities loses 2"). Barren Years says "(their choice)", which suggests that otherwise the caster chooses.
   **Proposed, and used for now:** the caster makes every choice on their card unless it says "their choice".
4. **"Its owner" on a city Calamity.** Pilgrims Turn Away and Desertion say "its owner loses 1 from reserve". City Calamities name a target player, but the city might be controlled by someone else, or no one.
   **Proposed, and used for now:** "its owner" means the target player, matching the Durations rule ("for an effect on a city, that is the player the effect was cast on").
5. **Locust Swarm.** "Anything they can't pay comes out of their cities": who picks which cities, the caster or the target? (Not playable until this is settled.)
6. **Fertile Age.** "Target city gains Flock equal to half its current Flock": half of *your* Flock there, or half of *everyone's*? (Not playable until this is settled.)
7. **Casting a card with no valid target.** Can you cast a card that would do nothing, for example Second Life with no cheap Favor in the discard pile, or Golden Age while controlling one city, just to get it out of your hand?
   **For now:** a card needs a valid choice for each question to be cast. A Calamity at a player with no Flock in the chosen city is still allowed (the rulebook says "that part does nothing").

### Structures and costs (milestone 4b). Proposed, and used for now

8. **Where can you build?** "Build:" cards don't say. **Used:** only in a city you control, with a free slot (2 at most).
9. **City Walls.** **Used:** +2 cost only when the walled city is the Calamity's main target. "1 less Flock" applies to every Calamity hit on the city, including spread from a neighbor, but only to Flock in the city (not reserve losses). Two City Walls in one city count twice (+4 cost, 2 less).
10. **"Waits one Economy Phase."** **Used:** Idle structures turn on at the end of the new controller's first Economy Phase after conversion. Conversion happens at Start, so that's the same turn: no income from them that turn, working from the Action on.
11. **Paying 2 to restore a structure** isn't an action. **Used:** allowed any time during your own turn after drawing.
12. **Repair Crews "since your last turn".** **Used:** structures destroyed after your previous turn, including during the current one. A structure rebuilt in an uncontrolled city starts switched off.
13. **Costs and Ruin can't go negative.** **Used:** a card never costs less than 0, and Ruin can't make a city give less than 0 income.

## Answered

### Designer rulings (not yet in RULES.md)

- **Switched-off structures are not "Idle".** Structures in a city that went uncontrolled can only be turned on by the next converter paying 2 Flock each. Ada the Lamplighter (Tier I and Tier III) and Repair Crews don't work on them; they only affect Idle structures from a city that changed hands directly.

### 4th rules update

- "Next turn" and "for N turns" always mean the affected player's own turns.
- When a city goes uncontrolled, its structures switch off until the next converter pays 2 Flock each, and ongoing effects keep hitting the player they were cast on.
- Gains and "nothing" rolls never owe a strike or punishment.
- A beaten defending Hero whose owner controls no cities falls back to a city with their Flock, or goes into exile.
- A tier's +1 is lost if both stats are already at 3.
- Counters can't be played on a punishment Calamity.

### 3rd rules update

- Conversion happens at the start of your next turn (new Start phase), so gains during your own turn always wait a full round.
- A Holy Site drops one level, once, whenever its controller loses the city, and gives no income while uncontrolled.
- "Cities converted" counts distinct cities, for Prophet tiers and strike resets.
- Any harmful Free Will result (Flock, Renown, stats, army, movement, fighting) can be cancelled whole with a Favor, good parts included.
- Redirecting a punishment Calamity costs +2.
- Favor and Free Will spill-over can reach any neighboring city.
- Tailwind's wording is fixed in `cards.csv`.
- Yield hands over all of the defender's Flock in the city if they have fewer than 2.
- A defeated defending Hero falls back to a controlled city in the same region.
- When a Hero regains a tier, you choose the stat again.

### 2nd rules update (all 38 original questions)

- **Contradictions:** only Shelter of the Wild and Cure are counters; strikes are always possible; Heroes lose tiers when Renown drops; Free Will has its own discard pile.
- **Setup:** secret simultaneous starting cities, shared starts allowed; smallest starting city goes first, then clockwise; no facilitator.
- **Flock:** placement, reserve-first payment, no cap per city, losing a city below 25%.
- **Holy Sites:** Temple = +10 percentage points (thresholds in `cities.csv`); upgrade costs are per step; Crossmarch costs 5 to reach.
- **Cards:** any card can be held; Calamities name a target player; Favors add your own Flock; self-targeting allowed; redirect rule; seed placement; tier names changed to Cataclysmic/Major/Minor/Slight; Grand Foundry.
- **Free Will:** roll first; losses come from the character's city then reserve; missing character = discard; strikes cleared only by conversion and three named cards.
- **Combat:** a defender without a Hero adds 0; defend with any number up to the attacker's army; armies can mix city and reserve; retreat rules; domain bonus for either side; Armory is permanent; yield gives no Renown.
