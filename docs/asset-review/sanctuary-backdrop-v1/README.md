# Sanctuary backdrop — parallax layers

The owner's five backdrop layers, as sent: `source-sky.png` (sky and moon), `source-band.png` (far mountain
band), `source-mountains.png` (mountains and clouds), `source-ruins.png` (ruins and waterfall silhouette) and
`source-forest.png` (forest overhang). Each is 320×180 pixel art upscaled about 5.2×.

## In the game

`scripts/build-backdrop.py` brings every layer back to its native 320×180 with an area filter over
premultiplied alpha, gives it binary alpha and a small palette of its own, and hazes the forest a fifth of the way
towards the night so ledges read in front of it. Output: `assets/backdrop-v1/<layer>.png` and `atlas.json`.

The even gardens without a biome backdrop (2–10) and the Crown draw them back to front, each tiled
sideways with every other tile mirrored and scrolled at its own rate (`SANCTUARY_PAR` in `index.html`: sky 0.02,
band 0.05, mountains 0.09, ruins 0.15, forest 0.3). A flat night colour with sparse stars fills above the sky
layer. Until all five load, the old sky and hills stand in. `tests/backdrop.test.cjs` covers the assets, which
gardens use them, and that the tiling covers the view without gaps.

In Figma they are the layers `342:3` (band), `342:4` (mountains), `342:5` (ruins), `343:2` (sky) and `344:2`
(forest) in frame `14 BACKDROP — production` (`342:2`) of the production page.
