# Original character artwork, 2026-09-27

Rattus norvegicus replaces Kestrel on 2026-09-30. Its immutable master is
`source/rattle-norvegicus.png`, copied byte-for-byte from the owner's selected
rat-wizard attempt 09. `source/rattle-prompt.json` contains that attempt's full
prompt and reference filenames. `source/provenance.json` pins its SHA-256 and
continues to retain the retired Kestrel source hashes and masters.

Rattus's source has eight nominal rows: idle, right walk, left walk, right run,
jump/land, hand casting, hurt/recovery and topple/rest. Its generated 1254-pixel
size does not divide into integer cells. The compiler uses rounded eighth-sheet
boundaries, removes the blue matte and detached dust, then applies one fixed
0.185 nearest-neighbour scale, a sixteen-colour palette and binary alpha. It
preserves the grey rat mask, auburn hair, green hat, navy robe and gold trim.
The native standing silhouette is 27 pixels tall; jumping and compressed poses
retain their relative dimensions. Every cell keeps the original foot anchor.

Only the right-facing walk and run rows supply movement. The source casting
drawings supply magical watering/hand-light poses. Prone drawings
appear only in the rest sequence. Digging, picking and planting reuse bend and
reach drawings because the source has no authored tool-specific sequences.
`registration.json` records the source row/column for each Rattus runtime frame;
all 25 animation timings and hit/pour markers remain unchanged.

The follow-up pro-wrestler design uses a second immutable built-in image_gen
master, `source/wrestling.png`, with its full prompt in
`source/wrestling-prompt.json`. Its 64 authored body groups contain a horizontal
two-boot dropkick, an upside-down salto, front-facing splits and landing
recovery. Extracting whole connected figures preserves wide legs and the
rotated hat across imperfect nominal source cells. One fixed 0.175 reduction
keeps the same palette, binary alpha, zero RGB under transparency and integer
anchor. No new silhouettes or poses are drawn procedurally.

Main row 6 contains all eight source row 2 salto poses. Interaction row 5
columns 0–3 use source row 0 columns 0, 1, 3, 6 for dropkick; columns 4–7 use
source row 3 columns 1, 2, 3, 4 for splits descent. Main row 5 uses source row 4
columns 0, 0, 3, 4, 1, 2, 6, 7 to recover from the wide impact through bending
and kneeling to standing. Idle, walk, run, look, jump, stretch, care and rest
remain unchanged. `atlas.json` records these wrestling cells under
`presentation.wrestling`; combat behavior and state timing belong to the game.
`registration.json` identifies the master and source cell for every output.

`rattle-sheets-1x.png` shows both actual runtime sheets; `rattle-sheets-4x.png`
is an exact integer enlargement. The existing contact and animation previews
now show Rattus, Cairn and Mycel. Cairn/Mycel sheets and atlases retain their
previous bytes. Kestrel's three runtime files have been retired.

`wrestling-1x.png` and `wrestling-4x.png` show every native wrestling pose;
`wrestling-4x.gif` plays dropkick, salto, splits and recovery in order. The
integer enlargement reveals the full splits width and inverted green hat.

`rattle-menu-390.png` and `rattle-menu-320.png` capture the selected character
at phone widths. Browser checks confirm the full name and description fit,
the preview loads the 256×256 native sheet with pixelated rendering, and no
script errors occur. Saved selections retain `runner` and `moss`.

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
