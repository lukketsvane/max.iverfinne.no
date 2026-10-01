# District props, 2026-09-27

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
One built-in image_gen master supplies all fifteen original poses: idle and lit
relay beacon, three-bell carillon, salvage pod, watch telescope, reward altar
and cache signpost; broken gear pump, ribbed arch and suspended great bell.
The complete prompt and source SHA-256 are retained under `source/`.

[historical build-district-props.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-district-props.py) performs measured row/column extraction,
pair-consistent nearest-neighbour reduction, shared sixteen-colour quantization
and binary alpha normalization. Feet anchor to native cell rows 31 or 63.
No source image is loaded directly or stretched by the game renderer.

`contact-1x.png` displays actual native pixels; `contact-4x.png` is an exact
integer enlargement. The generated source remains review material, while
`assets/district-props-v1/` holds the binding runtime sheets and atlas metadata.
