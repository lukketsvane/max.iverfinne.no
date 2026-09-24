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

ROOT = Path(__file__).resolve().parent.parent
REVIEW = ROOT / 'docs/asset-review/railway-ruins-v1'
ART = 'assets/levels-v1/railway-ruins.png'
DATA = 'levels-v1/railway-ruins.js'
GARDEN = 2
CELL = 3

W, H = 1080, 224
GROUND = 200                 # the garden's soil in art rows; the scene's court sits on it
SX, SY = 300, 32             # where the scene's top-left lands; its soil (row 168) meets GROUND
SCENE_SOIL, SCENE_ROWS = 168, 192

# ---------------------------------------------------------------- the pieces
# Kit sheets and the scale each is cut at (1/f), and each piece's box in the
# owner's sheet (source pixels). A piece is the largest opaque part in its box.
KITS = {'machinery': 8, 'bridges': 4, 'mossy': 4, 'stone': 4}
PIECES = {
    'machinery': {'wheel': (66, 66, 882, 888), 'crank': (1242, 108, 186, 222), 'press-frame': (1014, 282, 168, 588), 'sluice-crate': (1254, 366, 222, 396), 'hub': (1278, 786, 174, 162)},
    'bridges': {'long-pier': (80, 132, 688, 356), 'railed-pier': (824, 52, 608, 492), 'tall-post': (488, 584, 48, 344), 'tall-ladder': (932, 576, 72, 396), 'short-bridge': (68, 628, 360, 96), 'short-ladder': (748, 712, 76, 176), 'stub-post': (608, 736, 44, 152), 'trestle': (1044, 836, 448, 124)},
    'mossy': {'stepped-cliff': (640, 32, 836, 568), 'colonnade-island': (60, 72, 516, 324), 'ring-island': (76, 372, 680, 340), 'wall-island': (360, 620, 668, 240), 'long-slope': (56, 776, 972, 228)},
    'stone': {'pillar-tall': (52, 52, 112, 508), 'pillar-mid': (252, 156, 120, 376), 'lintel-long': (948, 180, 532, 76), 'pillar-short': (476, 256, 144, 240), 'slab-mid': (700, 380, 212, 84), 'lintel-mid': (1024, 356, 380, 72), 'slab-small-b': (940, 524, 128, 56), 'stairs-down': (124, 624, 236, 164), 'stairs-up': (536, 624, 248, 164), 'slab-small': (540, 548, 144, 60), 'arch-large': (872, 616, 284, 204), 'arch-small': (1228, 684, 248, 136), 'rubble-large': (116, 824, 444, 144), 'rubble-mid': (692, 860, 332, 108), 'rubble-small': (1184, 912, 240, 56)},
}
MILL = {'planter-wide': '050', 'planter-pink': '051', 'planter-blue': '052', 'planter-mixed': '053',
        'lamp-post': '066', 'lantern': '067', 'lantern-round': '068', 'vine-long': '060',
        'vine-flower': '062', 'crate': '077', 'crate-small': '078', 'chest': '080'}
MILL_FRAME = 'B07C3D03-8D5E-4531-B6DC-41483A5A24DE-'
# The owner's Pixel Mill cut of a mossy-ruins sheet. Its background removal keyed
# out every pixel near (7, 15, 28), dark stone included, so enclosed holes are
# filled again with that colour mixed with the piece's own darkest tones.
RUINS = {'arch-block': '020', 'arch-block-b': '021', 'stair-slope': '023', 'stair-slope-b': '025', 'ledge': '002',
         'ledge-long': '012', 'step-block': '001', 'pillar': '034', 'pillar-b': '035', 'pillar-c': '036',
         'slab': '050', 'slab-b': '051', 'slab-c': '057', 'water': '076', 'water-b': '077', 'water-c': '086'}
RUINS_KEY = (7, 15, 28)


def native(path, f):
    """A sheet at 1/f: premultiplied box filter, then hard alpha at half."""
    im = Image.open(path).convert('RGBA')
    a = np.array(im).astype(float)
    a[..., :3] *= a[..., 3:4] / 255.0
    w, h = round(im.width / f), round(im.height / f)
    s = np.array(Image.fromarray(a.astype(np.uint8), 'RGBA').resize((w, h), Image.BOX)).astype(float)
    al = s[..., 3]
    rgb = np.where(al[..., None] > 0, s[..., :3] * 255.0 / np.maximum(al[..., None], 1), 0)
    out = np.dstack([np.clip(np.round(rgb), 0, 255), np.where(al >= 128, 255, 0)]).astype(np.uint8)
    out[out[..., 3] == 0, :3] = 0
    return out


def cut_kits():
    pieces = {}
    for kit, f in KITS.items():
        sheet = native(REVIEW / 'kits' / (kit + '.png'), f)
        lab, _ = ndimage.label(sheet[..., 3] > 0, structure=np.ones((3, 3)))
        for name, box in PIECES[kit].items():
            x, y, w, h = (round(v / f) for v in box)
            box = lab[y:y + h, x:x + w]
            ids, counts = np.unique(box[box > 0], return_counts=True)
            keep = [i for i, c in zip(ids, counts) if c >= 0.5 * (lab == i).sum()]
            part = sheet[y:y + h, x:x + w].copy()
            part[~np.isin(box, keep)] = 0
            pieces[kit + '/' + name] = trim(part)
    atlas = np.array(Image.open(REVIEW / 'kits/mill-scene/atlas.png').convert('RGBA'))
    frames = json.loads((REVIEW / 'kits/mill-scene/atlas.json').read_text())['frames']
    for name, key in MILL.items():
        fr, sp = frames[MILL_FRAME + key]['frame'], frames[MILL_FRAME + key]['spriteSourceSize']
        part = atlas[fr['y'] + sp['y']:fr['y'] + sp['y'] + sp['h'], fr['x'] + sp['x']:fr['x'] + sp['x'] + sp['w']].copy()
        part[part[..., 3] < 128] = 0
        part[..., 3] = np.where(part[..., 3] > 0, 255, 0)
        pieces['mill/' + name] = trim(part)
    atlas = np.array(Image.open(REVIEW / 'kits/mossy-ruins/atlas.png').convert('RGBA'))
    frames = json.loads((REVIEW / 'kits/mossy-ruins/atlas.json').read_text())['frames']
    for name, key in RUINS.items():
        fr, sp = frames['ruins-' + key]['frame'], frames['ruins-' + key]['spriteSourceSize']
        part = atlas[fr['y'] + sp['y']:fr['y'] + sp['y'] + sp['h'], fr['x'] + sp['x']:fr['x'] + sp['x'] + sp['w']].copy()
        part[part[..., 3] < 128] = 0
        part[..., 3] = np.where(part[..., 3] > 0, 255, 0)
        pieces['ruins/' + name] = trim(refill(part, 3 + int(key)))
    return pieces


def refill(a, seed):
    """Fill the holes the colour key punched into dark stone."""
    op = a[..., 3] > 0
    closed = ndimage.binary_fill_holes(ndimage.binary_closing(op, structure=np.ones((3, 3)), iterations=2))
    hole = (ndimage.binary_fill_holes(op) | closed & ndimage.binary_dilation(op)) & ~op
    if not hole.any():
        return a
    dark = a[op][:, :3]
    tone = dark[dark.astype(int).sum(1) <= np.percentile(dark.astype(int).sum(1), 20)]
    pick = tone[np.random.default_rng(seed).integers(len(tone), size=int(hole.sum()))]
    out = a.copy()
    out[hole, :3] = np.clip(pick * 0.5 + np.array(RUINS_KEY) * 0.5, 0, 255).astype(np.uint8)
    out[hole, 3] = 255
    return out


def trim(a):
    ys, xs = np.nonzero(a[..., 3])
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


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


def top_rows(a):
    """For each column the first opaque row, or -1."""
    op = a[..., 3] > 0
    return np.where(op.any(0), op.argmax(0), -1)


def runs(tops, tol=1, min_len=8):
    """Level stretches of a top edge: (x0, x1, y)."""
    out, x = [], 0
    while x < len(tops):
        if tops[x] < 0:
            x += 1
            continue
        y, x0 = tops[x], x
        while x < len(tops) and tops[x] >= 0 and abs(tops[x] - y) <= tol:
            x += 1
        if x - x0 >= min_len:
            out.append((x0, x, int(min(tops[x0:x]))))
    return out


def build():
    pieces = cut_kits()
    art = np.zeros((H, W, 4), np.uint8)
    rock = np.zeros((H, W), bool)
    ledges, used = [], []

    def paste(a, x, y, bottom=GROUND):
        h, w = a.shape[:2]
        ys, xs = slice(max(0, y), min(bottom, y + h)), slice(max(0, x), min(W, x + w))
        sub = a[ys.start - y:ys.stop - y, xs.start - x:xs.stop - x]
        m = sub[..., 3] > 0
        art[ys, xs][m] = sub[m]

    back = [p for p in PLACE if p[3] == 'back']
    front = [p for p in PLACE if p[3] != 'back']
    for name, x, y, role, flip in back:
        a = pieces[name][:, ::-1] if flip else pieces[name]
        paste(a, x, y)
        used.append((name, x, y, a.shape[1], a.shape[0], role, flip))
    paste(scene(), SX, SY, H)
    for name, x, y, role, flip in front:
        a = pieces[name][:, ::-1] if flip else pieces[name]
        h, w = a.shape[:2]
        paste(a, x, y)
        used.append((name, x, y, w, h, role, flip))
        tops = top_rows(a)
        if role == 'deck':
            op = a[..., 3] > 0
            row = next(r for r in range(h) if op[r].sum() >= 0.6 * w)
            xs = np.nonzero(op[row])[0]
            ledges.append((x + int(xs.min()), y + row, int(xs.max() - xs.min() + 1)))
        elif role == 'tops':
            for x0, x1, ty in runs(tops):
                ledges.append((x + x0, y + ty, x1 - x0))
        elif role == 'stair':
            for c in range(w):
                if tops[c] >= 0:
                    rock[y + tops[c]:GROUND, x + c] = True
        elif role == 'ladder':
            top = y + int(tops[tops >= 0].min())
            for ry in range(GROUND - 17, top - 1, -17):
                ledges.append((x - 3, ry, w + 6))
            ledges.append((x - 3, top, w + 6))
    art[GROUND:, :, 3] = np.where(art[GROUND:, :, 3] > 0, 255, 0)
    rock |= profile_rock(COURT, SX, SY) | polygon_rock(TERRACE, SX, SY)
    rock[GROUND:] = False
    ledges += [(SX + x, SY + y, w) for x, y, w in SCENE_LEDGES]
    return art, rock, ledges, used


def blocks(rock):
    """Greedy 3 px rectangles over the rock grid."""
    gh, gw = H // CELL, W // CELL
    grid = np.zeros((gh, gw), bool)
    for gy in range(gh):
        for gx in range(gw):
            grid[gy, gx] = rock[gy * CELL:(gy + 1) * CELL, gx * CELL:(gx + 1) * CELL].mean() >= 0.5
    out, seen = [], np.zeros_like(grid)
    for gy in range(gh):
        for gx in range(gw):
            if not grid[gy, gx] or seen[gy, gx]:
                continue
            w = 1
            while gx + w < gw and grid[gy, gx + w] and not seen[gy, gx + w]:
                w += 1
            h = 1
            while gy + h < gh and grid[gy + h, gx:gx + w].all() and not seen[gy + h, gx:gx + w].any():
                h += 1
            seen[gy:gy + h, gx:gx + w] = True
            out.append([gx * CELL, gy * CELL, w * CELL, h * CELL])
    return out


def main():
    art, rock, ledges, used = build()
    img = Image.fromarray(art, 'RGBA')
    q = img.convert('RGB').quantize(255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = np.dstack([np.array(q), art[..., 3]])
    out[out[..., 3] == 0, :3] = 0
    (ROOT / ART).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out, 'RGBA').save(ROOT / ART, optimize=True)
    data = {
        'id': 'railway-ruins', 'w': W, 'h': H, 'art': ART, 'entry': {'x': 8, 'y': GROUND},
        'blocks': blocks(rock), 'ledges': [list(map(int, l)) for l in ledges], 'hazards': [],
        'markers': [[m, int(x), int(y)] for m, x, y in MARKERS],
    }
    (ROOT / DATA).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / DATA).write_text(
        '/* Garden 2, the Railway Ruins at native pixels: built by scripts/build-railway-ruins.py from\n'
        '   docs/asset-review/railway-ruins-v1 (the owner\'s scene and kit sheets). Do not edit by hand. */\n'
        '(window.MaxPictureLevels = window.MaxPictureLevels || {})[%d] = %s;\n' % (GARDEN, json.dumps(data, separators=(',', ':'))))
    (REVIEW / 'placements.json').write_text(json.dumps(
        {'w': W, 'h': H, 'ground': GROUND, 'scene': {'x': SX, 'y': SY, 'w': 384, 'h': SCENE_ROWS},
         'pieces': [{'piece': n, 'x': x, 'y': y, 'w': w, 'h': h, 'role': r, 'flip': f} for n, x, y, w, h, r, f in used]},
        indent=1) + '\n')
    print(ART, img.size, 'blocks', len(data['blocks']), 'ledges', len(data['ledges']))
    if '--preview' in sys.argv:
        prev = Image.new('RGBA', (W, H), (26, 40, 72, 255))
        prev.alpha_composite(Image.fromarray(out, 'RGBA'))
        pv = np.array(prev)
        pv[rock] = (pv[rock] * 0.5 + np.array([200, 60, 60, 255]) * 0.5).astype(np.uint8)
        for x, y, w in ledges:
            pv[max(0, y):y + 1, max(0, x):x + w] = (255, 210, 60, 255)
        for m, x, y in MARKERS:
            pv[max(0, y - 5):y, max(0, x - 2):x + 3] = (80, 255, 120, 255)
        pv[GROUND, :] = (120, 200, 255, 255)
        if '--reach' in sys.argv:
            for p in json.loads(Path(sys.argv[sys.argv.index('--reach') + 1]).read_text())['standing']:
                x, y = p['x'], p['y']
                if 0 <= x < W and 1 <= y < H:
                    pv[y - 2:y, max(0, x - 1):x + 1] = (60, 255, 255, 255)
        Image.fromarray(pv, 'RGBA').resize((W * 2, H * 2), Image.NEAREST).save(sys.argv[sys.argv.index('--preview') + 1])


if __name__ == '__main__':
    main()
