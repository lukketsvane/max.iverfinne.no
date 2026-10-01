# Original character artwork, 2026-09-27

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
On 2026-10-01 the owner selected five final grey-furred rat wrestling sheets
for default Ring gear, `rattle-norvegicus-pink` / `moss-pink`. The adult rat
has orange hair, a pink tail, fuller muscular hips/thighs, magenta/gold bra,
briefs and boots, and no hat, cape or weapons. The immutable image_gen masters
`source/rattus-ring-v4-01.png` through `-04.png` and revised
`source/rattus-ring-v6-05.png` each contain 64 separable complete bodies in a
visual 8×8 layout. Their exact final prompts are in
`source/rattus-ring-v6-prompts.json`; `source/provenance.json` pins raw bytes
by SHA-256, so the native build needs no separate candidate gallery.

The compiler measures whole connected figures at alpha 240, rejecting cropped
source edges. It uses one fixed 0.170 nearest-neighbour reduction across all
five sources: the widest source body is 186 pixels, fitting 32 native pixels
without individual resizing. The separate sixteen-colour palette preserves
grey fur, orange hair and magenta/gold gear. Native alpha is binary, with zero
RGB under transparency. Integer foot registration rejects oversized or
top-clipped poses before packing. Cairn and Mycel runtime PNG/atlas bytes remain unchanged. Earlier Rattus
runtime packs are retired; historical source bytes and proofs remain archived.

| Native row, zero-based | Final source mapping |
| --- | --- |
| Main 0, idle | Sheet 01 row 0 guards |
| Main 1/2, walk/run | Sheet 05 rows 0/1 authored cycles |
| Main 3, look/taunt | Revised sheet 05 row 7: four rear hip-bounce phases, jump, aerial split, floor split, guard |
| Main 4, jump/climb | Sheet 04 row 2 high knees |
| Main 5, impact/recovery | Sheet 03 row 7 floor splits; sheet 05 row3 crouch; sheet 01 grounded crouch/rise/guard |
| Main 6, salto | Sheet 02 row 0 forward rotation |
| Main 7, stretch | Sheet 05 row 4 leg-scissors warm-up |
| Interaction 2, planting | Sheet 01 guard/crouch/hands down; row 7 columns 1/2 hold splits at native columns 3–6 |
| Interaction 5, dropkick/descent | Sheet 01 row 5 coil/leap/horizontal kick/recover; sheet 05 row 3 leap/wide splits/impact |
| Interaction 7, sit/rest | Revised sheet 05 row6: guard, balance lost, slip, seated fall, complete prone column3 held for rest |

Interaction row 2 column 7 matches stand’s starting crouch, so planting rises
without dipping. Both complete magenta boots remain visible through sow hit
frame 6. The 128 cells preserve anchor (16,31), 32×32 registration and all 25
original frame sequences, fps, loops and hit/pour markers.
`registration.json` records the exact selected master and source cell.
The revised fifth source is copied unchanged from the final image_gen output,
SHA-256 `06067b53a3c8fee0758c853c2000fc4ddf39c4bc238ffcb890a40419c9a18771`.
Its 1265×1243 canvas has 64 separate whole bodies at alpha240 and250, eight
per row, with foreground bounds (35,26,1237,1217) and no significant edge
pixels. Its widest body is 170 pixels, fitting the existing fixed0.170
reduction. Source row centers are (89,241,402,587,737,871,1023,1153). The first
four source bytes are unchanged. The prior fifth source and complete v4
prompts remain immutable and pinned in the historical provenance entries.
Landing uses only floor-contact split/crouch/rise poses; rest holds the
complete prone drawing. All source tails and boots remain connected.

Care borrows hand-supported reaches and raised-arm poses; no garden tools,
lantern, sword or other weapon is drawn. Earlier owner-supplied and retired
masters stay preserved with their provenance. The sole runtime Rattus pack is
`rattle-norvegicus-pink`; it has no `variantOf` dependency. The optional candidate galleries
remain outside the compiler’s required source inputs.

`rattle-pink-sheets-1x.png` / `rattle-pink-sheets-4x.png` show both actual native
sheets. `pink-planting-1x.png` / `pink-planting-4x.png` show the planting sequence
and complete boots at native size and exact integer enlargement.

Rattus norvegicus replaced Kestrel on 2026-09-30. The earlier rat-wizard,
black/gold athletic and supplied pink sources remain immutable archives with
their prompts and SHA-256 provenance. Their runtime pack is retired: the
compiler no longer contains `rattle-norvegicus`, its three runtime files are
absent, and no active atlas depends on it. Old menu screenshots preserve the
historical wizard review rather than represent current runtime artwork.

`rattle-sheets-1x.png` / `rattle-sheets-4x.png`, `contact-1x.png` /
`contact-4x.png` and `animations-4x.gif` now display the sole active Ring gear
pack alongside Cairn and Mycel. `wrestling-1x.png`, `wrestling-4x.png` and
`wrestling-4x.gif` show its dropkick, salto, splits and recovery. `planting-1x.png`
and `planting-4x.png` show its complete native planting frames. Previews remain
outside runtime assets and Figma production sources.

Figma synchronization is recorded in `assets/figma-manifest.json`; any files
awaiting import remain pinned in the retired pending-art list. The initial
Rattus replacement used that pending workflow while access was unavailable.
The compiler leaves byte-matching synchronized PNGs out of the pending list.

The earlier built-in image_gen run produced six transparent source masters: movement and
interaction sheets for Kestrel, Cairn and Mycel. Full prompts are in
`source/prompts.json`; `source/provenance.json` pins every master by SHA-256.
The creature design replaces the three human Max recolours entirely, retaining
only class/skin IDs for saved loadouts and co-op compatibility.

Generated layout is imperfect: Kestrel has eight movement rows; Cairn and Mycel
have seven. Their landing and stretch clips use their real crouch/recovery and
alert poses. All three interaction masters have eight rows. Isolated projectile
drawings are omitted from attack selection so the player never disappears.
Some large Cairn punch drawings touch in the master; explicit cell windows
separate those poses. Runtime sheets are complete native animations rather than
upscaled source illustrations or static repeated stand-ins.

[historical build-characters-v2.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-characters-v2.py) is the authoritative source compiler. It uses
nearest-neighbour reduction, sixteen-colour palettes, binary alpha, connected
body extraction, fixed cells and original foot registration. No generated
background, alpha fringe, colour under alpha zero or fractional pixel reaches
the runtime. The original frame order and gameplay markers are unchanged.

Review artifacts:

- `contact-1x.png`: actual runtime pixels on a dark neutral ground.
- `contact-4x.png`: exact integer enlargement for silhouette review.
- `animations-4x.gif`: movement, care and signature attack playback.
- `registration.json`: original cell foot registration used for all 384 active cells.

The supplied Mech, PÃƒÆ’Ã‚Â¸lge and Sligo character sheets are unchanged. Runtime
loader and menu portraits use `assets/characters-v2/`; only native runtime PNGs
and atlas JSON ship. Old Max recolours remain archival source files in the repo.
