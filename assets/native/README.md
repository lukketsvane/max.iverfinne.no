# MAX — native 1× pixel assets

Transparent PNG sprite sheets for `lukketsvane/max.iverfinne.no`. No labels, backgrounds or grid lines are baked into the production PNGs. Original `index.html` artwork is unchanged.

## Scale

One PNG pixel = one game-canvas pixel. Import at scale **1**; the game already enlarges its entire canvas for display. Disable image smoothing and draw at integer coordinates. Do not resize individual frames to their visible bounds.

The original Max idle silhouette is **11×24 px**, the crow **11×10 px**. The new robot idle silhouette is **28×25 px**; the drone rotor span is **31 px**. Cell dimensions include transparent space for arms, cable and effects. Artwork uses only colours from the original plant/crow PNGs, with alpha 0 or 255 and zero hidden RGB.

| Sheet | PNG dimensions | Cell | Frames |
|---|---|---|---|
| watering-robot | 512×384 | 64×48 | 64 |
| watering-robot-left | 512×384 | 64×48 | 64 |
| plant-thief-drone | 512×384 | 64×48 | 64 |
| water-fx | 512×384 | 64×48 | 64 |
| water-fx-left | 512×384 | 64×48 | 64 |
| plant-growth | 512×768 | 64×96 | 64 |
| plant-cargo | 512×512 | 64×64 | 64 |
| garden-props | 512×256 | 64×64 | 32 |
| tiny-fauna | 128×128 | 16×16 | 64 |
| ui-icons | 128×32 | 16×16 | 16 |
| interaction-fx | 256×256 | 32×32 | 64 |
| crow-original | 160×128 | 20×16 | 64 |
| drone-with-cargo | 512×768 | 64×96 | 64 |

Matching JSON contains frame coordinates, names, origins, collision bounds, timing and attachment sockets. `frames/` contains separate untrimmed PNGs. `manifest.json` lists unique-frame counts. The 752 exported cells include mirrors, holds, original crow frames and a cargo composite; they are not 752 new unique objects.

## Animation reference

Robot rows 0–7: `idle`, `drive`, `deploy`, `water`, `retract`, `empty`, `refill`, `sleep`. Eight frames per row. Ground origin: **(32,44)**. Overlay `water-fx/spray` on `watering-robot/water` at the same position and elapsed time. Left-facing robot and water sheets must be used together.

Drone rows 0–7: `hover`, `approach`, `brake`, `lower_claw`, `grip`, `lift`, `carry`, `release`. Body origin: **(32,12)**. Align cargo's `grip` socket to the drone's `claw`; draw cargo behind it. `grip_06` marks `attach_cargo`; `release_04` marks `detach_cargo`. The caller owns transitions and delivers events once, even when time steps skip frames.

Plant rows: bell, branch, vine, spray, arch, fork, starburst, cluster. Growth sheets are finite states, not a replacement for the existing procedural tall plants. They reuse original native modules without resizing. Four original atlas pixels below alpha 32 are omitted from binary-alpha exports; `reference/` originals are untouched.

Fauna rows: ant, bee, firefly, butterfly, worm, beetle, snail, pillbug. Props and UI are named in JSON `spriteNames`. Effects use named one-shot sequences.

## Canvas adapter

```js
await MaxNativeSprites.load('assets/native/');
MaxNativeSprites.draw(ctx, 'watering-robot', 'water', stateTime, x, y);
MaxNativeSprites.draw(ctx, 'water-fx', 'spray', stateTime, x, y);
MaxNativeSprites.cargo(ctx, 'carry', stateTime, droneX, droneY, 'fork_00');
```

Include `native-sprites.js` first. The adapter resolves frames and draws at 1:1; it does not add robot/drone gameplay AI or modify saves.

## Build and review

```sh
npm test
npm run build
node scripts/stage-native-assets.cjs
```

Staging regenerates assets and the isolated renderer review, then copies only native assets and review files into `dist/`. It does not replace the game's current bundler, menu/account code or configuration. This extra step is explicit, not installed into the production build command.

Serve the repository and open `native-asset-review.html`. It uses a copy of the actual game renderer with in-memory saves. The separately supplied `game-review-offline.html` embeds dependencies for opening without a server.

The exporter uses Node standard libraries and throws on clipped visible pixels. Tests verify native grids, alpha, palette, fixed anchors, mirror/nozzle alignment, event cues and original crow pixels.

`contract-2048/` contains the earlier exact 2048×2048 sheets: eight by eight 256×256 cells, with native artwork padded rather than enlarged. Prefer the compact sheets for this game.
