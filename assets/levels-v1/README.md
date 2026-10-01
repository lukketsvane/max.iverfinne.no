# Picture levels

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
Draw these images at native 1:1 size on integer coordinates, with smoothing off.
The picture owns its visible floors; its collision platforms must not paint tiles.

## High Tide

`high-tide.png` preserves the 178 artwork objects, crops, layer order, opacity and
positions from the owner's `Groundfloor-Dei-fem-hagane.json`. The full scene is
628 × 1614 pixels, with authoring origin (0, -44) and spawn (76, 1472).
The 118 invisible collision strips share those same coordinates. No reduction to
the former 480-pixel tower and no replacement tiles. The dark authoring canvas is
baked into the image so opacity remains faithful with binary runtime alpha.

Rebuild with [historical build-high-tide.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-high-tide.py); sources live in
`docs/asset-review/high-tide-v1/`. The generated map is `high-tide-map.js`.
