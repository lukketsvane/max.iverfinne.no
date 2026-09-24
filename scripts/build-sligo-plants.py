"""Build Sligo's two umbilical plants: the cord (kind 25) and the cap (kind 26).

The owner painted both plants as exploded views at about five times the
game's pixel size (docs/asset-review/sligo-plants-v1): cord-source.png, ten
pink cords, and cap-source.png, nine red cords under a brain or mushroom cap.
Every piece is cut from those paintings and brought to native pixels with the
premultiplied box filter and alpha cut hard at half:

- the cord: stem slices are the trunk's boxes, one box and the neck above it
  each (1/3.9); flower heads are the coiled top, the loop, the knot and the
  hook (1/6); blooms are the small curls, base on the left (1/5); roots are
  the tentacles (1/8);
- the cap: stem slices are the glossy coil cut between the places where it
  runs straight up (1/5), each slid sideways so it starts and ends on the
  centre column; heads are the caps (1/5); blooms are the loose beads (1/5);
  roots are the fibres (1/6).

Then the pixel rules, all here: colours come from the painting's own ramps
(the median of each luminance band); a pixel that is mostly the painting's
line work takes the outline, one that is mostly highlight takes the gloss,
the rest the nearest ramp step, so no blend survives; specks and one-pixel
holes go; a 1 px dark outline goes round every shape, and thin parts darken
on their lower and right edges only; a pixel no neighbour shares takes its
neighbours' colour; box slices are symmetric, and every coil slice starts and
ends on the same 7 px passage, so mirrored slices stack unbroken. Each family
keeps to one palette of at most 16 colours.

    python3 scripts/build-sligo-plants.py [preview.png]
        -> assets/plants-v1/sligo-cord/, assets/plants-v1/sligo-cap/
           (stem-NN, flower-NN, bloom-NN, root-NN) and the PA.fam.push line
           for index.html
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/asset-review/sligo-plants-v1'
OUT = ROOT / 'assets/plants-v1'
LUM = np.array([0.299, 0.587, 0.114])
N4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)
N8 = np.ones((3, 3), bool)


# ------------------------------------------------------------------ the paintings
def load(name):
    """The painting with its background gone. Both paintings carry an alpha
    mask; the red halo and the glow live in the half-transparent fringe, so
    everything under half alpha goes, and so do specks under 40 px."""
    a = np.array(Image.open(SRC / name).convert('RGBA')).astype(float)
    keep = a[..., 3] >= 128
    lab, n = ndimage.label(keep, structure=N8)
    size = ndimage.sum(keep, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i in range(n) if size[i] >= 40])
    a[..., 3] = np.where(keep, 255, 0)
    a[~keep, :3] = 0
    return a


def poly_mask(shape, poly, origin):
    im = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([(x - origin[0], y - origin[1]) for x, y in poly], fill=255)
    return np.array(im) > 0


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def box_filter(a, w, h, box):
    """PIL's box filter over one float channel, exact to a fractional box."""
    return np.array(Image.fromarray(a.astype(np.float32), 'F').resize((w, h), Image.BOX, box=box))


def sheared(src, y0, y1, dx0, dx1):
    """The painting with rows y0..y1 slid sideways, dx0 at y0 running
    linearly to dx1 at y1 (premultiplied linear interpolation)."""
    out = src.copy()
    xs = np.arange(src.shape[1], dtype=float)
    for y in range(max(0, int(np.floor(y0)) - 3), min(src.shape[0], int(np.ceil(y1)) + 3)):
        t = min(1.0, max(0.0, (y + 0.5 - y0) / max(y1 - y0, 1e-9)))
        dx = dx0 + (dx1 - dx0) * t
        a = np.interp(xs - dx, xs, src[y, :, 3], left=0, right=0)
        for ch in range(3):
            pm = np.interp(xs - dx, xs, src[y, :, ch] * src[y, :, 3], left=0, right=0)
            out[y, :, ch] = np.where(a > 0, pm / np.maximum(a, 1e-9), 0)
        out[y, :, 3] = np.where(a >= 128, 255, 0)
        out[y, a < 128, :3] = 0
    return out


def tube_centre(src, y0, y1, x0, x1):
    """Where a tube runs through rows y0..y1 of the painting: the mean column
    of its opaque pixels between x0 and x1."""
    m = src[int(y0):int(y1), int(x0):int(x1), 3] > 0
    return x0 + np.nonzero(m)[1].mean() + 0.5


class Cut:
    """A native piece: rgb (the box-filtered colour), op (alpha cut hard at
    half) and, per pixel, the share of the painting's dark line work (dark)
    and of its highlights (bright) that fell into it."""
    def __init__(self, rgb, op, dark, bright):
        self.rgb, self.op, self.dark, self.bright = rgb, op, dark, bright

    def mirrored(self):
        return Cut(self.rgb[:, ::-1], self.op[:, ::-1], self.dark[:, ::-1], self.bright[:, ::-1])


def cut(src, cx, yb, w, h, fx, fy=None, keep=None, drop=(), lines=(100, 180)):
    """A native w x h piece whose centre column is source column cx and whose
    foot is source row yb; one native pixel is fx x fy source pixels, averaged
    by the premultiplied box filter, and alpha is cut hard at half. keep and
    drop are polygons in source pixels that isolate the piece from its
    neighbours; lines are the luminance under which the painting draws its
    dark lines and over which it draws highlights."""
    fy = fy or fx
    x0, x1, y0, y1 = cx - w * fx / 2, cx + w * fx / 2, yb - h * fy, yb
    X0, Y0 = int(np.floor(x0)) - 1, int(np.floor(y0)) - 1
    c = src[Y0:int(np.ceil(y1)) + 1, X0:int(np.ceil(x1)) + 1].copy()
    if keep is not None:
        c[~poly_mask(c.shape, keep, (X0, Y0))] = 0
    for p in drop:
        c[poly_mask(c.shape, p, (X0, Y0))] = 0
    box = (x0 - X0, y0 - Y0, x1 - X0, y1 - Y0)
    a = c[..., 3] / 255.0
    lum = c[..., :3] @ LUM
    al = box_filter(a, w, h, box)
    rgb = np.dstack([box_filter(c[..., i] * a, w, h, box) for i in range(3)]) / np.maximum(al[..., None], 1e-6)
    dark = box_filter(a * (lum < lines[0]), w, h, box) / np.maximum(al, 1e-6)
    bright = box_filter(a * (lum > lines[1]), w, h, box) / np.maximum(al, 1e-6)
    return Cut(np.clip(rgb, 0, 255), al >= 0.5, dark, bright)


# ------------------------------------------------------------------ colour
def band_colours(src, box, edges):
    """A ramp from the painting: the median colour of each luminance band
    (edges are quantiles) of the opaque pixels in box, dark to light."""
    x0, y0, x1, y1 = box
    c = src[y0:y1, x0:x1]
    px = c[c[..., 3] > 0][:, :3]
    lum = px @ LUM
    q = np.quantile(lum, edges)
    return np.array([np.median(px[(lum >= q[i]) & (lum <= q[i + 1])], 0) for i in range(len(edges) - 1)]).round()


def shade(k, ramp, dark_at=0.4, bright_at=0.35):
    """Ramp steps, 0 the outline and the last the highlight. A pixel that is
    mostly the painting's line work takes step 0 and one that is mostly its
    highlight the top step; the rest take the middle step nearest in
    luminance, so no blend of line and fill survives."""
    n = len(ramp)
    lum = k.rgb @ LUM
    ml = ramp[1:n - 1] @ LUM
    idx = 1 + np.abs(lum[..., None] - ml[None, None, :]).argmin(-1)
    idx = np.where(k.bright >= bright_at, n - 1, idx)
    idx = np.where(k.dark >= dark_at, 0, idx)
    return np.where(k.op, idx, -1)


# ------------------------------------------------------------------ pixel rules
def clean_mask(op, min_size=3):
    """No orphan pixels: specks under min_size go (the body always stays) and
    single-pixel holes are filled."""
    lab, n = ndimage.label(op, structure=N8)
    if n > 1:
        size = ndimage.sum(op, lab, range(1, n + 1))
        big = int(np.argmax(size)) + 1
        op = np.isin(lab, [big] + [i + 1 for i in range(n) if size[i] >= min_size])
    holes = ndimage.binary_fill_holes(op) & ~op
    lab, n = ndimage.label(holes, structure=N4)
    for i in range(1, n + 1):
        if (lab == i).sum() <= 1:
            op = op | (lab == i)
    return op


def shifted(m, dy, dx, fill=False):
    """m moved by (dy, dx)."""
    out = np.full_like(m, fill)
    h, w = m.shape
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = m[ys, xs]
    return out


def outline(idx, thin_step=2):
    """A 1 px dark outline round every shape. Where a part is too thin to
    hold an outline and a fill (under three pixels across) only its lower and
    right edges darken, so a thin curl keeps its lit top."""
    op = idx >= 0
    up, down, left, right = shifted(op, 1, 0), shifted(op, -1, 0), shifted(op, 0, 1), shifted(op, 0, -1)
    edge = op & ~(up & down & left & right)
    thick = ndimage.binary_dilation(op & ~edge, structure=N8)
    out = idx.copy()
    out[edge & thick] = 0
    thin = edge & ~thick
    lower_right = thin & ((~down & up) | (~right & left))
    out[lower_right] = 0
    rest = thin & ~lower_right
    out[rest] = np.maximum(out[rest], thin_step)
    return out


def orphans(idx):
    """No orphan pixels: a pixel that shares its step with none of its eight
    neighbours, while at least three of its four neighbours agree on one
    step, takes that step."""
    out = idx.copy()
    h, w = idx.shape
    pad = np.pad(idx, 1, constant_values=-1)
    for y in range(h):
        for x in range(w):
            v = idx[y, x]
            if v <= 0:
                continue
            n8 = np.delete(pad[y:y + 3, x:x + 3].flatten(), 4)
            if (n8 == v).any():
                continue
            n4 = [q for q in (pad[y, x + 1], pad[y + 2, x + 1], pad[y + 1, x], pad[y + 1, x + 2]) if q > 0]
            if not n4:
                continue
            vals, counts = np.unique(n4, return_counts=True)
            if counts.max() >= 3:
                out[y, x] = vals[counts.argmax()]
    return out


def symmetric(op):
    """A silhouette the same both ways round, so a slice mirrored by the
    game stacks as straight as one that is not."""
    return op | op[:, ::-1]


def trim(idx, keep_centre=True):
    """Transparent columns off both sides (equally, so the centre column
    stays the centre) and transparent rows off the top."""
    cols = np.nonzero((idx >= 0).any(0))[0]
    c = idx.shape[1] // 2
    if keep_centre:
        e = max(c - cols.min(), cols.max() - c)
        idx = idx[:, c - e:c + e + 1]
    else:
        idx = idx[:, cols.min():cols.max() + 1]
    rows = np.nonzero((idx >= 0).any(1))[0]
    return idx[rows.min():]


def rgba(idx, pal):
    out = np.zeros(idx.shape + (4,), np.uint8)
    m = idx >= 0
    out[m, :3] = pal[idx[m]]
    out[m, 3] = 255
    return out


def finish(idx, outlined=True):
    idx = outline(idx) if outlined else idx
    return orphans(idx)


# ------------------------------------------------------------------ the cord (kind 25)
FLESH_LINES = (100, 178)


def cord_pieces(cord):
    ramp = band_colours(cord, (150, 25, 1690, 840), [0, .04, .2, .45, .72, .93, 1])
    stems, heads, blooms, roots = [], [], [], []
    # stem slices: one box of the trunk each, from the neck above it to the neck below
    for cx, top, foot, rows in [(556, 213, 244, 8), (557.5, 667.5, 703.5, 9), (556, 244, 274, 8),
                                (1259, 666, 701, 9), (900.5, 702, 737.5, 9), (556, 274, 305, 8)]:
        k = cut(cord, cx, foot, 9, rows, 3.93, (foot - top) / rows, lines=FLESH_LINES)
        k.op = symmetric(clean_mask(k.op))
        stems.append(trim(finish(shade(k, ramp))))
    # flower heads: the coiled top, the loop, the knot and the hook
    for k in [cut(cord, 556, 178, 21, 26, 6, drop=[rect(597, 136, 640, 215)], lines=FLESH_LINES),
              cut(cord, 1259, 585, 19, 22, 6, lines=FLESH_LINES),
              cut(sheared(cord, 30, 150, 0, 17), 222, 150, 19, 20, 6, lines=FLESH_LINES)]:
        k.op = clean_mask(k.op)
        heads.append(trim(finish(shade(k, ramp))))
    # blooms: the small curls that leave the cord, base on the left
    for k in [cut(cord, 944, 232, 17, 15, 5, drop=[rect(880, 150, 906, 240)], lines=FLESH_LINES),
              cut(cord, 928, 302, 9, 8, 5, drop=[rect(880, 250, 907, 310)], lines=FLESH_LINES),
              cut(cord, 958, 648, 11, 13, 5, drop=[rect(900, 560, 933, 650)], lines=FLESH_LINES),
              cut(cord, 246, 226, 9, 8, 5, drop=[rect(190, 140, 226, 230)], lines=FLESH_LINES),
              cut(cord, 1652, 672, 13, 8, 5, drop=[rect(1590, 600, 1622, 680)], lines=FLESH_LINES)]:
        k.op = clean_mask(k.op)
        blooms.append(trim(finish(shade(k, ramp)), keep_centre=False))
    # roots: the tentacles
    for cx, foot in [(224, 402), (561, 402), (902, 838)]:
        k = cut(cord, cx, foot, 17, 12, 8, lines=FLESH_LINES)   # 12 rows: the gallery shows 12 under the soil
        k.op = clean_mask(k.op)
        roots.append(trim(finish(shade(k, ramp))))
    return ramp, stems, heads, blooms, roots


# ------------------------------------------------------------------ the cap (kind 26)
CAP_LINES, COIL_LINES, ROOT_LINES = (52, 120), (62, 160), (45, 100)
COIL_WIN = {'v2': (785, 95), 'v3': (1240, 95), 'v4': (320, 410), 'v5': (785, 410), 'v6': (1245, 405),
            'v7': (316, 735), 'v9': (1240, 745)}


def cap_pieces(cap):
    capr = band_colours(cap, (250, 340, 405, 420), [0, .04, .2, .45, .72, .93, 1])
    coil = band_colours(cap, (270, 740, 365, 920), [0, .04, .2, .45, .72, .93, 1])
    root = band_colours(cap, (1180, 925, 1335, 992), [0, .1, .35, .65, .9, 1])
    coil[0] = capr[0] = root[0]           # one dark line for the whole plant
    pal = np.concatenate([coil, capr[1:], root[1:4]])
    CO, CA, RO = list(range(6)), [0] + list(range(6, 11)), [0] + list(range(11, 14))
    stems, heads, blooms, roots = [], [], [], []
    join = np.array([0, 2, 3, 5, 3, 2, 0])      # the vertical passage every slice starts and ends on
    for var, r0, r1 in [('v7', 23, 34), ('v6', 2, 11), ('v9', 3, 17), ('v3', 17, 32), ('v5', 6, 14), ('v4', 12, 32)]:
        cx, top = COIL_WIN[var]
        ya, yb = top + 5 * r0, top + 5 * (r1 + 1)
        ct, cb = tube_centre(cap, ya, ya + 5, cx - 52, cx + 52), tube_centre(cap, yb - 5, yb, cx - 52, cx + 52)
        k = cut(sheared(cap, ya + 2.5, yb - 2.5, cx - ct, cx - cb), cx, yb, 23, r1 - r0 + 1, 5, lines=COIL_LINES)
        k.op = clean_mask(k.op)
        idx = finish(shade(k, coil))
        c = idx.shape[1] // 2
        for y in (0, idx.shape[0] - 1):
            idx[y] = -1
            idx[y, c - 3:c + 4] = join
        stems.append(trim(np.where(idx >= 0, np.array(CO)[idx.clip(0)], -1)))
    for k in [cut(cap, 1256, 748, 33, 19, 5, lines=CAP_LINES), cut(cap, 322, 425, 31, 17, 5, lines=CAP_LINES),
              cut(cap, 334, 104, 31, 19, 5, lines=CAP_LINES)]:
        k.op = clean_mask(k.op)
        idx = finish(shade(k, capr))
        heads.append(trim(np.where(idx >= 0, np.array(CA)[idx.clip(0)], -1)))
    for top, foot in [(768, 802), (802, 836), (836, 871), (871, 909)]:
        k = cut(cap, 803.5, foot, 9, 7, 5, (foot - top) / 7, lines=COIL_LINES)
        k.op = clean_mask(k.op)
        idx = finish(shade(k, coil))
        blooms.append(trim(np.where(idx >= 0, np.array(CO)[idx.clip(0)], -1), keep_centre=False))
    for cx, foot in [(1255, 990), (327, 320), (300, 985)]:
        k = cut(cap, cx, foot, 23, 11, 6, drop=[rect(cx - 90, foot - 300, cx - 55, foot + 5)], lines=ROOT_LINES)   # not the stem line beside it
        k.op = clean_mask(k.op)
        idx = finish(shade(k, root[:4]))
        roots.append(trim(np.where(idx >= 0, np.array(RO)[idx.clip(0)], -1)))
    return pal, stems, heads, blooms, roots


def sheet(families, path, scale=4, pad=3):
    """Every piece, family by family and kind by kind, at scale on a dark
    ground."""
    rows = []
    for pal, groups in families:
        for group in groups:
            rows.append([rgba(i, pal) for i in group])
    W = max(sum(a.shape[1] + pad for a in r) + pad for r in rows)
    H = sum(max(a.shape[0] for a in r) + pad for r in rows) + pad
    o = Image.new('RGBA', (W, H), (30, 33, 40, 255))
    y = pad
    for r in rows:
        x, rh = pad, max(a.shape[0] for a in r)
        for a in r:
            o.alpha_composite(Image.fromarray(a, 'RGBA'), (x, y + rh - a.shape[0]))
            x += a.shape[1] + pad
        y += rh + pad
    o.resize((W * scale, H * scale), Image.NEAREST).save(path)


def main(preview=None):
    cord, cap = load('cord-source.png'), load('cap-source.png')
    fams = {'sligo-cord': cord_pieces(cord), 'sligo-cap': cap_pieces(cap)}
    js = []
    for name, (pal, stems, heads, blooms, roots) in fams.items():
        d = OUT / name
        d.mkdir(parents=True, exist_ok=True)
        for f in d.glob('*.png'):
            f.unlink()
        entry = {'dir': name}
        for key, prefix, group in [('s', 'stem', stems), ('f', 'flower', heads), ('b', 'bloom', blooms), ('r', 'root', roots)]:
            entry[key] = []
            for i, idx in enumerate(group):
                Image.fromarray(rgba(idx, pal), 'RGBA').save(d / ('%s-%02d.png' % (prefix, i + 1)), optimize=True)
                entry[key].append([0, 0, idx.shape[1], idx.shape[0]])
        js.append(entry)
        print(name, len(pal), 'colours;', ', '.join('%d %s' % (len(g), n) for g, n in [(stems, 'stems'), (heads, 'heads'), (blooms, 'blooms'), (roots, 'roots')]))
    print('PA.fam.push(' + ','.join(json.dumps(e, separators=(',', ':')) for e in js) + ');')
    if preview:
        sheet([(p[0], p[1:]) for p in fams.values()], preview)
    return fams


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
