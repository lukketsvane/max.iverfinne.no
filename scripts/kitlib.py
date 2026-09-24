"""Kit-built picture levels: the owner's kits at native pixels, placed by role.

Every kit here is the owner's art brought to the game's own pixel size, where
Max is about 22 px tall:

- sheet kits: the owner's transparent kit sheets, cut at 1/f with a
  premultiplied box filter and hard alpha at half (docs/asset-review/
  railway-ruins-v1/kits: machinery at 1/8; bridges, mossy islands and stone at
  1/4), each piece the largest opaque part of its box in source pixels;
- pack kits: the owner's Pixel Mill cuts, already at 1/4 (railway-ruins-v1/kits
  mill-scene and mossy-ruins; underground-kits-v1: silo works, iron viaduct,
  brick arches, cave ledges, tram yard). Packs cut with a colour key (the
  mossy ruins) get their enclosed holes filled again.

A level places pieces as (piece, x, y, role, flip) in art pixels, y down. The
role makes its collision:

  deck    a one-way ledge along the widest opaque row near the top (planks)
  tops    one-way ledges along every level stretch of the top edge (islands,
          pillar caps, arches)
  stair   solid rock under the top edge down to the soil (steps of 6 px or less)
  ladder  one-way rungs every 17 px from the ladder's foot to its top
  back    drawn first, nothing to stand on
  decor   drawn in order, nothing to stand on

Pieces are clipped at the soil line so the game's ground runs under them.
Ledges are one-way and never drawn again (the art draws them).

    python3 scripts/build-kit-level.py scripts/levels/<garden>.json
"""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
RAIL = ROOT / 'docs/asset-review/railway-ruins-v1/kits'
UNDER = ROOT / 'docs/asset-review/underground-kits-v1'
CELL = 3
RUNG = 17

# sheet kit: (sheet file, 1/f, {piece: box in source pixels})
SHEETS = {
    'machinery': (RAIL / 'machinery.png', 8, {
        'wheel': (66, 66, 882, 888), 'crank': (1242, 108, 186, 222), 'press-frame': (1014, 282, 168, 588),
        'sluice-crate': (1254, 366, 222, 396), 'hub': (1278, 786, 174, 162)}),
    'bridges': (RAIL / 'bridges.png', 4, {
        'long-pier': (80, 132, 688, 356), 'railed-pier': (824, 52, 608, 492), 'tall-post': (488, 584, 48, 344),
        'tall-ladder': (932, 576, 72, 396), 'short-bridge': (68, 628, 360, 96), 'short-ladder': (748, 712, 76, 176),
        'stub-post': (608, 736, 44, 152), 'trestle': (1044, 836, 448, 124)}),
    'mossy': (RAIL / 'mossy.png', 4, {
        'stepped-cliff': (640, 32, 836, 568), 'colonnade-island': (60, 72, 516, 324), 'ring-island': (76, 372, 680, 340),
        'wall-island': (360, 620, 668, 240), 'long-slope': (56, 776, 972, 228)}),
    'stone': (RAIL / 'stone.png', 4, {
        'pillar-tall': (52, 52, 112, 508), 'pillar-mid': (252, 156, 120, 376), 'lintel-long': (948, 180, 532, 76),
        'pillar-short': (476, 256, 144, 240), 'slab-mid': (700, 380, 212, 84), 'lintel-mid': (1024, 356, 380, 72),
        'slab-small-b': (940, 524, 128, 56), 'stairs-down': (124, 624, 236, 164), 'stairs-up': (536, 624, 248, 164),
        'slab-small': (540, 548, 144, 60), 'arch-large': (872, 616, 284, 204), 'arch-small': (1228, 684, 248, 136),
        'rubble-large': (116, 824, 444, 144), 'rubble-mid': (692, 860, 332, 108), 'rubble-small': (1184, 912, 240, 56)}),
}

# pack kit: (atlas folder, frame key prefix, fill keyed holes with this colour or None, {piece: frame number})
PACKS = {
    'mill': (RAIL / 'mill-scene', 'B07C3D03-8D5E-4531-B6DC-41483A5A24DE-', None, {
        'planter-wide': '050', 'planter-pink': '051', 'planter-blue': '052', 'planter-mixed': '053',
        'lamp-post': '066', 'lantern': '067', 'lantern-round': '068', 'vine-long': '060',
        'vine-flower': '062', 'crate': '077', 'crate-small': '078', 'chest': '080'}),
    'ruins': (RAIL / 'mossy-ruins', 'ruins-', (7, 15, 28), {
        'arch-block': '020', 'arch-block-b': '021', 'stair-slope': '023', 'stair-slope-b': '025', 'ledge': '002',
        'ledge-long': '012', 'step-block': '001', 'pillar': '034', 'pillar-b': '035', 'pillar-c': '036',
        'slab': '050', 'slab-b': '051', 'slab-c': '057', 'water': '076', 'water-b': '077', 'water-c': '086'}),
    'silo-works': (UNDER / 'silo-works', '3A561949-0FF7-4A86-A844-7D379A8D681F-', None, {
        'pipe-tall': '001', 'boiler': '002', 'copper-line': '003', 'copper-riser': '004', 'copper-elbow': '005',
        'copper-tee': '006', 'valve-wheel': '007', 'copper-stub': '008', 'blue-bend': '009', 'doorway': '010',
        'doorway-b': '011', 'door-lit': '012', 'ladder-tall': '013', 'jar-shelf': '014', 'ladder': '015',
        'ladder-short': '016'}),
    'iron-viaduct': (UNDER / 'iron-viaduct', '4EE95E63-B1ED-4CE2-8F77-81F920176D37-', None, {
        'viaduct-double': '001', 'viaduct-single': '002', 'pier': '003', 'rail-long': '004', 'rail': '005',
        'rail-end': '006', 'lever': '007', 'lever-b': '008', 'coupling': '009'}),
    'brick-arches': (UNDER / 'brick-arches', '0E5A2722-00C1-4E31-9F39-EBE8C533C6F7-', None, {
        'arch': '001', 'arch-broken': '002', 'arch-crumbling': '003', 'arcade': '004', 'pillar': '005',
        'rubble-arc': '006', 'pillar-stub': '007'}),
    'cave-ledges': (UNDER / 'cave-ledges', '0648E0BA-D2B3-44CE-8561-37FF71050920-', None, {
        'ledge-huge': '001', 'ledge-long': '002', 'ledge-mid': '003', 'ledge-sliver': '004', 'ledge-stepped': '005',
        'ledge-slope': '006'}),
    'tram-yard': (UNDER / 'tram-yard', '71968A9A-FDEA-44CD-8EC7-CABD025B18BA-', None, {
        'tram': '001', 'cabinet-tall': '002', 'cabinet-wide': '003', 'drawers': '004', 'drawers-small': '005',
        'chest': '006', 'chest-long': '007'}),
}


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


def trim(a):
    ys, xs = np.nonzero(a[..., 3])
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def refill(a, key, seed):
    """Fill the holes a colour key punched into dark stone."""
    op = a[..., 3] > 0
    closed = ndimage.binary_fill_holes(ndimage.binary_closing(op, structure=np.ones((3, 3)), iterations=2))
    hole = (ndimage.binary_fill_holes(op) | closed & ndimage.binary_dilation(op)) & ~op
    if not hole.any():
        return a
    dark = a[op][:, :3]
    tone = dark[dark.astype(int).sum(1) <= np.percentile(dark.astype(int).sum(1), 20)]
    pick = tone[np.random.default_rng(seed).integers(len(tone), size=int(hole.sum()))]
    out = a.copy()
    out[hole, :3] = np.clip(pick * 0.5 + np.array(key) * 0.5, 0, 255).astype(np.uint8)
    out[hole, 3] = 255
    return out


@lru_cache(maxsize=1)
def pieces():
    out = {}
    for kit, (sheet, f, boxes) in SHEETS.items():
        a = native(sheet, f)
        lab, _ = ndimage.label(a[..., 3] > 0, structure=np.ones((3, 3)))
        for name, box in boxes.items():
            x, y, w, h = (round(v / f) for v in box)
            sub = lab[y:y + h, x:x + w]
            ids, counts = np.unique(sub[sub > 0], return_counts=True)
            keep = [i for i, c in zip(ids, counts) if c >= 0.5 * (lab == i).sum()]
            part = a[y:y + h, x:x + w].copy()
            part[~np.isin(sub, keep)] = 0
            out[kit + '/' + name] = trim(part)
    for kit, (folder, prefix, key, frames) in PACKS.items():
        atlas = np.array(Image.open(folder / 'atlas.png').convert('RGBA'))
        info = json.loads((folder / 'atlas.json').read_text())['frames']
        for name, n in frames.items():
            fr, sp = info[prefix + n]['frame'], info[prefix + n]['spriteSourceSize']
            part = atlas[fr['y'] + sp['y']:fr['y'] + sp['y'] + sp['h'], fr['x'] + sp['x']:fr['x'] + sp['x'] + sp['w']].copy()
            part[part[..., 3] < 128] = 0
            part[..., 3] = np.where(part[..., 3] > 0, 255, 0)
            out[kit + '/' + name] = trim(refill(part, key, 3 + int(n)) if key else part)
    return out


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


class Level:
    """An art canvas with rock and one-way ledges, built piece by piece."""

    def __init__(self, w, h, ground):
        self.w, self.h, self.ground = w, h, ground
        self.art = np.zeros((h, w, 4), np.uint8)
        self.rock = np.zeros((h, w), bool)
        self.ledges, self.used = [], []

    def paste(self, a, x, y, bottom=None):
        bottom = self.ground if bottom is None else bottom
        h, w = a.shape[:2]
        ys, xs = slice(max(0, y), min(bottom, y + h)), slice(max(0, x), min(self.w, x + w))
        if ys.start >= ys.stop or xs.start >= xs.stop:
            return
        sub = a[ys.start - y:ys.stop - y, xs.start - x:xs.stop - x]
        m = sub[..., 3] > 0
        self.art[ys, xs][m] = sub[m]

    def place(self, name, x, y, role, flip=False):
        a = pieces()[name]
        a = a[:, ::-1] if flip else a
        h, w = a.shape[:2]
        self.paste(a, x, y)
        self.used.append((name, x, y, w, h, role, flip))
        tops = top_rows(a)
        if role == 'deck':
            op = a[..., 3] > 0
            row = next(r for r in range(h) if op[r].sum() >= 0.6 * w)
            xs = np.nonzero(op[row])[0]
            self.ledges.append((x + int(xs.min()), y + row, int(xs.max() - xs.min() + 1)))
        elif role == 'tops':
            for x0, x1, ty in runs(tops):
                self.ledges.append((x + x0, y + ty, x1 - x0))
        elif role == 'stair':
            for c in range(w):
                if tops[c] >= 0 and 0 <= x + c < self.w:
                    self.rock[max(0, y + tops[c]):self.ground, x + c] = True
        elif role == 'ladder':
            top, foot = y + int(tops[tops >= 0].min()), min(y + h, self.ground)
            for ry in range(foot - RUNG, top, -RUNG):
                self.ledges.append((x - 3, ry, w + 6))
            self.ledges.append((x - 3, top, w + 6))

    def finish(self):
        self.rock[self.ground:] = False
        return self

    def blocks(self):
        """Greedy 3 px rectangles over the rock grid."""
        gh, gw = self.h // CELL, self.w // CELL
        grid = np.zeros((gh, gw), bool)
        for gy in range(gh):
            for gx in range(gw):
                grid[gy, gx] = self.rock[gy * CELL:(gy + 1) * CELL, gx * CELL:(gx + 1) * CELL].mean() >= 0.5
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

    def save(self, garden, level_id, markers, note, art_path, data_path, placements=None, extra=None, colours=255):
        img = Image.fromarray(self.art, 'RGBA')
        q = img.convert('RGB').quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
        out = np.dstack([np.array(q), self.art[..., 3]])
        out[out[..., 3] == 0, :3] = 0
        (ROOT / art_path).parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(out, 'RGBA').save(ROOT / art_path, optimize=True)
        data = {
            'id': level_id, 'w': self.w, 'h': self.h, 'art': art_path, 'entry': {'x': 8, 'y': self.ground},
            'blocks': self.blocks(), 'ledges': [list(map(int, l)) for l in self.ledges], 'hazards': [],
            'markers': [[m, int(x), int(y)] for m, x, y in markers],
        }
        (ROOT / data_path).parent.mkdir(parents=True, exist_ok=True)
        (ROOT / data_path).write_text('/* %s Do not edit by hand. */\n(window.MaxPictureLevels = window.MaxPictureLevels || {})[%d] = %s;\n'
                                      % (note, garden, json.dumps(data, separators=(',', ':'))))
        if placements:
            Path(placements).write_text(json.dumps(dict({'w': self.w, 'h': self.h, 'ground': self.ground}, **(extra or {}), pieces=[
                {'piece': n, 'x': x, 'y': y, 'w': w, 'h': h, 'role': r, 'flip': f} for n, x, y, w, h, r, f in self.used]), indent=1) + '\n')
        self.out = out
        return data

    def preview(self, path, markers, reach=None, sky=(26, 40, 72)):
        prev = Image.new('RGBA', (self.w, self.h), sky + (255,))
        prev.alpha_composite(Image.fromarray(self.out, 'RGBA'))
        pv = np.array(prev)
        pv[self.rock] = (pv[self.rock] * 0.5 + np.array([200, 60, 60, 255]) * 0.5).astype(np.uint8)
        for x, y, w in self.ledges:
            pv[max(0, y):y + 1, max(0, x):x + w] = (255, 210, 60, 255)
        for m, x, y in markers:
            pv[max(0, y - 5):y, max(0, x - 2):x + 3] = (80, 255, 120, 255)
        pv[self.ground, :] = (120, 200, 255, 255)
        if reach:
            for p in json.loads(Path(reach).read_text())['standing']:
                if 0 <= p['x'] < self.w and 2 <= p['y'] < self.h:
                    pv[p['y'] - 2:p['y'], max(0, p['x'] - 1):p['x'] + 1] = (60, 255, 255, 255)
        Image.fromarray(pv, 'RGBA').resize((self.w * 2, self.h * 2), Image.NEAREST).save(path)
