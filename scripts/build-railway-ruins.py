"""Build the Railway Ruins picture level (garden 1) from the owner's concept scene.

The scene is used at 1:1. The painting's lowest floors sit on the garden's soil
(GROUND); an entrance tunnel is painted under the lower arcade so Max walks in
from the garden on the soil line. Collision is the floors the painting shows:
the lower court as a surface profile traced into 3 px rock, the rail terrace as
one solid slab, the two rail bridges as one-way decks, and rungs on the hanging
vine and inside the lift tower so a walking Bulwark can climb from the court to
the rails and the top of the tower. Everything else is open air.

    python3 scripts/build-railway-ruins.py
      -> assets/levels-v1/railway-ruins.png, levels-v1/railway-ruins.js

Needs Pillow and numpy.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/asset-review/railway-ruins-v1/source.png'
ART = 'assets/levels-v1/railway-ruins.png'
DATA = 'levels-v1/railway-ruins.js'
GARDEN = 1
W, H = 1536, 720
GROUND = 673                   # the lower court's floor is the garden's soil
TUNNEL = (0, 386, 650, GROUND)  # x0, x1, y0, y1: in from the garden under the lower arcade
CELL = 3

# The lower court's walking surface, left to right. Its ramps are 1:1, so Max's
# feet never straddle a rise above his 6 px step-up and he walks them both ways.
COURT = [(0, 629), (150, 629), (152, 643), (385, 643), (386, 673), (400, 673), (411, 662), (480, 662),
         (491, 673), (667, 673), (736, 604), (840, 604), (858, 622), (960, 622), (984, 646), (1000, 651),
         (1125, 651), (1165, 611), (1300, 611), (1310, 619), (1358, 667), (1460, 667),
         (1462, 662), (1525, 662), (1536, 673)]
# The rail terrace: a trench where the tram car lies, ramps in and out of it.
TERRACE = [(0, 371), (162, 371), (175, 397), (447, 397), (460, 371), (640, 376), (640, 470), (0, 470)]
# One-way ledges the painting already shows (never drawn again): the two rail
# decks, the carts, the crate steps, the vine down from the bridge and the
# rungs of the lift tower up to its roof beam, and a stepping stone out of the
# culvert's mouth onto the lower arcade.
LEDGES = [(600, 377, 463), (1103, 377, 433), (690, 343, 46), (757, 354, 98), (387, 658, 14),
          (522, 357, 30), (522, 339, 33), (556, 323, 24)]
LEDGES += [(900, y, 28) for y in range(605, 380, -17)]            # the vine off the bridge
LEDGES += [(1366, y, 64) for y in range(650, 150, -17) if abs(y - 377) > 6] + [(1345, 157, 106)]  # the lift tower
MARKERS = [
    ('reward', 1400, 157), ('seed', 805, 354), ('trial', 790, 604), ('trial', 1232, 377),
    ('bonus', 60, 371), ('bonus', 567, 323), ('puzzle', 80, 629), ('door', 250, 397),
    ('dig', 1060, 651), ('secret', 1508, 377),
]


def paint_tunnel(rgb):
    """A low culvert under the lower arcade: dark air, a cobbled ceiling rim with
    moss hanging from it, the court's mossy floor and two lamps."""
    img = rgb.copy()
    x0, x1, y0, y1 = TUNNEL
    rng = np.random.default_rng(11)
    shade = np.linspace(0.75, 1.2, y1 - y0)[:, None, None]
    fill = np.array([14, 16, 26], float) * shade + rng.normal(0, 1.0, (y1 - y0, x1 - x0, 3))
    img[y0:y1, x0:x1] = np.clip(fill, 0, 255).astype(np.uint8)
    rim = rgb[634:646, 20:140].reshape(-1, 3)
    rim = rim[rim.max(1) > 30]
    moss = np.array([[46, 70, 44], [62, 92, 52], [38, 58, 40], [86, 118, 60]])
    depth = np.clip(np.cumsum(rng.integers(-1, 2, x1 - x0)) % 4 + 2, 2, 5)
    for i, x in enumerate(range(x0, x1)):
        for y in range(y0, y0 + depth[i]):
            img[y, x] = rim[rng.integers(len(rim))]
        if rng.random() < 0.12:
            for y in range(y0 + depth[i], y0 + depth[i] + rng.integers(2, 7)):
                img[y, x] = moss[rng.integers(len(moss))]
    floor = rgb[670:682, 650:700]                     # the court's floor right of the pool
    for x in range(x0, x1, floor.shape[1]):
        n = min(floor.shape[1], x1 - x)
        img[y1 - 3:y1 + 9, x:x + n] = floor[:, :n]
    lamp = rgb[518:542, 94:112]                       # the lamp under the lower arcade
    for lx in (120, 300):
        spot = img[y0 + 6:y0 + 6 + lamp.shape[0], lx:lx + lamp.shape[1]]
        lit = lamp.max(2) > 60
        spot[lit] = lamp[lit]
    return img


def rock_mask():
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    d.polygon(COURT + [(W, GROUND), (0, GROUND)], fill=255)
    d.polygon(TERRACE, fill=255)
    x0, x1, y0, y1 = TUNNEL
    d.rectangle([x0, y0, x1 - 1, y1], fill=0)
    return np.asarray(im) > 0


def blocks(rock):
    """Greedy rectangles over the 3 px rock grid, the picture level format."""
    gh, gw = H // CELL, W // CELL
    cells = rock[CELL // 2::CELL, CELL // 2::CELL][:gh, :gw].copy()
    out = []
    for gy in range(gh):
        gx = 0
        while gx < gw:
            if not cells[gy, gx]:
                gx += 1
                continue
            run = gx
            while run < gw and cells[gy, run]:
                run += 1
            h = 1
            while gy + h < gh and cells[gy + h, gx:run].all():
                h += 1
            cells[gy:gy + h, gx:run] = False
            out.append([gx * CELL, gy * CELL, (run - gx) * CELL, h * CELL])
            gx = run
    return out


def main():
    rgb = np.asarray(Image.open(SOURCE).convert('RGB').crop((0, 0, W, H))).copy()
    rgb = paint_tunnel(rgb)
    art = Image.fromarray(rgb).quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    (ROOT / ART).parent.mkdir(parents=True, exist_ok=True)
    art.save(ROOT / ART, optimize=True)
    rock = rock_mask()
    rock[GROUND:] = False  # the soil below takes over under the ground line
    data = {
        'id': 'railway-ruins', 'w': W, 'h': H, 'art': ART, 'entry': {'x': 8, 'y': GROUND},
        'blocks': blocks(rock), 'ledges': [list(l) for l in LEDGES], 'hazards': [],
        'markers': [list(m) for m in MARKERS],
    }
    js = '(window.MaxPictureLevels=window.MaxPictureLevels||{})[%d]=%s;\n' % (GARDEN, json.dumps(data, separators=(',', ':')))
    (ROOT / DATA).write_text(js)
    print(ART, (ROOT / ART).stat().st_size, 'bytes;', len(data['blocks']), 'blocks,', len(LEDGES), 'ledges')


if __name__ == '__main__':
    main()
