# Yeet and the black cat

These are isolated pixels from the existing Figma encounter sheet, node 527:13518, not new character drawings. The original workbench remains unchanged.

`yeet.png` has 32 frames in 32 by 32 cells, anchor (16,31). `cat.png` has 32 frames in 16 by 16 cells, anchor (8,15). Draw both at native 1x with integer destinations and smoothing disabled. The cat is a separate actor with its own position, facing, animation clock and ground contact, replicated by the host.

The four rows preserve source rows 0, 1, 3 and 7: idle, approach, beckon and escape. Source row 1 column 2 touches at the cat tail; the cat ends at x=14 and Yeet begins at x=15. Other frames separate by their disconnected silhouettes. All retained pixels keep their original colours. The flat #f5f5f5 export background is removed, with zero RGB under transparent pixels. Neither runtime sheet contains the other actor.

`atlas.json` records every frame rectangle, opaque bound and source registration. The exact runtime PNG bytes are in Figma production nodes 574:13527 and 582:13528 and pinned by the canonical manifest.
