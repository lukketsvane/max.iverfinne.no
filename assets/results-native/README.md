# MAX portrait results: native asset pack

This pack is based on the **actual game** in `lukketsvane/max.iverfinne.no`, commit
`cca0f5c46ca2a2e55bdae52569984f44499d4b11`. The generated concept pictures are not
used as game textures. Plant frames are rendered from the original PNG atlas
and the repository's own plant drawing functions, with a new integer-pixel
compositor gathering them into bouquets.

Open `MAX_native_preview.html` for the English portrait screens, animated
bundles, source-size comparisons, and a way to load a saved run's plant JSON.
Everything runs locally; it does not send the file anywhere.

## Import these files

| File | Canvas | Grid / frame | Grounding anchor |
|---|---:|---|---|
| `sprites/plant-atlas-native.png` | 512 × 118 | Original `PA` coordinates | Original source anchors |
| `sprites/plant-parts-trimmed.png` | See JSON | 167 tightly cropped construction parts | Per-frame JSON |
| `sprites/plants-growth.png` | 576 × 480 | 9 columns × 5 rows; 64 × 96 | 32, 77 |
| `sprites/bouquets-static.png` | 384 × 192 | 4 columns × 2 rows; 96 × 96 | 48, 91 |
| `sprites/bouquets-sway.png` | 768 × 384 | 8 columns × 4 rows; 96 × 96 | 48, 91 |
| `sprites/bouquet-reveal.png` | 768 × 96 | 8 columns × 1 row; 96 × 96 | 48, 91 |
| `sprites/ui-controls.png` | See JSON | Buttons, ties, selection and navigation marks | Per-frame JSON |
| `sprites/ui-labels-en.png` | See JSON | English labels | Top left |
| `sprites/font-5x7.png` | 96 × 32 | 16 columns × 4 rows; 6 × 8 | 5 × 7 glyph, advance 6 |

`individual/` contains separate transparent PNGs. `metadata/` contains exact
source rectangles, frame coordinates, anchors, animation timing and sample
plant records. Coordinates use a top-left origin. Every new sprite pixel is
fully transparent or fully opaque. No fractional texture scaling is required.

**Import at 1×.** Use nearest-neighbour texture filtering, integer placement,
and `ctx.imageSmoothingEnabled = false`. The game derives its display scale
from approximately 150 art pixels across the short viewport edge. The 4×
images in `preview/` are inspection enlargements, not replacement textures.

The existing game result callback has a 64 × 80 frame and a 32, 65 baseline.
The new plant sheet adds 12 pixels of headroom, moving its baseline to 32, 77
inside a 64 × 96 frame. This preserves flower heads above the old result frame
without shrinking a leaf or changing a plant's native scale.

## The score is the saved plants

Use the actual `rogueRun.garden` records:

```js
{ id: 1, kind: 5, seed: 123, growth: 1.7, stalk: false }
```

Keep `id`, `kind`, `seed`, `growth` and `stalk`. The current game records each
plant's maximum growth and retains it across worlds. The result presentation
uses the same bounded height as the game's result renderer, rather than
trying to fit an infinite beanstalk on a phone.

**The example bouquets are fixtures, not score tiers.** Never replace a real
run with a generic small/medium/large image. Generate the bouquet from the
record array. The compositor preserves every plant; more than 24 plants make
additional bundles. Provide previous/next navigation or a scrollable gallery
for those bundles. Do not silently draw only the first bundle.

No numeric score or rank is shown in the screen designs. Numerical metadata
remains necessary for frame coordinates, IDs, sorting and animation timing.

## Connect to the existing game

Load `code/max-bouquet.js` before `run-results.js`. The compositor accepts the
game's existing `drawPlant` callback, which is currently `drawResultPlant`.
The current `MaxRunResults.show(options)` API already receives both this
callback and the saved plants.

```js
const frameCanvas = document.createElement('canvas');
const result = MaxBouquet.render(frameCanvas, options.plants, {
  drawPlant: options.drawPlant,
  bundle: currentBundle,
  frame: Math.floor(animationMilliseconds / 120) % 8
});

// Draw the 96 × 96 result at an integer location. Do not scale it per player.
ctx.imageSmoothingEnabled = false;
ctx.drawImage(frameCanvas, Math.round(x - 48), Math.round(groundY - 91));

// result.bundleCount drives non-numerical pagination.
// result.visibleIds identifies the records present in this bundle.
```

The callback should preserve the incoming canvas transform. The current
repository callback does. The compositor translates it by 12 pixels to keep
flower crowns intact, then gathers whole scanlines by integer offsets.

For an independent tool, load `code/max-plant-native.js`, create an image from
`sprites/plant-atlas-native.png`, and use:

```js
await atlasImage.decode();
const renderer = MaxPlantNative.create(atlasImage);
MaxBouquet.render(frameCanvas, savedPlants, {
  drawPlant: (canvas, record) => renderer.drawPlant(canvas, record, 0)
});
```

Sway sheets use eight 120 ms frames and loop. Their anchors and stem ends
stay fixed; only whole-pixel offsets above the tie change. Reveal uses eight
120 ms frames, does not loop, and holds on the complete example bouquet.
For a real run, build its reveal from that run's own records.

The current build script copies only `index.html`, `run-results.js`, and
`run-results.css`. If importing external assets, also copy the required
`sprites/`, `metadata/` and `code/` files into the static build, or embed them.
No npm runtime dependencies are required for the browser compositor.

## Global leaderboard boundary

The portrait leaderboard uses **example names and plant records**. The
inspected repository revision has local personal-best storage; it does not
have a global leaderboard service. This asset pack provides the visuals and
record-driven renderer, not a deployed leaderboard or account system. A
future backend should return each player's saved plant records in its chosen
ranking order. The renderer must not invent or substitute those records.

## Verification and provenance

`metadata/provenance.json` identifies the source commit, original image sizes
and hashes of the copied rendering functions. `metadata/validation.json`
records frame bounds, binary alpha, palette, shared anchors, full-run
retention, and exact 4× nearest-neighbour previews.

The source renderer was executed locally using a software context for its
integer Canvas operations, and the exported images were inspected directly.
Live browser verification was blocked by the browser's local-file policy.

The only normalization in the source plant-atlas copy thresholds four
partial-alpha pixels at 128; all RGB colours remain unchanged. New rendered
sprites use the original plant/stem/UI colour palette and binary alpha.
Unmodified files under `reference/` are the actual embedded source images;
some, notably the existing player sheet, already contain partial alpha.

The Git delivery lives under `assets/results-native/`. The complete ZIP contains
every individual PNG and the unmodified reference files. The runtime sheets,
metadata, compositor and preview are also available directly in that folder.
This is an asset-pack delivery; integration into the live result screen is a
separate step.
