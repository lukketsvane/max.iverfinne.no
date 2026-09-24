"""Build the Sanctuary tile atlas the generated gardens draw their ledges and rock with.

Pieces come from the owner's pixel tile sheet (docs/asset-review/sanctuary-tiles-v1/
source.png), are halved to the game's native scale with binary alpha, their
repeating middles are made seamless, and the whole atlas shares one palette.

    python3 scripts/build-tiles.py
      -> assets/tiles-v1/sanctuary.png, assets/tiles-v1/atlas.json, tiles.js
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/asset-review/sanctuary-tiles-v1/source.png'
PNG = 'assets/tiles-v1/sanctuary.png'
COLOURS = 64

# Source boxes on the sheet, at sheet scale: x, y, w, h.
SHEET = {
    'mossy block': (17, 18, 73, 48),
    'big block': (531, 76, 85, 109),
    'hanging moss': (106, 310, 96, 90),
    'bench': (1338, 286, 90, 51),
    'arch': (1094, 24, 147, 129),
    'blue flowers': (843, 470, 47, 28),
    'violet mushrooms': (1000, 468, 29, 31),
    'glow ferns': (1064, 469, 51, 34),
}


def half(rgba):
    """Halve with a 2x2 box over opaque pixels; a cell is opaque when two of its four are."""
    h, w = rgba.shape[0] // 2 * 2, rgba.shape[1] // 2 * 2
    a = rgba[:h, :w].astype(float)
    solid = (a[..., 3] >= 128).astype(float)
    block = lambda x: x.reshape(h // 2, 2, w // 2, 2).sum((1, 3))
    n = block(solid)
    rgb = np.stack([block(a[..., c] * solid) for c in range(3)], -1) / np.maximum(n, 1)[..., None]
    out = np.zeros((h // 2, w // 2, 4))
    keep = n >= 2
    out[keep, :3] = rgb[keep]
    out[keep, 3] = 255
    return out


def seamless_x(tile, blend=4):
    """Fade the last columns into the first so the tile repeats without a seam."""
    t = tile.copy()
    for i in range(blend):
        k = (i + 1) / (blend + 1)
        col = t.shape[1] - blend + i
        both = (t[:, col, 3] > 0) & (t[:, i, 3] > 0)
        t[both, col, :3] = t[both, col, :3] * (1 - k) + t[both, i, :3] * k
    return t


def seamless_y(tile, blend=4):
    return seamless_x(tile.transpose(1, 0, 2), blend).transpose(1, 0, 2)


def pieces(src):
    part = {}
    for name, (x, y, w, h) in SHEET.items():
        crop = src[y:y + h, x:x + w].copy()
        crop[crop[..., 3] < 128] = 0
        part[name] = half(crop)
    out = {}
    # Stone ledge: the mossy block's cap and upper rock over its bottom rim, 14 rows.
    b = part['mossy block']
    strip = np.concatenate([b[0:10], b[-4:]], 0)
    out['ledge.stone.left'], out['ledge.stone.mid'], out['ledge.stone.right'] = strip[:, :6], seamless_x(strip[:, 6:30]), strip[:, 30:]
    # Rock: nine slices of the big block.
    r = part['big block']
    rows, cols = (slice(0, 8), slice(8, 50), slice(50, 54)), (slice(0, 5), slice(5, 37), slice(37, 42))
    for rn, rs in zip(('top', 'mid', 'bottom'), rows):
        for cn, cs in zip(('left', 'mid', 'right'), cols):
            tile = r[rs, cs]
            if cn == 'mid':
                tile = seamless_x(tile)
            if rn == 'mid':
                tile = seamless_y(tile)
            out[f'rock.{rn}.{cn}'] = tile
    # Wood ledge: the bench's plank with the tops of its legs as brackets.
    w = part['bench']
    out['ledge.wood.left'], out['ledge.wood.mid'], out['ledge.wood.right'] = w[:10, :11], seamless_x(w[:6, 11:34]), w[:10, 34:]
    # Ruin ledge: the arch's lintel and capitals.
    a = part['arch']
    lintel = a[5:14]
    out['ledge.ruin.left'], out['ledge.ruin.mid'], out['ledge.ruin.right'] = lintel[:, :10], seamless_x(lintel[:, 10:54]), lintel[:, 54:]
    # Vines that hang under rock, and flora for ledge tops.
    out['vines'] = part['hanging moss'][9:33]
    for name in ('blue flowers', 'violet mushrooms', 'glow ferns'):
        f = part[name]
        ys, xs = np.nonzero(f[..., 3])
        out['flora.' + name.split()[-1]] = f[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return out


def pack(tiles, width=128):
    """Shelf-pack pieces with a 1 px gap; returns the atlas and each piece's box."""
    x = y = shelf = 0
    boxes = {}
    for name, t in sorted(tiles.items(), key=lambda kv: (-kv[1].shape[0], kv[0])):
        h, w = t.shape[:2]
        if x + w > width:
            x, y, shelf = 0, y + shelf + 1, 0
        boxes[name] = [x, y, w, h]
        x, shelf = x + w + 1, max(shelf, h)
    atlas = np.zeros((y + shelf, width, 4))
    for name, (x, y, w, h) in boxes.items():
        atlas[y:y + h, x:x + w] = tiles[name]
    return atlas, boxes


def quantize(atlas):
    solid = atlas[..., 3] > 0
    rgb = Image.fromarray(np.clip(atlas[..., :3], 0, 255).astype(np.uint8))
    q = rgb.quantize(COLOURS, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    colours = np.array(q.getpalette()[:3 * COLOURS]).reshape(-1, 3)
    out = np.zeros(atlas.shape, np.uint8)
    out[..., :3] = colours[np.asarray(q)]
    out[..., 3] = np.where(solid, 255, 0)
    out[~solid] = 0
    used = sorted({'#%02x%02x%02x' % tuple(c) for c in out[solid][:, :3]})
    return out, used


def save_indexed(image, file):
    """An 8-bit palette PNG: the pack colours plus one black, fully transparent entry."""
    solid = image[..., 3] > 0
    colours = sorted({tuple(c) for c in image[solid][:, :3]})
    lookup = {c: i for i, c in enumerate(colours)}
    index = np.full(image.shape[:2], len(colours), np.uint8)
    for y, x in zip(*np.nonzero(solid)):
        index[y, x] = lookup[tuple(image[y, x, :3])]
    out = Image.fromarray(index, 'P')
    out.putpalette([v for c in colours for v in c] + [0, 0, 0])
    out.save(file, optimize=True, transparency=len(colours))
    try:
        import oxipng
        oxipng.optimize(file, level=6)
    except ImportError:
        pass


def main():
    src = np.asarray(Image.open(SOURCE).convert('RGBA'))
    atlas, boxes = pack(pieces(src))
    image, palette = quantize(atlas)
    (ROOT / PNG).parent.mkdir(parents=True, exist_ok=True)
    save_indexed(image, ROOT / PNG)
    h, w = image.shape[:2]
    meta = {'palette': palette, 'sheets': {'sanctuary': {'image': 'sanctuary.png', 'width': w, 'height': h}}, 'pieces': boxes,
            'source': 'docs/asset-review/sanctuary-tiles-v1/source.png, halved; scripts/build-tiles.py'}
    (ROOT / 'assets/tiles-v1/atlas.json').write_text(json.dumps(meta, indent=1) + '\n')
    js = ('// Generated by scripts/build-tiles.py: the Sanctuary tile atlas the generated gardens draw ledges and rock with.\n'
          'window.MaxTiles = { src: \'%s\', pieces: %s };\n' % (PNG, json.dumps(boxes, separators=(',', ':'))))
    (ROOT / 'tiles.js').write_text(js)
    print(PNG, '%dx%d' % (w, h), len(palette), 'colours', len(boxes), 'pieces')


if __name__ == '__main__':
    main()
