# Garden guardians — native 1×

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
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

## Native authoring

Edit the existing native sheets in [Figma frame 160:2](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Preserve the palette, frame rectangles, anchor, clip timing and gameplay tells, then follow [docs/figma.md](../../docs/figma.md). The master-import and repacking generator has been retired; its [source remains in Git history](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-garden-guardians.cjs).

Original eight-pose and motion sources, prompts, provenance, contact sheets and native atlases remain intact. The current-engine guardian motion review remains available at `/guardian-motion-review.html`.

## Palette and Figma

The art uses the existing dark teal, moss, bark and pale palette, with restrained
purple, frost and kiln accents. New runtime PNGs must be placed in the game's
Figma production section. The sheets live in groups `366:2` and `369:2` inside
current production frame `160:2`; `figma.json` records their nodes and successful
byte-for-byte readback. Until legacy source section `52:2` and the global
manifest are reconciled, the retired pending-art list pins the exact bytes per the
documented workflow. This does not claim a passing global `figma:check`.
