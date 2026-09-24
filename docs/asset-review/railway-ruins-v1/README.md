# Railway Ruins — garden 2

The owner's railway scene and kit sheets, built into garden 2 at Max's scale.

## Sources

- `source.png`: the scene (1536×864, generated pixel art): a station with a derailed tram, a rail viaduct with a flower cart, a hanging vine, a lift tower, a lower court with a pool.
- `kits/machinery.png`, `kits/bridges.png`, `kits/mossy.png`, `kits/stone.png`: the owner's kit sheets (1536×1024, transparent): the mill wheel and machinery, wooden piers and ladders, mossy floating islands, stone pillars, lintels, stairs, arches and rubble.
- `kits/mill-scene/`: the owner's Pixel Mill cut of a mill scene (`atlas.png`, `atlas.json`). Its colour-keyed background removal punched holes in dark stone, so only its planters, lanterns, lamp post, vines and crates are used.

- `kits/mossy-ruins/`: the owner's Pixel Mill cut of a mossy-ruins sheet. The same colour key removed its dark stone. The build fills each piece's enclosed holes again with that colour mixed with the piece's darkest tones, and uses its arch blocks, stair slopes, ledges, pillars, slabs and water.

The Pixel Mill packs of the machinery and the stone ruins are the same art as the sheets at 1/4. The build cuts those sheets itself instead, from their clean alpha.

## Scale

Everything is painted at about four times the game's pixel size. Max is about 22 px tall, as tall as the people in the scene at 1/4. So the build brings everything to native pixels:

- the scene, the piers, the mossy islands and the stone at 1/4;
- the machinery at 1/8, so the mill wheel is about five Max tall.

It uses a premultiplied box filter with hard alpha at half, then one 255-colour palette for the whole level.

## Build

`scripts/build-railway-ruins.py` (Pillow, numpy, scipy):

- **Scene.** Downscales the scene to 384×192 and clears its dark sky, flood-filled from the top, down to the upper floor. The station, the viaduct and the lift tower stand against the garden's own night sky; the undercroft below the viaduct stays.
- **Kit pieces.** Cuts every kit piece from its sheet by a box in source pixels (`PIECES`, `MILL`) and places them west and east of the scene (`PLACE`). Each placement has a role:
  - `deck`: a one-way ledge along a plank;
  - `tops`: one-way ledges along an island's or a pillar's level top;
  - `stair`: solid rock under a stair;
  - `ladder`: rungs every 17 px;
  - `back` or `decor`: nothing to stand on.
- **Clipping.** Placed pieces are clipped at the soil line, so the game's own ground runs under the whole garden.
- **Collision.** The scene's collision is traced at native scale:
  - the lower court as a 1:1 surface profile;
  - the rail terrace as rock;
  - the viaduct decks, the carts, the vine and the lift-tower rungs as one-way ledges.
- **Output:**
  - `assets/levels-v1/railway-ruins.png`;
  - `levels-v1/railway-ruins.js`;
  - `placements.json`, every placed piece with its box, which the Figma section mirrors.

Rebuild with `python3 scripts/build-railway-ruins.py`. For a preview with rock, ledges, markers and every spot a walking Bulwark reaches, run:

```sh
node tests/picture-sweep.cjs bulwark 1 reach.json
python3 scripts/build-railway-ruins.py --preview preview.png --reach reach.json
```

## Reach

`tests/picture-sweep.cjs` searches the level with the real game physics as a walking, unupgraded Bulwark from the soil on both sides. Every marker must be reached, Max must cross both ways, and no spot may strand him (`tests/picture-level.test.cjs`).

## Figma

The level is on the References page (`162:2`) of file `TC0PHGMTCMR6im4hb3CSbF`, section **GARDEN 01 — RAILWAY RUINS** (`361:2`). The frame `railway-ruins` is at 1:1 native pixels and holds:

- every placed kit piece as a rectangle named `kit:<kit>/<piece>` with its role;
- the scene's box;
- the rock, the one-way ledges, the soil line and the markers;
- a slot for the painting at 0,0.

It carries no `designed` instance and is not named `garden-NN`, so `npm run figma:levels` leaves it alone. The painting and the kit sheets are not uploaded, because Figma's image upload host is blocked in this environment.
