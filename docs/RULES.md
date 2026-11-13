# Gods' Favor Rulebook

Every rule settled so far, in play order. Card text is in `data/cards.csv`, characters are in `data/characters.csv`, and city stats are in `data/cities.csv`.

## Overview and components

2 to 4 players are gods competing for followers, called **Flock**, across 9 cities. Each god belongs to one domain and spreads its faith through miracles, disasters, a Prophet who converts and a Hero who fights.

| Component | Count | Notes |
| --- | --- | --- |
| City cards | 9 | 3 regions of 3 cities, small, medium or large population, each with a need tag |
| Calamity deck | 50 | 9 per domain + 14 neutral |
| Favor deck | 50 | 9 per domain + 14 neutral |
| Free Will deck | 30 | 15 Prophet + 15 Hero |
| Prophet cards | 8 | 2 per domain |
| Hero cards | 8 | 2 per domain |
| Flock tokens | many | placed on city cards |
| Markers | many | seeds, structures, Holy Sites, Ruin, ongoing effects, strikes, Renown |
| Die | 1+ | six-sided |

## Setup

1. Each player picks a god and its domain: Nature, Harvest, Production/Technology or Health/Fertility.
2. Lay out the 9 city cards in their 3 regions:
   - Region A: Ashgrove, Crossmarch, Ironhold
   - Region B: Havenspring, Stonevale, Goldmere
   - Region C: Wheatfield, Cogsworth, Brightwell
3. Shuffle the Calamity, Favor and Free Will decks separately. Set the Prophet and Hero cards aside by domain.
4. Each player takes 10 Flock and places them in one starting city of their choice. No one controls a city yet.
5. Each player draws 5 cards, choosing for each one whether it comes from the Calamity or the Favor deck.

In a 2-player game, the two gods play head to head with no facilitator role.

## Core concepts

### Flock and reserve

Flock are your followers. They sit either on a city card or in your **reserve**, the pool you spend to cast cards and move characters. Each turn you choose whether new income goes onto the board or into reserve. Card costs are paid from your total Flock pool.

### Cities and regions

Each city has a population size (small, medium or large) and a **need tag** matching one of the four domains (Crossmarch has none). A city's **neighbors** are the other cities in its region.

### Domains and the domain wheel

The domains sit on a circle: Nature, Harvest, Production/Technology, Health/Fertility, then back to Nature. Opposites are Nature and Production/Technology, and Harvest and Health/Fertility.

| Target city's need vs. your domain | Prophet move cost |
| --- | --- |
| Same domain | 1 Flock |
| Adjacent domain | 3 Flock |
| Opposite domain | 5 Flock |

When a city's need matches your domain, it is easier to convert (41% instead of 51%) and gives +1 extra Flock income each turn.

### Conversion

You convert a city the moment your Flock there reaches 51% of its population, or 41% if the city's need matches your domain. If rivals have Flock in the city, all of their Flock there switches to yours.

### Income

Your income is 1 base Flock a turn, plus 1 for each city you control (2 for a large city), +1 for each controlled city matching your domain, plus Holy Site bonuses.

### The cities

Every domain matches one large city and one smaller one. Crossmarch is a neutral crossroads that matches no one. Region B holds two large cities, making it the richest region on the map.

| City | Region | Size | Need |
| --- | --- | --- | --- |
| Ashgrove | A | Small | Nature |
| Crossmarch | A | Medium | None |
| Ironhold | A | Large | Production/Technology |
| Havenspring | B | Small | Health/Fertility |
| Stonevale | B | Large | Nature |
| Goldmere | B | Large | Harvest |
| Wheatfield | C | Small | Harvest |
| Cogsworth | C | Medium | Production/Technology |
| Brightwell | C | Large | Health/Fertility |

| Size | Population | Flock to convert | If domain-matched | Income | Holy Site cap |
| --- | --- | --- | --- | --- | --- |
| Small | 25 | 13 | 11 | 1 | Shrine |
| Medium | 35 | 18 | 15 | 1 | Temple |
| Large | 50 | 26 | 21 | 2 | Cathedral |

### Holy Sites

Any god can raise a Holy Site in a city they control, as their Action Phase. Each city has one Holy Site slot, separate from its 2 structure slots, and you upgrade it one level at a time up to the city's cap.

| Level | Cost | Total income bonus | Extra effect |
| --- | --- | --- | --- |
| Shrine | 4 Flock | +1 | None |
| Temple | 8 Flock | +2 | Rivals need 10% more Flock to convert this city |
| Cathedral | 14 Flock | +3 | Defenders get +1 Resolve in battles here |

When the city changes hands, its Holy Site is desecrated and drops one level. Holy Sites are not structures, so cards that destroy structures can't touch them.

## Turn sequence

Each turn runs through five phases in this order.

1. **Draw.** Refill your hand to 5 cards, choosing the Calamity or Favor deck for each draw.
2. **Prophecy.** Once you control a city, draw 1 Free Will card, plus 1 more for each additional city you control, and resolve them (see Prophets and Heroes).
3. **Economy.** Collect income (see Income). Your Prophet also adds +1 Flock in an uncontrolled city where it is stationed. Place income on your cities or hold it in reserve. Seeds and ongoing effects pay out or tick down here.
4. **Action.** Do one of these:
   - Cast one Calamity or Favor card
   - Move your Prophet
   - Send your Hero into battle
   - Build or upgrade a Holy Site
5. **End.** Check for conversions and victory, and remove any markers that have run out.

Counter cards, Favors used to offset Free Will, and Production's Armory can be played outside the Action Phase.

## Cards

Calamity cards are disasters you inflict; Favor cards are miracles you grant. Each deck holds 9 cards per domain (2 Severe, 3 Medium, 2 Moderate, 2 Light) plus 14 neutral cards, and every card has its own Flock cost, from 1 for Light up to 6 for Severe.

### Holding and playing

- Cards matching your domain, and neutral cards, can be held until you choose to play them.
- Cards from another domain must be played as soon as they are drawn.
- If a Calamity's domain matches yours, you can redirect it onto another player, paying its cost.

### Domain identities

| Domain | How its cards play |
| --- | --- |
| Nature | Spread: effects hit a city, then spill into a neighbor or the whole region |
| Harvest | Time: income and reserve, delayed payouts and effects that last several turns |
| Production/Technology | Permanence: structures that stay on the board, cost changes, locking Prophets |
| Health/Fertility | The graveyard: cards that return from or scale with the discard pile |

### Special rules

- **Counters.** Each domain's fifth Favor card (Shelter of the Wild, Rationing, Repair Crews, Cure) cancels a Calamity. Play it right after the Calamity is announced, before it resolves.
- **Seeds.** A seed pays out at your next Economy Phase. It is lost if an opponent converts the city first, and a Harvest Calamity on that city destroys the seed instead of its usual effect.
- **Ongoing effects.** Anything lasting more than one turn gets a marker on the city or player until it runs out.
- **Structures.** A city holds at most 2. When the city changes hands, its structures stay but go Idle; the new owner waits one Economy Phase or pays 2 Flock to restore them.
- **Discard piles.** Calamity and Favor each have their own. When a deck runs out, shuffle its discard pile into a new deck.
- **Prophet and Hero targets.** A card that targets a Prophet or Hero can't target a player who doesn't have one yet.

## Prophets and Heroes

When you convert your first city, draw one Prophet and one Hero of your domain at random (each domain has 2 of each). The Prophet converts; the Hero fights.

### The Prophet

- Starts in your first converted city.
- While stationed in a city you don't control, that city gains +1 of your Flock each turn.
- Moving the Prophet takes your whole Action Phase and costs 1, 3 or 5 Flock by the domain wheel.

### The Hero

- Starts in your first converted city, with the Might and Resolve on its card. One Hero per domain is an attacker (Might 2, Resolve 1), the other a defender (Might 1, Resolve 2). Stats max out at 3.
- Moves by marching into battle (see Combat).

### Tiers

Every character has three tiers of powers (`tier_1`, `tier_2`, `tier_3` in `data/characters.csv`). Progress counts in total, so a character never drops a tier.

| Character | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Prophet | On arrival | 2 cities converted | 4 cities converted |
| Hero | On arrival | 2 Renown | 4 Renown |

A Hero also gains +1 to a stat of your choice at each new tier. Renown is earned 1 per battle won.

### Free Will and strikes

Free Will cards are events your Prophet or Hero causes. Each is a **Loss**, a **Roll** (roll a die for the outcome) or a **Gain**. When one would cost you Flock, you can respond:

1. **Offset it with a Favor.** Discard a Favor card for free (no Flock cost, its effect is forfeited) to cancel the loss.
2. **Punish with a Calamity.** Play a Calamity against your own character. By default its loss hits every player's Flock, including yours; aimed at one opponent, only they take it.
3. **Take a strike.** Mark a strike on that character.

You can also discard a Favor at any time to reset a character's strikes to 0. Strikes also reset whenever you convert a new city. At 3 strikes, the character is removed. If you hold no Favor or Calamity cards, the Free Will card resolves as written.

A removed character is gone for good unless a card or power brings them back, such as Resurrection or Ione the Midwife's Tier III.

## Combat

A battle lets your Hero take Flock from a rival by force, at the cost of followers on both sides.

1. **March.** As your Action Phase, move your Hero to a city where a rival has Flock (1 Flock) and commit 1 to 5 Flock from that city or your reserve as your army.
2. **Defender chooses.** Defend by committing up to the same number of Flock from that city (their Hero fights if it's there), or Yield by handing over 2 Flock in that city with no battle and no strike.
3. **Fight rounds.** Each round, both roll a die and add Might (attacker) or Resolve (defender), plus +1 for a domain-matched city and +1 to the defender for City Walls. The lower roll loses 1 committed Flock for good; a tie costs both sides 1.
4. **Retreat or press on.** After any round, the attacker may retreat with whatever survived. The battle ends when one army is gone.
5. **Spoils.** The winner's surviving army stays in the city, and they take 2 more of the loser's Flock there. The losing Hero, attacker or defender, takes a strike. The winning Hero earns 1 Renown.

| Domain | Hero trait (Tier I) |
| --- | --- |
| Nature | Ambush: once per battle, reroll your die |
| Harvest | Supply Lines: once per battle, reinforce your army with up to 2 Flock from reserve |
| Production/Technology | Armory: spend 3 Flock at any time to add +1 Might or Resolve (max 3) |
| Health/Fertility | Field Medics: after a battle, half your lost army (rounded down) returns to the city |

## Winning

You win by controlling 2 of the 3 regions and still holding them at the start of your next turn. Rivals get one full round to break your hold. You control a region when you control 2 of its 3 cities.

## Playtest watch list

These may be too strong and should be checked once the game is playable: Ash the Unbroken Tier III, Old Marta Tier III, Ione the Midwife Tier II combined with Fertile Age, and Tailwind.
