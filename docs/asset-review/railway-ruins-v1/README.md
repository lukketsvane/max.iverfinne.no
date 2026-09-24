# Railway Ruins — garden 1

Scene from the owner (`source.png`, 1536×864, generated pixel art): an underground railway court with a derailed tram, rail bridges, carts and crates, a lift tower, arcades and a pool. It is garden 1 in the game.

`scripts/build-railway-ruins.py` (Pillow, numpy) turns it into the picture level:

- crops the painting to 1536×720 so the soil line sits at y 673;
- paints a culvert under the tram terrace on the left, so Max walks in from the garden on the soil, and rims it with cobble, moss and two lamps sampled from the scene;
- traces the rock (the court floor, its ramps and the terrace, minus the culvert) into 3 px blocks;
- lays the one-way ledges the art already draws: the rail bridges, the trench, the crates, the flower cart, the vine off the bridge and the rungs of the lift tower up to its roof beam;
- places the markers: the rewards on the roof beam and the flower cart, trials on the court and the far bridge, bonuses on the terrace and the crates, and the designer spots (puzzle, door, dig, secret).

Output: `assets/levels-v1/railway-ruins.png` (256 colours) and `levels-v1/railway-ruins.js`.

Rebuild with `python3 scripts/build-railway-ruins.py`.

## Reach

Court ramps are 1:1 so Max walks them both ways. A walking Bulwark gets from the culvert across the whole court and back, and every class climbs the stepping stone, the arcades, the vine to the bridge deck, the tower to the roof beam, the crates and the flower cart (`tests/picture-level.test.cjs`). The small white cart at (690, 343) is a perch for Moss or an air jump, never on the way.

## Figma

File `TC0PHGMTCMR6im4hb3CSbF`, page **References** (`162:2`), section **GARDEN 01 — RAILWAY RUINS · picture level · NATIVE 1×** (`361:2`). The frame `railway-ruins` (1536×720) holds the rock blocks, the one-way ledges, the soil line, the culvert and every marker at their level coordinates, with a slot for the painting at 0,0. It carries no `designed` instance and is not named `garden-NN`, so `npm run figma:levels` leaves it alone.
