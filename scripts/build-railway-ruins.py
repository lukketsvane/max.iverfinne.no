"""Build the Railway Ruins picture level (garden 2) at Max's scale.

The owner's railway scene and kit sheets are painted at about four times the
game's pixel size. Everything here is brought down to native pixels, where Max
(about 22 px tall) stands as tall as the people in the scene:

- the scene is downscaled 1/4 and stands in the middle of the garden. Its dark
  sky above the upper floor is cleared, so the station, the viaduct and the lift
  tower stand against the garden's own night sky;
- the kit sheets (stone ruins, wooden piers and ladders, mossy islands at 1/4,
  the mill machinery at 1/8, planters and lanterns from the Pixel Mill cut of
  the mill scene, and arch blocks, stairs, pillars, slabs and water from the
  Pixel Mill cut of the mossy-ruins sheet, its keyed-out holes filled again) are cut into pieces and placed west and east of it, so the
  garden is as wide as the gardens that follow.

Collision is the floors the pictures show: the scene's lower court and rail
terrace as 3 px rock, its decks, vine and tower rungs as one-way ledges, and for
every placed kit piece the role it plays (a deck, a stair, a ladder, the tops of
a mossy island, or nothing for decor). Ledges are one-way and never drawn again.

    python3 scripts/build-railway-ruins.py [--preview out.png [--reach reach.json]]
      -> assets/levels-v1/railway-ruins.png, levels-v1/railway-ruins.js

The preview doubles the art with rock in red, ledges in yellow, markers in
green and the soil in blue; with a reach file from `node tests/picture-sweep.cjs
bulwark 1 reach.json` it also marks every spot a walking Bulwark stood on.

Needs Pillow, numpy and scipy.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kitlib  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
REVIEW = ROOT / 'docs/asset-review/railway-ruins-v1'
ART = 'assets/levels-v1/railway-ruins.png'
DATA = 'levels-v1/railway-ruins.js'
GARDEN = 2

W, H = 1080, 224
GROUND = 200                 # the garden's soil in art rows; the scene's court sits on it
SX, SY = 300, 32             # where the scene's top-left lands; its soil (row 168) meets GROUND
SCENE_SOIL, SCENE_ROWS = 168, 192

# ---------------------------------------------------------------- the pieces
# ---------------------------------------------------------------- the scene
def scene():
    """The railway scene at 1/4 with its sky cleared down to the upper floor."""
    src = Image.open(REVIEW / 'source.png').convert('RGB')
    n = np.array(src.resize((384, 216), Image.BOX)).astype(int)[:SCENE_ROWS]
    lum = (n * [0.3, 0.59, 0.11]).sum(-1)
    dark = lum < 16
    dark[95:] = False                                  # never below the upper floor
    lab, _ = ndimage.label(dark)
    sky = np.isin(lab, [i for i in np.unique(lab[0]) if i])
    solid = ~sky
    # specks left floating in the sky go too
    blobs, _ = ndimage.label(solid, structure=np.ones((3, 3)))
    sizes = ndimage.sum(np.ones_like(blobs), blobs, range(1, blobs.max() + 1))
    for i, s in enumerate(sizes, 1):
        if s < 12:
            solid[blobs == i] = False
    return np.dstack([n, np.where(solid, 255, 0)]).astype(np.uint8)


# The scene's own floors, in scene pixels. The court is a surface profile down
# to the soil; its ramps are 1:1 so Max walks them both ways.
COURT = [(-12, 168), (-1, 157), (37, 157), (38, 160), (95, 160), (96, 168), (100, 168), (103, 165), (120, 165),
         (123, 168), (167, 168), (184, 151), (210, 151), (214, 155), (240, 155), (246, 161), (250, 163),
         (281, 163), (291, 153), (325, 153), (327, 155), (339, 167), (365, 167), (366, 165), (381, 165), (384, 168)]
TERRACE = [(0, 93), (40, 93), (44, 99), (112, 99), (115, 93), (160, 94), (160, 117), (0, 117)]
SCENE_LEDGES = [(150, 94, 116), (276, 94, 108), (172, 86, 11), (189, 88, 25), (128, 84, 14)]
SCENE_LEDGES += [(221, y, 14) for y in (138, 121, 104)]                       # the vine off the bridge
SCENE_LEDGES += [(338, y, 20) for y in (150, 133, 116, 77, 60)] + [(334, 43, 28)]  # rungs up the lift tower


# ---------------------------------------------------------------- the garden
# (piece, x, y of its top-left in art pixels, role, flip). Roles:
#   deck   one-way ledge along the widest opaque row near the top
#   tops   one-way ledges along the piece's top edge wherever it runs level
#   stair  solid rock under the piece's top edge (steps of 6 px or less)
#   ladder one-way rungs every 17 px from the soil up to the top
#   back / decor  nothing to stand on (back is drawn behind the scene)
def at_soil(h, sink=0):
    return GROUND - h + sink


PLACE = [
    # west: the mill race, the pier and the stair up to the station
    ('machinery/wheel', 70, at_soil(111, 30), 'back', False),
    ('machinery/crank', 200, at_soil(37), 'decor', False),
    ('stone/rubble-mid', 4, at_soil(27, 2), 'decor', False),
    ('stone/stairs-up', 96, at_soil(41), 'stair', False),
    ('bridges/short-bridge', 22, 158, 'deck', False),
    ('bridges/long-pier', 152, 128, 'deck', False),
    ('mill/lamp-post', 170, at_soil(49), 'decor', False),
    ('stone/pillar-tall', 286, at_soil(127), 'back', False),
    ('mill/planter-mixed', 250, 116, 'decor', False),
    # east: the colonnade, the ladder, the mossy heights and the long slope down
    ('stone/arch-large', 700, at_soil(51), 'back', False),
    ('stone/pillar-mid', 772, at_soil(94), 'tops', False),
    ('stone/lintel-mid', 700, 146, 'deck', False),
    ('stone/pillar-short', 812, at_soil(60), 'tops', False),
    ('stone/stairs-down', 846, at_soil(41), 'stair', True),
    ('bridges/tall-ladder', 900, at_soil(99), 'ladder', False),
    ('mossy/ring-island', 866, 62, 'tops', False),
    ('mill/lantern', 930, 110, 'decor', False),
    ('mossy/long-slope', 836, 122, 'tops', True),
    ('stone/rubble-large', 968, at_soil(36, 4), 'decor', False),
    ('mill/planter-wide', 1030, at_soil(24), 'decor', False),
]
MARKERS = [
    ('reward', SX + 346, SY + 43), ('seed', SX + 201, SY + 88),
    ('trial', SX + 196, SY + 151), ('trial', 736, 146),
    ('bonus', 230, 128), ('bonus', 920, 62),
    ('puzzle', 214, GROUND), ('door', SX + 20, SY + 93),
    ('dig', SX + 265, SY + 163), ('secret', 1052, GROUND),
]


def profile_rock(points, dx, dy):
    """Rock under a surface profile, down to the soil."""
    m = np.zeros((H, W), bool)
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        for x in range(x0, x1):
            y = y0 + (y1 - y0) * (x - x0) / max(1, x1 - x0)
            X = x + dx
            if 0 <= X < W:
                m[int(round(y)) + dy:GROUND, X] = True
    return m


def polygon_rock(points, dx, dy):
    from PIL import ImageDraw
    im = Image.new('1', (W, H), 0)
    ImageDraw.Draw(im).polygon([(x + dx, y + dy) for x, y in points], fill=1)
    return np.array(im, bool)


def build():
    level = kitlib.Level(W, H, GROUND)
    for name, x, y, role, flip in [p for p in PLACE if p[3] == 'back']:
        level.place(name, x, y, role, flip)
    level.paste(scene(), SX, SY, H)
    for name, x, y, role, flip in [p for p in PLACE if p[3] != 'back']:
        level.place(name, x, y, role, flip)
    level.art[GROUND:, :, 3] = np.where(level.art[GROUND:, :, 3] > 0, 255, 0)
    level.rock |= profile_rock(COURT, SX, SY) | polygon_rock(TERRACE, SX, SY)
    level.ledges += [(SX + x, SY + y, w) for x, y, w in SCENE_LEDGES]
    return level.finish()


def main():
    level = build()
    level.save(GARDEN, 'railway-ruins', MARKERS,
               'Garden 2, the Railway Ruins at native pixels: built by scripts/build-railway-ruins.py from '
               'docs/asset-review/railway-ruins-v1 (the owner\'s scene and kit sheets).',
               ART, DATA, placements=REVIEW / 'placements.json', extra={'scene': {'x': SX, 'y': SY, 'w': 384, 'h': SCENE_ROWS}})
    print(ART, (W, H), 'blocks', len(level.blocks()), 'ledges', len(level.ledges))
    if '--preview' in sys.argv:
        reach = sys.argv[sys.argv.index('--reach') + 1] if '--reach' in sys.argv else None
        level.preview(sys.argv[sys.argv.index('--preview') + 1], MARKERS, reach)


if __name__ == '__main__':
    main()
