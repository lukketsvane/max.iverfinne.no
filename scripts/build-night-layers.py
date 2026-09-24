"""Build the ten night layers from the owner's layer sheet, sky first, terrain last.

The sheet (docs/asset-review/night-layers-v1/source.png) has ten numbered rows of
cells. Rows 1-8 are one panorama each, cut into 13 cells over a baked sky; rows
9 and 10 are loose tree and terrain sprites with their own alpha. Each row becomes
one 180 px tall layer at the sheet's own pixel scale:

- the panorama's cells are joined, and its two ends are crossfaded so it wraps;
- the baked sky is keyed out against a sky gradient fitted to the rows where sky
  dominates (stars against their local median); mountains and forest are solid
  below their ridge;
- the sprites are set side by side on one baseline;
- every layer gets binary alpha and a small palette of its own. The sky is flat
  bands with a 2x2 ordered dither at each edge.

The ruins row is pale, so it sits behind the forest: 07 is ruins, 08 forest.
Stacked in order the layers make one scene.

The game draws the trees and terrain right behind the play, so its copies of
those two are hazed towards the night; docs/asset-review/night-layers-v1/layers/
keeps all ten clean.

    python3 scripts/build-night-layers.py -> assets/night-v1/<nn-name>.png, atlas.json
                                            docs/asset-review/night-layers-v1/layers/
"""
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/asset-review/night-layers-v1/source.png'
OUT = ROOT / 'assets/night-v1'
CLEAN = ROOT / 'docs/asset-review/night-layers-v1/layers'
H = 180
ROW_TOPS = [7, 102, 195, 296, 393, 486, 590, 694, 800, 901]
# layer: colours
COLOURS = {'01-sky': 12, '02-stars': 6, '03-moon': 12, '04-clouds': 12, '05-mountains-far': 10,
           '06-mountains-mid': 14, '07-ruins': 14, '08-forest': 14, '09-trees': 24, '10-terrain': 24}
# the game's copies: 640 wide, fewer colours in the busiest layers, and the
# trees and terrain hazed towards the night at the foot of the forest
RUNTIME_W = 640
RUNTIME_COLOURS = {'06-mountains-mid': 10, '07-ruins': 10, '08-forest': 10, '09-trees': 16, '10-terrain': 16}
HAZE = {'09-trees': 0.35, '10-terrain': 0.45}
NIGHT = np.array([13., 32, 73])
BAYER = np.array([[0, 2], [3, 1]]) / 4

A = np.asarray(Image.open(SOURCE).convert('RGBA')).astype(np.float32)


def rows():
    lab, _ = ndimage.label(A[..., 3] > 128)
    out = {}
    for i, s in enumerate(ndimage.find_objects(lab)):
        if (lab[s] == i + 1).sum() > 500:
            box = (s[1].start, s[0].start, s[1].stop, s[0].stop)
            r = min(range(10), key=lambda r: abs(box[1] - ROW_TOPS[r]))
            out.setdefault(r, []).append(box)
    return {r: sorted(v) for r, v in out.items()}


ROWS = rows()


def panorama(r, inset=1):
    bs = ROWS[r]
    y0 = max(b[1] for b in bs) + inset
    y1 = min(b[3] for b in bs) - inset
    return np.concatenate([A[y0:y1, b[0] + inset:b[2] - inset] for b in bs], 1)


def seamless(p, n=24):
    out = p[:, :p.shape[1] - n].copy()
    w = (np.arange(n) / n)[None, :, None]
    out[:, :n] = p[:, :n] * w + p[:, -n:] * (1 - w)
    return out


def lum(p):
    return p[..., :3] @ np.array([0.3, 0.55, 0.15])


def key(p, bright, frac=0.45, fill=True, top=None):
    L = lum(p)
    h = L.shape[0]
    q = np.percentile(L, 10 if bright else 92, axis=1)
    fit_rows = np.arange(h if top is None else top)
    bg = np.polyval(np.polyfit(fit_rows, q[fit_rows], 1), np.arange(h))[:, None]
    fg = np.percentile(L, 99.5 if bright else 3)
    thr = bg + (fg - bg) * frac
    m = L > thr if bright else L < thr
    if fill:
        m[-2:] = True
        m = ndimage.binary_fill_holes(m)
        lab, _ = ndimage.label(m)
        m = np.isin(lab, list(set(np.unique(lab[-1])) - {0}))
    return ndimage.binary_opening(m, np.ones((2, 2))) | (m & (np.abs(L - bg) > abs(fg - bg[0, 0]) * 0.8))


def place(rgb, m, y, extend=False):
    h, w = m.shape
    canvas = np.zeros((H, w, 3), np.float32)
    alpha = np.zeros((H, w), bool)
    for yy in range(h):
        if 0 <= y + yy < H:
            canvas[y + yy] = rgb[yy]
            alpha[y + yy] = m[yy]
    if extend:
        flat = np.median(rgb[-6:][m[-6:]], 0)
        canvas[y + h:] = flat
        alpha[y + h:] = True
    return canvas, alpha


def span(p, width):
    return seamless(p if width is None else p[:, :width + 24])


def silhouettes(r, bright, y, width=None, extend=False, solid=False, **kw):
    p = span(panorama(r), width)
    m = key(p, bright, **kw)
    if solid:
        m = np.maximum.accumulate(m, 0)
    return place(p[..., :3], m, y, extend)


def sky():
    s = np.median(panorama(0)[..., :3], 1)
    stops = [(0, s[0]), (60, s[len(s) // 2]), (110, s[-1]), (H, np.array([93., 124, 197]))]
    ys = np.arange(H)
    col = np.stack([np.interp(ys, [t[0] for t in stops], [t[1][c] for t in stops]) for c in range(3)], -1)
    n, w = COLOURS['01-sky'], 256
    t = ys / (H - 1) * n
    edge = (t % 1)[:, None] > BAYER[ys % 2][:, np.arange(w) % 2]
    idx = np.clip(np.floor(t)[:, None] + edge, 0, n - 1).astype(int)
    levels = np.array([col[min(H - 1, int((i + 0.5) / n * H))] for i in range(n)])
    return levels[idx], np.ones((H, w), bool)


def stars(width=None):
    p = span(panorama(1), width)
    L = lum(p)
    return place(p[..., :3], L - ndimage.median_filter(L, size=9) > 22, 0)


def moon(width=None):
    width = width or 1260
    # the full moon with its cloud wisps, alone in the strip
    c = A[196:290, 751:850, :3]
    L = lum(c)
    m = L - np.percentile(L, 20, axis=1)[:, None] > 26
    lab, n = ndimage.label(m)
    for i in range(1, n + 1):
        xs = np.nonzero(lab == i)[1]
        if xs.min() == 0 or xs.max() == m.shape[1] - 1 or len(xs) < 4:
            m[lab == i] = False
    rgb = np.zeros((m.shape[0], width, 3), np.float32)
    mm = np.zeros((m.shape[0], width), bool)
    x0 = width // 2 - m.shape[1] // 2
    rgb[:, x0:x0 + m.shape[1]] = c
    mm[:, x0:x0 + m.shape[1]] = m
    return place(rgb, mm, 10)


def sprites(r, bottom, overlap, width=None):
    parts = []
    for b in ROWS[r]:
        c = A[b[1]:b[3], b[0]:b[2]]
        m = c[..., 3] > 128
        if m.sum() < 800:
            continue
        ys, xs = np.nonzero(m)
        c = c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        if width and sum(p.shape[1] - overlap for p in parts) + c.shape[1] - overlap > width:
            break
        parts.append(c)
    w_all = sum(p.shape[1] for p in parts) - overlap * len(parts)
    rgb = np.zeros((H, w_all, 3), np.float32)
    al = np.zeros((H, w_all), bool)
    x = 0
    for p in parts:
        h, w = p.shape[:2]
        m = p[..., 3] > 128
        for yy in range(h):
            cy = bottom - h + yy
            if 0 <= cy < H:
                xs = np.arange(w) + x
                keep = m[yy] & (xs < w_all)
                rgb[cy, xs[keep]] = p[yy, keep, :3]
                al[cy, xs[keep]] = True
        x += w - overlap
    return rgb, al


def encode(rgb, m, n):
    if not m.all():
        # transparent pixels take their nearest opaque colour so they spend no palette entries
        _, (iy, ix) = ndimage.distance_transform_edt(~m, return_indices=True)
        rgb = rgb[iy, ix]
    q = Image.fromarray(rgb.clip(0, 255).astype(np.uint8)).quantize(n, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:3 * n]).reshape(-1, 3)
    index = np.asarray(q)
    used = sorted(set(index[m].tolist()))
    out = np.full(index.shape, len(used), np.uint8)
    for i, u in enumerate(used):
        out[(index == u) & m] = i
    image = Image.fromarray(out, 'P')
    image.putpalette([int(v) for u in used for v in pal[u]] + [0, 0, 0])
    buf = io.BytesIO()
    image.save(buf, 'PNG', optimize=True, **({} if m.all() else {'transparency': len(used)}))
    data = buf.getvalue()
    try:
        import oxipng
        data = oxipng.optimize_from_memory(data, level=6)
    except ImportError:
        pass
    return data, ['#%02x%02x%02x' % tuple(int(v) for v in pal[u]) for u in used]


def layers(width=None):
    return {
        '01-sky': sky(),
        '02-stars': stars(width),
        '03-moon': moon(width),
        '04-clouds': silhouettes(3, True, 40, width, frac=0.4, top=20),
        '05-mountains-far': silhouettes(4, False, 60, width, extend=True, solid=True, top=14),
        '06-mountains-mid': silhouettes(5, False, 74, width, extend=True, solid=True, top=24),
        '07-ruins': silhouettes(7, False, 58, width, extend=True, top=36),
        '08-forest': silhouettes(6, False, 88, width, extend=True, solid=True, top=16),
        '09-trees': sprites(8, 174, 10, width),
        '10-terrain': sprites(9, H + 48, 2, width),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    CLEAN.mkdir(parents=True, exist_ok=True)
    for name, (rgb, m) in layers().items():
        (CLEAN / f'{name}.png').write_bytes(encode(rgb, m, COLOURS[name])[0])
    sheets, palette = {}, set()
    for name, (rgb, m) in layers(RUNTIME_W).items():
        if name in HAZE:
            rgb = rgb * (1 - HAZE[name]) + NIGHT * HAZE[name]
        data, used = encode(rgb, m, RUNTIME_COLOURS.get(name, COLOURS[name]))
        (OUT / f'{name}.png').write_bytes(data)
        palette.update(used)
        sheets[name] = {'image': f'{name}.png', 'width': m.shape[1], 'height': H}
        print(name, f'{m.shape[1]}x{H}', len(data), 'bytes', len(used), 'colours')
    meta = {'palette': sorted(palette), 'sheets': sheets, 'order': list(sheets),
            'source': 'docs/asset-review/night-layers-v1/source.png, sheet scale; scripts/build-night-layers.py'}
    (OUT / 'atlas.json').write_text(json.dumps(meta, indent=1) + '\n')


if __name__ == '__main__':
    main()
