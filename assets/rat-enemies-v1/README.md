# Rat enemies — integrated runtime assets

Four game enemies, not a concept-board image. `rat-enemies.inc.js` implements
kind **8**; `native-art.mjs` loads these atlases and the production build copies
the four `sprites.png` / `atlas.json` pairs and the manifest.

| Variant | Role | Base speed | Additional health | Bite multiplier |
|---|---|---:|---:|---:|
| Common | Ground attacker | 32 | 0 | 1.0 |
| Black | Fast flanker | 46 | 0 | 0.8 |
| Albino | Slow, tougher attacker | 25 | 2 | 1.4 |
| Plague | Bite plus delayed green pulse | 30 | 1 | 0.85 |

Rats appear in all six existing enemy formations, from the first garden.
Black rats unlock at garden 2 or 75 elapsed seconds, albinos at garden 4 or
180 seconds, plague rats at garden 7 or 300 seconds. They use existing raid,
patrol and trial population limits: this integration does not add an unlimited
spawn loop or replace the milestone bosses.

## Native image contract

Each variant has a **384 × 160** transparent PNG: eight columns, five rows,
**48 × 32** cells, fixed **(28, 28)** foot anchor. These are padded rectangular
cells, not 48-pixel-tall rats. Draw 1:1 into the native game canvas, at rounded
coordinates, using the existing nearest-neighbour atlas adapter.

There are **38 extracted poses** per variant plus one fully transparent
terminal death frame: **156 isolated PNGs** across the four variants.
The final unused sheet cell is transparent. State clips: idle, walk, run,
jump, windup, attack, recover, hurt, death; `move` aliases run. Windup/recovery
reuse documented source poses instead of inventing new unique frames.
Each variant has 15 opaque palette entries and alpha 0/255 only.

The source is the rat sheet supplied in the conversation, with its SHA-256
and source rectangles recorded in `source-poses.json`. Its smoky background
and labels are **not** game assets. Foreground masks, a uniform 4:1 sampling
lattice, fixed foot registration and undithered palette quantization were
used. One broken source contour was repaired from its visible boundary;
the red eye was preserved on the native grid. Detached hurt stars were omitted.
The other variants are palette substitutions of the same isolated geometry,
not 114 additional independently drawn poses.

`source-poses.json` stores the final isolated indexed pixels. Rebuild all
PNG/JSON files with Python's standard library:

```sh
python3 scripts/build-rat-assets.py
node --test tests/rat-assets.test.cjs tests/rat-enemies.test.cjs
npm test
npm run build
```

## Runtime behaviour

Rats run along terrain, paddle at pond surfaces, fall off edges and jump
through one-way ledges to land above. When pursuing a player above them, they
approach a real route entrance rather than waiting below an unreachable top.
Ground rats target living garden plants; raised trial rats defend their route
and pursue nearby players. They use the game's existing player knockback /
garden-health rules; this change does not invent a separate player health bar.

Bites have a **0.6-second amber windup**, a **0.22-second lunge** and a recovery
window. The aim is locked when warned. Hits require the rat and target to
remain within horizontal and vertical reach. A jump, dodge or interruption
can prevent contact. Plague rats create one separately warned green pulse
with a **0.7-second** delay, not damage applied every frame. Damage and dodge
stagger cancel uncommitted attacks and their pending warning. Time increases
movement and existing game damage/durability, not the warning speed.

Bomb hit tests use the torso, not the tail or the transparent cell rectangle.
Deaths remove the enemy and award the existing rewards once; the native corpse
is a separate clamped animation and never holds a raid open. Rat defeat uses
dust rather than bird-feather particles. No new gameplay HUD is added.

## Co-op, ownership and review

Only the host runs rat AI, damage, spawning and rewards. Existing snapshots
carry variant, state, state time, attack timers, locked aim and footing.
Guests extrapolate at most 120 ms with the same footing code; they do not
create their own bites or damage. A disappearing rat creates one local death
animation on a same-stage guest snapshot. Retry and stage travel clear the
existing enemy/hazard state; completed-run garden data is unchanged.

`review.html?mode=rats&portrait=1&class=runner` is a playable fixture with all
four variants, normal controls and isolated in-memory garden data. It is not
a prerecorded animation or a replacement for the normal game's spawn tables.
Use B to defend, X to dodge, Up to jump and Down/Space to tend. `Reset scene`
restarts the encounter. The same fixture works in landscape.

Existing original Max, costumes, class powers, companion artwork, bosses,
menus, accounts, full-run bouquets and soundtrack are preserved.
