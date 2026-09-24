# Coast backdrop — behind the Railway Ruins

The owner's three backdrop layers for the mill-and-railway scene (1672×941, transparent, generated pixel art):

- `mountains.png`: far mountains and a small crescent moon;
- `sea.png`: clouds, the far shore, two lighthouses, rocks and open water;
- `ruins.png`: misty ruins standing in the water, in two bands. The owner sent this one twice, as identical files.

## Build

`scripts/build-coast-layers.py` (Pillow, numpy, scipy) brings each layer to native pixels at 1/4, like the Railway Ruins in front of them. It sets them on the night layers' 180-row grid, where row 140 is the ground line:

- the sea's horizon sits at row 100;
- the mountains stand on the horizon;
- the ruins' lower band sits just behind the ground, hazed 30% towards the night.

The crescent moon is dropped because the night sky has its own. The sea and the mountains are stored as a mirrored pair (836 wide) so they wrap without a seam. The ruins (418 wide) repeat as they are. Each layer has binary alpha and at most 16 colours; `atlas.json` lists the palette.

Output: `assets/coast-v1/mountains.png`, `sea.png`, `ruins.png`, `atlas.json`.

## Status

The layers are built but the game does not load them yet. Every PNG the runtime loads must be a Figma production layer with the same bytes (`tests/figma-assets.test.cjs`, `docs/figma.md`). Figma's image upload host is blocked in this environment, so the three files still have to be put in Figma. Once they are production layers:

1. Draw them behind the Railway Ruins (garden 2), or wherever the climb out of the silo first meets the open sky, over the night sky, stars and moon, in place of the night forest.
2. Record them in `assets/figma-manifest.json`.
