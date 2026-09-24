"""Build the cavern backdrop behind the underground gardens (1-10).

The owner's backdrop art (docs/asset-review/cavern-layers-v1: far cave
silhouettes, a sheet of silhouette strips, and the lake and misty ruins shared
with docs/asset-review/coast-layers-v1) is painted at about four times the
game's pixel size. Each layer is brought to native pixels (1/4, premultiplied
box filter, hard alpha at half) and set on the night layers' 180-row grid,
whose row 140 is the ground line:

- far: the cave silhouettes, opaque, the back of the cavern;
- ceiling: the stalactites of the sheet's first strip, hanging from the top
  of the grid (the sheet is keyed out of its near-black);
- horizon: what stands in that strip and the sheet's line of ruins, on the
  lake's far shore;
- lake: the dark water from the far shore down, its clouds left out (it is
  underground);
- ruins: the misty ruins in the water, hazed towards the cavern's dark.

Wide layers are stored as a mirrored pair so they wrap without a seam. Every
layer has binary alpha and a small palette of its own.

    python3 scripts/build-cavern-layers.py -> assets/cavern-v1/<name>.png, atlas.json
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
CAVE = ROOT / 'docs/asset-review/cavern-layers-v1'
COAST = ROOT / 'docs/asset-review/coast-layers-v1'
OUT = ROOT / 'assets/cavern-v1'
H = 180
SHORE = 104                    # the lake's far shore on the grid
DARK = np.array([5., 7, 14])   # the cavern's own dark


def native(img, f=4):
    a = np.array(img.convert('RGBA')).astype(float)
    a[..., :3] *= a[..., 3:4] / 255.0
    s = np.array(Image.fromarray(a.astype(np.uint8), 'RGBA').resize((round(img.width / f), round(img.height / f)), Image.BOX)).astype(float)
    al = s[..., 3]
    rgb = np.where(al[..., None] > 0, s[..., :3] * 255.0 / np.maximum(al[..., None], 1), 0)
    return np.clip(rgb, 0, 255), al >= 128


def keyed(path):
    """The sheet on near-black: its edge-connected dark is background."""
    rgb = np.array(Image.open(path).convert('RGB')).astype(int)
    dark = (rgb * [0.3, 0.59, 0.11]).sum(-1) < 11
    lab, _ = ndimage.label(dark)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    alpha = np.where(np.isin(lab, list(edge)), 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA')


def grid(rgb, op, dy):
    g_rgb, g_op = np.zeros((H, rgb.shape[1], 3)), np.zeros((H, rgb.shape[1]), bool)
    for y in range(H):
        if 0 <= y - dy < rgb.shape[0]:
            g_rgb[y], g_op[y] = rgb[y - dy], op[y - dy]
    return g_rgb, g_op


def finish(rgb, op, colours, pair=True, haze=0.0):
    rgb = rgb * (1 - haze) + DARK * haze
    if pair:
        rgb, op = np.concatenate([rgb, rgb[:, ::-1]], 1), np.concatenate([op, op[:, ::-1]], 1)
    q = np.array(Image.fromarray(np.round(rgb).astype(np.uint8)).quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'))
    q[~op] = 0
    return np.dstack([q, np.where(op, 255, 0)]).astype(np.uint8)


def strip(sheet, top, bottom):
    """One row of the sheet split in two: what hangs from its top edge (the
    ceiling's stalactites) and what stands on its foot."""
    rgb, op = native(sheet.crop((0, top, sheet.width, bottom)))
    h = op.shape[0]
    cut = min(range(h // 6, h * 2 // 3), key=lambda r: op[r].mean())   # the emptiest row between them
    hang = op.copy()
    hang[cut:] = False
    return rgb, hang, op & ~hang


def foot(rgb, op, at):
    rows = np.nonzero(op.any(1))[0]
    return grid(rgb, op, at - rows.max() - 1)


def layers():
    far_rgb, far_op = native(Image.open(CAVE / 'far.png'))
    far_op[:] = True
    yield 'far', finish(*grid(far_rgb, far_op, -8), 12)
    sheet = keyed(CAVE / 'strips.png')
    rgb, hang, stand = strip(sheet, 14, 159)
    yield 'ceiling', finish(*grid(rgb, hang, 0), 10, haze=0.2)
    cave = foot(rgb, stand, SHORE - 4)
    line, line_top, line_rest = strip(sheet, 180, 286)          # a line of ruins, nothing hanging
    ruin = foot(line, line_top | line_rest, SHORE + 1)
    rgb, op = cave[0].copy(), cave[1].copy()
    rgb[ruin[1]], op[ruin[1]] = ruin[0][ruin[1]], True
    yield 'horizon', finish(rgb, op, 12, haze=0.25)
    sea_rgb, sea_op = native(Image.open(COAST / 'sea.png'))
    sea_op[:80] = False                              # the clouds and sky: underground there are none
    yield 'lake', finish(*grid(sea_rgb, sea_op, SHORE - 84), 16, haze=0.35)
    ruins_rgb, ruins_op = native(Image.open(COAST / 'ruins.png'))
    yield 'ruins', finish(*grid(ruins_rgb, ruins_op, -24), 12, pair=False, haze=0.55)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    palette, sheets, order = set(), {}, []
    for name, a in layers():
        Image.fromarray(a, 'RGBA').save(OUT / (name + '.png'), optimize=True)
        palette |= {'#%02x%02x%02x' % tuple(c) for c in a[a[..., 3] > 0][:, :3]}
        sheets[name] = {'image': name + '.png', 'width': a.shape[1], 'height': H}
        order.append(name)
        print(name, a.shape[1], H)
    (OUT / 'atlas.json').write_text(json.dumps({
        'palette': sorted(palette), 'order': order, 'sheets': sheets,
        'source': 'docs/asset-review/cavern-layers-v1 and coast-layers-v1 (the owner\'s layers), 1/4; scripts/build-cavern-layers.py',
    }, indent=1) + '\n')


if __name__ == '__main__':
    main()
