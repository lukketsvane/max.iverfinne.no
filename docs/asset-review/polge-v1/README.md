# Pølge, the mannequin

The owner's 56 transparent PNGs from Untitled.zip are preserved in `source/`.
`python3 scripts/build-polge.py` rebuilds the two runtime sheets and their atlas.
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
`assets/figma-pending.json` under the repository's waiting-for-Figma procedure.
