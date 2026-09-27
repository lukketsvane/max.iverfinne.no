"""Normalize generated Evergreen/Chain source poses into native Sligo evolution art.

One source scale per atlas, never a per-frame fit; 24 authored poses in 40px
cells, anchor (20,39), binary alpha and one intentional shared 16-colour palette.
Brood and the original Sligo skin are not modified.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/asset-review/sligo-evolution-v1'
OUT = ROOT / 'assets/max-skins-v1/sligo'
CELL, COLS, ROWS = 40, 8, 3
PALETTE = ['#180f1b', '#351623', '#591d32', '#7a2945', '#9e3f59',
           '#be596d', '#da7782', '#eda099', '#f9c2ad', '#ffe3ce',
           '#372539', '#58344b', '#785169', '#39412b', '#606942', '#979262']
CLIPS = {
    'grow': [None, [0, 1, 2, 3], [8, 9, 10, 11], [16, 17, 18, 19]],
    'walk': [None, list(range(8)), list(range(8, 16)), list(range(16, 24))],
    'idle': [None, [0, 1, 0, 7], [8, 9, 8, 15], [16, 17, 16, 23]],
    'air': [None, 6, 14, 22],
}


def cut_frames(a, name):
    frames, boxes = [], []
    h, w = a.shape[:2]
    for row in range(ROWS):
        for col in range(COLS):
            x0, x1 = round(col*w/COLS), round((col+1)*w/COLS)
            # Generated rows have unequal whitespace. Cut in their actual clear
            # gutters so a tall crest never leaks into its neighbour's pose.
            boundaries = [0, 230, 475, h] if name == 'evergreen' else [0, 225, 451, h]
            y0, y1 = boundaries[row:row+2]
            f = a[y0:y1, x0:x1].copy()
            mask = f[..., 3] >= 160
            labels, count = ndimage.label(mask, structure=np.ones((3, 3)))
            sizes = np.bincount(labels.ravel()); sizes[0] = 0
            # Drop isolated antialiasing debris; retain every substantive source part.
            keep = np.flatnonzero(sizes >= max(12, sizes.max()*.001))
            mask &= np.isin(labels, keep)
            ys, xs = np.nonzero(mask)
            assert len(xs) > 1000, (row, col, 'empty source cell')
            box = [int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)]
            f[~mask] = 0
            frames.append(f[box[1]:box[3], box[0]:box[2]])
            boxes.append([x0+box[0], y0+box[1], x0+box[2], y0+box[3]])
    return frames, boxes


def native(f, scale):
    h, w = f.shape[:2]
    # Premultiplied BOX reduction keeps dark outlines without background fringes.
    rgb = f[..., :3].astype(float) * f[..., 3:4] / 255
    premult = np.dstack([rgb, f[..., 3]]).astype(np.uint8)
    p = np.array(Image.fromarray(premult).resize((round(w*scale), round(h*scale)), Image.Resampling.BOX))
    alpha = p[..., 3]
    rgb = np.clip(p[..., :3].astype(float)*255/np.maximum(1, alpha[..., None]), 0, 255)
    pal = np.array([tuple(bytes.fromhex(c[1:])) for c in PALETTE], dtype=np.int32)
    rgb = pal[((rgb[..., None, :] - pal)**2).sum(-1).argmin(-1)]
    out = np.dstack([rgb, np.where(alpha >= 128, 255, 0)]).astype(np.uint8)
    out[out[..., 3] == 0] = 0
    ys, xs = np.nonzero(out[..., 3])
    return out[ys.min():ys.max()+1, xs.min():xs.max()+1]


def build(name):
    source = SOURCE / (name+'-source.png')
    raw = np.array(Image.open(source).convert('RGBA'))
    source_frames, boxes = cut_frames(raw, name)
    scale = min(36 / max(f.shape[0] for f in source_frames),
                36 / max(f.shape[1] for f in source_frames))
    strip = np.zeros((CELL, CELL*COLS*ROWS, 4), dtype=np.uint8)
    records = []
    contact = Image.new('RGBA', (CELL*COLS, CELL*ROWS), '#241a29')
    for index, src in enumerate(source_frames):
        f = native(src, scale)
        h, w = f.shape[:2]
        x, y = CELL//2-w//2, CELL-h
        strip[y:y+h, index*CELL+x:index*CELL+x+w] = f
        tile = Image.new('RGBA', (CELL, CELL))
        tile.paste(Image.fromarray(f), (x, y))
        contact.alpha_composite(tile, ((index%COLS)*CELL, (index//COLS)*CELL))
        records.append({'sheet': name, 'rect': [index*CELL, 0, CELL, CELL],
                        'anchor': [20, 39], 'opaqueBounds': [x, y, x+w, y+h],
                        'sourceRect': boxes[index]})
    Image.fromarray(strip).save(OUT/(name+'.png'), optimize=True)
    meta = {'schema': 'max-sligo-evolution/v1', 'image': name+'.png',
            'cell': [CELL, CELL], 'anchor': [20, 39], 'rows': ['young', 'grown', 'mature'],
            'sourceColumns': COLS, 'scale': scale, 'palette': PALETTE,
            'source': str(source.relative_to(ROOT)),
            'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'generator': 'scripts/build-sligo-evolution-branches.py',
            'sheets': {name: {'image': name+'.png', 'size': [CELL*COLS*ROWS, CELL]}},
            'clips': CLIPS, 'frames': records}
    (OUT/(name+'.json')).write_text(json.dumps(meta, indent=1)+'\n')
    contact.resize((contact.width*4, contact.height*4), Image.Resampling.NEAREST).save(SOURCE/(name+'-contact-4x.png'))
    print(name, '24 poses', 'scale', round(scale, 6), 'native', strip.shape[1], 'x', strip.shape[0])


def main():
    for name in ['evergreen', 'chain']:
        build(name)
    # Merge only our paths into the established pending-art list.
    pending_path = ROOT/'assets/figma-pending.json'
    pending = json.loads(pending_path.read_text())
    for name in ['evergreen', 'chain']:
        path = 'assets/max-skins-v1/sligo/'+name+'.png'
        pending['files'] = [entry for entry in pending['files'] if entry['path'] != path]
        pending['files'].append({'path': path, 'sha1': hashlib.sha1((ROOT/path).read_bytes()).hexdigest(),
                                 'width': CELL*COLS*ROWS, 'height': CELL,
                                 'note': 'Generated Sligo '+name+' evolution poses; scripts/build-sligo-evolution-branches.py. Figma desktop unavailable.'})
    pending_path.write_text(json.dumps(pending, indent=1)+'\n')


if __name__ == '__main__':
    main()
