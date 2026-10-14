# Tiara head v1

Native 8×8 sprite atlas derived deterministically from the approved generated head sheet. The generated source is `exec-7002bf7a-6fd9-43f9-8c22-e62724aec46e.png` (1254×1254 RGBA); its SHA256 is recorded in `provenance.json`.

`sprites.png` is 320×320, with 64 fixed 40×40 cells and anchor `[20,39]`. This is approximately quarter-size (25.518% of the source width), rounded to a size divisible by the full 8×8 grid. The complete sheet was resized using ImageMagick nearest-neighbour sampling, without independent sprite trimming or repositioning. Frame order remains left-to-right, top-to-bottom.

The output has exactly 64 RGBA entries: 63 opaque RGB colors plus transparent black. Alpha is binary (0 or 255), dithering is disabled, and all transparent RGB values are 0. `atlas.json` lists the exact opaque palette and measured, cell-local half-open opaque bounds `[x0,y0,x1,y1]` for every frame.

| Row | Animation | Frames | FPS | Loop |
|---|---|---|---|---|
| 1 | idle | 0–7 | 6 | true |
| 2 | bounce | 8–15 | 10 | true |
| 3 | jump | 16–23 | 10 | false |
| 4 | fall | 24–31 | 8 | true |
| 5 | land | 32–39 | 12 | false |
| 6 | roll | 40–47 | 12 | true |
| 7 | headbutt | 48–55 | 12 | false |
| 8 | hurt | 56–63 | 10 | false |

Use nearest-neighbour scaling when displayed above native resolution. The atlas preserves the approved generated artwork, including any small artifacts or uneven frame placement present in that source.

The canonical Figma master is component `1032:21911`, inside holder `1020:13527`
in production section `451:4` on page `10:2` of `TC0PHGMTCMR6im4hb3CSbF`.
It contains 65 disjoint native vector parts in the exact 63 opaque colors.
All 64 animation variants and the Level 10 sheet instance reference this one
component, so a native source edit updates the Figma previews and game export.
The actual animation configuration is recorded in
`docs/design/tiara-head-v1/figma-animation-sets.json`.
`sprites.png` is the actual 1× PNG returned by Figma `exportAsync`; its encoding
differs from the prepared candidate while every RGBA pixel remains identical.

`figma-vector.json` pins the untouched authenticated path capture, its actual
Figma parser, a lossless native pixel plane, the actual PNG export, the approved
native candidate and this atlas. The source parser inspected all 54,503 integer
unit-row rectangles and found 62,801 opaque pixels, with no overlap or transformed
geometry. Evidence remains in `docs/asset-review/tiara-head-v1/`.
The manifest's `sourceKind: vector-export` explicitly describes a native vector
master; the export's SHA-1 is never represented as a stored Figma image hash.
See `docs/figma.md` before changing this master or its export.
