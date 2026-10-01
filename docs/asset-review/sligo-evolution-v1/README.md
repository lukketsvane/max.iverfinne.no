# Sligo evolution v1: three complete branches

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
`brood-sheet.png` is the owner's painted 4x16 sheet of Sligo budding (24 September 2026): row 1 grows two
buds and drags them, row 2 crawls as a chain of buds, row 3 stands the chain up, row 4 folds it into one
mass with a great eye and a crown of tendrils.

It is the Cultivator endpoint of Sligo's evolution. Like Eevee, Sligo has one endpoint per boon path, and
the first path capstone it takes is its stone: Bloom pulse (Cultivator) grows the brood, Evergreen (Warden)
grows an armored root guardian, and Chain bloom (Vanguard) grows a multi-eyed umbilical coil. More ranks on
the path grow it: the stone buds it (row 1), 8 ranks make the chain (rows 2 and 3), 12 fold it into the
brood mother (row 4). Each new stage plays its growth frames once.

[historical build-sligo-evolution.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-sligo-evolution.py) cuts the 64 frames, drops the faint red halo, brings them to Sligo's own
native scale (about 1/5.75) and writes `assets/max-skins-v1/sligo/brood.png` (64 cells of 40x40, feet on
row 39, one palette of 16 colours) and `brood.json`. `SLIGO_EVO` in `index.html` names the frames each stage
uses; [historical sligo-evolution.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/sligo-evolution.test.cjs) holds the rules.

## Evergreen and Chain

`evergreen-source.png` and `chain-source.png` are original generated sheets,
conditioned on the owner's brood sheet through the built-in image-generation
tool. Their 24 separate poses each describe three stages in eight poses per
stage. Evergreen develops plum bark armor, root legs and a moss crown; Chain
develops additional eyes, sinuous flesh nodes and hooked umbilical whips.
Both preserve Sligo's pink tissue and glossy black eye identity.

[historical build-sligo-evolution-branches.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-sligo-evolution-branches.py) deterministically cuts the
actual source-row gutters, drops alpha debris, applies one uniform scale per
sheet, snaps to one shared 16-colour palette and registers every pose at
(20,39). Outputs are `assets/max-skins-v1/sligo/{evergreen,chain}.png` and
matching JSON: 24 native 40×40 cells in a 960×40 strip. Binary alpha, zero RGB
under transparency, source crop boxes, source SHA-256, native bounds and clips
are recorded and tested. `*-contact-4x.png` are exact nearest-neighbour review
enlargements. Sources are never changed by the generator.

The runtime loads only the selected evolution line. Brood uses its existing
clips; both new branches use their own three-stage growth, idle, walk and air
clips. Existing first-stone locking, eight/twelve-rank thresholds and co-op
`line*4+stage` codes remain unchanged. Evolution neither grants mass nor
changes attacks, hitboxes or movement. Food still owns body size.

The runtime PNGs are pinned through the retired pending-art list; Figma desktop
MCP is unavailable in this environment. The static build includes both PNGs
and their metadata. [historical sligo-evolution.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/sligo-evolution.test.cjs) verifies progression,
remote rendering, distinct poses, palette, transparency and foot registration.

Generation prompts are recorded in `generation.json`; the built-in tool was
used, with true transparency requested, and no CLI/API fallback.
