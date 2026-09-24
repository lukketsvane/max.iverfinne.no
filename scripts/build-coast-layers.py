"""Build the coast backdrop behind the Railway Ruins from the owner's three layers.

The layers (docs/asset-review/coast-layers-v1: far mountains, the sea with its
clouds, lighthouses and rocks, and misty ruins standing in the water) are
painted at about four times the game's pixel size, like the Railway Ruins in
front of them. Each is brought down to native pixels (1/4, premultiplied box
filter, hard alpha at half) and set on the night layers' 180-row grid, whose
row 140 is the ground line:

- the sea's horizon at row 100, with open water below it;
- the mountains standing on that horizon (the painted crescent moon is dropped;
  the night sky's own moon stays);
- the ruins' lower band just behind the ground, hazed towards the night so
  they sit back.

The sea and the mountains are stored as a mirrored pair, so they wrap without a
seam; the ruins, which start 91 px in, repeat as they are. Every layer gets
binary alpha and a small palette of its own.

    python3 scripts/build-coast-layers.py -> assets/coast-v1/<name>.png, atlas.json
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/asset-review/coast-layers-v1'
OUT = ROOT / 'assets/coast-v1'
H = 180
NIGHT = np.array([13., 32, 73])
# name: (rows moved down on the grid, colours, haze towards the night, mirrored pair)
LAYERS = {'mountains': (57, 10, 0.0, True), 'sea': (16, 16, 0.0, True), 'ruins': (-24, 12, 0.3, False)}
SPECK = 20                     # opaque parts smaller than this go (the crescent moon)


def native(path, f=4):
    im = Image.open(path).convert('RGBA')
    a = np.array(im).astype(float)
    a[..., :3] *= a[..., 3:4] / 255.0
    s = np.array(Image.fromarray(a.astype(np.uint8), 'RGBA').resize((round(im.width / f), round(im.height / f)), Image.BOX)).astype(float)
    al = s[..., 3]
    rgb = np.where(al[..., None] > 0, s[..., :3] * 255.0 / np.maximum(al[..., None], 1), 0)
    return np.clip(rgb, 0, 255), al >= 128


def layer(name):
    dy, colours, haze, pair = LAYERS[name]
    rgb, op = native(SOURCE / (name + '.png'))
    lab, n = ndimage.label(op, structure=np.ones((3, 3)))
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    for i, s in enumerate(sizes, 1):
        if s < SPECK:
            op[lab == i] = False
    rgb = rgb * (1 - haze) + NIGHT * haze
    grid_rgb, grid_op = np.zeros((H, rgb.shape[1], 3)), np.zeros((H, rgb.shape[1]), bool)
    for y in range(H):
        if 0 <= y - dy < rgb.shape[0]:
            grid_rgb[y], grid_op[y] = rgb[y - dy], op[y - dy]
    if pair:
        grid_rgb = np.concatenate([grid_rgb, grid_rgb[:, ::-1]], 1)
        grid_op = np.concatenate([grid_op, grid_op[:, ::-1]], 1)
    q = np.array(Image.fromarray(np.round(grid_rgb).astype(np.uint8)).quantize(
        colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'))
    q[~grid_op] = 0
    return np.dstack([q, np.where(grid_op, 255, 0)]).astype(np.uint8)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    palette, sheets = set(), {}
    for name in LAYERS:
        a = layer(name)
        Image.fromarray(a, 'RGBA').save(OUT / (name + '.png'), optimize=True)
        palette |= {'#%02x%02x%02x' % tuple(c) for c in a[a[..., 3] > 0][:, :3]}
        sheets[name] = {'image': name + '.png', 'width': a.shape[1], 'height': H}
        print(name, a.shape[1], H)
    (OUT / 'atlas.json').write_text(json.dumps({
        'palette': sorted(palette), 'order': list(LAYERS), 'sheets': sheets,
        'source': 'docs/asset-review/coast-layers-v1 (the owner\'s layers), 1/4; scripts/build-coast-layers.py',
    }, indent=1) + '\n')


if __name__ == '__main__':
    main()
