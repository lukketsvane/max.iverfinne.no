# Enemy encounter progression

The September 30 two-player Easy playtest felt dominated by birds. The previous director locked all non-bird roles through garden 5 and rats through garden 11 on Easy. It then replaced locked formation slots with more birds. A small wave could end before reaching the more varied tail of its formation.

## Opening lessons

| Garden | Introduction | Response |
| --- | --- | --- |
| 1 | Three bird kinds | Approach, aim and defend the plant |
| 2 | Common ground rat | Jump or dodge the warned bite; use elevated routes |
| 3 | Seed thief | Protect loose seeds; defeat it to recover the stolen drop |
| 4 | Shield beetle; black rat variant | Flank or dodge to expose the shell; watch the faster ground approach |
| 5 | Spore caster | Follow the amber warning and intercept the spore |
| 6 | Healing moth | Interrupt support before it restores a wounded attacker |
| 7 | Albino rat variant | Respect its tougher body and stronger bite |
| 8 | Thorn caster | Leave the warned root eruption |
| 10 | Dew leech; plague rat variant | Protect moisture; avoid the separate delayed plague pulse |
| 12 | Rammer | Sidestep its warned straight charge |

## Composition rules

Every difficulty uses this progression. Easy keeps its lower damage, durability, population, wave budget and slower clock; it does not hide creature roles.

The first raid arrival on an introduction garden is the new role. Formations remove locked entries rather than converting them to birds. Garden 2 groups a rat with two different birds. Once two non-bird roles are available, a group has two distinct roles and one bird. Terrain profiles and wave rotation order those roles; the sequence does not depend on animation randomness. Existing finite wave budgets and the shared 24-enemy cap remain.

Patrol order restarts when entering a garden. The bird-only scouting grace applies to garden 1. Rat variants start with the newest available variant and cycle, preventing long random gaps. Optional circuit and expedition guards prioritize unlocked roles supported by their existing route AI.

These are existing live creatures with distinct behaviors, not new creature artwork. Native thief, beetle, caster, moth and four rat atlases are already in the production asset library. Thorn, leech and rammer retain their existing procedural renderers.

## Balance evidence

`run.enemies` records up to twenty per-garden rows. Each row has the total actual spawns, counts by kind, rat variants and source: raid, patrol, trial, circuit, expedition or guardian adds. Only the host increments counts; snapshots share them with guests and finished records retain them. Counts represent spawned encounters, not a guarantee that every player saw every enemy on screen. The old reported run did not record this breakdown, so its exact enemy mix cannot be reconstructed.

The [Figma encounter board](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=405-72) sits alongside the draft geometry. Ten instances of the `Encounter note` component expose Garden, Introduction and Response text properties. Eight exact native sprite previews link to the existing source image hashes. Notes and previews are design guidance. Enemy spawning remains authored in `run-director.inc.js`; editing board text does not automatically change runtime balance.
