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
The original exporter is preserved in Git history.

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

## Runtime and authoring

`companion.js` owns the live companion's movement, watering and upgrades. `scripts/build-companion.cjs` reads the existing native frame metadata and emits its runtime animation catalogue. The old standalone `MaxNativeSprites` adapter and candidate atlas bench were retired after integration; use `/review.html` for current-engine comparisons with isolated storage.

Edit native masters in [Figma frame 160:2](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2), preserving these anchors, frame rectangles, palette and binary transparency. Follow [docs/figma.md](../../docs/figma.md), then run `npm test`, `npm run build` and `npm run figma:check`. Source PNGs, metadata and historical export evidence remain intact.
