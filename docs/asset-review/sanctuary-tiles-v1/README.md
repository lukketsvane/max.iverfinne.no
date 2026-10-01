# Sanctuary tiles — pixel tile sheet

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
The owner's pixel tile sheet (`source.png`, 1536×1024, transparent background) cut into its loose parts:
`parts/<group>/<nn>.png`, listed with their source boxes in `parts.json`. Groups follow the sheet's areas
(`groups.json`): terrain, ruins, bridges, scaffolds, trees, flora, rocks, waterfalls, rooms, props, backdrop,
fx and pond. Rebuild with

    python3 scripts/split-alpha-sheet.py docs/asset-review/sanctuary-tiles-v1/source.png docs/asset-review/sanctuary-tiles-v1 docs/asset-review/sanctuary-tiles-v1/groups.json

## In the game

[historical build-tiles.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-tiles.py) halves the terrain block, the big rock block, the bench, the arch lintel, the hanging
moss and three flowers to the game's native scale, makes their repeating middles seamless and packs them into
`assets/tiles-v1/sanctuary.png` (one 64-colour palette, binary alpha; pieces in `atlas.json` and `tiles.js`).
Generated gardens draw their stone ledges, plank ledges, ruin lintels and rock blocks from it
(`MaxStageLayout.draw`, [historical tiles.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/tiles.test.cjs)). The atlas is the Figma layer `340:3` in frame
`13 TILES — production` (`340:2`) of the production page.
