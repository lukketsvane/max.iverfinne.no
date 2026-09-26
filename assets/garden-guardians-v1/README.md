# Garden guardians — native 1×

Sixteen generated boss designs join Mossback, Bellkeeper, Moon Moth and Hollow
Crown. The main garden has 20 distinct configured guardians, one per stage.
`run-director.inc.js` owns attacks, phases and rewards; art never applies damage.

## Authored motion

Each guardian motion sheet contains **32 authored drawings**: four consecutive
poses for each of idle, move, windup, attack, recover, vulnerable, hurt and death.
The built-in image-generation tool created transparent 4-column, 8-row masters
using the creature's existing design as a reference. `motion-prompts.json`
records the complete prompts and original generated master paths;
`motion-inputs/<id>.json` is the editable per-creature import record.
`provenance.json` pins each generated master by SHA-256 and records its single
scale, four fixed column origins and eight row baselines.

`source/motion/<id>.png` stores the reproducible native 128×256 source. The
runtime atlas is 128×288: the 32 source drawings, copied pixel for pixel, followed
by a transparent terminal death frame. The extra final row is transparent
padding, not four more authored drawings. Import rejects empty poses or a row
that becomes repeated drawings after native reduction.

Every cell is 32×32 with the fixed anchor (16,31), facing right. All 32 drawings
share one scale and fixed column origins; each state's four drawings share a
ground baseline. The complete motion envelope fits within 30×31 native pixels,
leaving a pixel at both sides and above the tallest pose. Transparent gaps locate
the eight source rows, and connected
shapes are assigned whole to their source column, preserving long limbs that
cross an imaginary grid boundary. Generated spacing between rows is removed;
an extended limb is never independently recentered or enlarged to fill its cell.
Runtime drawing uses integer anchors,
1:1 pixels and disabled smoothing. Alpha is binary, and transparent RGB is zero.
The atlas records the exact palette and opaque bounds for every frame.

Idle runs at 4 fps, locomotion at 8 fps and vulnerability at 5 fps. The game's
actual windup and attack timers choose their frames; artwork cannot advance an
attack or its damage. Recovery and hurt have their own drawings, and the four
collapse poses finish before the transparent death frame. Amber is confined to
windup; cyan is confined to vulnerability.

## Import and reproduce

Sharp is required for authoring. Import one generated master and repack:

```sh
node scripts/build-garden-guardians.cjs --motion-import --id=sprout-sentinel
```

Omit `--id` to import every available motion record. A record has this shape:

```json
{"id":"sprout-sentinel","source":"/absolute/generated/master.png","prompt":"Full generation prompt","grid":[4,8]}
```

Reproduce all runtime atlases from the checked-in native sources, without the
large generated masters:

```sh
node scripts/build-garden-guardians.cjs
```

The generator also updates the contact sheet, manifests and exact pending
Figma byte pins. Only run one importer at a time. A selected `--id` restricts
master import, while the final repack includes the full roster.

The original eight-pose sources remain in `source/<id>.png`, with their original
prompts in `prompts.json`. `--import` reimports those original masters. Creatures
with no motion source retain the old 256×256 fallback atlas: eight authored
poses repeated across held rows, honestly distinct from the new 32-pose motion
sheets. An existing motion source always takes precedence during packing.

## Palette and Figma

The art uses the existing dark teal, moss, bark and pale palette, with restrained
purple, frost and kiln accents. New runtime PNGs must be placed in the game's
Figma production section. The sheets live in groups `366:2` and `369:2` inside
current production frame `160:2`; `figma.json` records their nodes and successful
byte-for-byte readback. Until legacy source section `52:2` and the global
manifest are reconciled, `assets/figma-pending.json` pins the exact bytes per the
documented workflow. This does not claim a passing global `figma:check`.
