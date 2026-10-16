#!/usr/bin/env python3
import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'assets' / 'levels-v2'


def sources_dir():
    return Path(os.environ.get('SCENE_SOURCES', HERE / 'sources'))


def best_offset(rgba, box, avoid, reach):
    x, y, w, h = box
    H, W = rgba.shape[:2]
    img = rgba.astype(np.float64)
    ring = 5
    y0, y1, x0, x1 = max(0, y - ring), min(H, y + h + ring), max(0, x - ring), min(W, x + w + ring)
    mask = np.ones((y1 - y0, x1 - x0), dtype=bool)
    mask[y - y0:y - y0 + h, x - x0:x - x0 + w] = False
    target = img[y0:y1, x0:x1][mask]
    best, choice = None, None
    for dy in range(-reach[1], reach[1] + 1):
        for dx in range(-reach[0], reach[0] + 1):
            if abs(dx) < w and abs(dy) < h:
                continue
            sx0, sy0 = x0 + dx, y0 + dy
            if sx0 < 0 or sy0 < 0 or sx0 + (x1 - x0) > W or sy0 + (y1 - y0) > H:
                continue
            if any(sx0 < ax + aw and ax < sx0 + (x1 - x0) and sy0 < ay + ah and ay < sy0 + (y1 - y0) for ax, ay, aw, ah in avoid):
                continue
            cost = ((img[sy0:sy0 + y1 - y0, sx0:sx0 + x1 - x0][mask] - target) ** 2).sum() * (1 + .002 * (abs(dx) + 2 * abs(dy)))
            if best is None or cost < best:
                best, choice = cost, (dx, dy)
    return choice


def remove_figures(rgba, patches):
    boxes = [p['box'] for p in patches]
    used = []
    for i, patch in enumerate(patches):
        x, y, w, h = patch['box']
        if patch.get('clear'):
            rgba[y:y + h, x:x + w] = 0
            used.append([patch['note'], 'clear'])
            continue
        dx, dy = patch.get('from') or best_offset(rgba, patch['box'], boxes[i:], tuple(patch.get('reach', (160, 70))))
        rgba[y:y + h, x:x + w] = rgba[y + dy:y + dy + h, x + dx:x + dx + w].copy()
        used.append([patch['note'], [dx, dy]])
    return used


def downscale(rgba, size):
    image = Image.fromarray(rgba, 'RGBA').convert('RGBa').resize(size, Image.Resampling.BOX).convert('RGBA')
    return np.asarray(image).copy()


def despeckle(opaque, minimum):
    labels, count = ndimage.label(opaque, structure=np.ones((3, 3)))
    if not count:
        return opaque
    sizes = ndimage.sum(opaque, labels, range(1, count + 1))
    keep = np.zeros(count + 1, dtype=bool)
    keep[1:] = sizes >= minimum
    return keep[labels]


def quantize(rgb, opaque, colors):
    fill = rgb[opaque].mean(axis=0).astype(np.uint8) if opaque.any() else np.zeros(3, np.uint8)
    work = rgb.copy()
    work[~opaque] = fill
    q = Image.fromarray(work, 'RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return np.asarray(q.convert('RGB')).copy()


def paint_ladders(rgb, opaque, ladders):
    if not ladders:
        return
    colors, counts = np.unique(rgb[opaque].reshape(-1, 3), axis=0, return_counts=True)
    light = colors @ np.array([.299, .587, .114])
    order = np.argsort(light)
    cumulative = np.cumsum(counts[order]) / counts.sum()
    pick = lambda q: colors[order[min(len(order) - 1, int(np.searchsorted(cumulative, q)))]]
    rail, rung, shade = pick(.12), pick(.72), pick(.04)
    H, W = opaque.shape
    for _, cx, top, bottom in ladders:
        for y in range(max(0, top - 2), min(H, bottom + 1)):
            for x in (cx - 6, cx - 5, cx + 5, cx + 6):
                if 0 <= x < W:
                    rgb[y, x] = rail if x in (cx - 6, cx + 6) else shade
                    opaque[y, x] = True
        for y in range(top + 3, bottom - 1, 7):
            for x in range(cx - 5, cx + 6):
                if 0 <= x < W:
                    rgb[y, x] = rung
                    opaque[y, x] = True
                    if y + 1 < H:
                        rgb[y + 1, x] = shade
                        opaque[y + 1, x] = True


def painted(scene_id):
    for spec in sorted((HERE / 'specs').glob('*.json')):
        data = json.loads(spec.read_text())
        if data.get('id') == scene_id:
            return data.get('paintLadders', [])
    return []


def save_indexed(rgb, opaque, path):
    colors = sorted({tuple(c) for c in rgb[opaque].tolist()})
    if len(colors) > 255:
        raise SystemExit(f'{path.name}: {len(colors)} colours exceed an indexed PNG')
    index = {c: i + 1 for i, c in enumerate(colors)}
    flat = np.zeros(opaque.shape, dtype=np.uint8)
    flat[opaque] = [index[tuple(c)] for c in rgb[opaque].tolist()]
    image = Image.fromarray(flat, 'P')
    image.putpalette([0, 0, 0] + [v for c in colors for v in c] + [0] * (765 - 3 * len(colors)))
    path.parent.mkdir(parents=True, exist_ok=True)
    if opaque.all():
        image.save(path, optimize=True)
    else:
        image.save(path, optimize=True, transparency=0)
    return len(colors)


def digest(path):
    return hashlib.sha1(path.read_bytes()).hexdigest()


def build(scene):
    src = sources_dir()
    fg_path, bg_path = src / f"{scene['id']}-fg.png", src / f"{scene['id']}-bg.png"
    for path, key in ((fg_path, 'foregroundHash'), (bg_path, 'backdropHash')):
        if digest(path) != scene['figma'][key]:
            raise SystemExit(f'{path.name} differs from Figma image {scene["figma"][key]}')
    fg = np.asarray(Image.open(fg_path).convert('RGBA')).copy()
    fg[..., 3] = np.where(fg[..., 3] >= 128, 255, 0)
    fg[fg[..., 3] == 0] = 0
    used = remove_figures(fg, scene.get('patches', []))
    scale = scene['scale']
    size = (round(fg.shape[1] * scale), round(fg.shape[0] * scale))
    small = downscale(fg, size)
    opaque = despeckle(small[..., 3] >= 128, scene.get('speckle', 6))
    rgb = quantize(small[..., :3], opaque, scene.get('colors', 64))
    paint_ladders(rgb, opaque, painted(scene['id']))
    rgb[~opaque] = 0
    fg_out = OUT / f"{scene['id']}-fg.png"
    fg_colors = save_indexed(rgb, opaque, fg_out)

    bg = np.asarray(Image.open(bg_path).convert('RGB')).copy()
    bg_scale = scene.get('backdropScale', scale)
    bg_size = (round(bg.shape[1] * bg_scale), round(bg.shape[0] * bg_scale))
    bg_small = np.asarray(Image.fromarray(bg, 'RGB').resize(bg_size, Image.Resampling.BOX)).copy()
    full = np.ones(bg_small.shape[:2], dtype=bool)
    bg_rgb = quantize(bg_small, full, scene.get('backdropColors', 64))
    bg_out = OUT / f"{scene['id']}-bg.png"
    bg_colors = save_indexed(bg_rgb, full, bg_out)
    return {
        'id': scene['id'],
        'foreground': {'path': str(fg_out.relative_to(ROOT)), 'width': size[0], 'height': size[1], 'colors': fg_colors, 'sha1': digest(fg_out), 'source': digest(fg_path)},
        'backdrop': {'path': str(bg_out.relative_to(ROOT)), 'width': bg_size[0], 'height': bg_size[1], 'colors': bg_colors, 'sha1': digest(bg_out), 'source': digest(bg_path)},
        'patches': used,
    }


def main():
    recipe = json.loads((HERE / 'art-recipe.json').read_text())
    wanted = set(sys.argv[1:])
    report = [build(s) for s in recipe['scenes'] if not wanted or s['id'] in wanted]
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
