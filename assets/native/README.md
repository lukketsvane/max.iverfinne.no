# MAX: native 1× game sprites

Actual transparent PNGs for `lukketsvane/max.iverfinne.no`, authored on the final
pixel grid. These are not illustrated sheets with a background, labels or grid
lines. The original `index.html` artwork is unchanged.

## Scale contract

The inspected game uses 32×32 player cells, with Max occupying 11×24 visible
pixels in the first idle frame. Its original crow occupies 11×10 pixels in a
20×16 cell. The new robot's idle silhouette is 28×25 pixels; the drone's rotor
span is 31 pixels. Extended arms, cables and water occupy additional space.

One PNG pixel = one game-canvas pixel. Import at scale 1. The game's `resize()`
function already enlarges the ENTIRE canvas by an integer device-pixel factor.
Do not multiply each sprite by that display scale. Never resize each frame to
its visible bounds. Padding is deliberate; anchors stay fixed.

New artwork uses only colours present in the repository's original plant and
crow PNGs. Alpha is 0 or 255. Transparent RGB is zero. No antialiasing, filters,
blur, smooth rotations or blended gradient colours are used in these exports.

## Files

| PNG | Dimensions | Cell | Frames | Origin in cell |
|---|---:|---:|---:|---:|
| watering-robot.png | 512×384 | 64×48 | 64 | 32,44: ground |
| watering-robot-left.png | 512×384 | 64×48 | 64 | 32,44: ground |
| plant-thief-drone.png | 512×384 | 64×48 | 64 | 32,12: body |
| water-fx.png | 512×384 | 64×48 | 64 | 32,44: robot ground |
| water-fx-left.png | 512×384 | 64×48 | 64 | 32,44: robot ground |
| plant-growth.png | 512×768 | 64×96 | 64 | 32,84: soil |
| plant-cargo.png | 512×512 | 64×64 | 64 | 32,48: soil |
| garden-props.png | 512×256 | 64×64 | 32 | 32,56: ground |
| tiny-fauna.png | 128×128 | 16×16 | 64 | 8,14: ground |
| ui-icons.png | 128×32 | 16×16 | 16 | 8,8: centre |
| interaction-fx.png | 256×256 | 32×32 | 64 | 16,24: effect origin |
| crow-original.png | 160×128 | 20×16 | 64 | 10,12: existing game origin |
| drone-with-cargo.png | 512×768 | 64×96 | 64 | 32,12: body |

Every sheet has matching JSON. `frames/<sheet>/<frame>.png` contains individual
untrimmed frames. `manifest.json` lists the sheets and unique-pixel-frame counts.
There are 752 exported cells INCLUDING mirror variants, state variants, an
original crow reference and a precomposited cargo example. This does not mean
752 different objects or 752 newly drawn unique poses. Repeated animation holds
are intentional and counted honestly in the manifest.

`reference/` contains originals, not newly authored assets. Plant growth and
cargo reuse the game's native leaf/flower modules without resizing them; the
stem and small root ball are assembled at 1×. Four original atlas pixels with
alpha below 32 are omitted from the binary-alpha exports; the reference PNG is
untouched. Do not replace the game's procedural tall-plant renderer with these
finite growth-state examples.

## Robot animation rows

Rows 0–7: `idle` (6 fps, loop), `drive` (12, loop), `deploy` (10, once),
`water` (12, loop), `retract` (10, once), `empty` (5, loop), `refill` (8, once),
`sleep` (6, once). Eight cells in each row, left to right.

Feet stay at the same ground line. Wheels rotate without scaling the chassis.
The water is separate: overlay `water-fx/spray` on `watering-robot/water` at the
SAME world position and elapsed time. Its emitter equals that frame's nozzle
socket exactly. Use both `-left` sheets together for the left-facing version.

## Drone animation rows and attachment

Rows 0–7: `hover` (12 fps, loop), `approach` (12, loop), `brake` (12, once),
`lower_claw` (10, once), `grip` (10, once), `lift` (12, once), `carry` (14, loop),
`release` (10, once).

`grip_06` has event `attach_cargo`. `release_04` has `detach_cargo`. These are
metadata cues, not code that removes a real plant. Read the current `claw`
socket and align the selected cargo frame's `grip` socket to it. Draw cargo
behind the drone. Keep cargo separate when carrying the actual plant from a
run. `drone-with-cargo.png` is an optional already-composited fork-plant example.

The adapter resolves and draws frames; the caller owns animation transitions
and delivers each event once, including when its time step skips a frame.

## Other rows

Plant sheets: bell, branch, vine, spray, arch, fork, starburst, cluster. Growth
is a state index, not a looping animation. Cargo supplies two compact growth
sizes and soil-shake variants. UI icons and props are static named sprites.

Tiny fauna: ant, bee, firefly, butterfly, worm, beetle, snail, pillbug; 8 frames
per row. These do not replace the already implemented original NPCs.

Interaction effects: soil burst, growth spark, pickup, alert, falling leaves,
hit, success and empty-water signal. Eight frames per one-shot sequence.

Props, by row:

- Row 0: refill pump, reservoir, hose reel, nozzle stand, charging dock,
  battery crate, repair crate, water tank.
- Row 1: spare wheel, arm module, lantern, signpost, planter, compost bin,
  fence post, trellis.
- Row 2: storage chest, seed box, mug, campfire, garden door, garden terminal,
  beacon, cabinet.
- Row 3: hanging planter, grass edge, soil edge, stone edge, puddle edge,
  short fence, long fence, bouquet tie.

The JSON `spriteNames` gives the exact identifiers for props and UI icons.

## Draw using the actual game's Canvas context

Include `native-sprites.js` and load the PNGs once:

```js
await MaxNativeSprites.load('assets/native/');

const x = Math.round(bot.x - camX);
const y = Math.round(bot.y - camY);
MaxNativeSprites.draw(ctx, 'watering-robot', 'water', bot.stateTime, x, y);
MaxNativeSprites.draw(ctx, 'water-fx', 'spray', bot.stateTime, x, y);

MaxNativeSprites.cargo(ctx, 'carry', drone.stateTime,
  Math.round(drone.x - camX), Math.round(drone.y - camY), 'fork_00');

MaxNativeSprites.draw(ctx, 'garden-props', 'refill_pump', 0, x + 40, y);
```

The adapter keeps source/destination sizes identical, rounds destination
coordinates, disables image smoothing and respects the supplied origins. It
also exposes `resolve()` and `socket()`. The JSON has explicit collision bounds
for the two main actors; visual padding and cargo are not their hitboxes.

## Build, test and inspect

`npm test` runs the game's existing tests and the new asset tests. These verify
native dimensions, palette membership, binary alpha, fixed ground anchors,
mirroring, nozzle alignment, loop/clamp behaviour, event cues and PNG round trips.

`npm run build` regenerates the PNGs and the isolated game-renderer review,
then copies the game and assets into `dist/`. No image libraries are required.
The source of the art is `scripts/build-native-assets.cjs`, including editable
palette entries and pixel matrices. It throws on any clipped visible pixel.

Serve the repository and open `native-asset-review.html`. The left pane is a
copy of the ACTUAL game renderer with the new sprites; saves go only to an
in-memory store. The right pane inspects raw animation frames at integer zoom.
`game-review-offline.html`, when supplied in the download, embeds everything
and can be opened without a server. That file is a review, not the main game.

This is an asset-only addition. It does not replace art in `index.html`, rebalance
the run or secretly add robot/drone AI. `main` is not changed by building it.

`contract-2048/` supplies the earlier exact 2048×2048, 8×8 contract. Native
artwork is padded into 256×256 cells, NOT enlarged. Use the compact sheets for
the actual game; the legacy JSON records the different padded origin.
