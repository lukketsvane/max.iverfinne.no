# Seed Vault — garden 1, the bottom of the silo

The owner's scene (`source.png`, 1672×941, generated pixel art) is a frozen seed vault at the bottom of a silo. It has glass tanks of plants, a great wheel of seed jars, pipes and a valve wheel, an ice bridge over a frozen pool with a flower on a pedestal, lit doors, and ladders between three and four floors. The run starts here, dark and wet, and climbs out.

`kits/` holds the owner's Pixel Mill cut of the same scene (1/4, dark keyed out). It is kept for reference and the level does not use it.

## Scale

The vault's keepers and doors are drawn smaller than the Railway Ruins' people and arches, so the scene is brought to native pixels at 1/3 rather than 1/4 (557×314). Max, about 22 px tall, stands a head above the keepers and fits the doors. The same box filter is used as for the railway, then one 255-colour palette.

## Build

`scripts/build-seed-vault.py` uses the scene whole and opaque, because it is its own cave.

Collision is the floors it shows, all one-way so Max can jump up through them:

- the upper floor on the left (the keepers' door and the rover);
- the middle floor on the left;
- the stone blocks and the ice bridge;
- the step off the bridge;
- the middle and upper floors on the right;
- the top deck by the lit door;
- the pedestal in the frozen pool;
- rungs 17 px apart up each of the four ladders the art draws.

A wooden ladder from the Railway Ruins' kit reaches the top deck. The lowest floor is the garden's soil.

Output: `assets/levels-v1/seed-vault.png` and `levels-v1/seed-vault.js`.

Rebuild with `python3 scripts/build-seed-vault.py`. To preview with the reach overlay, run `node tests/picture-sweep.cjs bulwark 1 reach.json`, then `python3 scripts/build-seed-vault.py --preview p.png --reach reach.json`.

## Reach

A walking Bulwark reaches every marker, crosses both ways and is never stranded (`tests/picture-level.test.cjs`). Every class climbs both left ladders to the keepers' floor, hops onto the bridge, and climbs both right ladders and the kit ladder to the top deck.
