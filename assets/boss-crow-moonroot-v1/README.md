# Raven + Moonroot — isolated native boss art

This package converts the **two designs selected by the user** into real transparent PNGs. It is not another generated sheet illustration and does not activate or replace any boss in gameplay.

| Atlas | PNG size | Cell / anchor | Named frames |
|---|---|---|---|
| raven.json | raven.png, 384×192 | 48×48 / (24,44) | 32 body poses |
| moonroot.json | moonroot.png, 384×192 | 48×48 / (24,44) | 30 body poses |
| effects.json | effects.png, 256×120 | 32×24 / per effect | 33 effects/sprouts |

Every named frame is also an isolated transparent PNG under `frames/`. The 95 exported frames contain 93 distinct pixel buffers; tiny particles include holds/duplicates. Blank packing cells are not exported.

**One PNG pixel = one native game-canvas pixel. Draw at scale 1.** Body cells include transparent wing/tendril space; visible first idle silhouettes are **27×22 px (raven)** and **19×28 px (moonroot)**, compared with the original Max around 11×24 px. Do not resize or independently recenter cropped poses. All PNG pixels have alpha 0/255, zero transparent RGB and an empty outer border. Preview labels/backgrounds are never in production sprites.

## Existing game adapter

Compatible with `assets/native-atlas.mjs`, audited at main `a24a164f767023e5ee76c44a05c34f4328e2d2a0`, module blob `2bc87a6ada5e2a419536aeb4b1123d5af1fa8eda`.

```js
import { loadAtlas, drawAtlas } from './assets/native-atlas.mjs';
const raven = await loadAtlas('assets/boss-crow-moonroot-v1/raven.json');
// Camera-subtracted foot/hover anchor, in native pixels.
drawAtlas(ctx, raven, 'flight', stateElapsedSeconds, screenX, footY, { facing: 1 });
// Keep actual gameplay tells synchronized through normalized progress.
drawAtlas(ctx, raven, 'windup', 0, screenX, footY, { facing: -1, progress: tellProgress });
```

Serve the repository root and open `/assets/boss-crow-moonroot-v1/preview.html`. It uses that exact adapter, but is a sprite inspection bench, **not a recorded boss fight**. No saves or accounts are accessed.

## Source conversion and separate elements

The lossless source sheets correspond to the user-selected raven and moonflower JPEGs, not later regenerated variants. Sources were illustrations with partial-alpha edges and irregular packing. Actual actor components were isolated separately from loose effects, reduced at one fixed scale per actor (6 source px/native px for raven, 7 for moonroot), palette-constrained without dithering, foot/root registered and packed on exact integer grids. This is deliberate conversion, not lossless recovery of original 1× pixels from an illustration.

Eye highlights were retained; a left-facing raven impact was normalized to right-facing. The long lash was explicitly masked away from its casting body. Source rectangles, component IDs and sockets remain in JSON. The palette has 28 opaque colours: original crow/plant colours, two muted petal midtones and the game's moon colour. Full provenance is under `source/`.

The projectile-only source slot and the slot containing three sprouts are **not full moonroot body frames**. Four individual moon seeds, a long lash, three sprouts, petals, feathers, soil and glow fragments are isolated under `effects`.

## Animation and scope

Raven: idle, move, caw, windup, attack, takeoff, flight, dive, impact, hurt, death, recover. Moonroot: idle, move, windup, lash, slam, attack, summon, hurt, enrage, death, recover. Finite actions stop on their final frame. Timings and `suggestedEvents` are proposals; the simulation owns once-only events, damage, collision, projectiles and co-op synchronization.

Historical user intent was raven level 10 / moonroot level 20. Current main already renders Hollow Crown for all `enemy.boss` objects. Do not silently replace it or route both new bosses through the same existing ID. Read [DEVELOPER_HANDOFF.md](DEVELOPER_HANDOFF.md).

## Rebuild and tests

```sh
python assets/boss-crow-moonroot-v1/export.py
node --test assets/boss-crow-moonroot-v1/test.mjs
```

Python standard library only, no network or generation service. Native masters: `source/pixels.json` (compressed indexed buffers and source registrations). Bootstrap `source/pixels.*.b64` expands to the same JSON if missing. Exporter writes only beneath this folder.

13 asset tests verify exact grids, alpha, gutters, palette, all 95 individual PNGs against atlas crops, body anchors, clip sampling/non-looping death and actual-adapter 1:1 drawing in both directions. No claim that boss AI, encounter progression, collision, co-op or device performance are implemented or tested. Existing runtime, build, original art and deployment configuration are unchanged.
