"""Cut a concept sheet whose background is transparent into its loose parts.

    python3 scripts/split-alpha-sheet.py <sheet.png> <out-dir> <groups.json>

Pixels with alpha >= 128 are the art. Parts closer than 3 px join, so a vine
stays with its rock and a lamp with its glow. Each part is saved with binary
alpha (RGB 0 where transparent) and at most 64 colours, under the group whose
box holds its centre: `<out-dir>/parts/<group>/<nn>.png`, listed in
`<out-dir>/parts.json`. groups.json is a list of [group, x0, y0, x1, y1];
parts outside every box go to `misc`.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

JOIN = 2
MIN_AREA = 25
COLOURS = 64


def save_part(rgba, file):
    solid = rgba[..., 3] >= 128
    q = Image.fromarray(np.ascontiguousarray(rgba[..., :3])).quantize(COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    colours = np.array(q.getpalette()[:3 * COLOURS]).reshape(-1, 3)
    index = np.asarray(q).copy()
    clear = len(colours)
    index[~solid] = clear
    image = Image.fromarray(index.astype(np.uint8), 'P')
    image.putpalette(np.vstack([colours, [[0, 0, 0]]]).astype(np.uint8).flatten().tolist())
    image.save(file, optimize=True, transparency=clear)


def main(sheet, out, groups_file):
    out = Path(out)
    rgba = np.asarray(Image.open(sheet).convert('RGBA'))
    art = rgba[..., 3] >= 128
    labels, _ = ndi.label(ndi.binary_dilation(art, iterations=JOIN), structure=np.ones((3, 3)))
    labels = labels * art
    groups = json.loads(Path(groups_file).read_text())
    found = []
    for index, box in enumerate(ndi.find_objects(labels)):
        if box is None:
            continue
        mask = labels[box] == index + 1
        if mask.sum() < MIN_AREA:
            continue
        y0, y1, x0, x1 = box[0].start, box[0].stop, box[1].start, box[1].stop
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        group = next((g for g, gx0, gy0, gx1, gy1 in groups if gx0 <= cx < gx1 and gy0 <= cy < gy1), 'misc')
        found.append((group, y0, x0, y1, x1, mask))
    found.sort(key=lambda f: (f[0], f[1] // 24, f[2]))
    listing, count = [], {}
    for group, y0, x0, y1, x1, mask in found:
        n = count[group] = count.get(group, 0) + 1
        crop = rgba[y0:y1, x0:x1].copy()
        crop[~mask] = 0
        crop[..., 3] = np.where(mask & (crop[..., 3] >= 128), 255, 0)
        crop[crop[..., 3] == 0] = 0
        file = out / 'parts' / group / f'{n:02d}.png'
        file.parent.mkdir(parents=True, exist_ok=True)
        save_part(crop, file)
        listing.append({'group': group, 'file': str(file.relative_to(out)), 'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)})
    (out / 'parts.json').write_text(json.dumps(listing, indent=1) + '\n')
    print(sheet, len(listing), 'parts', {g: count[g] for g in sorted(count)})


if __name__ == '__main__':
    main(*sys.argv[1:4])
