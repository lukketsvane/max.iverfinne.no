# Sligo's plants — the cord and the cap

Max Sligo Neverdahl, the hidden pink tardigrade, grows only two plants, both like umbilical cords. The owner painted them as exploded views, the same layout as the existing plants: the stem line beside the plant, the stem slices spread apart, the head above and the root below.

- `cord-source.png`: ten pink cords (2 × 5). Each has a trunk of stacked boxes, a coiling cord with small curls on top and tentacle roots. The background is transparent, with a noisy red halo in the half-transparent fringe.
- `cap-source.png`: nine red cords (3 × 3). Each has a brain or mushroom cap, a coiled glossy cord, loose round beads and dark fibrous roots. There is a red glow behind each plant.

## Build

`scripts/build-sligo-plants.py` (Pillow, numpy, scipy) cuts every piece from the paintings and brings it to native pixels. It uses the premultiplied box filter and cuts alpha hard at half. Everything under half alpha goes, and with it the halo and the glow, and so do specks under 40 px.

| Plant | Stem slices | Flower heads | Blooms | Roots |
| --- | --- | --- | --- | --- |
| Cord (kind 25, `assets/plants-v1/sligo-cord/`) | 6 trunk boxes, each with the neck above it (1/3.9) | 3: the loop, the knot and the hook of the coiled top (1/6) | 5 small curls, base on the left (1/5) | 3 tentacle roots (1/8) |
| Cap (kind 26, `assets/plants-v1/sligo-cap/`) | 6 lengths of the glossy coil (1/5) | 3 caps: two brains and one dripping mushroom (1/5) | 4 loose beads (1/5) | 3 fibrous roots (1/6) |

The pixel rules all live in the script:

- The colours come from each painting's own ramps: the median of each luminance band.
- A pixel that is mostly the painting's line work takes the outline. A pixel that is mostly highlight takes the gloss. Every other pixel takes the nearest ramp step, so no blend survives.
- Specks and one-pixel holes go.
- A 1 px dark outline goes round every shape. Thin parts darken only on their lower and right edges, so a curl keeps its lit top.
- A pixel that none of its neighbours shares takes its neighbours' colour.
- The trunk boxes are symmetric. The coil is cut where it runs straight up, slid sideways so every length starts and ends on the centre column, and given the same 7 px passage at both ends. The game mirrors every other slice, and the stacks stay unbroken.
- Each family keeps one palette: 6 colours for the cord, 14 for the cap.

## Previews

- `pieces-4x.png`: every piece at 4×. The cord comes first (slices, heads, blooms, roots), then the cap.
- `assembled-1x.png` and `assembled-4x.png`: both plants drawn by the game's own plant renderer. Each is shown at growth 0.3, 0.7, 1.2 and 2.4 in the plant gallery's frame, then as a beanstalk.
- `exploded-2x1-1x.png` and `exploded-2x1-4x.png`: both grown plants taken apart as the owner laid them out. The views are on a transparent 2:1 ground.

## Game

`index.html` adds the families as `PA.fam` 9 and 10, with a folder (`dir`), blooms (`b`) and roots (`r`) of their own, and the kinds as 25 (cord, heal, tier 1) and 26 (cap, bind, tier 2). `SLIGO_PLANTS` keeps them away from ordinary seeds (`gardenKindFor`) and out of the garden collection. The other 25 kinds draw exactly as before.

## Figma

These files are not in Figma yet. `assets/figma-pending.json` pins them. See `docs/figma.md`, "Waiting for Figma".
