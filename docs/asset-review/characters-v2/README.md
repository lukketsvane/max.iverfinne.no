# Original character artwork, 2026-09-27

Built-in image_gen produced six transparent source masters: movement and
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
