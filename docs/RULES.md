# Gods' Favor Rulebook

Every rule settled so far, in play order. Card text is in `data/cards.csv`, characters are in `data/characters.csv`, and city stats are in `data/cities.csv`. All percentage thresholds round up.

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
4. Each player secretly chooses a starting city, then everyone reveals at once. Two or more players may choose the same city; it is contested from the start. Each player places 10 Flock in their starting city. No one controls a city yet.
5. **Turn order.** The player whose starting city has the smallest population goes first. Ties are broken randomly. Play then passes clockwise. "The opponent to your left" means the next player in turn order.
6. Each player draws 5 cards, choosing for each one whether it comes from the Calamity or the Favor deck.

There is no facilitator or game-master role at any player count.

## Core concepts

### Flock and reserve

Flock are your followers. They sit either on a city card or in your **reserve**.

- **Placing Flock.** Flock can be placed in any city you control, or any city where you already have Flock. You reach brand-new cities through your Prophet, cards and battles.
- **Reserve.** During your Economy Phase you choose whether new income goes onto the board or into reserve, and you may also move any reserve Flock onto the board under the placement rule above.
- **Paying costs.** Costs are paid from reserve first. If reserve runs short, the rest comes from your Flock in any cities you choose.
- **No cap.** A city can hold any amount of Flock. Its population only sets its thresholds.

### Cities and regions

Each city has a population size (small, medium or large) and a **need tag** matching one of the four domains (Crossmarch has none). A city's **neighbors** are the other cities in its region.

### Domains and the domain wheel

The domains sit on a circle: Nature, Harvest, Production/Technology, Health/Fertility, then back to Nature. Opposites are Nature and Production/Technology, and Harvest and Health/Fertility.

| Target city's need vs. your domain | Prophet move cost |
| --- | --- |
| Same domain | 1 Flock |
| Adjacent domain | 3 Flock |
| Opposite domain | 5 Flock |
| Crossmarch (no need) | 5 Flock for every god |

When a city's need matches your domain, it is easier to convert (41% instead of 51%) and gives +1 extra Flock income each turn.

### Conversion

When your Flock in a city reaches its threshold, the city is not yours yet. It converts **at the start of your next Economy Phase**, if your Flock there is still at or above the threshold. This gives rivals one round to push you back.

- The threshold is 51% of the city's population, or 41% if the city's need matches your domain.
- A Temple (or Cathedral) in the city adds 10 percentage points for rivals: 61%, or 51% if matched.
- When a city converts to you, all rival Flock there switches to yours.

### Losing a city

You keep a converted city even if your Flock there falls below the threshold. But at the start of your Economy Phase, any city you control where your Flock is **below 25% of its population** becomes uncontrolled.

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

| Size | Population | Convert at | If matched | With Temple | Temple + matched | Lost below | Income | Holy Site cap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Small | 25 | 13 | 11 | n/a | n/a | 7 | 1 | Shrine |
| Medium | 35 | 18 | 15 | 22 | 18 | 9 | 1 | Temple |
| Large | 50 | 26 | 21 | 31 | 26 | 13 | 2 | Cathedral |

### Holy Sites

Any god can raise a Holy Site in a city they control, as their Action Phase. Each city has one Holy Site slot, separate from its 2 structure slots. You upgrade it one level at a time, up to the city's cap, paying each step's cost.

| Level | Upgrade cost | Total income bonus | Extra effect |
| --- | --- | --- | --- |
| Shrine | 4 Flock | +1 | None |
| Temple | 8 more Flock | +2 | Rivals need 10 percentage points more to convert this city |
| Cathedral | 14 more Flock | +3 | Keeps the Temple effect; defenders get +1 Resolve in battles here |

When the city changes hands, its Holy Site is desecrated and drops one level: a Cathedral becomes a Temple, a Temple becomes a Shrine, and a Shrine is removed. Holy Sites are not structures, so cards that destroy structures can't touch them.

## Turn sequence

Each turn runs through five phases in this order.

1. **Draw.** Refill your hand to 5 cards, choosing the Calamity or Favor deck for each draw.
2. **Prophecy.** Once you control a city, draw 1 Free Will card, plus 1 more for each additional city you control, and resolve them (see Free Will and strikes).
3. **Economy.** In this order:
   1. Any city you control where your Flock is below 25% of its population becomes uncontrolled.
   2. Any city where your Flock is at or above its threshold converts to you.
   3. Collect income (see Income). Your Prophet also adds +1 Flock in an uncontrolled city where it is stationed.
   4. Place income and any reserve Flock on the board, or keep them in reserve.
   5. Seeds and ongoing effects pay out or tick down.
4. **Action.** Do one of these:
   - Cast one Calamity or Favor card
   - Move your Prophet
   - Send your Hero into battle
   - Build or upgrade a Holy Site
5. **End.** Check for victory, and remove any markers that have run out.

Counter cards, redirects, Favors used to cancel Free Will losses, and Production's Armory can be used outside the Action Phase.

## Cards

Calamity cards are disasters you inflict; Favor cards are miracles you grant. Each deck holds 9 cards per domain plus 14 neutral cards. Every card has its own Flock cost, by tier:

| Tier | Cost | Per domain |
| --- | --- | --- |
| Cataclysmic | 6 | 2 |
| Major | 4 | 3 |
| Minor | 3 | 2 |
| Slight | 1-2 | 2 |

### Holding and playing

- Any card can be held in your hand until you choose to play it, whatever its domain.
- Every card costs what it says, whoever plays it.

### Targeting

- **Calamities on a city** name one target player. They remove only that player's Flock in the target city, and in any neighboring cities the effect spreads to. If that player has no Flock in a city, that part does nothing. You may target your own cities.
- **Favors** always add your own Flock. They can target any city you control or where you already have Flock.
- **Seeds** can be planted in any city you control or where you have Flock.

### Redirecting

Whenever anyone plays a Calamity of your domain, at anyone, you may pay its cost to choose a new target player for it. Each Calamity can be redirected only once.

### Domain identities

| Domain | How its cards play |
| --- | --- |
| Nature | Spread: effects hit a city, then spill into a neighbor or the whole region |
| Harvest | Time: income and reserve, delayed payouts and effects that last several turns |
| Production/Technology | Permanence: structures that stay on the board, cost changes, locking Prophets |
| Health/Fertility | The graveyard: cards that return from or scale with the discard pile |

### Special rules

- **Counters.** Shelter of the Wild and Cure are counters. Play one at any time, even on another player's turn, right after a Calamity is announced (and after any redirect), before it resolves. All other cards, including Rationing and Repair Crews, are played on your own Action Phase.
- **Seeds.** A seed pays out at your next Economy Phase. It is lost if an opponent converts the city first, and a Harvest Calamity on that city destroys the seed instead of its usual effect.
- **Ongoing effects.** Anything lasting more than one turn gets a marker on the city or player until it runs out.
- **Structures.** A city holds at most 2. When the city changes hands, its structures stay but go Idle; the new owner waits one Economy Phase or pays 2 Flock to restore them.
- **Discard piles.** Calamity, Favor and Free Will each have their own discard pile. When a deck runs out, shuffle its discard pile into a new deck.
- **Prophet and Hero targets.** A card that targets a Prophet or Hero can't target a player who doesn't have one.

## Prophets and Heroes

When you convert your first city, draw one Prophet and one Hero of your domain at random (each domain has 2 of each). The Prophet converts; the Hero fights.

### The Prophet

- Starts in your first converted city.
- While stationed in a city you don't control, that city gains +1 of your Flock each Economy Phase.
- Moving the Prophet takes your whole Action Phase and costs 1, 3 or 5 Flock by the domain wheel (5 to Crossmarch).

### The Hero

- Starts in your first converted city, with the Might and Resolve on its card. One Hero per domain is an attacker (Might 2, Resolve 1), the other a defender (Might 1, Resolve 2). Stats max out at 3.
- Moves by marching into battle (see Combat).

### Tiers

Every character has three tiers of powers (`tier_1`, `tier_2`, `tier_3` in `data/characters.csv`).

| Character | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Prophet | On arrival | 2 cities converted | 4 cities converted |
| Hero | On arrival | 2 Renown | 4 Renown |

- **Prophets** count every city you have ever converted, so a Prophet never drops a tier.
- **Heroes** count their current Renown. A Hero earns 1 Renown per battle won, and gains +1 to a stat of your choice on reaching each new tier. If Renown drops below a tier's requirement (for example, from Blood on Their Hands), the Hero loses that tier's power **and** its +1 stat until the tier is reached again.

### Free Will and strikes

Free Will cards are events your Prophet or Hero causes. Each is a **Loss**, a **Roll** or a **Gain**.

1. **Roll first.** For a Roll card, roll the die before deciding anything.
2. **If the result costs you Flock**, you may discard any Favor card from your hand (free) to cancel the loss completely. Nothing else happens.
3. **If you don't cancel it**, the loss happens, and you must also choose one:
   - **Take a strike** on that character. This is always possible.
   - **Punish** your character by playing a Calamity from your hand against yourself, for free. Its effect resolves on you, and no strike is taken.
4. **Where Flock comes from and goes.** Free Will losses come from the character's city; anything beyond what is there comes from reserve. Free Will gains go to the character's city.
5. **Missing character.** A Free Will card for a character you no longer have is discarded with no effect.

**Strikes.** At 3 strikes, the character is removed. Strikes reset to 0 when you convert a new city, and are reduced by Healing Waters, Answered Prayer and Hero's Triumph. There is no other way to clear them.

A removed character is gone for good unless a card or power brings them back, such as Resurrection or Ione the Midwife's Tier III.

## Combat

A battle lets your Hero take Flock from a rival by force, at the cost of followers on both sides.

1. **March.** As your Action Phase, move your Hero to a city where a rival has Flock (1 Flock) and commit 1 to 5 Flock as your army. The army can be any mix of your Flock in that city and your reserve. You don't need Flock in the city already.
2. **Defender chooses.**
   - **Defend:** commit any number of their Flock in that city, up to the size of the attacker's army. Their Hero fights if it's there.
   - **Yield:** hand over 2 of their Flock in that city, which become the attacker's Flock there. The attacker's army stays in the city. No battle, no strike, no Renown.
3. **Fight rounds.** Each round, both roll a die and add:
   - Might (attacker) or Resolve (defender). A defender with no Hero in the city adds 0.
   - +1 to whichever side's domain matches the city's need.
   - +1 to the defender for City Walls, and +1 Resolve to the defender in a city with a Cathedral.

   The lower roll loses 1 committed Flock for good; a tie costs both sides 1.
4. **Retreat or press on.** After any round, the attacker may retreat. The surviving army goes to the attacker's reserve, the Hero returns to the city it marched from, and the Hero takes a strike. No spoils, no Renown.
5. **Spoils.** The battle ends when one army is gone.
   - **Attacker wins:** the surviving army and the Hero stay in the city, the attacker takes 2 more of the defender's Flock there, the defender's Hero (if it fought) takes a strike, and the attacking Hero earns 1 Renown.
   - **Defender wins:** the defender's surviving Flock stay, they take 2 of the attacker's Flock in that city if there are any, the attacking Hero takes a strike and returns to the city it marched from, and the defending Hero (if it fought) earns 1 Renown.

| Domain | Hero trait (Tier I) |
| --- | --- |
| Nature | Ambush: once per battle, reroll your die |
| Harvest | Supply Lines: once per battle, reinforce your army with up to 2 Flock from reserve |
| Production/Technology | Armory: spend 3 Flock at any time to add +1 Might or Resolve permanently (max 3) |
| Health/Fertility | Field Medics: after a battle, half your lost army (rounded down) returns to the city |

## Winning

You win by controlling 2 of the 3 regions and still holding them at the start of your next turn. Rivals get one full round to break your hold. You control a region when you control 2 of its 3 cities.

## Playtest watch list

These may be too strong, or too weak, and should be checked once the game is playable:

- Ash the Unbroken Tier III, Old Marta Tier III, Ione the Midwife Tier II combined with Fertile Age, and Tailwind may be too strong.
- Holy Site costs (4, then 8, then 14 more) may be too expensive.
- With no Flock cap in a city, stacking may make cities hard to take.
