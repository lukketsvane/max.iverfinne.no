# Pølge, the mannequin

Current authoring: [Figma runtime player characters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=451-5). The runtime sections `451:2`–`451:7` replaced the retired `160:2` frame. Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](../../figma.md) for edits.
The owner's 56 transparent PNGs from Untitled.zip are preserved in `source/`.
[historical build-polge.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-polge.py) rebuilds the two runtime sheets and their atlas.
Every pose has the same 0.72 reduction, binary alpha and one shared 16-colour
palette. Cells are 32×32, anchored at (16,31), with each pose registered to the
original animation's foot position. All named clips and gameplay event markers
are unchanged. The last two source rows supply tending, landing and rest;
the topple sequence supplies jumps and the collapsed rest. No limbs are invented.

Pølge is now a close boxer: jab, cross, uppercut, Rhythm, clinch, a short ground
slip and a moving flurry. The old stand-in kit has been retired. His existing
native body sheets remain unchanged; contact glove echoes are short local
effects, separate from his limbless body, and never become projectiles or actors.
`varnish` adds bounded flurry punches, `splinters` strengthens uppercuts and
`raincoat` recovers skill cooldown on confirmed enemy contact. Haymaker respects
boss movement resistance; Second wind restores plants only on a landed flurry
finish. See [the gameplay contract](../../design/polge-v3.md).

The October 3 gameplay pass preserves every runtime PNG, palette, atlas, anchor
and native pixel registration. It makes no new Figma synchronization claim:
connected accounts require reauthentication, and the offline manifest remains
the existing art evidence. Any future art edit must use the current Figma
workflow and pass its all-MATCH comparison; there is no pending-art exception.
