# Hollow Crown — Ascendant native art

An original, tall silver moon king with a faceless crown, a narrow waist, long
limbs, a hollow cyan core and an oversized rectangular two-handed maul. Its
wounded form has lost the maul and much of its armor. The user explicitly
requested generated sprite sheets and a complete
final boss on 3 October 2026. The game presents this boss at the radioactive
surface sunrise in garden 20.

The standing armored body is roughly 68 native pixels tall, and the wounded
body roughly 67, beside a roughly 24-pixel
player. Transparent padding and weapon arcs are not body size. The runtime
never enlarges this boss separately from the game canvas.

## Registration

`atlas.json` uses `max-native-atlas/v1`. `boss.png` is **768×1728**: six columns
and eighteen rows of **128×96** cells, all anchored at **(64,95)**. The wider
cell preserves the complete maul swing without reducing the body. `effects.png`
is **288×288**: six columns and six rows of **48×48** cells at **(24,46)**.
`chimera.png` is **384×384**: six columns and eight rows of **64×48** cells at
**(32,47)**. Ground chimeras have low, broad plated bodies; flying chimeras have
separate floating armor and trailing tendrils. Their bodies are roughly 30 native
pixels tall, with room for the wider collapse and bolt poses.
Every frame has an integer rectangle, the fixed sheet anchor and measured
`opaqueBounds`. Draw at 1:1 with integer destinations and smoothing disabled.
Mirror the sheet at render time; never trim, stretch, rotate or automatically
center individual frames at runtime.

| Body row | Clip | Intended playback |
| --- | --- | --- |
| 0 | `idle` | Loop |
| 1 | `move` | Loop |
| 2 | `windup` | Follow the actual warning timer |
| 3 | `hammer` | Follow the actual hammer strike |
| 4 | `leap` | Follow the leap |
| 5 | `slam` | Follow impact and landing |
| 6 | `recover` | Recover after attacks |
| 7 | `exposed` | Loop throughout the damage window |
| 8 | `pillar` | Raise the energy pillars |
| 9 | `volley` | Release aimed bolts |
| 10 | `summon` | Stand, lower the maul and kneel for the guardian interlude |
| 11 | `death` | Clamp; last cell is transparent |
| 12–17 | `wounded/idle`, `wounded/move`, `wounded/volley`, `wounded/drain`, `wounded/hurt`, `wounded/death` | Separate weaponless form; last death cell is transparent |

The `intermission` alias loops only the final three genuine kneeling poses of
`summon`. `empowered` plays the six upright `exposed` poses and holds its last
pose for the third-act return and exposure. These aliases select existing
frames; they do not inflate the 192 authored frame count. `hurt` selects
`recover` in the armored form.

Effects rows are `impact`, `wave`, `column`, `bolt`, `seal` and `break`. Every
clip selects six frames. Repeated alias frames are intentional pose holds.
Warning, damage, recovery
and exposure remain simulation events; image frames never determine damage.
Chimera rows are ground `idle`, `move`, `attack`, `death`, followed by the same
four flying clips, keyed `chimera-ground/...` and `chimera-air/...`.
Death clips run at 6 fps and end on a transparent frame; other action clips
run at 10 fps and idle clips at 6 fps.

## Source and reproducibility

The five active generated PNG originals are preserved unchanged in
`docs/asset-review/crown-ascendant-v1/source/pass2/`. The first-pass originals
remain unchanged in `source/`, and the previous native exports, mappings and
provenance are archived in `prior-pass/`. `recipe.json` and
`frame-sources.json` record exact source rectangles, integer translations and
fixed scale within each bank. `scripts/build-crown-art.mjs` uses nearest-neighbor
sampling, a declared 24-color palette and binary alpha threshold 128. Transparent
RGB is zeroed. This is the creation of a new native master, not a rescale of any
existing runtime sheet. Other established runtime PNGs remain unchanged.
Where adjacent generated poses have overlapping rectangles, connected-sprite
isolation removes neighboring poses without cutting the intended sprite. Explicit
translations register each pose's feet; a source bank never changes scale between
frames. Detached projectile art belongs to the effects sheet.

`provenance.json` pins original SHA-256 hashes, native output SHA-1/SHA-256
hashes and atlas/recipe/source-map hashes. `validation.json` records geometry and
pixel checks. The offline guard checks those pins, every opaque bound, all 192
frames and all four transparent death endings. Reproduce a candidate in a
separate directory, preserving the active native masters:

```sh
node scripts/build-crown-art.mjs docs/asset-review/crown-ascendant-v1/recipe.json --output-root /tmp/crown-reproduction
```

## Figma status

**Local generated source; pending authenticated Figma verification.** The
approved native PNGs are frozen while their authenticated import into
file `TC0PHGMTCMR6im4hb3CSbF`, page `10:2`, runtime bosses section `451:4`
is completed. `provenance.json` records the current authority and verification
status. An import is promoted only after actual source node IDs, native
dimensions, image hashes and a fresh ordinary Figma comparison have passed.
After promotion, these three PNGs use the same Figma production guard as every
other runtime sheet; the generated originals remain an audit trail.

The previous unexecuted import script is preserved in `prior-pass/` and
contains only the first-pass bytes. It is historical evidence, not an import
script for the active silver king.
