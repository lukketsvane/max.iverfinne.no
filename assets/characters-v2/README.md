# Rattus norvegicus, Cairn, Mycel

Three original characters replace the old Moss, Ember and Moon Max
recolours. Rattus norvegicus replaces Kestrel in the runner slot. The saved skin
keys `moss`, `ember`, `moon` remain wire identifiers;
`native-art.mjs` loads these new packs for them. No old recolour PNG ships.

| Character | Role | Silhouette | Palette |
| --- | --- | --- | --- |
| Rattus norvegicus | pro wrestler / runner | unsettling grey rat mask, auburn hair, green cone hat, navy robe with gold trim and wide wrestling boots | grey, navy, gold, green, auburn, cyan |
| Cairn | stone tank / bulwark | broad boulder, slab fists, massive short feet | slate, ceramic, amber |
| Mycel | spore support / herbalist | wide cap, luminous gills, root feet | burgundy, ivory, mint |

All six sheets are native **256×256** PNGs, with **32×32** cells and integer
anchor **(16,31)**. Each character has 128 cells and the original 25 clips;
frame sequences, fps, looping and hit/pour markers are unchanged. Binary alpha,
zero RGB under transparency, no more than 16 opaque colours per character.
Never smooth or enlarge the source pixels inside the world renderer.

Interaction row 5 is a dedicated signature attack for Cairn and Mycel; sowing
keeps row 2. Rattus's wrestling presentation uses the following native cells:

| Move | Sheet | Row | Columns |
| --- | --- | --- | --- |
| Ground dropkick | interaction | 5 | 0–3 |
| Aerial salto | main | 6 | 0–7 |
| Splits descent | interaction | 5 | 4–7 |
| Impact and recovery | main | 5 | 0–7 |

The renderer follows the game's wrestling state. Atlas presentation does not
decide hit timing, range, damage or multiplayer authority. Idle, walk, run,
look, jump, stretch and care keep their original Rattus drawings.

The built-in image_gen masters, complete prompts, source SHA-256 hashes and
measured row windows live in `docs/asset-review/characters-v2/`. Rattus uses the
immutable rat-wizard attempt 09 source; its original opaque blue matte is removed
before a fixed 0.185 nearest-neighbour reduction. Standing frames are 27 pixels
tall. The compiler maps its 64 source cells into both runtime sheets, retaining
right-facing walk/run sequences, hand-light care and prone poses for rest.
The second immutable master, `source/wrestling.png`, supplies the dropkick,
upside-down salto, wide front splits and recovery drawings. Its 64 complete
connected figures are isolated before one fixed 0.175 reduction; wide legs and
the rotated hat can cross nominal source cells and must never be clipped.
The widest native splits pose is 32 pixels. Combat reduction retains separated
native pixels belonging to the same authored body, including boots and hands.
The source has no dedicated digging, picking or lantern-tool sequence; those
clips reuse its bend/reach poses or hand flame. `registration.json` records each
Rattus runtime cell's source file, row and column. Retired Kestrel masters remain in
the review archive, and its runtime sheets are removed.
Run `python scripts/build-characters-v2.py` to reproduce the PNGs, atlases,
registration log, native/4× contact sheets and 4× animation preview. A fixed
reduction per character preserves pose proportions; connected-body extraction
keeps long tails intact across the generated source's nominal column edges.
Generated source images are never copied to the game build.

Figma synchronization is recorded in `assets/figma-manifest.json`; any files
still awaiting import are pinned in `assets/figma-pending.json`. Rebuilding
byte-matching production files does not recreate pending entries. The initial
character integration used the pending workflow while Figma access was unavailable.
