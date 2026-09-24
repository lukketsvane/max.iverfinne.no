# Sligo evolution v1: the brood

`brood-sheet.png` is the owner's painted 4x16 sheet of Sligo budding (24 September 2026): row 1 grows two
buds and drags them, row 2 crawls as a chain of buds, row 3 stands the chain up, row 4 folds it into one
mass with a great eye and a crown of tendrils.

It is the Cultivator endpoint of Sligo's evolution. Like Eevee, Sligo has one endpoint per boon path, and
the first path capstone it takes is its stone: Bloom pulse (Cultivator) grows the brood, Evergreen (Warden)
and Chain bloom (Vanguard) settle their lines but keep Sligo as it is until their art exists. More ranks on
the path grow it: the stone buds it (row 1), 8 ranks make the chain (rows 2 and 3), 12 fold it into the
brood mother (row 4). Each new stage plays its growth frames once.

`scripts/build-sligo-evolution.py` cuts the 64 frames, drops the faint red halo, brings them to Sligo's own
native scale (about 1/5.75) and writes `assets/max-skins-v1/sligo/brood.png` (64 cells of 40x40, feet on
row 39, one palette of 16 colours) and `brood.json`. `SLIGO_EVO` in `index.html` names the frames each stage
uses; `tests/sligo-evolution.test.cjs` holds the rules.
