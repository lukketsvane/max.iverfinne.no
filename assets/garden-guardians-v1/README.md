# Garden guardians — native 1×

Eight generated boss designs join Mossback, Bellkeeper, Moon Moth and Hollow
Crown. The main garden has 20 configured encounters, including later remixes.
`run-director.inc.js` owns attacks, phases and rewards; art never applies damage.

## Source and registration

The built-in image-generation tool created eight-pose transparent source sheets.
`prompts.json` records the complete prompts and original workspace paths.
`source/<id>.png` stores the native reductions used to reproduce the atlases.
`scripts/build-garden-guardians.cjs --import` imports the generated masters;
subsequent runs without `--import` only repack these checked-in native sources.
The script requires Sharp (available in the authoring runtime).

Runtime sheets are 256×256, with 32×32 cells and fixed anchor (16,31), facing
right. No runtime scaling, smoothing, floating coordinates or moving anchors.
All pixels have binary alpha; transparent pixels have RGB zero. Each atlas
declares its exact palette and frame opaque bounds.

Rows: idle, move, windup, attack, recover, vulnerable, hurt, death. Eight cells
per row include deliberate held poses. Source walk and idle poses alternate;
anticipation and attack follow actual gameplay timers. Amber is confined to
windup, cyan to vulnerability. Final death cell is empty. These are eight
authored poses per creature, not 64 unique drawings.

The new art uses the existing dark teal, moss, bark and pale palette, with
restrained purple, frost and kiln accents. New runtime PNGs must be placed in
the game's Figma production section. The sheets are now in group `366:2`
inside current production frame `160:2`; `figma.json` records their nodes and
successful byte-for-byte readback. Until the legacy source section `52:2` and
global manifest are reconciled, `assets/figma-pending.json` pins the exact bytes
per the documented workflow. This does not claim a passing global figma:check.
