# Cavern backdrop — behind the underground gardens

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
The owner's backdrop art for the climb out of the silo (1672×941 each, generated pixel art):

- `far.png`: dark cave silhouettes, opaque. This is the back of the cavern.
- `strips.png`: a sheet of silhouette strips on near-black: cave ceilings with stalactites, lines of ruins, arches, colonnades and pillars.
- The lake and the misty ruins are the owner's `sea.png` and `ruins.png` in `../coast-layers-v1/`. They are the same files.

## Build

[historical build-cavern-layers.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-cavern-layers.py) (Pillow, numpy, scipy) brings each layer to native pixels at 1/4. It sets them on the night layers' 180-row grid, where row 140 is the ground line:

- **far:** the cave silhouettes.
- **ceiling:** the stalactites of the sheet's first strip. The strip is cut at its emptiest row, and the ceiling hangs from the top of the grid. The sheet is keyed out of its near-black background by an edge-connected flood.
- **horizon:** the mounds and ruins of that strip, plus the sheet's line of ruins, standing on the lake's far shore at row 104.
- **lake:** the dark water from the far shore down. Its clouds and sky are left out, since it is underground.
- **ruins:** the misty ruins in the water, hazed towards the cavern's dark.

The wide layers are stored as mirrored pairs (836 wide) so they wrap without a seam. Every layer has binary alpha and at most 16 colours.

Output: `assets/cavern-v1/<name>.png` and `atlas.json`. `index.html` draws them for gardens 1–10 with `drawCavernLayers`.

## Figma

These files are not in Figma yet, because the agent environment could not reach Figma's image upload host. the retired pending-art list pins them. See `docs/figma.md`, "Waiting for Figma".
