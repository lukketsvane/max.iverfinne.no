# Railway ruin modules

Six large architecture modules follow the owner's selected railway reference in
Figma: file `TC0PHGMTCMR6im4hb3CSbF`, original artwork `1266:19`, component
`1433:22051`, linked reference `1271:34`.

The owner quarter-scaled the first, oversized pieces. These corrected native
masters are prepared from the unchanged generated original using consistent
one-quarter nearest-pixel-center sampling, then imported and rendered at
**one Figma pixel per native game pixel**. Preparation applies alpha threshold
128, the unchanged 128-color palette without dithering, zero RGB under
transparent pixels and one pixel of padding. There is no smoothing, isolation,
redraw or change to the design content.

The palette retains source brick, purple-grey stone, iron, green/cyan vegetation,
amber lanterns and flower accents. Its 112 weighted source-color selections and
16 fixed hue anchors are pinned in the recipe and `atlas.json`.

| Module | PNG dimensions | Original source rectangle x, y, width, height |
| --- | --- | --- |
| arches | 127 × 98 | 14, 83, 500, 382 |
| bridge | 125 × 87 | 520, 126, 490, 337 |
| tunnel | 127 × 79 | 1023, 174, 499, 305 |
| lift | 92 × 133 | 30, 468, 358, 523 |
| train | 141 × 76 | 402, 650, 556, 294 |
| junction | 137 × 96 | 977, 573, 538, 376 |

The integer anchor `[1,1]` marks the prepared artwork origin. Native dimensions
round the owner's quarter-size footprints upward to whole pixels. Exact
exclusive-right/bottom `opaqueBounds` are measured and recorded in `atlas.json`;
rounding and pixel-center sampling can leave more than one clear border pixel.
Use the full PNG at its listed native dimensions in Figma and in the game, with
integer placement and image smoothing disabled. Repeated pieces must keep this
scale. Artwork outlines and vegetation are not an automatic collision map;
traversal surfaces need explicit authored geometry registered to these pixels.

The generated original is preserved byte for byte at
`docs/asset-review/railway-modules-v1/source/railway-ruins-generated.png`.
`provenance.json` pins its SHA-256, recipe, builder, atlas, output hashes, crop
coordinates and nearest input sampling registration. This verifies the declared
sampling operation, not equivalence with Figma's fractional display scaling.
The previous full-size exports, recipe, builder and authenticated import/check
evidence are preserved and hash-pinned in
`docs/asset-review/railway-modules-v1/prior-scale/archive.json`.

The six quarter-size PNG masters were verified in production section `451:2`
on page `10:2` on 17 October 2026. Their actual image hashes, native dimensions
and local bytes match; `provenance.json` pins the authenticated readback and
[comparison](../../docs/asset-review/railway-modules-v1/final-source-check/comparison.json).
They remain asset-library modules and are not placed in the MASTER map.

The pack is synchronized and the builder refuses to overwrite it. Further
edits follow `docs/figma.md`. The full `npm run figma:check` remains blocked by
24 pre-existing scene PNG hash differences and four missing local source PNGs;
the comparison records this separately from the seven requested source matches.
