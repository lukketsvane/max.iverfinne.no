# Upper districts: gardens 1–20

Each main garden now has an optional vertical district beyond its original routes. Trail lamps point toward its sign. The original painted levels, places, garden defence, two-way shrine choice and physical exit remain intact.

The choice is time: collect a guaranteed feather on the ordinary route and leave, or spend another climb on a specialised item, seed caches and a keepsake. The global threat clock and garden continue throughout. District completion never clears the garden or bypasses a boss.

## Traversal and encounters

Districts rise 288–384 native pixels on 18–24 ledges. Four silhouettes alternate tight switchbacks, wider spines, arches and braided returns. Each includes three off-route galleries with a descent, a reachable hidden nook and a return jump. All routes work with a walking, unupgraded Bulwark; feathers and class movement make them faster. Walk off an outer edge to return to soil. There are no solid cages, forced fall damage or one-use traversal gates.

- **Relay:** tend three beacons, in any order. Each light wakes keepers.
- **Bells:** blast the bells in their visible one/two/three pip order. Wrong notes do not reset progress or charge seeds.
- **Salvage:** blast three sealed containers, in any order.
- **Watch:** tend each antenna, then hold its ledge for six seconds. Leaving pauses the hold; switching antennas starts that antenna's hold. Each antenna wakes keepers once.

All three stations and their keepers must be resolved before the summit drops one owner-reserved item for every connected teammate. Keepers use the shared 24-enemy budget, stay at the encounter's elevation, and telegraph aimed knockback hazards. Divers retain interruptible dives; spore and root specialists use their respective tells. Existing shields still reward flanking. Enemies and reward state are host-authoritative; duplicate actions cannot repay rewards, and takeover carries progress.

Every district has three seed nooks: an open one-seed clue and two nearby-revealed two-seed caches. The highest side gallery hides a keepsake. Standing quietly beside it for two seconds reveals its line, a chime and one seed, once per garden. These are run discoveries, not account unlocks.

## The twenty places

| Garden | District | Route | Encounter | Summit item | Keepsake |
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

`stage-expeditions.js` supplies deterministic geometry and the catalogue; `run-director.inc.js` owns interactions, elevated keeper behaviour and drawing. `coop-game.inc.js` snapshots scalar district state. Existing art remains native scale. No new PNG or atlas is introduced.

`review.html?mode=layout7&expedition=1` starts at a district entrance. Add `&summit=1` to inspect its summit; change the garden number to review any of the twenty. Review mode remains isolated from live players and saves.

`tests/expeditions.test.cjs` physically jumps every ascent with all four classes across three seeds and 30/60/120 Hz, tests Bulwark return paths, encounter completion, item ownership, enemy caps and one-time keepsakes. `tests/platform-coop.test.cjs` checks guest elevation, action deduplication, snapshots and takeover rewards.
