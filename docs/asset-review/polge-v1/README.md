# Pølge, the mannequin

Current authoring: [Figma native masters](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=160-2). Tool instructions below describe historical imports; the retired scripts and demos are linked to their final source revision. Follow [the current art contract](https://github.com/lukketsvane/max.iverfinne.no/blob/main/docs/figma.md) for edits.
The owner's 56 transparent PNGs from Untitled.zip are preserved in `source/`.
[historical build-polge.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-polge.py) rebuilds the two runtime sheets and their atlas.
Every pose has the same 0.72 reduction, binary alpha and one shared 16-colour
palette. Cells are 32×32, anchored at (16,31), with each pose registered to the
original animation's foot position. All named clips and gameplay event markers
are unchanged. The last two source rows supply tending, landing and rest;
the topple sequence supplies jumps and the collapsed rest. No limbs are invented.

Pølge rolls readily but tends slowly. His skill leaves a six-second stand-in
that lures ordinary pests within 70px, withstands three bites, then bursts.
Bosses ignore the lure but take burst damage. Varnish adds bites; Splinters adds
damage and reach; Raincoat waters nearby plants when it bursts. These boons are
exclusive to Pølge. The stand-in is host-owned, travels in snapshots, never enters
plant records, and disappears on departure or stage change.

Figma desktop was unavailable. The generated sheets are pinned in
the retired pending-art list under the repository's waiting-for-Figma procedure.
