# Raven + Moonroot — isolated native boss art

This package converts the **two designs selected by the user** into real transparent PNGs. It is not another generated sheet illustration and does not activate or replace any boss in gameplay.

| Atlas | PNG size | Cell / anchor | Named frames |
|---|---|---|---|
| raven.json | raven.png, 384×192 | 48×48 / (24,44) | 32 body poses |
| moonroot.json | moonroot.png, 384×192 | 48×48 / (24,44) | 30 body poses |
| effects.json | effects.png, 256×120 | 32×24 / per effect | 33 effects/sprouts |
| megasheet.json | megasheet.png, 384×504 | grouped native grids | **all 95 assets** |

Every named frame is also an isolated transparent PNG under `frames/`. The megasheet is the single-file handoff requested by the user: raven first, larger Moonroot second, effects/sprouts last. Blank packing cells stay transparent.

**One PNG pixel = one native game-canvas pixel. Draw at scale 1.** Body cells include transparent wing/tendril space. Visible first-idle silhouettes are **27×22 px (raven)** and now **25×37 px (Moonroot)**, compared with original Max around 11×24 px. Moonroot was deliberately enlarged after the user said the boss should be larger, while retaining the same 48×48 cell and fixed foot anchor (24,44). Do not independently fit artwork to cell bounds or recenter cropped poses.

All PNG pixels have binary alpha, zero transparent RGB and an empty outer border. Preview labels/backgrounds are never baked into production sprites.

## Existing game adapter

Compatible with `assets/native-atlas.mjs`, audited at main `a24a164f767023e5ee76c44a05c34f4328e2d2a0`, module blob `2bc87a6ada5e2a419536aeb4b1123d5af1fa8eda`.

```js
import { loadAtlas, drawAtlas } from './assets/native-atlas.mjs';
const raven = await loadAtlas('assets/boss-crow-moonroot-v1/raven.json');
drawAtlas(ctx, raven, 'flight', stateElapsedSeconds, screenX, footY, { facing: 1 });
drawAtlas(ctx, raven, 'windup', 0, screenX, footY, { facing: -1, progress: tellProgress });
```

Serve the repository root and open `/assets/boss-crow-moonroot-v1/preview.html`. It uses that exact adapter, but is a sprite inspection bench, **not a recorded boss fight**. No saves or accounts are accessed.

## Source conversion and Moonroot enlargement

The lossless source sheets correspond to the user-selected raven and moonflower JPEGs, not later replacement designs. Sources were illustrations with partial-alpha edges and irregular packing. Actor components were isolated separately from loose effects, palette-constrained without dithering, foot/root registered and packed on exact integer grids.

The native extraction master remains reproducible. Raven keeps its extracted native size. Moonroot output is enlarged **4:3 around the fixed foot anchor with nearest-neighbour indexed pixels** so the late-game boss reads substantially larger without changing cell size, smoothing, palette or game-canvas scale. Sockets are transformed by the same anchor-relative rule. This enlargement is deterministic in `export.py`.

Eye highlights were retained; a left-facing raven impact was normalized to right-facing. The long lash was explicitly masked away from its casting body. The projectile-only source slot and the slot containing three sprouts are **not full Moonroot body frames**. Four individual moon seeds, a long lash, three sprouts, petals, feathers, soil and glow fragments are isolated under `effects`.

## Animation and scope

Raven: idle, move, caw, windup, attack, takeoff, flight, dive, impact, hurt, death, recover. Moonroot: idle, move, windup, lash, slam, attack, summon, hurt, enrage, death, recover. Finite actions stop on their final frame. Timings and `suggestedEvents` are proposals; the simulation owns once-only events, damage, collision, projectiles and co-op synchronization.

Historical user intent was raven level 10 / Moonroot level 20. Current main already renders Hollow Crown for all `enemy.boss` objects. Do not silently replace it or route both new bosses through the same existing ID. Read [DEVELOPER_HANDOFF.md](DEVELOPER_HANDOFF.md).

## Rebuild and tests

```sh
python assets/boss-crow-moonroot-v1/export.py
node --test assets/boss-crow-moonroot-v1/test.mjs
```

Python standard library only, no network or generation service. Native masters: `source/pixels.json` (compressed indexed buffers and source registrations). Bootstrap `source/pixels.*.b64` expands to the same JSON if missing. Exporter writes only beneath this folder and deterministically rebuilds `megasheet.png` and `megasheet.json`.

13 asset tests verify exact grids, alpha, gutters, palette, all 95 individual PNGs against atlas crops, body anchors, clip sampling/non-looping death and actual-adapter 1:1 drawing in both directions. The export workflow also completed successfully after the larger Moonroot/megasheet update. No claim that boss AI, encounter progression, collision, co-op or device performance are implemented or tested. Existing runtime, build, original art and deployment configuration are unchanged.
