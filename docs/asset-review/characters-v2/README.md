# Original character artwork, 2026-09-27

Rattus norvegicus replaced Kestrel on 2026-09-30. On 2026-10-01 the owner selected
the supplied black-and-gold movement and combat sheets to replace the initial
wizard robe artwork and perform a split while planting. Immutable copies are
`source/rattus-movement-v2.png` and `source/rattus-combat-v2.png`; both match their
built-in image_gen outputs byte for byte. The exact two selected prompt records
are self-contained in `source/rattus-wrestler-v2-prompts.json`.
`source/provenance.json` pins those files and continues to retain the earlier
rat-wizard, wrestling and retired Kestrel sources.

Both supplied sheets have eight visual rows and eight poses per row, but their
1254-pixel dimensions do not form integer cells. The final row is clipped;
some final-row figures also touch the figures above. The compiler selects whole
connected figures by measured row centers and nominal columns, rejects joined
figures taller than a source row, and never uses source row 7. Complete source
poses from rows 0–6 retain their boots, hands, hat and wide legs without drawing
missing pixels. One fixed 0.175 nearest-neighbour reduction applies to both
masters, followed by the existing sixteen-colour palette and binary alpha.
Pixels under transparency have RGB zero. A registration assertion rejects any
pose taller than its original foot position, so no hat is cropped above a cell.

All runtime drawings now use the selected black-and-gold athletic ring gear,
short navy/gold cape, rat mask, auburn hair and green hat. Idle uses complete
combat row 0 guard poses, omitting its jab columns. Walk uses movement row 1
weight shifts; run uses movement row 4. All face right before the existing
renderer mirrors the sprite. Care and rest borrow complete crouch, reach and
raised-arm poses because these sources have no authored gardening tools,
lantern or complete prone-rest sequence. No procedural silhouettes are drawn.

Wrestling cells retain the runtime contract:

| Runtime cells | Selected source cells, zero-based |
| --- | --- |
| Main row 6, salto | Combat row 5, columns 0–7 |
| Interaction row 5, columns 0–3, dropkick | Combat row 4, columns 0, 1, 3, 6 |
| Interaction row 5, columns 4–7, splits descent | Combat row 6, columns 4, 1, 2, 3 |
| Main row 5, impact/recovery | Combat (6,1), (6,2), (6,5), (6,6); movement (0,1), (0,2), (0,3); combat (0,0) |
| Interaction row 2, planting | Combat (0,0); movement (0,1); combat (6,4), (6,1), (6,2), (6,3), (6,2); movement (0,0) |

Planting columns 3–6 hold the full wide splits through the existing sow hit
frame 6. Column 7 recovers to the same low crouch as interaction row 0 column 3,
so the following stand clip rises without dipping. All 25 original clip frame
sequences, fps, loops and hit/pour markers remain unchanged.
`atlas.json` records the wrestling slots under `presentation.wrestling`;
gameplay retains hit timing, damage and authority. `registration.json` records
the exact selected master and source cell for all 128 Rattus runtime frames.

`rattle-sheets-1x.png` shows both actual runtime sheets; `rattle-sheets-4x.png`
is an exact integer enlargement. The existing contact and animation previews
now show Rattus, Cairn and Mycel. Cairn/Mycel sheets and atlases retain their
previous bytes. Kestrel's three runtime files have been retired.

`wrestling-1x.png` and `wrestling-4x.png` show every native wrestling pose;
`wrestling-4x.gif` plays dropkick, salto, splits and recovery in order. The
integer enlargement reveals the full splits width and inverted green hat.

`planting-1x.png` and `planting-4x.png` show all eight actual native planting
frames, including the held splits and low-crouch recovery.

`rattle-menu-390.png` and `rattle-menu-320.png` retain the earlier wizard-robed
phone review. Saved selections still use `runner` and `moss`.

Figma synchronization is recorded in `assets/figma-manifest.json`; any files
awaiting import remain pinned in `assets/figma-pending.json`. The initial
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

`scripts/build-characters-v2.py` is the authoritative source compiler. It uses
nearest-neighbour reduction, sixteen-colour palettes, binary alpha, connected
body extraction, fixed cells and original foot registration. No generated
background, alpha fringe, colour under alpha zero or fractional pixel reaches
the runtime. The original frame order and gameplay markers are unchanged.

Review artifacts:

- `contact-1x.png`: actual runtime pixels on a dark neutral ground.
- `contact-4x.png`: exact integer enlargement for silhouette review.
- `animations-4x.gif`: movement, care and signature attack playback.
- `registration.json`: original cell foot registration used for all 384 cells.

The supplied Mech, Pølge and Sligo character sheets are unchanged. Runtime
loader and menu portraits use `assets/characters-v2/`; only native runtime PNGs
and atlas JSON ship. Old Max recolours remain archival source files in the repo.
