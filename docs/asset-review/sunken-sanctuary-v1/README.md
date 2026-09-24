# Sunken Sanctuary — split parts

Concept sheet from the owner (`source.jpg`, 1536×1024, generated pixel art), cut into its loose parts for the Figma **References** page.

- `source.jpg`: the sheet as received.
- `clown-mask.png`: the label map the cut came from. Each part is one flat colour at its place in the sheet; black is empty panel; the grey top is the level illustration, kept whole.
- `parts/<group>/<nn-name>.png`: 170 parts at the sheet's own 1× scale, in 24 groups that follow the sheet's panels (tiles, structures, flora, props, enemies, fx, palette). Each binary-alpha part keeps at most 64 colours, which drops the JPEG noise and is visually unchanged.
- `parts.json`: every part's group, name, file, source box (`x`, `y`, `w`, `h`), alpha mode and clown colour.

Rebuild with `python3 scripts/split-concept-sheet.py docs/asset-review/sunken-sanctuary-v1` (Pillow, numpy, scipy; pyoxipng optional).

## How the cut works

Every pixel is scored by its distance from a smooth estimate of the dark panel colour. Headings, captions, the title block and the panel rules are blanked. What is left splits into connected parts per panel column. A part that runs past the next heading stays whole and belongs to the section its middle is in. A fragment inside a part four times its size joins it. The four waterfalls share one dark backdrop, so they use a stricter threshold and are cut at the gaps. The palette swatches are cut as solid rectangles.

The clown mask that came with the sheet does not register with it: its layout and objects are different. That is why the mask here was rebuilt from the art.

## Not runtime-ready

- The sheet is a JPEG, so parts carry compression noise and far more colours than a pack palette allows.
- Glow parts (`fx/lights`, `fx/particles`, the wisps and the candelabra) keep a soft halo alpha; every other part has binary alpha. Runtime art needs binary alpha and a pack palette (`docs/figma.md`).
- The level illustration at the top is one connected scene, so it is not split. It is garden 2 in the game: `scripts/build-sunken-sanctuary.py` paints out its labels, adds an entrance tunnel on the soil line and traces its rock into collision (`assets/levels-v1/sunken-sanctuary.png`, `levels-v1/sunken-sanctuary.js`).

## Figma

File `TC0PHGMTCMR6im4hb3CSbF`, page **References** (`162:2`), section **SUNKEN SANCTUARY — SPLIT PARTS · NATIVE 1×** (`269:2`). Each group is a component set `sunken_sanctuary/<group>` with variants `part=<nn-name>`, each sized 1:1 to its PNG. The clown mask sits beside them as the key.
