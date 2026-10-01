# Rattus Ring gear — final five-sheet selection

The final character is an adult anthropomorphic rat with fully grey fur,
orange hair, a pink tail, muscular hips/thighs, and magenta/gold bra, briefs
and boots. Every selected sheet is unarmed, without a hat or cape.

Five unchanged image_gen originals provide 320 complete figures in visual
8×8 layouts. Alpha-240 connected-body checks found 64 separate bodies per
sheet, with positive padding and no significant canvas-edge pixels. The
revised fifth source has 64 separate whole bodies at alpha240 and250 on a
1265×1243 canvas; its prone boots, tails and wide splits are complete. Actual source coverage:

| Original | Coverage |
| --- | --- |
| [01](sheets/01-grounded-thigh-strikes.png) | Guard, knee/front/high kicks, seated sweeps, dropkicks, split planting |
| [02](sheets/02-aerial-saltos.png) | Forward/backward saltos, cartwheels, jumping knees and aerial leg attacks |
| [03](sheets/03-sweeps-and-split-planting.png) | Aerial rotations, low hand-supported sweeps and full split planting |
| [04](sheets/04-high-kicks-and-knee-combos.png) | High kicks, jumping knees, low sweeps and split recovery |
| [05](sheets/05-movement-and-ring-animation-cycles.png) | Eight new cycles: strut walk, run, hip check, split stomp, leg scissors, salto, comedic slip/prone recovery, rear hip-bounce taunt, jump and splits |

[metadata.json](metadata.json) records exact source paths, dimensions,
SHA-256 hashes, alpha measurements, measured row centers and coverage.
[prompts.json](prompts.json) preserves the exact final tool prompts.
[rattus-ring-gear-five-sheets.zip](rattus-ring-gear-five-sheets.zip) contains
these five original PNGs, metadata, prompts and this README. Earlier
black/gold candidates remain preserved outside the archive.

The native compiler uses immutable byte-matching copies named
rattus-ring-v4-01.png through -04.png and revised rattus-ring-v6-05.png in
characters-v2/source. Exact active prompts are rattus-ring-v6-prompts.json;
the previous fifth master and v4 prompts remain pinned historical sources. One fixed
0.170 nearest-neighbour reduction fits the widest 186-pixel figure inside
32 pixels. All 128 selected runtime cells preserve integer anchor (16,31),
16 palette colours, binary alpha and the original 25 clip timings/markers.
The latest Ring gear retains the moss-pink cosmetic key and
rattle-norvegicus-pink pack directory for compatibility. Earlier Rattus
runtime outfits are retired; Ring gear is the sole independent Rattus pack.
Cairn and Mycel packs remain byte-identical. Main row3 presents the new
taunt; rest holds the complete prone drawing and landing uses floor-contact
splits/crouch/rise, preserving all existing gameplay timings.

Runtime review images are in ../characters-v2/rattle-pink-sheets-1x.png and
rattle-pink-sheets-4x.png; pink-planting-1x.png / pink-planting-4x.png show
both complete magenta boots held through sow hit frame 6. The source PNGs
have graded alpha and dimensions not divisible by eight, so they are not
ready-made native atlases. The game loads only the compiled native sheets.
