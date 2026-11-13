# Open rules questions

Found while reading `docs/RULES.md` and the CSVs for the digital build. A computer has to do *something* in each case, so each one needs a ruling. Write the ruling under the question (or put it in RULES.md) and the code will follow it. Where there's an obvious likely answer, it's given as **Proposed**. Confirm it or correct it.

## Open

1. **Whose "next turn"?** Many cards say "next turn" or "for 2 turns" without saying whose turn: Earthquake, Late Frost, Wild Beasts, Failed Harvest, Sabotage, Broken Roads, Stalled Caravan, The Long Fast, The King's Summons, A Challenge Refused. With 4 players, "next turn" could mean the very next player's turn, or the affected player's next turn.
   **Proposed:** always the affected player's own next turn(s). For a city, that's the target player of the Calamity.
2. **Structures and ongoing effects when a city goes uncontrolled.** Holy Sites now have a clear rule for this, but structures only say what happens "when the city changes hands". When a controller drops below 25% and the city goes uncontrolled, do its structures go Idle? And do ongoing city effects tied to "its owner" (Blight, Drought) keep hitting the former owner?
   **Proposed:** structures go Idle, and ongoing effects stay tied to the Calamity's target player.
3. **Free Will Gains and neutral rolls.** Step 3 ("take a strike or punish") follows "If you don't cancel it". Does it only apply to harmful results, so a Gain or a 3-4 "nothing" never costs a strike?
   **Proposed:** yes, harmful results only.
4. **A defeated defending Hero with nowhere to go.** It falls back to a city its owner controls. What if the owner controls no cities at that moment?
5. **Hero tier stat at the cap.** On reaching a tier you choose +1 to a stat, max 3. If both stats are already 3 (e.g. from Armory), is the +1 simply lost?
6. **Curing your own punishment.** Can you play Cure on a Calamity you're using to punish your own character? Then the Free Will loss still happens, but you avoid both the punishment and the strike, at the cost of 4 Flock and two cards.

## Answered

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
