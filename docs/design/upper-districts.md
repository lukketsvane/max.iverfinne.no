# Upper districts: gardens 1–20

Each main garden now has an optional vertical district beyond its original routes. Trail lamps point toward its sign. The original painted levels, places, garden defence, two-way shrine choice and physical exit remain intact.

The choice is time: collect a guaranteed feather on the ordinary route and leave, or spend another climb on a specialised item, seed caches and a keepsake. The global threat clock and garden continue throughout. District completion never clears the garden or bypasses a boss.

## Traversal and encounters

Districts rise 288–384 native pixels. Four lower silhouettes lead into two different seeded, authored platform phrases. Each includes three off-route galleries with a descent, a reachable hidden nook and a return jump. All routes work with a walking, unupgraded Cairn; feathers and class movement make them faster. Walk off an outer edge to return to soil. There are no solid cages, forced fall damage or one-use traversal gates.

- **Relay:** tend three beacons, in any order. Each light wakes keepers.
- **Bells:** blast the bells in their visible one/two/three pip order. Wrong notes do not reset progress or charge seeds.
- **Salvage:** blast three sealed containers, in any order.
- **Watch:** tend each antenna, then hold its ledge for six seconds. Leaving pauses the hold; switching antennas starts that antenna's hold. Each antenna wakes keepers once.

All three stations and their keepers must be resolved before the summit drops one owner-reserved item for every connected teammate. Keepers use the shared 24-enemy budget, stay at the encounter's elevation, and telegraph aimed knockback hazards. Divers retain interruptible dives; spore and root specialists use their respective tells. Existing shields still reward flanking. Enemies and reward state are host-authoritative; duplicate actions cannot repay rewards, and takeover carries progress.

Every district has three seed nooks: an open one-seed clue and two nearby-revealed two-seed caches. The highest side gallery hides a keepsake. Standing quietly beside it for two seconds reveals its line, a chime and one seed, once per garden. These are run discoveries, not account unlocks.

## Terrace circuits

A seeded outer circuit branches from one upper platform and rejoins the ascent above it. There are three authored court families: Old Pump Court, Split Bough Court and Broken Bell Court. Their 88–104 pixel floor provides room to dodge, approach a ranged keeper or flank a shield. Low and high perches create another approach. Both directions use ordinary jumps for all six characters, and the open sides permit retreat to the soil.

The fork shows two reward icons before the detour. At the court, tend either altar to choose one of those gifts for the party. The choices exclude the current summit item, so the detour expands the available build directions. Choosing summons two keepers, three from garden eight, plus one for parties of three or four. Each arrival has a 1.35 second amber warning at its exact position. Occupying that point relocates the warning before a keeper appears. Once every keeper falls, each connected teammate receives a reserved copy of the chosen gift, alongside shared seed and XP rewards. The second altar cannot award again.

Walking through the court does not force a fight. Once activated, leaving the area for four seconds withdraws; 75 seconds also expires the challenge. Both retire pending strikes and award nothing. The main ascent, summit puzzle and guardian remain available. The pressure clock never pauses.

Circuit insertion is deliberately conditional: the bounded search rejects crossings that would obstruct the existing ascent or cache routes. An omitted circuit is part of the seed variation. Pictures, the first seven shrine approach ledges and their courts retain their existing geometry.

## The twenty places

| Garden | District | Route | Encounter | Base summit item (rotated by seed) | Keepsake |
| --- | --- | --- | --- | --- | --- |
| 1 | The Lost Seed Lift | Switchbacks | Relay | Dew | A tiny watering can |
| 2 | Signalbox Nine | Spine | Bells | Ember | The last train ticket |
| 3 | Rainwell Galleries | Arches | Watch | Dew | An umbrella for a beetle |
| 4 | The Hanging Archive | Braid | Salvage | Ember | A book of pressed leaves |
| 5 | Mossback Lookout | Switchbacks | Relay | Feather | Mossback was here |
| 6 | Thiefwind Rigging | Spine | Salvage | Ember | A stolen golden spoon |
| 7 | Sporeglass Conservatory | Arches | Watch | Dew | Do not water the moon |
| 8 | The Armoured Belfry | Braid | Bells | Ember | A beetle sized helmet |
| 9 | Rootwell Observatory | Switchbacks | Relay | Feather | A star in a jam jar |
| 10 | The Silent Carillon | Arches | Bells | Dew | The bell that says meow |
| 11 | Aurora Scaffold | Spine | Relay | Feather | A scarf for the aurora |
| 12 | Snowmelt Reservoir | Braid | Watch | Dew | A snowman facing summer |
| 13 | The Frozen Post | Switchbacks | Salvage | Ember | A letter addressed to Max |
| 14 | Windchime Orchard | Arches | Bells | Feather | The wind knows your name |
| 15 | Moon Moth Roost | Braid | Watch | Dew | A moths bedtime story |
| 16 | Cinder Pumpworks | Spine | Relay | Dew | Tea is still warm |
| 17 | The Ember Library | Arches | Salvage | Ember | Please return before dawn |
| 18 | Furnace Choir | Switchbacks | Bells | Ember | Three notes from home |
| 19 | The Last Weather Station | Braid | Watch | Feather | Forecast: one more try |
| 20 | Above the Hollow Crown | Spine | Relay | Ember | A crown for the gardener |

## Implementation and review

`stage-expeditions.js` supplies deterministic geometry and the catalogue; `run-director.inc.js` owns interactions, elevated keeper behaviour and drawing. `coop-game.inc.js` snapshots scalar district state. `assets/district-props-v1` supplies native idle/lit machinery and three landmark silhouettes, rebuilt from the retained generated source by `scripts/build-district-props.py`.

`review.html?mode=layout7&expedition=1` starts at a district entrance. Add `&summit=1` to inspect its summit; change the garden number to review any of the twenty. Review mode remains isolated from live players and saves.

`tests/expeditions.test.cjs` physically jumps the existing ascents and Cairn cache returns. `tests/expedition-circuits.test.cjs` covers seeded circuit geometry, all six classes and reverse travel at 30/60/120 Hz. `tests/district-circuit.test.cjs` exercises physical reward choices, timed arrivals, punching reach, retreat, guest activation and mid-warning authority handoff. The isolated circuit review scene and browser CI exercise the same controls on phone layouts.
