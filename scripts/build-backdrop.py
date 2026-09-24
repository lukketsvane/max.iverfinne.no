"""Build the Sanctuary backdrop: five parallax layers at their native 320x180.

The owner's layers (docs/asset-review/sanctuary-backdrop-v1/source-*.png) are
320x180 pixel art upscaled about 5.2x. Each is brought back to 320x180 with
an area filter over premultiplied alpha, gets binary alpha and a small palette
of its own; the forest is hazed towards the night so ledges read in front of it.

    python3 scripts/build-backdrop.py -> assets/backdrop-v1/<layer>.png, atlas.json
"""
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/asset-review/sanctuary-backdrop-v1'
OUT = ROOT / 'assets/backdrop-v1'
SIZE = (320, 180)
# layer: colours, haze towards the night sky
LAYERS = {'sky': (16, 0), 'band': (12, 0), 'mountains': (16, 0), 'ruins': (12, 0), 'forest': (24, 0.2)}
NIGHT = np.array([18, 24, 58])


def native(file):
    a = np.asarray(Image.open(file).convert('RGBA')).astype(np.float32)
    alpha = a[..., 3] / 255
    chans = [a[..., c] * alpha for c in range(3)] + [alpha]
    small = np.stack([np.asarray(Image.fromarray(c, 'F').resize(SIZE, Image.BOX)) for c in chans], -1)
    solid = small[..., 3] >= 0.5
    rgb = small[..., :3] / np.maximum(small[..., 3:], 1e-6)
    return np.clip(rgb, 0, 255), solid


def palette_png(rgb, solid, colours):
    q = Image.fromarray(rgb.astype(np.uint8)).quantize(colours, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:3 * colours]).reshape(-1, 3)
    index = np.asarray(q)
    used = sorted(set(index[solid].tolist()))
    out = np.full(index.shape, len(used), np.uint8)
    for i, u in enumerate(used):
        out[(index == u) & solid] = i
    image = Image.fromarray(out, 'P')
    image.putpalette([int(v) for u in used for v in pal[u]] + [0, 0, 0])
    buf = io.BytesIO()
    image.save(buf, 'PNG', optimize=True, transparency=len(used))
    data = buf.getvalue()
    try:
        import oxipng
        data = oxipng.optimize_from_memory(data, level=6)
    except ImportError:
        pass
    return data, ['#%02x%02x%02x' % tuple(int(v) for v in pal[u]) for u in used]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sheets, palette = {}, set()
    for name, (colours, haze) in LAYERS.items():
        rgb, solid = native(SOURCE / f'source-{name}.png')
        if haze:
            rgb = rgb * (1 - haze) + NIGHT * haze
        data, used = palette_png(rgb, solid, colours)
        (OUT / f'{name}.png').write_bytes(data)
        palette.update(used)
        sheets[name] = {'image': f'{name}.png', 'width': SIZE[0], 'height': SIZE[1]}
        print(name, len(data), 'bytes', len(used), 'colours')
    meta = {'palette': sorted(palette), 'sheets': sheets, 'order': list(LAYERS),
            'source': 'docs/asset-review/sanctuary-backdrop-v1, 320x180 native; scripts/build-backdrop.py'}
    (OUT / 'atlas.json').write_text(json.dumps(meta, indent=1) + '\n')


if __name__ == '__main__':
    main()
