# Rattus norvegicus, Cairn, Mycel

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
Three original characters replace the old Moss, Ember and Moon Max recolours.
Rattus norvegicus occupies the runner slot. The sole active Rattus outfit is
Ring gear, `rattle-norvegicus-pink`, with saved cosmetic key `moss-pink`.
Earlier wizard, black/gold and pink costumes are retired from runtime packs;
their source masters, prompts and historical provenance remain preserved.
The retired `rattle-norvegicus` pack has no generator entry or runtime files.
The remaining pack is independent and has no `variantOf` dependency.

| Character | Role | Silhouette | Palette |
| --- | --- | --- | --- |
| Rattus norvegicus | pro wrestler / runner | grey fur, muscular hips/thighs, orange hair, pink tail, magenta/gold athletic ring gear; no hat or cape | grey, magenta, gold, orange |
| Cairn | stone tank / bulwark | broad boulder, slab fists, massive short feet | slate, ceramic, amber |
| Mycel | spore support / herbalist | wide cap, luminous gills, root feet | burgundy, ivory, mint |

All six sheets are native **256×256** PNGs with **32×32** cells and integer
anchor **(16,31)**. Each character has 128 cells and the original 25 clips.
Frame sequences, fps, loops and hit/pour markers remain unchanged. Native
alpha is binary, transparent RGB is zero, and each palette has at most 16
opaque colours. World rendering disables smoothing and preserves 1:1 pixels.

Five self-contained image_gen masters, `source/rattus-ring-v4-01.png` through
`-04.png` and revised `source/rattus-ring-v6-05.png`, supply the grey-furred adult rat's poses in magenta/gold bra, briefs
and boots. Exact prompts are in `source/rattus-ring-v6-prompts.json`. The previous fifth master and prompts
remain preserved under their v4 paths and provenance pins.
`source/provenance.json` pins the raw source bytes by SHA-256 and retains
historical retired masters. Each final sheet has 64 separate complete figures.

Whole connected bodies at alpha 240 have positive source-edge padding. One
fixed 0.170 nearest-neighbour reduction applies to every pose from all five
sources: the widest 186-pixel figure fits a 32-pixel cell at this scale. No
individual pose is stretched, cropped or drawn. Registration rejects poses
taller than their original foot position, preventing silent top clipping.

The 128 native cells combine grounded strikes, aerial saltos, sweeps, split
planting, high knees and authored walk/run, split-stomp, leg-scissors, prone
recovery and taunt cycles. The revised fifth sheet adds a complete slip,
prone fall and grounded rise, plus four rear hip-bounce phases followed by
a jump, aerial split, floor split and guard. The look clip presents this taunt.
Rest ends in its complete prone pose; landing recovery uses floor splits
and grounded crouch/rise/guard drawings rather than slipping or airborne poses. Complete source01 row7 splits hold both magenta
boots through sow hit frame6, then recover to the stand clip's starting crouch.
Care borrows complete hand-supported reaches and raised arms because the
sources contain no garden tools, lanterns or weapons. Gameplay owns attacks,
hit timing, range, damage and multiplayer authority.

| Presentation | Sheet | Row | Columns |
| --- | --- | --- | --- |
| Ground dropkick | interaction | 5 | 0–3 |
| Aerial salto | main | 6 | 0–7 |
| Splits descent | interaction | 5 | 4–7 |
| Floor impact and recovery | main | 5 | 0–7 |
| Planting splits | interaction | 2 | 3–6 within the eight-frame sow clip |

`registration.json` records every selected source file and cell. Cairn and
Mycel PNGs and atlases retain their previous bytes. Retired runtime artwork is
not copied to the build; review sources and historical proofs are archives.

Run [historical build-characters-v2.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-characters-v2.py) to reproduce the native PNGs,
atlases, registration log, contact sheets and integer animation previews.
Generated source images are never copied to the game build. Figma production
synchronization is recorded in `assets/figma-manifest.json`; files awaiting
import are pinned in the retired pending-art list. Byte-matching synchronized
files do not recreate pending entries.
