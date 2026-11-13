# Open rules questions

Found while reading `docs/RULES.md` and the CSVs for the digital build. A computer has to do *something* in each of these cases, so each one needs a ruling. Grouped by when the build will need the answer. Write the ruling under each question (or edit RULES.md) and the code will follow it.

## Contradictions

1. **Counters don't all cancel a Calamity.** RULES says each domain's fifth Favor "cancels a Calamity. Play it right after the Calamity is announced." Shelter of the Wild and Cure do that. But **Rationing** cancels an *ongoing effect* (Famine, Blight, Drought), and **Repair Crews** removes a Ruin token or restores a structure. Neither cancels a Calamity as it's announced. Which wording is right?
2. **Conversion timing.** Conversion says a city converts "the moment" your Flock reaches the threshold; the End phase says "Check for conversions". Is it instant (mid-action) or only at End?
3. **"If you hold no Favor or Calamity cards, the Free Will card resolves as written."** But "Take a strike" needs no cards, so it should still be possible. Can you always take a strike, or only when you also have cards?
4. **Blood on Their Hands vs. tiers.** "Progress counts in total, so a character never drops a tier", but this card makes you "lose 1 Renown". Does lost Renown slow progress to the *next* tier (e.g. 3 → 2, so 2 more wins needed for Tier III), or is the total-ever-earned count unaffected?
5. **Free Will discard pile.** RULES gives Calamity and Favor their own discard piles and reshuffle rule, but says nothing about Free Will. Do played Free Will cards get discarded and reshuffled when the deck runs out?

## Needed for milestone 2–3 (setup, economy, conversion)

6. **Turn order.** Who goes first, and does play go clockwise (needed for "opponent to your left")?
7. **Starting city.** Can two players start in the same city?
8. **Off-domain cards drawn during setup.** Setup has you draw 5 cards; off-domain cards "must be played as soon as they are drawn". Does that apply during setup, before anyone has taken a turn?
9. **Where can Flock go?** Income goes "on your cities or in reserve". Does "your cities" mean only cities you control, or any city where you have Flock? If only controlled cities, the main ways into a new city are cards, the Prophet and battles. Is that intended?
10. **Paying costs.** "Card costs are paid from your total Flock pool." Can you pay from Flock on the board, and from which city? Can paying drop a city below its conversion threshold, and does that lose you the city?
11. **Losing a city.** Once converted, do you keep a city if your Flock there drops below the threshold (to Calamities etc.)? Or does it only change hands when a rival reaches *their* threshold? Is there a cap on total Flock in a city (its population)?
12. **Temple: "10% more Flock to convert".** 10 percentage points (51% → 61%) or 10% of the threshold (26 → 29)? How is it rounded?
13. **Holy Site costs.** Is the cost table per upgrade step (Shrine 4, then Temple +8, then Cathedral +14) or the total to reach that level?
14. **Desecration.** A Shrine "drops one level" when the city changes hands. Does that mean it's removed?
15. **Prophet move cost to Crossmarch** (no need tag): 1, 3 or 5?
16. **Facilitator.** "In a 2-player game, the two gods play head to head with no facilitator role." There's no facilitator anywhere else in the rules. Is there one in 3–4 player games, and what does it do?

## Needed for milestone 4 (cards)

17. **Whose Flock does a city Calamity hit?** "Target city loses 5 Flock": the controller's? Split among everyone with Flock there? Caster's choice? What about uncontrolled cities with several players' Flock?
18. **Where does Favor Flock go?** "Target city gains 3 Flock": always the caster's Flock? Can you target a city where you have no Flock or that a rival controls?
19. **Can a Calamity target your own city?** (Needed anyway for "punish your own character".)
20. **Playing off-domain cards immediately:** Does it use your Action Phase? Do you pay the cost? What if you can't afford it, or there's no legal target? Who picks the target?
21. **Off-domain counters are dead cards.** A Harvest god who draws Cure must play it at once, when there's no Calamity to cancel. Intended?
22. **"If a Calamity's domain matches yours, you can redirect it onto another player, paying its cost."** Is this about a Calamity *someone else plays on you* (you pay to bounce it)? Or about one you draw?
23. **"Lose 2 Flock" with no source.** Many Free Will cards (Rival Preacher, Speaking in Tongues, Duel of Honor…) say "lose/gain N Flock" without saying from/to where. Reserve, the character's city, or player's choice?
24. **Seeds.** "Plant a seed": in which city? One you control, any city, or the Prophet's city?
25. **Tier names.** Medium (cost 4) is stronger than Moderate (cost 3), but in everyday English the two words mean nearly the same thing. Consider renaming (e.g. Severe / Major / Minor / Light) so players don't mix them up.
26. **Cathedral of Industry** (a structure) shares its name with the **Cathedral** Holy Site level, and cards that destroy structures can't touch Holy Sites. Worth renaming to avoid confusion?

## Needed for milestone 5 (Prophets, Heroes, Free Will)

27. **Punishing with a Calamity.** "Play a Calamity against your own character. By default its loss hits every player's Flock, including yours; aimed at one opponent, only they take it." Does the Free Will loss still happen? Do you pay the Calamity's cost? Is "its loss" the Calamity's effect or the Free Will card's? Whose Flock where (each player's reserve? every city)?
28. **Strikes are cheap to clear.** Discarding *any* Favor at any time resets strikes to 0, which makes Healing Waters and Answered Prayer (pay 3 to remove *1* strike) strictly worse than discarding them. Intended?
29. **Free Will for a missing character.** If your Prophet or Hero has been removed, what happens when you draw a Free Will card for it?
30. **Response timing for Roll cards.** Do you choose your response (offset/punish/strike) before or after rolling?

## Needed for milestone 6 (combat)

31. **Defender without a Hero.** If the defender's Hero isn't in the city, what Resolve do they roll with: 0?
32. **Short defender.** If the defender has fewer Flock in the city than the attacker commits, can they still defend with what they have?
33. **Where does the attacking army come from?** "1 to 5 Flock from that city or your reserve": can you mix both? Can you attack a city where you have no Flock (all from reserve)?
34. **Retreat.** Where do retreating Flock and the Hero go? Is a retreat a loss (strike, spoils)?
35. **Losing attacker's Hero.** Where does it end up after a lost battle: does it stay in the city?
36. **"+1 for a domain-matched city"**: applies to whichever side's domain matches the city's need, or only to the attacker?
37. **Armory.** Is the +1 Might/Resolve permanent or for one battle?
38. **Yield.** "Handing over 2 Flock": the 2 become the attacker's Flock in that city? Does the attacker's Hero earn Renown?

## Balance watch list (from RULES)

Already flagged by you: Ash the Unbroken III, Old Marta III, Ione II + Fertile Age, Tailwind. Once games run, the digital version could log outcomes to help check these.
