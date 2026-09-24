"""Build Sligo's evolution strip from the owner's evolution sheet.

docs/asset-review/sligo-evolution-v1/brood-sheet.png is a painted 4x16 sheet of Sligo budding: row 1 grows
two buds and drags them, row 2 crawls as a chain of buds, row 3 stands the chain up, row 4 folds it into
one mass with a great eye and a crown of tendrils. It is the Cultivator line, one of Sligo's three
endpoints (see SLIGO_EVO in index.html).

Every frame is cut by its connected shape (the faint red halo under alpha 160 is dropped), brought to
native pixels at Sligo's own scale (the first frame's height against the skin's idle height) with a
premultiplied box filter and hard alpha at half, and all frames share one palette of at most 16 colours.
Each sits in a 40x40 cell, bottom row on row 39, centred on x 20, like the specials.

    python3 scripts/build-sligo-evolution.py
      -> assets/max-skins-v1/sligo/brood.png (64 cells in a row), brood.json
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/asset-review/sligo-evolution-v1/brood-sheet.png'
SKIN = ROOT / 'assets/max-skins-v1/sligo/main.png'
OUT = ROOT / 'assets/max-skins-v1/sligo'
CELL, ROWS, COLS = 40, 4, 16


def height(mask):
    ys = np.nonzero(mask.any(1))[0]
    return ys[-1] - ys[0] + 1


def frames(a):
    """The sheet's frames as boxes, row by row, left to right."""
    solid = a[..., 3] >= 160
    lab, _ = ndimage.label(ndimage.binary_dilation(solid, iterations=3), structure=np.ones((3, 3)))
    boxes = [(s[1].start, s[0].start, s[1].stop, s[0].stop) for s in ndimage.find_objects(lab)]
    boxes = [b for b in boxes if (b[2] - b[0]) * (b[3] - b[1]) > 900]
    rows = []
    for b in sorted(boxes, key=lambda b: b[3]):
        if rows and b[3] - rows[-1][-1][3] < 40:
            rows[-1].append(b)
        else:
            rows.append([b])
    rows = [sorted(r) for r in rows]
    assert [len(r) for r in rows] == [COLS] * ROWS, [len(r) for r in rows]
    return rows, solid


def native(a, solid, box, scale):
    x0, y0, x1, y1 = box
    crop = a[y0:y1, x0:x1].astype(float)
    keep = ndimage.binary_dilation(solid[y0:y1, x0:x1], iterations=1) & (crop[..., 3] >= 128)
    crop[..., 3] = np.where(keep, crop[..., 3], 0)
    crop[..., :3] *= crop[..., 3:4] / 255.0
    w, h = max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale))
    s = np.array(Image.fromarray(crop.astype(np.uint8), 'RGBA').resize((w, h), Image.BOX)).astype(float)
    al = s[..., 3]
    rgb = np.where(al[..., None] > 0, s[..., :3] * 255.0 / np.maximum(al[..., None], 1), 0)
    out = np.dstack([np.clip(np.round(rgb), 0, 255), np.where(al >= 128, 255, 0)]).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    ys, xs = np.nonzero(out[..., 3])
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def main():
    a = np.array(Image.open(SRC).convert('RGBA'))
    rows, solid = frames(a)
    first = rows[0][0]
    ours = np.array(Image.open(SKIN).convert('RGBA'))[:32, :32, 3] > 0   # the skin's first idle cell
    scale = height(ours) / height(solid[first[1]:first[3], first[0]:first[2]])
    cells = [native(a, solid, b, scale) for r in rows for b in r]
    strip = np.zeros((CELL, CELL * len(cells), 4), np.uint8)
    for k, f in enumerate(cells):
        h, w = f.shape[:2]
        assert h <= CELL - 1 and w <= CELL - 2, ('frame too big for its cell', k, w, h)
        x, y = k * CELL + CELL // 2 - w // 2, CELL - h
        strip[y:y + h, x:x + w] = f
    q = Image.fromarray(strip[..., :3]).quantize(16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = np.dstack([np.array(q.convert('RGB')), strip[..., 3]]).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    Image.fromarray(out, 'RGBA').save(OUT / 'brood.png', optimize=True)
    (OUT / 'brood.json').write_text(json.dumps({
        'schema': 'max-sligo-evolution/v1', 'image': 'brood.png', 'cell': [CELL, CELL], 'anchor': [CELL // 2, CELL - 1],
        'rows': ['bud', 'chain', 'stand', 'mass'], 'frames': COLS, 'scale': round(scale, 4),
        'source': 'docs/asset-review/sligo-evolution-v1/brood-sheet.png; scripts/build-sligo-evolution.py',
    }, indent=1) + '\n')
    print('brood.png', out.shape[1], 'x', out.shape[0], 'scale', round(scale, 4),
          'heights', [int(c.shape[0]) for c in cells[::4]], 'widths', [int(c.shape[1]) for c in cells[::4]])


if __name__ == '__main__':
    main()
