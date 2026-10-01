# Upper district props

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
Original generated world machinery and ruin silhouettes for the optional upper
district. Teal oxidized metal, ink shadow, pale stone and amber brass are shared
across the pack; activated interiors use cyan. These are physical world props,
not interface badges. Runtime uses native pixels and no smoothing.

| Sheet | Size | Cell / anchor | Frames |
| --- | --- | --- | --- |
| props.png | 192×64 | 32×32 / (16,31) | 6 columns, idle row then lit row |
| landmarks.png | 144×64 | 48×64 / (24,63) | pump, arch, bell |

Prop column order: `relay`, `bells`, `salvage`, `watch`, `altar`, `cache`.
Each JSON uses `max-native-atlas/v1` with `frames` and named one-frame clips.
Examples: `relay/idle`, `relay/lit`, `altar/lit`; landmark clips `pump`, `arch`,
`bell`. All metadata records source rectangles, exact opaque bounds and anchors.

Draw props from `(column*32, lit?32:0, 32,32)` to `(round(x)-16,
round(y)-31,32,32)`. Draw landmarks from `(index*48,0,48,64)` to
`(round(x)-24,round(y)-63,48,64)`. Do not stretch the landmark to fit geometry;
it is decorative artwork and never defines collision or platform reachability.
Readiness/progress and attack warnings remain separate gameplay signals.

[historical build-district-props.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-district-props.py) reproduces the two PNGs, JSON atlases,
manifest, source provenance and contact sheets. The actual original image_gen
source and full prompt live in `docs/asset-review/district-props-v1/source/`.
Each prop pair uses one fixed reduction, binary alpha, zero RGB under alpha
zero, a shared palette of at most sixteen colours and integer ground alignment.

Figma synchronization is pending because the local Dev Mode MCP is unavailable;
both runtime PNGs are pinned in the retired pending-art list under the existing
documented workflow. No synced Figma production layer is claimed.
