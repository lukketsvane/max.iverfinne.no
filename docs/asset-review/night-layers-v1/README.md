# Night layers: ten parallax layers, sky to terrain

`source.png` is the owner's labelled layer sheet (1536×1024). It has ten numbered rows of cells: 1 sky, 2 stars,
3 moon, 4 far clouds, 5 far mountains, 6 mid mountains, 7 forest, 8 ruins silhouette, 9 foreground trees and
10 terrain. Rows 1–8 are each one panorama, cut into 13 cells over a baked sky. Rows 9 and 10 are loose sprites
with their own alpha. `preview.png` shows all ten stacked, at 2×.

`scripts/build-night-layers.py` turns each row into one 180 px tall layer at the sheet's own pixel scale:

- the panorama's cells are joined and its ends crossfaded so it wraps;
- the baked sky is keyed out, stars against their local median;
- mountains and forest are solid below their ridge;
- sprites are set on one baseline.

Every layer gets binary alpha and a small palette of its own. The sky becomes flat bands with a 2×2 ordered
dither at each edge. The ruins row is paler than the forest, so it sits behind it: layer 07 is ruins, 08 forest.
Only one moon is kept: the full moon with its cloud wisps.

- `layers/`: the ten clean layers. Rows 1–8 are 1258–1260 px wide, the trees 1154 and the terrain 1333.
- `assets/night-v1/`: the game's copies. They are 640 wide (the sky 256, the trees 604, the terrain 591),
  with fewer colours in the busiest layers. The trees and terrain are hazed towards the night so they sit
  behind the play.

## In the game

Odd gardens without a biome backdrop (1, 3, 5, 7 and 9) draw the ten layers from one top, back to front, each
wrapping sideways at its own rate (`NIGHT_LAYERS` in `index.html`). The moon stays 70% across the view. On a
tall screen the stars repeat up the sky. The even gardens and the Crown keep the Sanctuary backdrop. Until all
ten layers load, the old sky and hills stand in. `tests/backdrop.test.cjs` covers the layers, the gardens and
the tiling.

In Figma the runtime layers are in frame `15 NIGHT — production` (`346:2`) on the production page. Each layer
is named by its path.
