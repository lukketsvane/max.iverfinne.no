# Native role coverage — fresh source audit

The authenticated Figma read captures all six configured runtime sections on
production page `10:2`: 1,425 actual hierarchy nodes, captured from 16:48:19 UTC
on 14 October 2026 in eleven bounded, gap-free return chunks. It is not built
from the repository manifest or an older hierarchy. `414:3` is the original
256×288 `assets/enemies-v2/sprites.png` rectangle, now under `1040:21976` in
runtime enemies `451:3`, retaining image hash
`dd8c215a6ed39ec1db6a4e197ab5eb1829c84e2e`.

There are **667 production masters**, not 670: 666 ordinary raster rectangles
and the one explicit Tiara vector master. Three additional PNG-named components
are wrappers for water FX, Sanctuary tiles and the pixel font, not extra masters.

Tiara's actual vector paths were freshly read at **17:12:39 UTC** and retained
in eight bounded chunks. The actual parser validates every integer, axis-aligned
unit-row path, rejecting curves, overlapping pixels, transforms, partial alpha,
strokes and effects. Its 65 shapes, 63 colours, 54,503 rectangle runs and 62,801
opaque pixels, complete 102,400-cell geometry plane and native metadata exactly
match the existing approved source proof. The actual fresh 147,306-byte Figma
PNG export is byte-equal to that proof. Its SHA-1 is
`daa9788b7b6b168510ee8d635447d2aa105e3e95`.

The untouched source returns remain separate from the mechanically assembled
capture. PNG/RGBA hashes and the existing canonical receipt path are derived
from the actual fresh export bytes. They do not turn an export hash into a stored
Figma image hash or introduce another vector exception.

The unchanged ordinary `npm run figma:check` completed at **17:18:02 UTC**:

> 667 layers in 10:2 · 667 MATCH · 0 problem(s)

`figma-comparison.json` pins the captures, executed read scripts, PNG and strict
checker log. The first attempt used separate execution sessions and failed to
connect to loopback before comparison. `check-captured-source.mjs` runs the
unchanged captured replay and ordinary checker in one finite process tree; the
strict source checks are not altered. Its three reported tool calls are local
replay RPCs, not a claim of only three authenticated connector reads.

To reproduce the captured comparison:

```sh
node docs/asset-review/native-role-coverage/assemble-captures.mjs
node docs/asset-review/native-role-coverage/check-captured-source.mjs
node docs/asset-review/native-role-coverage/write-comparison.mjs
```

This proves synchronization at the stated capture times. It does not establish
an ongoing live Figma connection or declare the new release/remaining sprite
coverage complete. Runtime artwork, manifest, checker and source-exception
contracts were not modified by this audit.
