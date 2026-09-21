# MAX — watering robot: native pixel assets

Start with `sprites/rover_idle_left.png` (45 × 31 pixels), or the aligned animation sheets in `atlases/`.
`preview.html` is a self-contained, offline animation inspector. It is not a game implementation.

## What is in this pack

- Twenty tightly cropped standalone PNG sprites: the rover in five states and both directions, water tank, refill station, charging dock, watering-can pickup, seed pod, three seedlings, wet-soil patch and splash.
- Ninety-six separate aligned rover animation PNGs: six eight-frame animations in each direction.
- Two 640 × 288-pixel rover sprite sheets, plus frame-by-frame JSON and animation tags.
- Separate arm, wheel, tank, water-spray, water-drop and splash animations.
- Eight transparent 16 × 16 UI icons: water, seed, rover, repair, charge, garden, play and pause.
- Four small reference extractions in `source/`, and cleaned movable pieces in `parts/`.

## Raster contract

Production PNGs are native-resolution RGBA. Every alpha value is either 0 or 255. Fully transparent pixels also have zero RGB values. All opaque production pixels use the included 32-colour palette. No checkerboard, scenery, baked drop shadow, interpolation or semi-transparent edge pixels are in the production sprites.

The complete rover is 31 pixels tall. Its occupied width varies with the arm: 33 pixels folded, 45 pixels idle, and 51 pixels extended. The standard animation canvas is **80 × 48 pixels**, including transparent motion space. This padding is NOT extra sprite scale.

Both left and right animation frames use the exact same fixed ground anchor: **(40, 44)**, measured from the frame's top-left. Wheel bottoms occupy row 43. The foreground artwork is never resized between frames. Crop origins and adjusted anchors for the standalone sprites are recorded in `manifest.json`.

## Rover sheet layout

Each sheet has eight columns and six rows. Every cell is 80 × 48 pixels.

| Row | Animation | Frames | Suggested rate | Playback |
|---|---|---|---|---|
| 0 | idle | 0–7 | 8 fps | loop |
| 1 | drive | 8–15 | 12 fps | loop |
| 2 | deploy | 16–23 | 12 fps | once |
| 3 | water | 24–31 | 12 fps | loop |
| 4 | retract | 32–39 | 12 fps | once |
| 5 | refill | 40–47 | 6 fps | once |

For column `c` and row `r`, source rectangle = `(c*80, r*48, 80, 48)`.

The water row includes animated spray. The other rows do not. Standalone `rover_water_left.png` and `rover_water_right.png` are robot-only poses; the aligned separate spray overlays can be used with these through the anchors in the manifest. Do not overlay the spray again on the water-animation row.

Refill is a non-looping progression from empty to full. Switch to idle after its last frame. Empty and sleeping rover poses are supplied separately; they are not filler rows in the main atlas.

## Canvas drawing example

```js
// img: loaded rover_left_640x288.png or rover_right_640x288.png
// x, y: desired ground anchor in the game world
// col: 0..7; row: 0..5; zoom: integer display scale
ctx.imageSmoothingEnabled = false;
ctx.drawImage(img, col * 80, row * 48, 80, 48,
  Math.round(x - 40 * zoom), Math.round(y - 44 * zoom),
  80 * zoom, 48 * zoom);
```

When rendering at the engine's native resolution, use `zoom = 1` and integer world/screen coordinates. Scale the final canvas by an integer with nearest-neighbour/pixelated display. For trimmed sprites, use that sprite's own anchor from `manifest.json` rather than the animation-frame anchor.

## Construction and reference

The robot design comes from the supplied rover reference image. Chassis, reservoir, planter and arm areas were explicitly masked and sampled down, then cleaned/rebuilt on the native pixel grid. The restrained botanical greens come from the supplied actual asset atlas `IMG_3027(2).png`. The wheels, arm poses, effects, support props and small UI symbols are new raster work.

`source/` contains the intermediate native-sized extracted reference parts, not the full original reference image. `previews/` contains enlarged inspection images/GIFs only; never import previews as native textures. The scale-comparison preview includes a supplied plant fragment as a reference, not as a newly made asset.

Dimensions, palette, alpha, anchors, frame extraction and exact left/right reflection were checked by `validation.json`. These assets have NOT been installed in, or tested against, the live game/repository. The frame size and anchor are this pack's export contract, not an assertion about undocumented engine requirements.
