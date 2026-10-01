# Rattus norvegicus, Cairn, Mycel

Three original characters replace the old Moss, Ember and Moon Max
recolours. Rattus norvegicus replaces Kestrel in the runner slot. The saved skin
keys `moss`, `ember`, `moon` remain wire identifiers;
`native-art.mjs` loads these new packs for them. No old recolour PNG ships.

| Character | Role | Silhouette | Palette |
| --- | --- | --- | --- |
| Rattus norvegicus | pro wrestler / runner | fully grey fur, muscular hips/thighs, orange hair, pink tail, magenta/gold athletic ring gear without hat or cape; preserved black/gold outfit | grey, magenta, gold, orange; separate base palette |
| Cairn | stone tank / bulwark | broad boulder, slab fists, massive short feet | slate, ceramic, amber |
| Mycel | spore support / herbalist | wide cap, luminous gills, root feet | burgundy, ivory, mint |

All eight sheets are native **256Ãƒâ€”256** PNGs, with **32Ãƒâ€”32** cells and integer
anchor **(16,31)**. Each character has 128 cells and the original 25 clips;
frame sequences, fps, looping and hit/pour markers are unchanged. Binary alpha,
zero RGB under transparency, no more than 16 opaque colours per character.
Never smooth or enlarge the source pixels inside the world renderer.

The default Ring gear costume `rattle-norvegicus-pink` retains the saved
cosmetic key `moss-pink` for the runner. Five final image_gen sheets provide
grey-furred adult rat poses in magenta/gold bra, briefs and boots, with orange
hair, a pink tail, fuller muscular hips/thighs, and no hat, cape or weapons.
The self-contained immutable masters are `source/rattus-ring-v4-01.png`
through `-05.png`; their exact final prompts are preserved in
`source/rattus-ring-v4-prompts.json`. SHA-256 pins and measured source row
centers record all five sources. Each original has 64 complete figures.

All 128 native cells combine grounded strikes, aerial saltos, sweeps, split
planting, high knees and the fifth sheet’s authored walk, run, split-stomp,
leg-scissors, prone recovery and victory cycles. Whole connected bodies at
alpha 240 have positive source-edge padding. A fixed 0.170 nearest-neighbour
reduction applies to every pose: the widest 186-pixel source figure fits one
32-pixel cell at this scale. No individual pose is stretched, cropped or
drawn. The separate sixteen-colour palette has grey fur, orange hair,
magenta gear and gold trim, with binary alpha and zero transparent RGB.

Complete source 01 row 7 splits hold both magenta boots through sow hit
frame 6, then recover to the same crouch as the stand clip. The original 25
clip timings, markers and integer anchors stay intact. Sheet 05 supplies
real walk/run cycles, seated leg-scissors warm-ups and complete prone rest;
care borrows hand-supported reaches because there are no authored garden
tools or lantern. Gameplay attack rules remain in runtime code.
Base black/gold, Cairn and Mycel sheets/atlases retain their existing bytes.
The earlier supplied pink attachment and previous base masters stay
preserved with their existing provenance.

Interaction row 5 is a dedicated signature attack for Cairn and Mycel; sowing
keeps row 2. Rattus's wrestling presentation uses the following native cells:

| Move | Sheet | Row | Columns |
| --- | --- | --- | --- |
| Ground dropkick | interaction | 5 | 0Ã¢â‚¬â€œ3 |
| Aerial salto | main | 6 | 0Ã¢â‚¬â€œ7 |
| Splits descent | interaction | 5 | 4Ã¢â‚¬â€œ7 |
| Impact and recovery | main | 5 | 0Ã¢â‚¬â€œ7 |
| Planting splits | interaction | 2 | 3Ã¢â‚¬â€œ6, within the existing eight-frame sow clip |

The renderer follows the game's wrestling state. Atlas presentation does not
decide hit timing, range, damage or multiplayer authority. Planting holds the
complete wide splits through the existing hit frame 6, then returns to a low
crouch matching the following stand clip.

The built-in image_gen masters, complete prompts, source SHA-256 hashes and
measured row centers live in `docs/asset-review/characters-v2/`. The preserved base outfit uses
the owner's revised black-and-gold masters, `source/rattus-movement-v3.png`
and `source/rattus-combat-v3.png`. Their exact two built-in image_gen prompts are
retained in `source/rattus-wrestler-v3-prompts.json`; the native build does not
depend on the separate colour-variant gallery. One fixed 0.175 nearest-neighbour
reduction applies to every selected pose from both masters. Whole connected
figures preserve boots, hands, wide legs and the rotated hat across imperfect
nominal cell boundaries. Reduction retains separated native pixels belonging
to the same authored figure. Registration rejects any pose taller than its
original foot position, preventing silent top clipping.

The base outfit mastersâ€™ final source rows are clipped and some figures touch the row above.
No runtime frame uses source row 7. Complete splits come from combat row 6;
standing, crouching and recovery use complete earlier rows. The compiler rejects
the vertically joined figures rather than inventing missing boots. Idle uses
guard poses, walk uses right-facing weight shifts, and run uses the movement
master's right-facing run row. The sources have no authored gardening tools,
lantern or complete prone rest sequence; those clips reuse crouch, reach,
raised-arm and resting crouch poses. `registration.json` records each runtime
cell's exact source file, row and column. The v2 ring-gear masters and prompts,
earlier rat-wizard, wrestling and retired Kestrel masters remain preserved with
their provenance.
Run `python scripts/build-characters-v2.py` to reproduce the PNGs, atlases,
registration log, native/4Ãƒâ€” contact sheets and 4Ãƒâ€” animation preview. A fixed
reduction per character preserves pose proportions; connected-body extraction
keeps long tails intact across the generated source's nominal column edges.
Generated source images are never copied to the game build.

Figma synchronization is recorded in `assets/figma-manifest.json`; any files
still awaiting import are pinned in `assets/figma-pending.json`. Rebuilding
byte-matching production files does not recreate pending entries. The initial
character integration used the pending workflow while Figma access was unavailable.
