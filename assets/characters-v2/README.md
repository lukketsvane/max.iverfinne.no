# Rattle Norvegicus, Cairn, Mycel

Three original characters replace the old Moss, Ember and Moon Max
recolours. Rattle Norvegicus replaces Kestrel in the runner slot. The saved skin keys `moss`, `ember`, `moon` remain wire identifiers;
`native-art.mjs` loads these new packs for them. No old recolour PNG ships.

| Character | Role | Silhouette | Palette |
| --- | --- | --- | --- |
| Rattle Norvegicus | needle caster / runner | unsettling grey rat mask, auburn hair, green cone hat, navy robe with gold trim | grey, navy, gold, green, auburn, cyan |
| Cairn | stone tank / bulwark | broad boulder, slab fists, massive short feet | slate, ceramic, amber |
| Mycel | spore support / herbalist | wide cap, luminous gills, root feet | burgundy, ivory, mint |

All six sheets are native **256×256** PNGs, with **32×32** cells and integer
anchor **(16,31)**. Each character has 128 cells and the original 25 clips;
frame sequences, fps, looping and hit/pour markers are unchanged. Binary alpha,
zero RGB under transparency, no more than 16 opaque colours per character.
Never smooth or enlarge the source pixels inside the world renderer.

Interaction row 5 is a dedicated signature attack. `playerRow` substitutes it
for `toss` only; sowing keeps row 2. This is presentation only and cannot alter
hit timing, range, damage or multiplayer authority.

The built-in image_gen masters, complete prompts, source SHA-256 hashes and
measured row windows live in `docs/asset-review/characters-v2/`. Rattle uses the
immutable rat-wizard attempt 09 source; its original opaque blue matte is removed
before a fixed 0.185 nearest-neighbour reduction. Standing frames are 27 pixels
tall. The compiler maps its 64 source cells into both runtime sheets, retaining
right-facing walk/run sequences, hand casting for attack and prone poses for rest.
The source has no dedicated digging, picking or lantern-tool sequence; those
clips reuse its bend/reach poses or hand flame. `registration.json` records each
Rattle runtime cell's source row and column. Retired Kestrel masters remain in
the review archive, and its runtime sheets are removed.
Run `python scripts/build-characters-v2.py` to reproduce the PNGs, atlases,
registration log, native/4× contact sheets and 4× animation preview. A fixed
reduction per character preserves pose proportions; connected-body extraction
keeps long tails intact across the generated source's nominal column edges.
Generated source images are never copied to the game build.

Figma sync is pending: the local Dev Mode MCP was unavailable on 2026-09-27;
both the connector and local MCP were unavailable for Rattle on 2026-09-30.
The six PNGs are pinned in the existing `assets/figma-pending.json` workflow;
these files have not been claimed as synced production layers.
