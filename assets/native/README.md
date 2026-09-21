# MAX — renderer-matched native kit

This kit replaces the earlier **rover draft assets**, not the original game's
artwork. The earlier 64×48 / 80×48 frames and arbitrary screenshot downscaling
are not the contract used here. No generated concept screenshot is an input.

## Ground truth

Audited repository: `lukketsvane/max.iverfinne.no`.
Source commit: `cca0f5c46ca2a2e55bdae52569984f44499d4b11`.

- `index.html`, `resize()` (lines 108–124): one native art pixel maps to an integer
  block of device pixels; the short viewport dimension is roughly 150 art pixels.
- `CELL = 32` (line 78); `drawPlayer()` (line 4601): 32×32 source frames are drawn
  1:1, with `dx = px - 16`, `dy = py - 31`. The standing Max image has an alpha
  bounding box of 11×24 pixels, not a 32-pixel-tall visible figure.
- The crow atlas has 20×16 cells with its own (10,12) anchor. Its frame size is
  not an instruction to resize every creature to the same height.
- `PLANT_STEM`, `C`, and `FLOWER` supply this kit's 15 visible colours. The build
  rejects any palette entry that does not occur in the original game source.
- Existing `drawGrowingFigmaPlant()` and `drawResultPlant()` remain the way to
  depict the player's actual plants, including run results. Do not replace them
  with a painted collection screen or precomposed bouquet.

## Import files

| Sheet | Pixel dimensions | Cell | Frames | Purpose |
|---|---:|---:|---:|---|
| `rover.png` | 256×192 | 32×32 | 48 | One robot, eight animation states |
| `water-fx.png` | 128×32 | 16×16 | 16 | Spray, splash and refill stream |
| `props.png` | 128×64 | 32×32 | 8 | Four reservoir levels, two docks, two seed crates |
| `ui.png` | 128×16 | 16×16 | 8 | Optional interface symbols, not world objects |

The companion JSON files specify exact pixel rectangles, frame order, timing,
looping, anchors and per-pose nozzle positions. The atlas rows are packing rows;
**read the animation lists, rather than assuming one animation per row.**
The downloadable ZIP includes every individual frame under `frames/`; running
`python scripts/native-assets/build.py` regenerates those individual PNGs too.

## Robot contract

The anchor is the **ground pixel `(16,31)`**, exactly matching Max's draw offset.
The bottom wheel pixels occupy row 31 in every frame. Do not trim, auto-centre,
scale, stretch, or rotate whole frames. Visible size is smaller than the cell:
roughly 25–29 px wide and 20–22 px high depending on arm pose.

Art faces left. Draw right-facing poses by mirroring the same sheet. This avoids
a second independently generated design. PNG alpha is strictly 0/255. No labels,
checkerboard, shadow, background, bloom, or gradients are baked into the atlases.
Normal game lighting should be applied after drawing the robot with other actors.

States: idle (4), drive (8), deploy (6), water (8), retract (6), dry (4), refill (8),
sleep (4). Deploy, retract and refill are non-looping and hold their final frame.
The rig uses fixed 8px/6px arm segments, with joint positions quantised to pixels.
Some hold/reverse poses intentionally repeat; 48 frames is not a claim of 48
independently drawn characters. Spray is separate and registered to `emitter`.

## Canvas integration

Load `assets/native/runtime.js` before the main game script. Await:

```js
const native = await new MaxNativeSprites().load('assets/native/');
```

Inside the existing renderer, after camera positioning and before post-lighting:

```js
const pose = native.drawRover(ctx, {
  x: robot.x - camX,
  y: surfaceY(robot.x) - camY,
  animation: robot.animation,
  seconds: robot.animationTime,
  facing: robot.face // -1 left, +1 right
});
if (robot.animation === 'water') {
  native.drawSpray(ctx, pose.emitter, robot.animationTime, robot.face);
}
```

These are **art-pixel coordinates**, not CSS pixels. Do not multiply by SCALE or
DPR here; `resize()` already controls presentation. The loader disables smoothing
only for its draw and restores canvas state afterwards. It rejects missing sheets,
invalid rectangles, unknown states and invalid coordinates.

## Preview and scope

Serve the repository and open `/native-assets.html`. The page reads the actual
`index.html`, inserts one render hook in an isolated iframe, and supplies explicit
test plants. It uses the original terrain, player, plant renderer, crow and
post-lighting. The fixture has its own in-memory storage, not the player's saves.
`index.html` is unchanged. The source hook fails explicitly if its target changes.

This is an **asset and renderer integration**, not a finished autonomous watering
feature. Pathfinding, terrain collision, water consumption, unlocking and gameplay
balance are intentionally not added. The preview animation does not award growth
or change the player's run. Main and the live game are not modified by this branch.

## Build and checks

`python scripts/native-assets/build.py` regenerates all PNG/JSON/frame files
(requires Pillow). `npm test` runs the existing game tests plus the native asset
contract tests. `npm run build` includes the isolated preview and sprite files.
`validation.json` records pixel-level build checks. Browser proof images and the
browser test report are included in the downloadable package, under `previews/native`.
