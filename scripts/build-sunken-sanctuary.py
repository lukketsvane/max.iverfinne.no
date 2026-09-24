"""Build the Sunken Sanctuary picture level (garden 2) from the owner's concept sheet.

The sheet's level illustration is used at 1:1. Its labels, markers and legend
are painted out, an entrance tunnel is painted along the ground line, and the
rock is traced into 3 px collision blocks: everything inside the picture is
rock except the sky above the top outline and the chambers listed below.

    python3 scripts/build-sunken-sanctuary.py
      -> assets/levels-v1/sunken-sanctuary.png, levels-v1/sunken-sanctuary.js

Needs Pillow, numpy and opencv-python-headless.
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/asset-review/sunken-sanctuary-v1/source.jpg'
ART = 'assets/levels-v1/sunken-sanctuary.png'
DATA = 'levels-v1/sunken-sanctuary.js'
GARDEN = 2
W, H = 1536, 540
GROUND = 490  # the tunnel floor and the lowest walkable floor sit on the garden's soil
TUNNEL = (0, 535, 465, GROUND)  # x0, x1, y0, y1
CELL = 3

# Labels and legend baked into the sheet: (x0, y0, x1, y1).
LABELS = [
    (28, 8, 312, 84),      # title block
    (58, 104, 110, 162),   # SPAWN
    (372, 172, 472, 214),  # THE OLD BRIDGE
    (726, 194, 802, 234),  # THE HEART
    (360, 352, 470, 394),  # ROOTED CAVERNS
    (724, 432, 804, 474),  # THE DEPTHS
    (1078, 402, 1180, 444),  # FLOODED HALLS
    (1256, 142, 1346, 184),  # BROKEN SPIRE
    (1412, 326, 1494, 370),  # THE GROTTO
    (1476, 92, 1520, 154),   # EXIT
    (14, 436, 166, 526),   # legend
    (1326, 490, 1528, 526),  # footnote
]

# Open air: the sky above the top outline and every chamber, as polygons.
SKY = [(0, 0), (1536, 0), (1536, 14), (1506, 18), (1505, 150), (1462, 150), (1456, 118), (1430, 116),
       (1380, 124), (1340, 184), (1298, 186), (1295, 222), (1265, 222), (1262, 194), (1250, 190),
       (1140, 190), (1124, 205), (1120, 212), (1118, 252), (1032, 252), (1030, 212), (1003, 208),
       (1000, 222), (950, 222), (890, 215), (888, 196), (840, 190), (825, 170), (760, 165), (700, 168),
       (645, 178), (640, 194), (560, 196), (556, 200), (502, 200), (502, 232), (438, 232), (430, 252),
       (378, 252), (372, 224), (372, 195), (365, 188), (332, 178), (318, 163), (48, 162), (34, 158),
       (30, 100), (24, 44), (0, 40)]
CHAMBERS = {
    'upper room': [(52, 170), (318, 170), (330, 182), (362, 194), (365, 229), (52, 229)],
    'first fall': [(255, 158), (275, 158), (275, 172), (255, 172)],
    'middle hall': [(100, 270), (140, 238), (362, 238), (368, 258), (440, 258), (446, 242), (556, 242),
                    (560, 228), (640, 228), (640, 345), (630, 345), (572, 340), (566, 324), (510, 324),
                    (505, 315), (482, 300), (475, 292), (358, 292), (350, 307), (200, 307), (118, 352),
                    (100, 352)],
    'rooted caverns': [(100, 360), (200, 316), (350, 316), (358, 300), (476, 300), (483, 312), (483, 398),
                       (468, 398), (450, 410), (427, 428), (245, 428), (245, 402), (100, 402)],
    'root hollow': [(470, 400), (488, 376), (628, 370), (628, 490), (470, 490)],
    'rope ladder': [(322, 300), (340, 300), (340, 320), (322, 320)],
    'heart and depths': [(628, 228), (652, 215), (895, 215), (900, 236), (1000, 236), (1000, 370),
                         (1003, 505), (628, 505)],
    'tunnel': [(0, 465), (535, 465), (535, 490), (0, 490)],
    'second fall': [(1100, 250), (1120, 250), (1120, 264), (1100, 264)],
    'spray ledge': [(1010, 262), (1182, 258), (1182, 287), (1105, 287), (1088, 300), (1082, 332), (1010, 332)],
    'flooded halls': [(1082, 300), (1105, 300), (1105, 340), (1180, 340), (1200, 352), (1235, 352), (1258, 360),
                      (1258, 458), (1000, 458), (1000, 347), (1080, 347)],
    'spire hall': [(1140, 198), (1262, 198), (1265, 228), (1298, 228), (1298, 275), (1140, 275)],
    'grotto gate': [(1242, 302), (1372, 300), (1372, 395), (1290, 395), (1290, 356), (1242, 356)],
    'grotto': [(1378, 300), (1500, 300), (1500, 378), (1410, 378), (1410, 395), (1372, 395), (1372, 362),
               (1378, 362)],
    'spring room': [(1382, 190), (1500, 190), (1500, 230), (1382, 230)],
    'spring fall': [(1430, 116), (1455, 116), (1455, 192), (1430, 192)],
}
# The colonnade floor under the ruins stands in the depths.
ROCK_IN_AIR = [[(888, 368), (1000, 368), (1000, 412), (888, 412)]]
# One-way ledges, never drawn: the bridges and root shelf the art already
# shows, root steps up from the tunnel into the rooted caverns, the rungs of
# the rope ladder up to the middle hall, and a stone out of the depths.
LEDGES = [(376, 228, 62), (1032, 212, 86), (472, 466, 86), (490, 443, 26), (470, 420, 22),
          (324, 410, 14), (324, 392, 14), (324, 374, 14), (324, 356, 14), (324, 338, 14), (324, 321, 14),
          (322, 307, 18), (984, 474, 18)]
MARKERS = [
    ('reward', 330, 427), ('seed', 1190, 458), ('trial', 800, 490), ('trial', 1120, 458),
    ('bonus', 84, 162), ('bonus', 406, 228), ('puzzle', 200, 229), ('door', 1484, 150),
    ('dig', 250, 490), ('secret', 1456, 378),
]


def paint_labels(rgb):
    img = rgb.copy()
    mask = np.zeros((H, W), np.uint8)
    for x0, y0, x1, y1 in LABELS:
        box = img[y0:y1, x0:x1].astype(int)
        v = box.max(2)
        spread = box.max(2) - box.min(2)
        bright = (v > 105) | ((v > 70) & (spread < 40) & (v > np.median(v) + 30))
        mask[y0:y1, x0:x1][bright] = 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2)
    return cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA)


def paint_tunnel(rgb):
    """A low cave along the ground line: dark air, a cobbled ceiling rim with
    moss hanging from it, the root hollow's grassy floor and two lamps."""
    img = rgb.copy()
    x0, x1, y0, y1 = TUNNEL
    rng = np.random.default_rng(7)
    shade = np.linspace(0.8, 1.2, y1 - y0)[:, None, None]
    fill = np.array([16, 20, 36], float) * shade + rng.normal(0, 1.0, (y1 - y0, x1 - x0, 3))
    img[y0:y1, x0:x1] = np.clip(fill, 0, 255).astype(np.uint8)
    rim = rgb[300:312, 20:95].reshape(-1, 3)          # cobbles of the outer cliff
    rim = rim[rim.max(1) > 28]
    moss = np.array([[44, 66, 52], [58, 84, 60], [36, 54, 48], [70, 98, 74]])
    depth = np.clip(np.cumsum(rng.integers(-1, 2, x1 - x0)) % 4 + 2, 2, 5)
    for i, x in enumerate(range(x0, x1)):
        for y in range(y0, y0 + depth[i]):
            img[y, x] = rim[rng.integers(len(rim))]
        if rng.random() < 0.12:
            for y in range(y0 + depth[i], y0 + depth[i] + rng.integers(2, 7)):
                img[y, x] = moss[rng.integers(len(moss))]
    floor = rgb[484:494, 566:626]                     # the root hollow's lower floor
    for x in range(x0, x1, floor.shape[1]):
        n = min(floor.shape[1], x1 - x)
        img[y1 - 4:y1 + 6, x:x + n] = floor[:, :n]
    lamp = rgb[384:400, 118:132]                      # the lamp in the rooted caverns
    for lx in (150, 356):
        spot = img[y1 - 4 - lamp.shape[0]:y1 - 4, lx:lx + lamp.shape[1]]
        lit = lamp.max(2) > 40
        spot[lit] = lamp[lit]
    return img


def paint_stone(rgb):
    """The stepping stone out of the depths: a lip of the rooted caverns floor."""
    img = rgb.copy()
    cap = rgb[425:434, 330:350]
    x, y = 983, 472
    img[y:y + cap.shape[0], x:x + cap.shape[1]] = cap
    return img


def air_mask():
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    d.polygon(SKY, fill=255)
    for poly in CHAMBERS.values():
        d.polygon(poly, fill=255)
    for poly in ROCK_IN_AIR:
        d.polygon(poly, fill=0)
    return np.asarray(im) > 0


def blocks(rock):
    """Greedy rectangles over the 3 px rock grid, the Moonlit Ruins format."""
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
    rgb = paint_stone(paint_tunnel(paint_labels(rgb)))
    art = Image.fromarray(rgb).quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    (ROOT / ART).parent.mkdir(parents=True, exist_ok=True)
    art.save(ROOT / ART, optimize=True)
    rock = ~air_mask()
    rock[GROUND:] = False  # the soil below takes over under the ground line
    data = {
        'id': 'sunken-sanctuary', 'w': W, 'h': H, 'art': ART, 'entry': {'x': 8, 'y': GROUND},
        'blocks': blocks(rock), 'ledges': [list(l) for l in LEDGES], 'hazards': [],
        'markers': [list(m) for m in MARKERS],
    }
    js = '(window.MaxPictureLevels=window.MaxPictureLevels||{})[%d]=%s;\n' % (GARDEN, json.dumps(data, separators=(',', ':')))
    (ROOT / DATA).write_text(js)
    print(ART, (ROOT / ART).stat().st_size, 'bytes;', len(data['blocks']), 'blocks')


if __name__ == '__main__':
    main()
