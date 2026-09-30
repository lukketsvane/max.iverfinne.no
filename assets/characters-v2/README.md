# Rattus norvegicus, Cairn, Mycel

Three original characters replace the old Moss, Ember and Moon Max
recolours. Rattus norvegicus replaces Kestrel in the runner slot. The saved skin
keys `moss`, `ember`, `moon` remain wire identifiers;
`native-art.mjs` loads these new packs for them. No old recolour PNG ships.

| Character | Role | Silhouette | Palette |
| --- | --- | --- | --- |
| Rattus norvegicus | pro wrestler / runner | grey rat mask, auburn hair, green cone hat, small black/gold halter top and high-cut briefs, short navy cape and gold-trim boots | grey, navy, gold, green, auburn, cyan |
| Cairn | stone tank / bulwark | broad boulder, slab fists, massive short feet | slate, ceramic, amber |
| Mycel | spore support / herbalist | wide cap, luminous gills, root feet | burgundy, ivory, mint |

All eight sheets are native **256×256** PNGs, with **32×32** cells and integer
anchor **(16,31)**. Each character has 128 cells and the original 25 clips;
frame sequences, fps, looping and hit/pour markers are unchanged. Binary alpha,
zero RGB under transparency, no more than 16 opaque colours per character.
Never smooth or enlarge the source pixels inside the world renderer.

The alternate costume `rattle-norvegicus-pink` uses the saved cosmetic key
`moss-pink` for the runner. Its pink/gold cape and ring gear use a separate
sixteen-colour palette; its cells, anchors and all 25 animation timings match
the base outfit. The owner's supplied opaque seven-row sheet is preserved
byte-for-byte as `source/rattus-pink-gold-v1.png` in the review directory.
The compiler removes only its near-white matte, extracts whole connected
figures and applies the same fixed 0.175 nearest-neighbour reduction.
Vertically joined drawings are omitted. Right-facing walk/run poses come from
source rows 1/3; inverted and dropkick poses come from rows 4/5. Planting holds
the complete row 5 column 2 splits through hit frame 6, then recovers to the
same crouch as the stand clip. Base-outfit sheets and other character packs
retain their existing bytes.

Interaction row 5 is a dedicated signature attack for Cairn and Mycel; sowing
keeps row 2. Rattus's wrestling presentation uses the following native cells:

| Move | Sheet | Row | Columns |
| --- | --- | --- | --- |
| Ground dropkick | interaction | 5 | 0–3 |
| Aerial salto | main | 6 | 0–7 |
| Splits descent | interaction | 5 | 4–7 |
| Impact and recovery | main | 5 | 0–7 |
| Planting splits | interaction | 2 | 3–6, within the existing eight-frame sow clip |

The renderer follows the game's wrestling state. Atlas presentation does not
decide hit timing, range, damage or multiplayer authority. Planting holds the
complete wide splits through the existing hit frame 6, then returns to a low
crouch matching the following stand clip.

The built-in image_gen masters, complete prompts, source SHA-256 hashes and
measured row centers live in `docs/asset-review/characters-v2/`. Rattus now uses
the owner's revised black-and-gold masters, `source/rattus-movement-v3.png`
and `source/rattus-combat-v3.png`. Their exact two built-in image_gen prompts are
retained in `source/rattus-wrestler-v3-prompts.json`; the native build does not
depend on the separate colour-variant gallery. One fixed 0.175 nearest-neighbour
reduction applies to every selected pose from both masters. Whole connected
figures preserve boots, hands, wide legs and the rotated hat across imperfect
nominal cell boundaries. Reduction retains separated native pixels belonging
to the same authored figure. Registration rejects any pose taller than its
original foot position, preventing silent top clipping.

The supplied final source rows are clipped and some figures touch the row above.
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
registration log, native/4× contact sheets and 4× animation preview. A fixed
reduction per character preserves pose proportions; connected-body extraction
keeps long tails intact across the generated source's nominal column edges.
Generated source images are never copied to the game build.

Figma synchronization is recorded in `assets/figma-manifest.json`; any files
still awaiting import are pinned in `assets/figma-pending.json`. Rebuilding
byte-matching production files does not recreate pending entries. The initial
character integration used the pending workflow while Figma access was unavailable.
