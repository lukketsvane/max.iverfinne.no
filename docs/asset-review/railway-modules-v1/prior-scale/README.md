# Railway ruin modules

Six large architecture modules follow the owner's selected railway reference in
Figma: file `TC0PHGMTCMR6im4hb3CSbF`, original artwork `1266:19`, component
`1433:22051`, linked reference `1271:34`.

Each source pixel occupies exactly one native output pixel. There is no resize,
resampling, warping, isolation or redraw. Preparation applies alpha threshold
128, a fixed 128-color palette without dithering, zero RGB under transparent
pixels, tight integer cropping and four transparent pixels of padding.

The palette retains source brick, purple-grey stone, iron, green/cyan vegetation,
amber lanterns and flower accents. Its 112 weighted source-color selections and
16 fixed hue anchors are pinned in the recipe and `atlas.json`.

| Module | PNG dimensions | Original source rectangle x, y, width, height |
| --- | --- | --- |
| arches | 508 × 390 | 14, 83, 500, 382 |
| bridge | 498 × 345 | 520, 126, 490, 337 |
| tunnel | 507 × 313 | 1023, 174, 499, 305 |
| lift | 366 × 531 | 30, 468, 358, 523 |
| train | 564 × 302 | 402, 650, 556, 294 |
| junction | 546 × 384 | 977, 573, 538, 376 |

The integer anchor `[4,4]` is the top-left of the tight source rectangle. Each
frame's exclusive-right/bottom `opaqueBounds` is `[4,4,width-4,height-4]`.
Use the full PNG at its listed native dimensions in Figma and in the game, with
integer placement and image smoothing disabled. Repeated pieces must keep this
scale. Artwork outlines and vegetation are not an automatic collision map;
traversal surfaces need explicit authored geometry registered to these pixels.

The generated original is preserved byte for byte at
`docs/asset-review/railway-modules-v1/source/railway-ruins-generated.png`.
`provenance.json` pins its SHA-256, recipe, builder, atlas, output hashes, crop
coordinates and exact source alpha coverage. No rejected mossy terrain artwork
is included.

Reproduce the pending import candidate from the repository root:

```sh
node scripts/build-railway-modules.mjs
```

The builder refuses a synchronized Figma pack. Once these native sheets are
imported into runtime section `451:2` on production page `10:2`, edits follow
`docs/figma.md`. Update provenance with actual authenticated node IDs and image
hashes, and pass the normal manifest and `npm run figma:check` before claiming
source synchronization. The initial provenance explicitly remains
`pending-import`; local artwork validation does not assert a Figma upload or
runtime integration.
