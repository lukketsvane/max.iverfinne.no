# Risk of Rain notes, and the plan for MAX · NIGHT GARDEN

Status: design notes, not yet the contract. `docs/run-design.md` stays the contract until each step below ships and updates it. Line numbers refer to HEAD at the time of the audits and may be off by ±2. The MAX numbers were measured headlessly with a bot that plays full runs through the real game code (the audit's scratch harness, a copy of `tests/game-harness.cjs`), or computed from the current formulas.

The owner's request that drives this: the game is far too easy after almost no time. Autogrowth belongs very late for every class except the Herbalist. The game should be hard even on Easy. Boons should be tiered, and a new robot should come after a boss. Levels should be generative, so every run is different. Rarer upgrades should be found by platforming and exploring.

---

## 1. Risk of Rain: what it does

Sources: riskofrain2.wiki.gg, riskofrainreturns.wiki.gg, riskofrain.wiki.gg (the fandom wikis return HTTP 402). The formulas are the wiki's. The worked numbers are computed from them.

### 1.1 Items and rarity (RoR2)

| Tier | Colour | Count | Role | Where it comes from |
|---|---|---|---|---|
| Common | white | 36 | One small, always-positive stat or proc (Syringe +15% attack speed; Bison Steak +25 HP) | small chests, shrines, printers |
| Uncommon | green | 42 | A mechanic (Hopoo Feather +1 jump; AtG missile 10%) | large chests, 1 per player from the teleporter boss |
| Legendary | red | 36 | Defines the build (Brilliant Behemoth, Ceremonial Dagger, 57 Leaf Clover) | ~1% of small chests, 20% of large, legendary chest (stage 4+), hidden spots |
| Boss | yellow | 22 | Only from bosses. Several summon allies (Queen's Gland: a Beetle Guard, 1 per stack) | 15% chance per teleporter drop, Shrine of the Mountain |
| Lunar | blue | 20 | Big upside with a built-in downside (Shaped Glass ×2 damage, ×0.5 HP) | Bazaar, for coins that carry across runs |
| Void | purple | 14 | Replaces its normal counterpart | Void Cradle (costs 50% HP), Void Fields |

- A chest rolls the TIER first and then an item uniformly inside the tier. The small chest's weights .8/.2/.01 normalise to 79.2 / 19.8 / 0.99%.
- **Stacking.** Flat stats stack linearly, `1 + a·x`. Every chance or reduction stacks hyperbolically, `1 − 1/(1 + a·x)`, so Tougher Times (15%) gives 13% at 1 stack, 43% at 5 and 60% at 10, and never reaches 100%. Only lunar items with a downside stack exponentially. Procs spawned by other procs have coefficient 0, so chains end.
- Hopoo's rule is that everything stacks with everything and every pick makes you stronger, but each pick is small. The power fantasy arrives late and is earned. Spare Drone Parts was **nerfed 50%** because it "would essentially play the game for you". That is exactly MAX's autogrowth and robot problem.

### 1.2 Chests and costs

| Thing | Base cost | Odds |
|---|---|---|
| Small chest | $25 | W 79.2 / G 19.8 / R 0.99 |
| Large chest | $50 | G 80 / R 20 |
| Legendary chest | $400 | R 100. Only from stage 4, and naturally very rare (≈5% of stages) |
| Category chest (Damage / Healing / Utility) | $30 / $60 | Small or large odds, but only items with that tag: lets the player steer a build |
| Multishop | $25 / $50 | 3 terminals, buy 1 and the other 2 close; 20% chance each hidden terminal shows "?" |
| Cloaked chest | free | Small odds. Near-invisible until you are close |
| Rusty Lockbox | 1 Rusted Key (a common) | G 80 / R 20, spawns in the NEXT stage; the key is consumed |
| Shrine of Chance | $17, +40% per use | nothing 45 / W 36 / G 9 / equipment 9 / R 1; at most 2 wins |
| Shrine of the Mountain | free | Harder teleporter boss (+100% boss credits); boss drops = players × (1 + shrines) |
| Printer / Scrapper / Bazaar cauldron | an item / items | Convert tiers: 3 W → 1 G, 5 G → 1 R |

- **Prices scale faster than income.** `cost = base × coeff^1.25`, while gold per kill is `2 × coeff × value`. Kills per chest therefore rise as `coeff^0.25` (a Beetle is worth 7.8 kills per chest at c=1 and 12.2 at c=6). The economy tightens slowly and cannot snowball.
- **Scene Director.** Each map has an interactable credit budget (Distant Roost 220, stage 2–4 maps ~280, Abyssal Depths 400, Sky Meadow 520), ×(1 + 0.5 × (players − 1)). It picks a weighted CATEGORY (Titanic Plains: chests 45, drones 14, barrels 10, shrines 10, duplicator 8, misc 7, void 3, rare 0.4), then a weighted AFFORDABLE card inside it. Each card carries a weight, a cost and a minimum stage (small chest 15 credits, large 30, legendary 50, shrines 20). It repeats until the budget is spent. Randomness sits on top of authored anchors: some maps always have a large chest, and Abyssal Depths always has one legendary spot.

### 1.3 Difficulty over time

```
coeff       = (playerFactor + minutes × timeFactor) × 1.15^stagesCompleted
playerFactor = 1 + 0.3 × (players − 1)
timeFactor   = 0.0506 × diffValue × players^0.2        diffValue: Drizzle 1, Rainstorm 2, Monsoon 3
enemyLevel   = 1 + (coeff − playerFactor) / 0.33       each level: +30% base HP, +20% base damage
```

- **Difficulty only changes the time slope.** The ×1.15 per stage and the player scaling are the same on every setting, so even Drizzle steepens stage by stage.
- **Drizzle does not shrink enemies.** It halves the time slope and helps the player: +70 armour (damage taken ×0.59) and ×1.5 regen. Monsoon runs the clock at ×1.5 with ×0.6 regen. The Eclipse levels 1–8 each ADD one pressure (half starting HP, half teleporter radius, lethal falls, +40% enemy speed, −50% healing, −20% gold, −50% enemy cooldowns, permanent damage). Hard modes are new pressures, not bigger numbers.
- Player levels give exactly the monsters' +30% HP / +20% damage. **Levelling is parity; the build comes only from items.** XP per level ×1.55, no cap.

Solo at ~6 min per stage (c = coeff, L = monster level, $ = small chest price):

| Entering | Drizzle c / L / $ | Rainstorm c / L / $ | Monsoon c / L |
|---|---|---|---|
| stage 2 @ 6 min | 1.50 / 2.5 / 41 | 1.85 / 3.6 / 54 | 2.20 / 4.6 |
| stage 3 @ 12 min | 2.13 / 4.4 / 64 | 2.93 / 6.8 / 96 | 3.73 / 9.3 |
| stage 4 @ 18 min | 2.91 / 6.8 / 95 | 4.29 / 11.0 / 154 | 5.68 / 15.2 |
| stage 6 @ 30 min | 5.06 / 13.3 / 190 | 8.12 / 22.6 / 343 | 11.17 / 31.8 |

Drizzle is ~0.68× Rainstorm's coefficient and takes ×0.59 damage on top, so its effective threat is **about 40% of normal. It is never 4%.**

### 1.4 Directors (pacing)

- Combat director credits/s = `mult × (1 + 0.4 × coeff) × (players + 1) / 2`. The fast and slow directors use mult 0.75, the teleporter director 2.0 (≈2.67× ambient during the event).
- The fast director waits 4.5–9 s between waves; the slow one banks for 22.5–30 s and then spends it in a spike. The result is a trickle plus spikes. A wave repeats one card until it can no longer afford it, 0.1–1 s apart. Hard cap: 40 monsters.
- Elites are bought from surplus. Tier 1 costs ×6 (HP ×3–5, damage ×2); tier 2 costs ×36 (HP ×18, damage ×6) and only exists from stage 6. The "too cheap" rule rerolls a card when the director holds more than 6× its elite cost, so late game brings fewer, stronger enemies instead of trash.
- Kill rewards are `coeff × value × rewardMult`, with mult 0.2 for ambient kills, 0.11 during the teleporter event and 0.067 for pre-spawns. Farming the event pays least.

### 1.5 The teleporter and the boss

- A charge of at least 90 s inside a zone. The charge rate is the fraction of living players inside it. The boss spawns at the start with `600 × √coeff × (1 + mountainShrines)` credits. Spawns stop at 99%.
- While it charges, interactables outside the zone are locked. You commit to the defence, then get a calm window to loot while the clock keeps running.
- Reward: 1 green per player (dead players included), each with a 15% chance to become the boss's yellow item. **New allies come from bosses (yellow) or from a big price, never for free.**
- Drones cost 1.4×–14× a small chest, scale with the ambient level so they never fall off, do not inherit the player's items, and leave a wreck when they die. More power comes from COMBINING, not from more units: the Drone Combiner merges 2 identical drones into the next tier (×2 HP and damage, −20% cooldown).

### 1.6 Stages and secrets

- Hopoo rejected fully procedural maps: "hand-crafted terrain with randomized enemy and loot placement… felt a lot better than truly random". Variety comes in four layers:
  1. A pool of 2–5 maps per stage slot.
  2. Around 3–6 variants per map (Returns has about 6), mostly single toggles such as an opened door.
  3. Director placement on random spawn nodes.
  4. A teleporter spot drawn from fixed candidates.
- **Rare things are gated by depth, by source and by traversal:**
  - Legendary chests only from stage 4; the red printer from stage 5.
  - Newt Altars: 3–5 hidden candidate spots, one usually spawns, and it opens the Bazaar.
  - A timed chest that locks at 10:00 of run time (Rallypoint Delta), with lamps lit only at the spot where it spawned.
  - A two-plate co-op gate (Aqueduct), where 2 of 8 plates must be held at once.
  - Void Fields: 9 cells whose rewards go W→G→R while the enemies gain items too. You can leave at any time and never come back.
  - Returns hides its Artifacts behind a vine peeking from the ground, a gap only vertical survivors can cross, 3 hidden buttons behind thin walls, and a jump series in a pit.
  - The pattern: a fixed candidate set, rolled per run, marked by a subtle tell, and paid for with time, risk or currency.
- **Borrowed from other games for level generation:**
  - Spelunky: build the guaranteed critical path first ("traversable without bombs, rope or other equipment"), then decorate. Rooms have probabilistic tiles and a random mirror. A level "feeling" (dark, flooded, spider lair…) is announced in one line.
  - Dead Cells: a per-biome concept graph (length, special rooms, branchiness) filled with authored room templates.
  - Launchpad: rhythm groups of 2–4 jumps joined by safe rest platforms. Generate K candidates and let critics pick. The most valuable coin sits at the riskiest spot.

Key links: [Difficulty](https://riskofrain2.wiki.gg/wiki/Difficulty) · [Directors](https://riskofrain2.wiki.gg/wiki/Directors) · [Chests](https://riskofrain2.wiki.gg/wiki/Chests) · [Items](https://riskofrain2.wiki.gg/wiki/Items) · [Item stacking](https://riskofrain2.wiki.gg/wiki/Item_Stacking) · [Teleporter](https://riskofrain2.wiki.gg/wiki/Teleporter) · [Shrine of Chance](https://riskofrain2.wiki.gg/wiki/Shrine_of_Chance) · [Shrine of the Mountain](https://riskofrain2.wiki.gg/wiki/Shrine_of_the_Mountain) · [Newt Altars](https://riskofrain2.wiki.gg/wiki/Newt_Altars) · [Void Fields](https://riskofrain2.wiki.gg/wiki/Void_Fields) · [Eclipse](https://riskofrain2.wiki.gg/wiki/Eclipse) · [Drones](https://riskofrain2.wiki.gg/wiki/Drones) · [Returns difficulty](https://riskofrainreturns.wiki.gg/wiki/Difficulty) · [Returns stages](https://riskofrainreturns.wiki.gg/wiki/Stages) · [Returns interview](https://gamerant.com/risk-rain-returns-remake-interview/) · [Dead Cells level design](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/) · [Spelunky generator](https://tinysubversions.com/spelunkyGen/) · [Launchpad](https://users.soe.ucsc.edu/~ejw/papers/Smith-Launchpad-TCIAIG-2011.pdf).

---

## 2. MAX today, and why it is too easy

### 2.1 Plants grow on their own, without limit

- Growth (`index.html:3442`) is `.032/s × (.18+.82m) × health × (1+.35·Quick roots) × Bloom Rush 2.25 × neighbours ≤1.34`, whenever moisture > .14. **Nothing stops it at maturity.** Any plant at growth ≥ 2.7 becomes a full-screen stalk (`:3451`). A stalk gains +.25 health once, takes ×.5 bite damage (`:4137`), and every 1.25 growth sheds a seed **and 1 XP**, forever.
- One tap (m 1.0) lasts ~72 s at drying .012/s. One Moss or Herbalist tap matures a plant in 33 s, and it then coasts to 86 px untended. A hand water adds only `Δm × .055`, about 1–2 s of passive growth. **Care is maintenance, not growth.**

| Condition (one plant, meadow, no pests) | Mature | Stalk |
|---|---|---|
| re-tapped every ~75 s | 34 s | 104 s |
| Quick roots 3 + neighbours + Bloom Rush | 7 s | **23 s** |
| untended in rain .5 (wetland gardens) | 42 s | **90 s** |
| untended, Morning dew 2 (holds m .35 forever) | 71 s | 176 s |
| untended, Dew 2 + Deep soil 1 + Quick roots 2 | 37 s | 97 s |

In a full bot run on Easy, the first plant that is not the exit becomes a stalk **46–57 s into garden 1**. At every clear, 3–8 of the 8 plants are full-screen stalks.

### 2.2 Easy is flat, and Medium hits a wall

`runTimeThreat = (1 + t·pressure/180)^1.7` (`run-director.inc.js:170`). Durability is `d.durability(1+.65(thr−1))` and damage `d.damage(1+.45(thr−1))`. The Easy profile (`index.html:4030`) is pressure .18, damage .26, durability .55, budget .36 and density .40: every lever at once, and pressure is cut twice.

| Damage / durability | 0 m | 5 m | 10 m | 20 m | 30 m |
|---|---|---|---|---|---|
| Easy | .26 / .55 | .33 / .75 | .40 / .99 | .59 / 1.56 | .82 / 2.25 |
| Medium | 1 / 1 | 2.93 / 3.79 | 5.99 / 8.21 | 14.9 / 21.1 | 27.1 / 38.7 |
| Insane | 1.45 / 1.35 | 7.44 / 9.41 | 17.9 / 23.5 | 49.7 / 66.2 | 93.9 / 126 |

- At 20 min, Easy is **~4% of Medium**. The RoR equivalent (Drizzle vs Rainstorm) is ~40%.
- The garden number barely matters: `runDamageScale` makes garden 20 only ×1.17, while RoR's stage factor would be ×14.
- Pest HP rises in integer steps (+1 at worlds 4, 9 and 14). Bosses have flat HP 15/23/31 (Crown 38) and die in ~11 bombs on Easy.
- Easy garden 1 has 2 pests at once and a patrol every 20 s. A watered plant regenerates .010/s against an Easy pest's .020/s. With Sap 2, or as a stalk, a watered plant **cannot be killed by one Easy pest**. An undefended, watered Easy garden loses its first plant at 206 s and is wiped out at 417 s.
- Defence multiplies: Thorns .78^5 × Barkskin .92^4 = ×.207 bite damage (4.8× effective HP). With Bulwark guard and a stalk it is ×.07.

Bot runs (baseline, 2 runs per cell):

| | Good bot | Casual bot |
|---|---|---|
| Easy | **won at 27.7–28.9 min, 0–5 plants lost in the whole run** | alive at 30 min, garden 17–18 |
| Medium | lost at 5.2–7.5 min, garden 3–5, never reached a boss | same |
| Hard / Insane | lost at 3.7–6.1 / 2.3–4.7 min | same |

### 2.3 Boons flood in, and plants pay for them

- The XP curve (`index.html:3240`) is `next` from 4, ×1.18 + 2, **capped at 45**: level 5 at 35 XP, level 10 at 190.
- XP sources: 1 per harvest (allowed every .35 growth), 1 per 1.25 growth, 1/3/7 per kill, 2–3 per wave and 4 per trial. Plants give 60–90% of all XP. In 10 minutes on Easy that was harvest 1518 + growth 700, against kills 218 + waves 72.
- A harvest-farming bot reached **level 7 at 61 s** (6 boons in the first minute) and **maxed all 105 ranks by garden 13 (~16 min)**. A mixed bot was L10–11 at 5 min, L18–20 at 10, L42–43 at 20 and L69–76 at the win.
- `build-paths.js` has 29 perks and **no rarity and no gate**. Companion (robot ×4), Robot crew (fleet ×2) and Guard bot (sentry ×3) are ordinary level-up picks, so a Mech can run 3 rovers plus a sentry at minute 3–4.
- A stage boss is recorded nowhere, and pays like an elite: 3 XP and 3 seeds.
- `gardenWave%4===0` (`index.html:4105,4111`) is dead code, since FINAL_WAVE is 3 and the counter resets per garden.
- Run items are uncapped: embers +12% bomb damage per stack and the dew trait +8% care per stack, up to 99 each.

### 2.4 Every run is the same run

- `stage-layout.js` cycles 5 fixed shapes by `(stage−1)%5`. The variant is `floor((stage−1)/5)`, the gaps are 7→14 px, and there is no seed.
- Terrain is a fixed hash of absolute x, and `levelOriginX(n)` is fixed, so garden N is identical in every run. Weather is `w%3`, trials rotate `(w−1+i)%3`, and loot is fixed: 1 feather per player on the summit, embers or dew on the bonus perch from garden 3.
- There is exactly one gated tier: the bonus perch 32 px above the summit (Moss, air jump or Spring step 2+).
- One feather per summit gives the air jump (feathers ≥ 3) by about garden 3, after which every gate is trivial.

### 2.5 The fix, already checked in the simulator (audit patch set `p3`)

The patch set applies these changes: passive growth stops at 1.0; tends past maturity (capped at 1.6); stalks only from the exit, or from overgrowth (Herbalist ×.5, garden ≥16 ×.35); drying .020; rain .025; dew holds a .10 floor; no growth XP; the linear threat below; regen `.006+.004·Sap`; seedlings take ×1.35 bites; and the Easy/Medium/Hard/Insane profiles of §3b.

| Result | Before | After |
|---|---|---|
| Easy, good bot | won with 0–5 plants lost | Herbalist won at 28.9–29.3 min with 10–11 lost; Mech reached garden 20, 60–76 lost |
| Easy, casual bot | alive at 30 min | **lost at 17–22 min, garden 11–14** |
| Medium, good bot | dead at 5–7 min, garden 3–5 | garden 15–19 (lost at 25 min, or alive at 30) |
| Hard, good bot | dead at ~4–6 min | garden 10–12 |
| Non-Herbalist stalks other than the exit | 3–8 per garden | **0 all run** |
| Undefended Easy garden, first loss / wiped out | 206 / 417 s | 51 / 65 s |

Still open: the good bot lost 0 plants in the first 5 min on every setting, and Mech (care .45) suffers most from faster drying.

---

## 3. The plan for MAX

Every decision has a number, and each is tied to a harness test in §3f. "Garden" = stage 1–20. Boss gardens are 5, 10 and 15 (and the Crown at 20). `bosses` = stage bosses killed this run.

### 3a. Growth: nothing grows by itself until very late, except with the Herbalist

**A1. Passive growth stops at maturity.** Growth still needs moisture > .14 (only a water makes it start), but it stops at 1.0 for every plant and every class: `if (g < 1) g = min(1, g + step); else if (over) g += step × over`.

**A2. Past maturity only a tend grows.** Each tend on a ripe plant adds `+.10 × tend`, up to RIPE_CAP 1.6 (75 px, which is ≥ 64 px so Moss can still climb). The harvest threshold drops .35 → .30, so a capped plant still gives 3 harvests.

**A3. The exit is the only stalk.** `makeStalk` only runs from `levelCleared`, unless overgrowth is active. Stalks that come from overgrowth take ×.8 bite damage (not ×.5) and get no +.25 heal. The exit stalk keeps today's behaviour.

**A4. Overgrowth thresholds.** `overgrowth(plant)`:

| Who | When | Multiplier on the passive step past 1.0 |
|---|---|---|
| Herbalist | from garden 1, on plants a Herbalist tended last (`p.carer` class) | ×.5 |
| Everyone else | **garden ≥ 16** (after the third boss, ≈ minute 22+) | ×.35 |
| Everyone else, garden ≤ 15 | never | 0 |

The co-op rule is per plant, not per team, so a Herbalist on the team does not overgrow a Mech's garden. Target: the Herbalist's first non-exit stalk comes ≥ 150 s into a garden with steady care.

**A5. Water.** Drying .012 → .020/s (a full tap lasts ~43 s). Rain .055 → .025 per intensity, so rain slows drying instead of watering. The garden `bloom` event and the grow/water auras (`PLANT_FEATURES`) only act below maturity unless overgrowth is on. To keep Mech (care .45) alive, rover water per refill rises +25%, because rovers now carry the drying difference.

**A6. Morning dew is the autogrowth boon.** Dew holds a moisture floor of `.14 + .07·rank` (.21 / .28 / .35), which is above the growth line, so the plant waters itself. It is **green for the Herbalist** and **red and gated to garden ≥ 16** for everyone else (§3c).

**A7. Weaker multipliers:**
- Quick roots: +15% per rank, max 3 (was +35%, max 5).
- Deep soil: ×.85 drying per rank, max 3 (was ×.70).
- Bloom Rush: ×1.5 growth (was ×2.25).
- Sap: `.006 + .004·rank`, max 3 (was `.010 + .005·rank`, max 5).
- Seedlings (growth < 1) take ×1.35 bite damage.

**A8. No XP from plants.** Remove the XP per 1.25 growth. A harvest pays 1 XP per 3 harvests. Seed shedding stays, but at the 1.6 cap it happens at most once per plant per garden.

### 3b. Difficulty: one "night depth" coefficient, and Easy that still bites

**B1. One formula** replaces `runTimeThreat`, `raidPressure` and `runDamageScale`:

```
D(t, g, n)   = (1 + 0.3·(n−1) + t_min · s · n^0.2) · 1.04^(g−1)
pest bite    = profile.damage     · (1 + .40·(D−1))
pest HP mult = profile.durability · (1 + .15·(D−1))      (bomb hit = 1 / HP mult; basic pest HP 1)
```

- The per-garden 1.04 is RoR's 1.15 per ~6 min stage converted to MAX's ~1.4 min gardens: `1.15^(1.4/6) = 1.033`.
- It is linear in time and exponential in gardens: lingering costs a steady amount, and the steepening comes from progress, which is also where the player's power comes from.
- `n` = players. The co-op player factor replaces today's flat budget ×(1+.42(n−1)) and the co-op boss HP add-ons.

**B2. Profiles** (tested as `p3`). Difficulty changes the slope `s` and the base levers, never the garden compounding.

| | pressure | damage | durability | budget | density | slope s |
|---|---|---|---|---|---|---|
| Easy | .65 | .70 | .95 | .75 | .80 | .07 |
| Medium | .90 | 1.00 | 1.10 | .95 | .95 | .10 |
| Hard | 1.10 | 1.20 | 1.20 | 1.15 | 1.10 | .13 |
| Insane | 1.40 | 1.45 | 1.35 | 1.40 | 1.30 | .17 |

- Easy's damage .70 plays the role of Drizzle's +70 armour (×.59). Easy's slope .07 is steeper than Drizzle's (.05): "hard even on Easy".
- Medium's .10 equals Rainstorm's .101/min.

Solo values (D and the bite multiplier) at the target pace of about 1.4 min per garden:

| t / garden | Easy D / bite | Medium D / bite | Hard D / bite | Insane D / bite |
|---|---|---|---|---|
| 0 / 1 | 1.00 / .70 | 1.00 / 1.00 | 1.00 / 1.20 | 1.00 / 1.45 |
| 5 / 4 | 1.52 / .85 | 1.69 / 1.28 | 1.86 / 1.61 | 2.08 / 2.08 |
| 10 / 7 | 2.15 / 1.02 | 2.53 / 1.61 | 2.91 / 2.12 | 3.42 / 2.85 |
| 20 / 14 | 4.00 / 1.54 | 5.00 / 2.60 | 5.99 / 3.60 | 7.33 / 5.12 |
| 28 / 20 | 6.24 / 2.17 | 8.01 / 3.80 | 9.78 / 5.41 | 12.1 / 7.91 |

- The Easy/Medium bite ratio stays .55–.70 all run (today .04–.26).
- From D ≈ 1.35 (≈ minute 4 on Easy), a basic pest takes 2 bombs until the first ember: RoR's "items let you one-shot trash again" curve.

**B3. Escalation.**
- Patrol interval `max(1.2, 7 / (pressure · (1 + t/240)))`, replacing `(1+t/120)^1.4` with its floor of .18.
- Raid size +1 per 90 s (was 45).
- First raid in garden 1: Easy 20 s (was 28). In later gardens: Easy 14 / Medium 10 / Hard 8 / Insane 6 s (was a flat 9).

**B4. Anti-camping stays separate.** 20 s after a garden is cleared, patrol rate and bite are multiplied by `1 + ((s − 20)/60)^1.7`. This keeps the intent of `time-pressure.test.cjs:108`.

**B5. Bosses scale from D.**
- Base HP ×1.5: Mossback 22, Bellkeeper 34, Moon Moth 46, Crown 56.
- Final HP = base × profile.durability × (1 + .15(D−1)) × (1 + .5(n−1)).

**B6. Prices and income.**
- Every seed price (trial, cache, chance flower) is `ceil(base × D^1.25)`.
- Pest seed income scales ×D. The chance of a seed drop per kill is `min(1, p₀·D)`, and the excess above 1 becomes extra seeds.
- The harness asserts that price divided by income per minute rises by no more than `D^0.25`.

**B7. The danger bar** (RoR's named clock). One word in the top line, the tier `floor((D − 1) / 0.75)`: Dusk, Evening, Night, Late, Deep, Witching, Owl hour, Black, No moon, Never morning. Watching the threat rise is what keeps Easy tense.

**B8. Success criteria for "hard even on Easy"**, checked by the bot matrix:
- The casual bot loses Easy between gardens 10 and 16.
- The good bot wins Easy and loses 8–25 plants.
- An undefended Easy garden 1 falls in 45–70 s.
- The good bot loses ≥ 1 plant by minute 5 on Medium. This is the one criterion p3 missed; the levers are B3's first raid and the slower XP of §3c.
- The Easy/Medium bite ratio stays in .45–.80 at every minute.

**B9. Contract change.** `docs/run-design.md:68` ("Easy must actually feel easy") and the max repo's `CLAUDE.md` are rewritten in the same commit as B1–B2, because the owner has overridden that rule.

### 3c. Boon tiers: white, green, red and yellow, gated by source

**C1. Tier per perk** (a `tier` field in `build-paths.js`; ranks changed as in §3a):

| Tier | Perks (id) | Count |
|---|---|---|
| White (common) | growth, water, yield, tender, spread, magnet, bark, cadence, dash, stride, spring, slow | 12 |
| Green (uncommon) | shield, blast, mulch, luck, regen, bounty, bramble, glue (+ dew for the Herbalist) | 8 |
| Red (legendary) | wild, chain, evergreen, bloom, dew (non-Herbalist, garden ≥ 16), recycle (Mech) | 6 |
| Yellow (boss) | robot (ranks 2–4), fleet (Robot crew), sentry (Guard bot); later one relic per class | 3 |

**C2. Nothing red or yellow before the first boss.** Red and yellow need `bosses ≥ 1`.

**C3. The robot cap.** Mech units = `1 + fleet + (sentry > 0 ? 1 : 0)` must be `≤ 1 + bosses`, and the robot rank must also be `≤ 1 + bosses`. Mech starts with `robot:1` and one rover. After boss 5 it may add ONE of {robot 2, Robot crew 1, Guard bot 1}; after boss 10, another; after boss 15, a third. Rain engine (`needs robot:3`) therefore arrives after boss 10 at the earliest.

**C4. Drop weights by source.** Inside a tier the pick is uniform over the class's available perks, as in RoR.

| Source | Before boss 1 | After boss 1 |
|---|---|---|
| Level-up (3 cards; each card rolls its tier) | W 80 / G 20 | W 80 / G 20 (**never red or yellow**) |
| Seed cache (summit, C0) / hidden cache | W 80 / G 20 | W 79 / G 20 / R 1 |
| Perch cache (C2) / dawn cache / trowel box | G 100 | G 80 / R 20 |
| Root vault (C3 or secret) | not placed | R 100 |
| Boss pick (5 / 10 / 15), per player, 1 of 3 | — | 1 yellow (if the class has one available) + 2 red |
| Chance flower | nothing 45 / W 36 / G 10 / trait 9 | nothing 45 / W 36 / G 9 / R 1 / trait 9 |

- The level-up keeps its one-card-per-path rule. If the rolled tier is empty in that path, it falls one tier, then to any path.
- Rolls use a hash of `runSeed, garden, level, slot`, never `Math.random`.
- Until the class relics exist, a non-Mech boss pick is 3 red.

**C5. Slower level curve.** `next` starts at 6, ×1.3 + 3, cap 120 (today 4, ×1.18 + 2, cap 45). Cumulative XP: L5 59, L7 144, L10 422, then +120 per level. With kill XP only (35–50/min) that gives target levels L6–8 at 5 min, L9–11 at 10, L13–16 at 20 and ~L17 at garden 20 (the mixed bot today: L10–11, L18–20, L42–43, L69–76).

Adding caches (~1–2 opened per garden) and 3 boss picks, a finished run holds **35–45 ranks** (today all 105 by garden 13 in the farming case). Delete the dead `gardenWave%4` branches.

**C6. Stacking in the RoR shapes.**
- Plant armour `A = 25·shield + 10·bark`, bite × `100/(100 + A)`. At the new maxes (Thorns 3, Bark 4) that is A 115, ×.47, where today it is ×.21.
- Chances are hyperbolic, `1 − 1/(1 + a·n)`: Wild spark a .12 gives .26 at 3 ranks (today .36); Bumper crop a .20 gives .38 (today .60).
- Blasts spawned by Chain bloom or Wild spark have proc coefficient 0 and cannot retrigger.
- Run items are capped: embers 8 stacks (+96%), the dew trait 5 (+40%). Feathers already use the hyperbolic `sqrt` form.

**C7. The boss is an event.** Add `rogueRun.bosses`: incremented in `burstKrek`'s stage-boss branch (`index.html:4157`), reset in `resetRogueRun` (`:3032`), and synced like `bossDefeated` (`coop-game.inc.js:200,215`). The boss pick uses the existing 3-card UI, so the game does not pause.

**C8. The Moon bell** (Shrine of the Mountain). It stands in each boss garden and can be rung until wave 3 starts, at most 2 rings. Each ring gives the boss HP ×1.5 and bite ×1.3, plus **+1 boss pick per player**.

### 3d. Exploration loot: the rare things sit where the climbing is hard

**D1. Caches** are loot items with a string `boon` and `tier` (`coopPlain` drops arrays and strings of 80+ characters), rolled from the seed when placed. Paid caches open with the crouch verb (`crouchGardenAction`, with a guest branch). Opening grants the boon at once, with no menu. Base costs use B6's `ceil(base·D^1.25)`: at D 1 / 2.5 / 5 that is 1/2/3 → 4/7/10 → 8/15/23 seeds for the three paid tiers.

| Cache | Reach | Price base | Odds (§3c) | Tell |
|---|---|---|---|---|
| Seed cache | summit, C0 | 1 | W 80 / G 20 (+R 1 after boss 1) | a pot |
| Hidden cache | secret site, C0–C1 | free | same as the seed cache | invisible until Max is within 24 px; a firefly swirl marks it |
| Perch cache | C2 perch (+32 px) | 2 | G 100 → G 80 / R 20 | a lit lantern |
| Dawn cache | a C1/C2 node | free | G 100 → G 80 / R 20 | locks 60 s after garden entry (45 s on Hard/Insane); its lamp goes out |
| Root vault | C3 perch or secret site; bosses ≥ 1; ≤ 1 per garden, 35% of gardens | 3 | R 100 | a cracked root wall, an odd flower |

**D2. Feathers are earned.** A summit gives a feather only until the player holds 2. The third feather (the air jump) is a green trait found only in perch caches or root vaults, so C3 stays gated until the player has climbed for it.

**D3. New traits.** Traits are drawn in code (`drawRunItem`), so they need no PNG or manifest entry and do not touch the `perks.length===29` pin.

| Trait | Tier | Effect | Stacking |
|---|---|---|---|
| rusty trowel | W | Next garden spawns one hidden trowel box per holder (G 80 / R 20); consumed on opening | — |
| snail shell | W | A plant ignores a bite | chance `1−1/(1+.10n)` |
| firefly jar | G | Hidden caches and secret sites show within 60 px instead of 24 | +20 px per stack, cap 3 |
| bee box | G | A bomb releases a stinging bee (proc 0) | chance `1−1/(1+.08n)` |
| four-leaf clover | R | A cache rolls one tier up | chance `1−1/(1+.25n)` |

**D4. The Chance flower** (Shrine of Chance). Cost `ceil(1·D^1.25) × 1.4^uses`, at most 2 wins per garden. Odds as in §3c.

**D5. Co-op follows RoR's rules.** Caches are shared world objects, and whoever pays or touches first gets the boon. The placement budget is ×(1 + 0.5(n−1)). Boss picks, Moon bell picks and trowel boxes are per player. The host places everything, and guests pick up through `'pickup-item'`. `coopState` truncates encounters to 4 (`coop-game.inc.js:213`), so caches travel as loot, not as encounters.

### 3e. Parametric levels: seeded, always reachable, harder routes hold rarer loot

**E1. Seed plumbing.**
- `rogueRun.seed` (32 bits) is set by the host in `resetRogueRun`, sent in `coopCapture`, and applied in `coopState` before anything reads the layout.
- `stageSeed = hash(runSeed, stage)` feeds a mulberry32. There is never a `Math.random`.
- The `stageLayout()` cache key becomes `stage + seed`.
- `MaxStageLayout.create(stage, origin, ground, wet, seed)` with `seed === undefined` returns today's authored shape, so every existing layout test stays green.
- Do not use `room.id` as the seed: replays and the shared garden reuse the room.
- `levelOriginX(n)` may shift by a seed-picked multiple of 8×640 px, which keeps the biome but brings new ground and ponds.

**E2. Structure.**
- The 5 themes stay as identities. Each gets 3 macro graphs (nodes: spawn, route L/R, summits, 2 trials, perch, 3–5 secret sites, vault?).
- A graph is filled from ~12 authored chunks with ports: step, hop-gap, switchback, arch, drop-climb, fork, narrow run, rest ledge, pond hop, wall-and-alcove, stacked shelf, bridge.
- Chunks have probabilistic cells (a 50% optional ledge, ±4 px width) and a random mirror.
- The Crown (garden 20) stays authored.

**E3. Per-theme parameters.** Gaps ramp from the first number at garden 1 to the second at garden 19 (+.35 px per garden). Width shrinks 1 px per 2 gardens, to a minimum of 18.

| Theme | Routes | Graphs | Summit height | Gap (px) | Shelf width | Branch p | Ponds | Secret sites |
|---|---|---|---|---|---|---|---|---|
| terraces | 2 | twin stair · stair + fork · stacked | 90–120 | 7→13 | 26–40 | .35 | low | 3 |
| canopy | 2, one high | tree ladder · fork · arch | 110–150 | 8→14 | 20–34 | .50 | low | 4 |
| crossing | 1–2, wide | bridge · broken bridge · islands | 80–110 | 10→18 | 22–36 | .30 | high | 3 |
| ruins | 2 | walls · collapsed · cellar | 100–140 | 8→14 | 18–30 | .40 | mid | 5 |
| switchbacks | 2 | zigzag · spiral · double | 120–160 | 7→12 | 22–30 | .25 | low | 3 |

**E4. Reach rules for the required path** (spawn, summits, trials, exit site). Measured for C0 = Bulwark (vx 74.8), standing start, no upgrades, apex 26.9 px. Its reach at rise 0/10/19 is 49/44/36 px.
- Rise ≤ 19.
- Edge-to-edge gap ≤ `min(28, reach(rise) − 8)`.
- Width ≥ 18 (≥ 22 before garden 6).
- Soil clearance ≥ 6.
- ≥ 3 gaps wider than 6 px per route.
- First shelf within 70 px of the origin; summit at y ≤ −40.
- A rest ledge ≥ 36 px wide every 2–4 jumps.
- No more than 2 required jumps in a row above 80% of the gap limit.

These are the existing invariants from `stage-layout.test.cjs` and `platform-layouts.test.cjs`, applied to every seed.

**E5. Capability tiers. A spot's tier is the lowest profile that reaches it**, found with a BFS over a jump graph built from `t = (v + √(v² − 2g·dy))/g`, `reach = vx·t − ACC ramp`:

| Tier | Profile | Apex | Loot it may hold |
|---|---|---|---|
| C0 | worst class, no upgrades | 26.9 px | seed pouch, seed cache, feather (until 2) |
| C1 | precision: an 18–20 px landing, a gap of 23–28 at rise ≥ 15, or ≥ 4 jumps without rest | 26.9 | hidden cache, dawn cache, chance flower |
| C2 | Moss, Spring step ≥ 2, or air jump (the +32 px perch) | 33.7–35.7 | perch cache, embers/dew traits |
| C3 | air jump (feathers ≥ 3), +48 px above a ledge | ~62 | root vault |

A soil spot under a C3 vault is allowed on purpose: a Moss can climb a capped 75 px plant it grew there, so care itself becomes a route.

**E6. The placement director** (RoR's Scene Director).
- Credits per garden = `(6 + 0.4·g) × (1 + 0.5(n−1))`: 6.4 at garden 1 solo, 14 at garden 20.
- Anchors outside the budget: 2 trials, 2 summit rewards, the exit site, and the Moon bell in boss gardens.

| Card | Cost | Weight | Earliest | Node tiers |
|---|---|---|---|---|
| seed pouch | 1 | 20 | g1 | C0–C1 |
| seed cache | 2 | 25 | g1 | C0 |
| hidden cache | 2 | 10 | g2 | secret |
| perch cache | 3 | 15 | g1 | C2 |
| dawn cache | 3 | 8 | g3 | C1–C2 |
| chance flower | 3 | 8 | g3 | C0–C1 |
| trait (embers / dew) | 2 | 12 | g3 | C1–C2 |
| root vault | 6 | 4, max 1 | bosses ≥ 1 | C3 / secret |

**E7. Critics.**
- Generate K = 6 candidates per stage seed. Score each on route asymmetry, distance from the previous garden's signature, ≥ 1 C2 node, a C3 node from garden 4 (in 35% of gardens), bird airspace, and walkable rat ledges.
- Pick the best deterministically. If all K fail E4, fall back to the authored shape.

**E8. Garden feelings** replace `w%3` weather. Roll 0–1 per garden from the seed, from a pool with an earliest garden: seedfall 1, bloom 1, drought 2 (today's weathers), overgrown 3 (+optional ledges), flooded 4 (+50% ponds), windy 6 (±12 px/s air drift), rat warren 7 (×2 rats on ledges, heavy), dark 8 (60 px lantern radius, heavy). At most one heavy feeling per 5-garden band; announced in one word. Trial types are drawn from the seed too.

### 3f. Implementation order: small steps, each shippable and each proven by a test

Every step: `npm test` is green, the tests that pin the old numbers are updated in the same commit, and the bot matrix (`good`/`casual` × 4 difficulties × 2 runs) is re-run for steps 1–3 and 6.

| # | Step | Scope | Tests that prove it |
|---|---|---|---|
| 1 | **Growth off** | A1–A7 (`index.html:3384,3400,3409,3427–3460,4137`; `run-director.inc.js:163`) | Bot run, 20 gardens: 0 non-exit stalks for Mech/Moss/Bulwark in gardens 1–15; an untended watered plant stops at 1.0; tends cap at 1.6; Herbalist's first non-exit stalk ≥ 150 s into a garden; a Herbalist in co-op does not overgrow a Mech's plants; dew floor < .14 for a non-Herbalist before garden 16. Update `game.test.cjs:48-58` and `boons-expanded.test.cjs:16`. |
| 2 | **XP faucet** | A8, C5, delete the dead `gardenWave%4` | No XP from growth; 1 XP per 3 harvests; curve 6/×1.3+3/cap 120 (`game.test.cjs:5-17` rewritten); bot levels in the C5 bands at 5/10/20 min. |
| 3 | **Night depth** | B1–B6, B8–B9; profiles; regen; boss HP | Table test of D and bite (§3b ±2%); Easy/Medium bite ratio .45–.80 at every minute 0–30; B8 bot criteria; `difficulty.test.cjs:20-40`, `time-pressure.test.cjs:20-108` and `enemy-pressure.test.cjs:42-49` rewritten (camp still lost by 10 min); run-design and CLAUDE.md updated. |
| 4 | **Bosses count** | C7 (`rogueRun.bosses`, sync); boss pick of 3 (red, and yellow where the class has one) per player | Harness: a stage-boss kill increments `bosses`, which resets per run; a co-op guest sees the same count; each member gets one pick of 3; no pause. |
| 5 | **Tiers and gates** | C1–C4 in `build-paths.js`: `tier`, `ctx = {garden, bosses, classId, seed}`; ctx undefined = ungated; every caller passes ctx (`perkChoices`, `chooseRoguePerk`, `grantRogueXP`, `coopOffer`, `coopChoose`, guest filter `coop-game.inc.js:233`) | 1000 seeded level-ups: W 80 ± 4 / G 20 ± 4, 0 red, 0 yellow; no red or yellow anywhere before boss 1; Mech units ≤ 1 + bosses in every bot run; dew is never offered to a non-Herbalist before garden 16; `classes.test.cjs:93-113` (ungated pool exhaustion) and `coop.test.cjs:131` unchanged. |
| 6 | **Stacking** | C6: armour, hyperbolic chances, proc 0, trait caps | Thorns 3 + Bark 4 bite multiplier = .465 ± .01; Wild spark 3 = .265; a chained blast never spawns a blast; embers capped at 8. |
| 7 | **Run seed** | E1 (seed only; `create` still authored when seed is undefined) | Same seed gives an identical layout, weather and trials; host and guest layouts are deep-equal in `coop.test.cjs`; `Math.random` is still never called (`platform-layouts.test.cjs:14`). |
| 8 | **Generator v1** | E2–E4, E7 for C0 routes only; theme table E3 | 500 seeds × 19 gardens: every required node BFS-reachable at C0; E4 rules hold; the physics sweep (`stage-layout.test.cjs:40-78`) on 20 seeds × 4 classes × 30/60/120 Hz; ≥ 90% of gardens differ between two seeds; expressive range: no bucket (summit height × jump count × asymmetry) > 15%; with seed undefined all old tests pass as they are. |
| 9 | **Tiers on the map, and caches** | E5, E6, D1, D2, C4 cache odds; `layout.caches`, `dropRunItem`/`awardRunItem` accept caches | Gates are real: no C2 node is reachable at C0, and no C3 node at C2; red only once bosses ≥ 1; 10 000 seeded cache rolls within ±2% of §3c; price follows `ceil(base·D^1.25)`; `coopPlain` keeps the boon string; a guest opens a paid cache and the host deducts seeds; the third feather appears only in C2/C3 caches. |
| 10 | **Secrets and time** | Hidden cache (24 px), dawn cache, rusty trowel, the D3 traits | A hidden cache is not drawn beyond 24 px (60 px with the jar); the dawn cache locks at 60 s / 45 s; a trowel spawns one box per holder next garden and is consumed; the trait stacking formulas. |
| 11 | **Risk for reward** | Chance flower (D4), Moon bell (C8) | 10 000 seeded flower pulls within ±2% of the odds, max 2 wins; price ×1.4 per use; a bell raises boss HP ×1.5 per ring and adds 1 pick per player per ring; locked after wave 3 starts. |
| 12 | **Feelings and danger bar** | E8, B7 | ≤ 1 heavy feeling per 5-garden band across 500 seeds; the danger word matches `floor((D−1)/.75)`. |
| 13 | Later | A credit-based combat director with elites bought from surplus (§1.4); class relics for Moss/Bulwark/Herbalist (each needs a 9×9 PNG and a `figma-manifest.json` entry); a compost cauldron (3 W → 1 G, 5 G → 1 R); a Void-Fields-style side garden; an Eclipse-style ladder for Hard/Insane; a two-plate co-op gate | One step each, with its own test. |

Steps 1–3 fix "too easy" on their own and can ship before any of the level work. Steps 4–6 make power arrive through bosses and places instead of the XP bar. Steps 7–12 make every run different and put the rare boons on the hard routes.
