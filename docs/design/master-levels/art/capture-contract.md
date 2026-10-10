# Native MASTER ART capture

`capture.use-figma.js` is portable read-only Plugin API code. Load `figma-use`
before executing it through `use_figma`. Set `CAPTURE_STAGE`, `OP_OFFSET` and
`OP_LIMIT` (1–250). Continue using the returned `nextOffset` until `more` is false.
Only selected operations are inspected and serialized; each response is bounded
to approximately 18,000 JSON characters plus its small response envelope.
The sole UI mutation is one awaited switch to the configured levels page.
There are no node edits, raster exports, file writes or production activations.

The configured file is `TC0PHGMTCMR6im4hb3CSbF`, page `508:11825`, editor
`863:15149`, MASTER `863:15150`. Recursion stops at `level_NN` rows. Exactly one
row per stage is required. **Outer row numbering determines stage identity**;
legacy ART titles and operation labels do not. Stage N records review frame
`garden-NNb` without creating it or adding any activation marker.

ART contains ordered LAYER frames, each containing ordered OP rectangles or
clipped OP image frames. Operations are emitted in existing child order, with
their global layer index prefixed. Array columns are:

- Plane/layer header: `[index,id,name,x,y,w,h,opacity,blend,clip,visible]`.
- Solid operation: `[layerIndex,0,id,x,y,w,h,colorHex,alpha,blend]`.
- Image operation: `[layerIndex,1,id,x,y,w,h,sourcePath,sourceHash,sourceW,sourceH,sx,sy,alpha,blend]`.

Operation x/y are local to the zero-offset layer and thus ART. Solid `alpha`
is node opacity multiplied by its sole solid paint opacity. Image `alpha` is
the crop frame opacity; its sole SOURCE rectangle and IMAGE paint must have
opacity 1. The full source PNG remains native size with an identity image fill.
The crop is `sx=-SOURCE.x`, `sy=-SOURCE.y`, with width/height from the OP frame.
`sourceHash` is Figma's actual IMAGE hash, not a newly exported PNG hash.
The registration record contains native ORIGIN x and SOIL y in REGISTRATION,
plus both reference IDs. Plane offsets are retained explicitly; consumers must
check ART/REGISTRATION alignment before converting coordinates to game space.

Capture rejects unknown node kinds, fractional geometry, rotations, mirrors,
scales, auto layout, rounded corners, visible effects/strokes, nonempty wrapper
fills, filtered/scaled images and out-of-bounds crops. Hidden operations require
explicit reconciliation rather than silent omission. Selected LAYER wrappers
must be visible, have zero offsets, opacity 1 and PASS_THROUGH blend. Their
clipping flags and ART opacity/blend/clip are retained, not flattened away.
Unsupported line/vector primitives throw; native lines already rasterized into
rectangles replay as their actual ordered rectangle coverage.

Each response includes a deterministic pure-JavaScript SHA-1 of UTF-8
`JSON.stringify(chunk)`. This identifies that chunk only. Calls are separate
observations and **do not establish an atomic whole-row snapshot**. Collectors
must reject offset gaps, changing totals/row IDs/plane registration, duplicate
operation IDs or inconsistent layer headers; preserve actual chunks and compute
the joined-source fingerprint locally. Compare source image hashes and native
sizes to the approved production manifest before runtime use.

Historical root source hashes and the earlier 20,339/23,576 operation counts
are provenance only. They are not asserted equal to this fresh capture. This
script supplies editable primitive evidence, not a complete game geometry,
Figma-to-runtime activation or pixel-parity certification.
