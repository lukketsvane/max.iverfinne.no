# Kestrel, Cairn, Mycel

Three original creature characters replace the old Moss, Ember and Moon Max
recolours. The saved skin keys `moss`, `ember`, `moon` remain wire identifiers;
`native-art.mjs` loads these new packs for them. No old recolour PNG ships.

| Character | Role | Silhouette | Palette |
| --- | --- | --- | --- |
| Kestrel | needle archer / runner | avian head, beak, talons, long forked tail | rust, bone, ochre |
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

The six original built-in image_gen masters, complete prompts, source SHA-256
hashes and measured row windows live in `docs/asset-review/characters-v2/`.
Run `python scripts/build-characters-v2.py` to reproduce the PNGs, atlases,
registration log, native/4× contact sheets and 4× animation preview. A fixed
reduction per character preserves pose proportions; connected-body extraction
keeps long tails intact across the generated source's nominal column edges.
Generated source images are never copied to the game build.

Figma sync is pending: the local Dev Mode MCP was unavailable on 2026-09-27.
The six PNGs are pinned in the existing `assets/figma-pending.json` workflow;
these files have not been claimed as synced production layers.
