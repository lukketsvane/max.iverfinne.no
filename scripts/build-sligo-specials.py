"""Build Sligo's special effects from the owner's specials sheet.

The owner's Max Level Studio export (docs/asset-review/sligo-specials-v1/level.json) carries a
305x297 sheet of Sligo specials (the object named 0856438B-...): poses, a cord lash, a thrown blood
clot, tendrils, fading ghosts, and on its last row two lying poses, four blood sacs with Sligo curled
inside and four blood splats. The tun uses the sacs; throws and tun release use the splats. The action clips and detached parts are mapped below.

Every frame is found by its connected shape, brought to Sligo's own height (the idle frame of the
sheet against the idle frame of assets/max-skins-v1/sligo/main.png) with a premultiplied box filter
and hard alpha at half, and all frames share one palette of at most 16 colours. Each sits in a
40x40 cell with its bottom row on row 39, centred on x 20, like the skins' feet (the splash is taller than a skin cell).

    python3 scripts/build-sligo-specials.py
      -> assets/max-skins-v1/sligo/specials.png (31 cells in a row), specials.json
"""
import base64
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
LEVEL = ROOT / 'docs/asset-review/sligo-specials-v1/level.json'
SKIN = ROOT / 'assets/max-skins-v1/sligo/main.png'
OUT = ROOT / 'assets/max-skins-v1/sligo'
CELL = 40                       # the splash is taller than a skin cell
SHEET = '0856438B'
# (clip, the sheet's last-row items it takes, in order)
CLIPS = [
    ('sac', 7, [2, 3, 4, 5]), ('burst', 7, [6, 7, 8, 9]),
    ('throw', 4, [0, 1, 2, 3]), ('lash', 3, list(range(8))),
    ('hurt', 6, [0, 1, 2]), ('float', 5, [2, 3, 4, 5]),
    ('sleep', 7, [0, 1]),
]
# Detached clot and cord tip from the owner's painting, at the same scale as the body.
PARTS = [(21, 158, 29, 169), (294, 116, 305, 136)]


def sheet():
    level = json.loads(LEVEL.read_text())
    assets = {a['id']: a for a in level['assets']}
    obj = next(o for o in level['objects'] if (o.get('name') or '').startswith(SHEET))
    data = assets[obj['asset']]['src'].split(',', 1)[1]
    return np.array(Image.open(io.BytesIO(base64.b64decode(data))).convert('RGBA'))


def shapes(a):
    """Each frame as a bounding box: the opaque parts, joined across small gaps, in reading order."""
    solid = a[..., 3] >= 128
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=2), structure=np.ones((3, 3)))
    boxes = [(s[1].start, s[0].start, s[1].stop, s[0].stop) for s in ndimage.find_objects(lab)]
    boxes = [b for b in boxes if (b[2] - b[0]) * (b[3] - b[1]) >= 40]
    rows = []
    for b in sorted(boxes, key=lambda b: (b[1] + b[3]) / 2):
        cy = (b[1] + b[3]) / 2
        if rows and abs(cy - rows[-1][0]) < 14:
            rows[-1][1].append(b)
            rows[-1][0] = np.mean([(q[1] + q[3]) / 2 for q in rows[-1][1]])
        else:
            rows.append([cy, [b]])
    out = []
    for _, row in rows:   # frames drawn touching each other come out as one wide box: cut it evenly
        wide = float(np.median([b[2] - b[0] for b in row]))
        cut = []
        for b in sorted(row):
            k = max(1, round((b[2] - b[0]) / wide)) if b[2] - b[0] > 1.8 * wide else 1
            step = (b[2] - b[0]) / k
            cut += [(round(b[0] + i * step), b[1], round(b[0] + (i + 1) * step), b[3]) for i in range(k)]
        out.append(cut)
    return out, solid


def height(mask):
    ys = np.nonzero(mask.any(1))[0]
    return ys[-1] - ys[0] + 1


def native(a, box, scale):
    x0, y0, x1, y1 = box
    crop = a[y0:y1, x0:x1].astype(float)
    crop[..., 3] = np.where(crop[..., 3] >= 128, crop[..., 3], 0)
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
    a = sheet()
    rows, solid = shapes(a)
    idle = rows[0][0]
    ours = np.array(Image.open(SKIN).convert('RGBA'))[:32, :32, 3] > 0   # the skin's first idle cell
    scale = height(ours) / height(solid[idle[1]:idle[3], idle[0]:idle[2]])
    frames, clips = [], {}
    for clip, row, picks in CLIPS:
        clips[clip] = []
        for i in picks:
            clips[clip].append(len(frames))
            frames.append(native(a, rows[row][i], scale))
    clips['parts'] = []
    for box in PARTS:
        clips['parts'].append(len(frames))
        frames.append(native(a, box, scale))
    strip = np.zeros((CELL, CELL * len(frames), 4), np.uint8)
    for k, f in enumerate(frames):
        h, w = f.shape[:2]
        assert h <= CELL - 1 and w <= CELL - 2, ('frame too big for its cell', k, w, h)
        x, y = k * CELL + CELL // 2 - w // 2, CELL - h
        # Register action poses by the eye, not the reach of a moving cord.
        # Eye sits two pixels right of the body anchor in a right-facing pose.
        if 8 <= k <= 26:
            eye = (f[..., 0] < 105) & (f[..., 1] < 65) & (f[..., 2] < 65) & (f[..., 3] > 0)
            if eye.any():
                ex = int(round(np.nonzero(eye)[1].mean()))
                x = k * CELL + CELL // 2 + 2 - ex
                assert x >= k * CELL + 1 and x + w <= (k + 1) * CELL - 1, ('action overflow', k)
        strip[y:y + h, x:x + w] = f
    q = Image.fromarray(strip[..., :3]).quantize(16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    rgb = np.array(q.convert('RGB'))
    out = np.dstack([rgb, strip[..., 3]]).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    result = Image.fromarray(out, 'RGBA')
    result.save(OUT / 'specials.png', optimize=True)
    # Review only: exact integer enlargement of the runtime cells, one clip per row.
    from PIL import ImageDraw
    review = Image.new('RGBA', (360, len(clips) * 54), '#202c33')
    draw = ImageDraw.Draw(review)
    for row, (clip, indexes) in enumerate(clips.items()):
        draw.text((4, row * 54), clip.upper(), fill='#ebbec5')
        for col, index in enumerate(indexes):
            review.alpha_composite(result.crop((index * CELL, 0, (index + 1) * CELL, CELL)), (col * 44, row * 54 + 12))
    review.resize((1080, review.height * 3), Image.Resampling.NEAREST).save(ROOT / 'docs/asset-review/sligo-specials-v1/contact-3x.png')
    (OUT / 'specials.json').write_text(json.dumps({
        'schema': 'max-sligo-specials/v1', 'image': 'specials.png', 'cell': [CELL, CELL], 'anchor': [CELL // 2, CELL - 1],
        'clips': clips, 'scale': round(scale, 4),
        'source': 'docs/asset-review/sligo-specials-v1/level.json (object ' + SHEET + '); scripts/build-sligo-specials.py',
        'sourceClips': CLIPS, 'sourceParts': PARTS,
    }, indent=1) + '\n')
    print('specials.png', out.shape[1], 'x', out.shape[0], 'frames', len(frames), 'scale', round(scale, 3),
          'rows found', [len(r) for r in rows])


if __name__ == '__main__':
    main()
