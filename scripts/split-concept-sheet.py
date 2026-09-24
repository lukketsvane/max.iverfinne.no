"""Cut a generated concept sheet into its loose parts.

    python3 scripts/split-concept-sheet.py docs/asset-review/sunken-sanctuary-v1

Reads <dir>/source.jpg and writes <dir>/parts/<group>/<nn-name>.png,
<dir>/parts.json and <dir>/clown-mask.png. The clown mask is the label map
the cut came from: every part is one flat colour at its place in the source.

The sheet puts its parts on a flat dark panel. Each pixel is scored by its
distance from a smooth estimate of that panel colour; the section headings and
panel rules are blanked; what is left splits into connected parts, and a small
fragment that lies inside a bigger part's box joins it. Parts keep binary
alpha and at most 64 colours, except glowing lights, wisps and particles,
whose halo fades out against the panel and which stay lossless. The glow
parts are not runtime-ready yet: runtime art needs binary alpha. The layout below (panels, sections, headings) belongs to
the Sunken Sanctuary sheet (1536x1024). Requires Pillow, numpy and scipy.
"""
from pathlib import Path
import colorsys, json, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
try:
    import oxipng                # optional: pip install pyoxipng, lossless
except ImportError:
    oxipng = None

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/asset-review/sunken-sanctuary-v1')
MAP = (0, 0, 1536, 541)          # the level illustration: kept whole
THRESHOLD = 16                   # max channel distance from the panel
# panel columns: x0, x1, sections (group, top y, grouping dilation)
PANELS = [
 (4, 310, [('tiles/terrain', 592, 1), ('tiles/background', 696, 1), ('tiles/water', 810, 1), ('tiles/overgrowth', 914, 1)]),
 (317, 569, [('structures/ruins', 592, 1), ('structures/bridges-platforms', 734, 1), ('structures/ladders-chains', 902, 1)]),
 (576, 829, [('flora/trees-roots', 592, 1), ('flora/plants', 732, 1), ('flora/hanging-vines', 826, 1), ('flora/mushrooms-fungus', 909, 1)]),
 (836, 1096, [('props/crates-barrels-lamps', 592, 2), ('props/statues-altars', 667, 1), ('props/decorative', 775, 1), ('props/interactive', 869, 1)]),
 (1103, 1324, [('enemies/land', 598, 1), ('enemies/water', 691, 1), ('enemies/flying-ambient', 810, 1)]),
 (1331, 1436, [('fx/bubbles', 688, 1)]),
 (1436, 1532, [('fx/lights', 688, 1)]),
 (1331, 1532, [('fx/particles', 785, 5), ('fx/ambient-elements', 851, 1)]),
]
PANEL_BOTTOM = {836: 913, 1103: 913, 1331: 913}
# the stalactite column at the right edge of the terrain block runs past the
# BACKGROUND heading
TERRAIN_COLUMN = (278, 300, 740)
WATERFALLS = [(1338, 1377), (1377, 1420), (1420, 1451), (1451, 1522)], (590, 672), 34
PALETTE_Y = (966, 1004)
PALETTE = [('sky-bg', 846, 904), ('terrain', 916, 985), ('ruins', 996, 1053), ('plants', 1065, 1113),
           ('water', 1124, 1182), ('lights', 1190, 1240), ('accent', 1251, 1312)]
# headings, captions and the title block (x0, y0, x1, y1)
TEXT = [(10, 552, 160, 572), (10, 578, 70, 593), (10, 681, 86, 696), (10, 796, 54, 810), (10, 899, 86, 914),
 (322, 552, 420, 572), (322, 578, 362, 593), (322, 718, 444, 734), (322, 887, 426, 902),
 (580, 552, 704, 572), (580, 578, 670, 593), (580, 717, 627, 732), (580, 810, 664, 826), (580, 893, 698, 909),
 (841, 552, 976, 572), (841, 578, 979, 593), (841, 652, 946, 667), (841, 760, 909, 775), (841, 853, 914, 869),
 (1108, 552, 1260, 572), (1108, 578, 1170, 598), (1108, 677, 1148, 691), (1108, 795, 1212, 810),
 (1336, 552, 1450, 572), (1336, 578, 1406, 593), (1336, 672, 1388, 688), (1445, 672, 1491, 688),
 (1336, 770, 1399, 785), (1336, 836, 1447, 851), (841, 924, 992, 942), (841, 949, 1320, 966), (1336, 915, 1532, 1019)]
BORDERS = [(0, 4, 0, 1024), (310, 317, 0, 1024), (569, 576, 0, 1024), (829, 836, 0, 1024),
           (1096, 1103, 0, 914), (1324, 1331, 0, 1024), (1532, 1536, 0, 1024)]
GLOW = {'fx/lights', 'fx/particles'}          # always soft
GLOW_IF_BRIGHT = {'enemies/flying-ambient', 'props/crates-barrels-lamps'}
NAMES = {
 'tiles/background': ['mountains-small', 'mountains-wide', 'mountains-ridge', 'gothic-window', 'gothic-window-lit', 'carved-pillar', 'pedestal'],
 'tiles/water': ['water-deep-weed', 'water-column', 'water-block', 'water-ledge-mossy', 'water-surface-overhang', 'water-weed', 'water-column-narrow'],
 'structures/ruins': ['carved-pillar', 'column', 'arch-and-rubble', 'rubble-steps', 'broken-column', 'gothic-window-frame', 'rubble-small'],
 'structures/bridges-platforms': ['short-bridge', 'rope-bridge', 'rope-ladder', 'gantry-bridge-mossy', 'hanging-chain', 'ladder-short', 'hook-post', 'rope-ladder-short'],
 'structures/ladders-chains': ['ladder-braced', 'hook-chain', 'rope-chain', 'chain', 'bar-chain-ring', 'chain-loop'],
 'flora/trees-roots': ['twisted-tree'],
 'flora/plants': ['fern-stalk', 'purple-flower', 'pink-flower-bush', 'pink-flower', 'blue-flower', 'vine-stalk', 'blue-flower-large'],
 'flora/hanging-vines': ['vines'] * 5,
 'flora/mushrooms-fungus': ['blue-mushroom', 'blue-mushroom-bent', 'violet-mushroom-small', 'violet-mushroom-large', 'moss-mound-glow',
                            'blue-mushroom-small', 'blue-mushroom-small-2', 'glow-sprout', 'blue-mushroom-pair', 'blue-flower-small', 'grass-tuft', 'blue-flower-tall'],
 'props/crates-barrels-lamps': ['crate-double', 'barrel-large', 'barrel-handle', 'barrel-small', 'wall-hook', 'keg', 'lamp-post', 'candelabra'],
 'props/statues-altars': ['hooded-statue', 'hooded-statue-2', 'altar-shrine', 'statue-and-urn', 'fluted-column'],
 'props/decorative': ['banner-red', 'banners-pair', 'plaque', 'chain-swag', 'skull', 'bones', 'post', 'banner-grey', 'wall-lantern'],
 'props/interactive': ['lever', 'pressure-plate', 'switch-crate', 'valve-wheel', 'ladder-short', 'grate'],
 'enemies/land': ['ghoul', 'sprout-creeper', 'moss-beast'],
 'enemies/water': ['fish-large', 'fish-bony', 'fish-small', 'fish-medium', 'fish-fry', 'jellyfish', 'sea-serpent'],
 'enemies/flying-ambient': ['bat', 'bat-2', 'wisp-violet', 'wisp-small', 'wisp-blue'],
 'fx/waterfalls': ['waterfall-narrow', 'waterfall', 'waterfall-thin', 'waterfall-wide'],
 'fx/lights': ['light-orb', 'ring-dim', 'torch-sconce', 'ring', 'lantern'],
 'fx/particles': ['dust-blue', 'motes-green', 'sparks-gold'],
}
ORDER = [s[0] for _, _, ss in PANELS for s in ss]
ORDER.insert(ORDER.index('fx/bubbles'), 'fx/waterfalls')
ORDER.append('palette')

src = np.asarray(Image.open(ROOT / 'source.jpg').convert('RGB'))
art = src.astype(np.float32)
H, W, _ = art.shape
panel_like = (art.mean(2) < 28).astype(np.float32)
weight = ndi.gaussian_filter(panel_like, 18) + 1e-6
bg = np.stack([ndi.gaussian_filter(art[..., c] * panel_like, 18) / weight for c in range(3)], 2)
dist = np.abs(art - bg).max(2)

fg = dist > THRESHOLD
fg[:548] = False
fg[1019:] = False
for x0, x1, y0, y1 in BORDERS: fg[y0:y1, x0:x1] = False
for x0, y0, x1, y1 in TEXT: fg[y0:y1, x0:x1] = False
lab, _ = ndi.label(fg)
for i, s in enumerate(ndi.find_objects(lab)):
    h, w = s[0].stop - s[0].start, s[1].stop - s[1].start
    if h <= 5 and w > 50: fg[s][lab[s] == i + 1] = False       # panel rules

def fill_small_holes(m, most=10):
    holes = ndi.binary_fill_holes(m) & ~m
    hl, n = ndi.label(holes)
    if n:
        sizes = ndi.sum(holes, hl, range(1, n + 1))
        m = m | np.isin(hl, [i + 1 for i, s in enumerate(sizes) if s <= most])
    return m

def components(mask, grow):
    gl, _ = ndi.label(ndi.binary_dilation(mask, iterations=grow) if grow else mask)
    gl = gl * mask
    out = []
    for i, s in enumerate(ndi.find_objects(gl)):
        if s is None: continue
        m = gl == i + 1
        out.append(dict(m=m, area=int(m.sum()), box=(s[1].start, s[0].start, s[1].stop, s[0].stop)))
    # a fragment mostly inside a part at least four times its size joins it
    out.sort(key=lambda c: -c['area'])
    changed = True
    while changed:
        changed = False
        for i in range(len(out) - 1, -1, -1):
            c = out[i]; x0, y0, x1, y1 = c['box']
            for d in out:
                if d is c or d['area'] < 4 * c['area']: continue
                u0, v0, u1, v1 = d['box']
                inside = max(0, min(x1, u1) - max(x0, u0)) * max(0, min(y1, v1) - max(y0, v0))
                if inside >= 0.75 * (x1 - x0) * (y1 - y0):
                    d['m'] |= c['m']; d['area'] += c['area']
                    d['box'] = (min(x0, u0), min(y0, v0), max(x1, u1), max(y1, v1))
                    out.pop(i); changed = True; break
            if changed: break
    return out

parts = []
def add(group, mask, name=None):
    ys, xs = np.where(mask)
    if not len(ys): return
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    parts.append(dict(group=group, name=name, mask=mask[y0:y1, x0:x1], x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0)))

# Each panel column splits as a whole, so a part that runs past the next
# heading stays in one piece; it belongs to the section its middle is in.
# Sections that group looser parts (grow > 1) are split again on their own.
seen = np.zeros((H, W), bool)
for x0, x1, sections in PANELS:
    tops = [s[1] for s in sections]
    top = tops[0]
    bottom = 770 if sections[0][0] in ('fx/bubbles', 'fx/lights') else PANEL_BOTTOM.get(x0, 1019)
    column = np.zeros((H, W), bool)
    column[top:bottom, x0:x1] = fg[top:bottom, x0:x1] & ~seen[top:bottom, x0:x1]
    seen |= column
    for c in components(column, 1):
        cx0, cy0, cx1, cy1 = c['box']
        k = max([i for i, t in enumerate(tops) if t <= (cy0 + cy1) / 2] or [0])
        group, grow = sections[k][0], sections[k][2]
        if group == 'tiles/background' and TERRAIN_COLUMN[0] <= cx0 and cx1 <= TERRAIN_COLUMN[1] and cy0 < TERRAIN_COLUMN[2]:
            group = 'tiles/terrain'
        if grow == 1 and c['area'] >= (6 if group.startswith('fx/') else 25):
            add(group, fill_small_holes(c['m']))
    for k, (group, y0, grow) in enumerate(sections):
        if grow == 1: continue
        y1 = tops[k + 1] if k + 1 < len(tops) else bottom
        band = np.zeros((H, W), bool)
        band[y0:y1, x0:x1] = column[y0:y1, x0:x1]
        for c in components(band, grow):
            if c['area'] >= (6 if group.startswith('fx/') else 25): add(group, fill_small_holes(c['m']))

# waterfalls share one dark backdrop: a stricter threshold, cut at the gaps
cuts, (wy0, wy1), strict = WATERFALLS
for x0, x1 in cuts:
    m = np.zeros((H, W), bool)
    m[wy0:wy1, x0:x1] = dist[wy0:wy1, x0:x1] > strict
    lab, n = ndi.label(ndi.binary_dilation(m, iterations=1)); lab = lab * m
    sizes = ndi.sum(m, lab, range(1, n + 1))
    add('fx/waterfalls', fill_small_holes(np.isin(lab, [k + 1 for k, s in enumerate(sizes) if s >= 3])))

# palette swatches: solid rectangles, inset past the JPEG edge ring
py0, py1 = PALETTE_Y
rows = np.where(fg[py0:py1, 846:1312].mean(1) > 0.6)[0]
sy0, sy1 = py0 + rows.min(), py0 + rows.max() + 1
for name, xa, xb in PALETTE:
    cols = np.where(fg[sy0:sy1, xa - 4:xb + 4].mean(0) > 0.6)[0]
    sx0, sx1 = xa - 4 + cols.min(), xa - 4 + cols.max() + 1
    m = np.zeros((H, W), bool); m[sy0 + 2:sy1 - 2, sx0 + 2:sx1 - 2] = True
    add('palette', m, name)

def reading_order(ps):
    rows = []
    for p in sorted(ps, key=lambda p: p['y']):
        for r in rows:
            if min(r[1], p['y'] + p['h']) - max(r[0], p['y']) > 0.3 * min(p['h'], r[1] - r[0]):
                r[2].append(p); r[0] = min(r[0], p['y']); r[1] = max(r[1], p['y'] + p['h']); break
        else:
            rows.append([p['y'], p['y'] + p['h'], [p]])
    return [q for r in sorted(rows, key=lambda r: r[0]) for q in sorted(r[2], key=lambda q: q['x'])]

def cut(p, glow):
    if not glow:
        rgba = np.zeros((p['h'], p['w'], 4), np.uint8)
        rgba[..., :3] = np.where(p['mask'][..., None], src[p['y']:p['y'] + p['h'], p['x']:p['x'] + p['w']], 0)
        rgba[..., 3] = p['mask'] * 255
        return rgba
    # soft halo: alpha from the distance to the panel, colour un-premultiplied
    pad = 3
    x0, y0, h, w = p['x'] - pad, p['y'] - pad, p['h'] + 2 * pad, p['w'] + 2 * pad
    m = np.zeros((h, w), bool); m[pad:pad + p['h'], pad:pad + p['w']] = p['mask']
    m = ndi.binary_dilation(m, iterations=2)
    s, b, d = art[y0:y0 + h, x0:x0 + w], bg[y0:y0 + h, x0:x0 + w], dist[y0:y0 + h, x0:x0 + w]
    alpha = np.clip((d - 8) / 52, 0, 1) * m
    alpha[alpha < 0.06] = 0
    colour = np.clip(b + (s - b) / np.maximum(alpha, 1e-3)[..., None], 0, 255)
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = np.where(alpha[..., None] > 0, colour, 0).astype(np.uint8)
    rgba[..., 3] = np.round(alpha * 255).astype(np.uint8)
    ys, xs = np.where(alpha > 0)
    p['x'], p['y'] = int(x0 + xs.min()), int(y0 + ys.min())
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    p['h'], p['w'] = rgba.shape[:2]
    p['mask'] = rgba[..., 3] > 0
    return rgba

def save_part(rgba, file, glow):
    """A binary-alpha part keeps at most PART_COLOURS colours (the sheet's
    JPEG noise gives each part hundreds); a glow part stays lossless RGBA."""
    if glow:
        Image.fromarray(rgba, 'RGBA').save(file, optimize=True)
        return
    solid = rgba[..., 3] > 0
    q = Image.fromarray(rgba[..., :3]).quantize(colors=PART_COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    colours = np.array(q.getpalette()[:3 * PART_COLOURS]).reshape(-1, 3)
    index = np.asarray(q).copy()
    clear = len(colours)
    index[~solid] = clear
    image = Image.fromarray(index.astype(np.uint8), 'P')
    image.putpalette(np.vstack([colours, [[0, 0, 0]]]).astype(np.uint8).flatten().tolist())
    image.save(file, optimize=True, transparency=clear)

PART_COLOURS = 64
out = ROOT / 'parts'
shutil.rmtree(out, ignore_errors=True)
clown = np.zeros((H, W, 3), np.uint8)
clown[MAP[1]:MAP[3], MAP[0]:MAP[2]] = (48, 48, 64)
manifest, k = [], 0
for group in ORDER:
    ps = reading_order([p for p in parts if p['group'] == group])
    names = NAMES.get(group, [])
    for i, p in enumerate(ps):
        label = p['name'] or '%02d' % (i + 1) + ('-' + names[i] if i < len(names) and len(names) == len(ps) else '')
        bright = (src[p['y']:p['y'] + p['h'], p['x']:p['x'] + p['w']].max(2) > 200) & p['mask']
        glow = group in GLOW or (group in GLOW_IF_BRIGHT and bright.sum() >= 20)
        rgba = cut(p, glow)
        file = out / group.replace('/', '__') / (label + '.png')
        file.parent.mkdir(parents=True, exist_ok=True)
        save_part(rgba, file, glow)
        if oxipng: oxipng.optimize(file, level=6)
        hue = (k * 0.61803) % 1; k += 1
        colour = (np.array(colorsys.hsv_to_rgb(hue, 0.85, 1.0)) * 255).astype(np.uint8)
        clown[p['y']:p['y'] + p['h'], p['x']:p['x'] + p['w']][p['mask']] = colour
        manifest.append(dict(group=group, part=label, file=str(file.relative_to(ROOT)), x=p['x'], y=p['y'], w=p['w'], h=p['h'],
                             alpha='soft' if glow else 'binary', clown='#%02x%02x%02x' % tuple(int(v) for v in colour)))
(ROOT / 'parts.json').write_text(json.dumps(dict(source='source.jpg', map=dict(zip('xywh', (MAP[0], MAP[1], MAP[2] - MAP[0], MAP[3] - MAP[1]))),
                                                 parts=manifest), indent=1) + '\n')
# one flat colour per part: a palette image, exact while the sheet has at most 254 parts
Image.fromarray(clown).quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(ROOT / 'clown-mask.png', optimize=True)
if oxipng: oxipng.optimize(ROOT / 'clown-mask.png', level=6)
print(len(manifest), 'parts')
for group in ORDER:
    got = [m for m in manifest if m['group'] == group]
    if group in NAMES and len(NAMES[group]) != len(got): print('  names do not fit', group, len(got), len(NAMES[group]))
