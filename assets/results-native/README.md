# Native results assets

The production compositor is `code/max-bouquet.js`, loaded before `run-results.js`. It uses the game's `drawResultPlant` callback to render the actual saved plant records. The build ships the compositor, pixel font, font metadata and native labels.

The independent portrait prototype, duplicate plant renderer and render harness have been retired. Their source remains in [Git history](https://github.com/lukketsvane/max.iverfinne.no/tree/050bc6ce0e31f0d37139297973822224d58a0be8/assets/results-native). Use the current isolated `/review.html` result fixtures and the [Figma asset library](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2).

## Plant and pixel contract

Keep every record's `id`, `kind`, `seed`, maximum `growth`, `stalk` and additional renderer state. Never replace a real run with a small/medium/large fixture bouquet. More than 24 plants produce additional bundles; pagination must retain every record.

The compositor uses a 96×96 canvas with anchor (48,91). It preserves the incoming plant transform and adds 12 pixels of headroom to the game's 64×80 plant frame with baseline (32,65). Eight 120 ms sway frames use whole-pixel offsets above the tie. Draw at integer coordinates with equal source and destination dimensions and smoothing disabled.

The supplied `sprites/`, `metadata/`, preview PNGs and ZIP remain as provenance and design references. The example bouquets are fixtures. `metadata/provenance.json` identifies the original source commit; `metadata/validation.json` records the original export checks. Current runtime art is edited and synchronized through [docs/figma.md](../../docs/figma.md).

## Records and publication

`MaxRunResults.show(options)` receives actual plants and drawing callbacks. `MaxRunRecords` preserves complete finished runs across retry and reload. Global publication is opt-in, requires the captured account owner and preserves complete plant data; the supplied example names are not leaderboard entries.
