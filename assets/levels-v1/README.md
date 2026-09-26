# Picture levels

Draw these images at native 1:1 size on integer coordinates, with smoothing off.
The picture owns its visible floors; its collision platforms must not paint tiles.

## High Tide

`high-tide.png` preserves the 178 artwork objects, crops, layer order, opacity and
positions from the owner's `Groundfloor-Dei-fem-hagane.json`. The full scene is
628 × 1614 pixels, with authoring origin (0, -44) and spawn (76, 1472).
The 118 invisible collision strips share those same coordinates. No reduction to
the former 480-pixel tower and no replacement tiles. The dark authoring canvas is
baked into the image so opacity remains faithful with binary runtime alpha.

Rebuild with `python scripts/build-high-tide.py`; sources live in
`docs/asset-review/high-tide-v1/`. The generated map is `high-tide-map.js`.
