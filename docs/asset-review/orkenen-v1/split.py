"""Split the 03 Ørkenen concept sheet with its clown mask.

    python docs/asset-review/orkenen-v1/split.py      (numpy, pillow, scipy)

Reads source.jpg (the concept) and clown-mask.webp (the same picture painted in
flat colours) and writes:

- parts/<panel>/<panel>-part-NN.png  every loose sprite of the modular sheet
  (right half). The mask says which sprite a pixel belongs to; the source says
  where the sprite really ends, because the sheet background is flat dark grey.
  Panel headings and the footer tagline are text and are left out.
- layers/<panel>/<panel>-layer-NNN.png  the level scene and the five stage
  thumbnails, one layer per mask colour, cropped to its bounds. The layers
  partition the panel, so stacking them rebuilds it exactly.
- manifest.json  positions, sizes and the Figma node each file fills.

Everything stays at source pixels 1:1; this is concept art, not native 1×.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.stats import mode

HERE = Path(__file__).resolve().parent
S = np.array(Image.open(HERE / 'source.jpg').convert('RGB'))
M = np.array(Image.open(HERE / 'clown-mask.webp').convert('RGB')).astype(np.float32)
H, W, _ = M.shape

SHEET = [  # key, title, panel rectangle between the sheet's divider lines
    ('01_terrain_tiles', 'Terrain tiles', (877, 61, 1160, 275)),
    ('02_ruins_architecture', 'Ruins & architecture', (1162, 61, 1529, 275)),
    ('03_structures', 'Structures', (877, 278, 1120, 469)),
    ('04_props', 'Props', (1122, 278, 1307, 469)),
    ('05_plants', 'Plants', (1309, 278, 1529, 469)),
    ('06_underground_tiles', 'Underground tiles', (877, 472, 1083, 638)),
    ('07_underground_props', 'Underground props', (1085, 472, 1301, 638)),
    ('08_water_fx', 'Water & FX', (1302, 472, 1529, 638)),
    ('09_enemies', 'Enemies (examples)', (877, 641, 1248, 787)),
    ('10_npc_interactables', 'NPC / interactables', (1250, 641, 1529, 787)),
    ('11_details_small_fx', 'Details / small FX', (877, 789, 1189, 973)),
    ('12_background_layers', 'Background layers', (1191, 789, 1529, 973)),
    ('13_palette_mark', 'Palette + mark', (877, 976, 1536, 1024)),
]
SCENES = [  # key, title, rectangle, names for mask colours that are unambiguous
    ('scene', '03 Ørkenen — level scene', (4, 3, 870, 846), {
        '#0064FC': 'sky', '#8F1F1D': 'earth mass', '#FC8DD8': 'pink sandstone (far dunes, cave columns)',
        '#681082': 'cave hollow west', '#CE2F1B': 'red rock bands', '#015588': 'deep pools + boss hall',
        '#1BF4DF': 'underground lake', '#FCA533': 'sand rim + top soil', '#7C10A4': 'cave hollow east',
        '#34F869': 'rock spires + statue', '#9DD9FB': 'waterfall + sand fall', '#68F0FB': 'text title',
        '#B5E430': 'cave rims', '#6E0BEE': 'cave passages', '#F23845': 'aqueduct + bridge ruins',
        '#827002': 'root curtain', '#FA38FA': 'text subtitle', '#FDED77': 'sun + relic glow',
        '#FDDF09': 'text line 1', '#69F828': 'text line 2', '#F82F31': 'text START'}),
    ('thumb_1_start', '1. Start — sand og ruinar', (16, 855, 172, 965), {}),
    ('thumb_2_kanjon', '2. Kanjon — gamle bruer', (186, 855, 340, 965), {}),
    ('thumb_3_undergrunn', '3. Undergrunn — gøymde kjelder', (354, 855, 516, 965), {}),
    ('thumb_4_oase', '4. Oase — liv i ørkenen', (529, 855, 689, 965), {}),
    ('thumb_5_boss', '5. Boss — den gløymde maskina', (701, 855, 862, 965), {}),
]
MASK_BG = np.array([13, 25, 34], np.float32)   # the mask's sheet background
INSET = 2        # keep off the divider lines
MERGE = 2        # mask blobs this close are one sprite (per-panel overrides below)
MERGE_BY_PANEL = {'11_details_small_fx': 4, '12_background_layers': 0}
REACH = 5        # how far past the mask outline the drawn sprite may extend
EIGHT = np.ones((3, 3))


def save(path, rgb, alpha):
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba = np.zeros(alpha.shape + (4,), np.uint8)
    rgba[..., :3] = np.where(alpha[..., None], rgb, 0)
    rgba[..., 3] = alpha * 255
    Image.fromarray(rgba, 'RGBA').save(path, optimize=True)


def mask_labels():
    """Quantise the lossy webp mask into its flat colours.

    Flat pixels vote for palette colours; an edge pixel keeps its nearest
    colour only when that colour's flat region is within 4 px, otherwise it
    takes the nearest flat pixel's label, so edge blends never invent a label.
    """
    mean = ndi.uniform_filter(M, size=(5, 5, 1))
    var = (ndi.uniform_filter(M * M, size=(5, 5, 1)) - mean * mean).sum(-1)
    flat = var < 60
    q = (M[flat] / 4).round().astype(np.int32)
    u, c = np.unique(q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2], return_counts=True)
    cols = np.stack([u // 4096, (u // 64) % 64, u % 64], -1).astype(np.float32) * 4
    centers, weights, R = [], [], 22.0
    for i in np.argsort(-c):
        if centers:
            d = np.linalg.norm(np.array(centers) - cols[i], axis=1)
            j = int(d.argmin())
            if d[j] < R:
                centers[j] = (centers[j] * weights[j] + cols[i] * c[i]) / (weights[j] + c[i])
                weights[j] += c[i]
                continue
        centers.append(cols[i].copy()); weights.append(int(c[i]))
    centers = np.array(centers)[np.array(weights) >= 25]

    best = np.full((H, W), np.inf, np.float32); lab0 = np.zeros((H, W), np.int32)
    for k, col in enumerate(centers):
        d = ((M - col) ** 2).sum(-1)
        lab0[d < best] = k; best = np.minimum(best, d)
    seed = flat & (best < R * R * 1.5)
    lab = np.where(seed, lab0, -1)
    idx = ndi.distance_transform_edt(~seed, return_distances=False, return_indices=True)
    present = np.zeros((H, W), bool)
    for k in np.unique(lab0[~seed]):
        if (lab == k).any():
            present |= ~seed & (lab0 == k) & ndi.binary_dilation(lab == k, iterations=4)
    lab = np.where(seed | present, lab0, lab[idx[0], idx[1]])

    pad = np.pad(lab, 1, mode='edge')
    lab = mode(np.stack([pad[dy:dy + H, dx:dx + W] for dy in range(3) for dx in range(3)]),
               axis=0, keepdims=False).mode
    for _ in range(3):  # specks under 12 px join their most common neighbour
        changed = 0
        for k in np.unique(lab):
            cc, n = ndi.label(lab == k, structure=EIGHT)
            sizes = np.bincount(cc.ravel())[1:]
            objs = ndi.find_objects(cc)
            for i in np.nonzero(sizes < 12)[0]:
                sl = tuple(slice(max(s.start - 1, 0), s.stop + 1) for s in objs[i])
                blob = cc[sl] == i + 1
                nb = lab[sl][ndi.binary_dilation(blob) & ~blob]
                nb = nb[nb != k]
                if nb.size:
                    lab[sl][blob] = np.bincount(nb).argmax(); changed += 1
        if not changed:
            break
    hexes = ['#%02X%02X%02X' % tuple(col) for col in centers.round().astype(int)]
    return lab, hexes


def reading_order(items):
    rows = []
    for it in sorted(items, key=lambda it: it['cy']):
        if rows and it['cy'] - rows[-1][0]['cy'] < 28:
            rows[-1].append(it)
        else:
            rows.append([it])
    return [it for r in rows for it in sorted(r, key=lambda it: it['cx'])]


def heading(sl, blob):
    h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
    return sl[0].start < 30 and h <= 26 and w >= 2.5 * h and blob.sum() > 0.75 * h * w


def sheet_parts():
    out = []
    for key, title, (x0, y0, x1, y1) in SHEET:
        x0, y0, x1, y1 = x0 + INSET, y0 + INSET, x1 - INSET, y1 - INSET
        m = M[y0:y1, x0:x1]; s = S[y0:y1, x0:x1].astype(np.float32)
        fg = np.linalg.norm(m - MASK_BG, axis=-1) > 40
        fg = ndi.binary_opening(fg) | (fg & ndi.binary_erosion(fg))
        fg = ndi.binary_closing(fg, structure=EIGHT)
        grow = MERGE_BY_PANEL.get(key, MERGE) // 2
        grp, _ = ndi.label(ndi.binary_dilation(fg, iterations=grow) if grow else fg, structure=EIGHT)
        blobs = grp * fg
        keep = []
        for i, sl in enumerate(ndi.find_objects(blobs)):
            if sl is None:
                continue
            blob = blobs[sl] == i + 1
            if blob.sum() < 20 or heading(sl, blob):
                continue
            if key == '13_palette_mark' and x0 + sl[1].start >= 1400:
                continue                                   # footer tagline (text)
            keep.append(i + 1)
        lab = np.where(np.isin(blobs, keep), blobs, 0)
        dist, idx = ndi.distance_transform_edt(lab == 0, return_indices=True)
        owner = lab[idx[0], idx[1]] * (dist <= REACH)      # nearest sprite owns the gap
        bgpx = ~ndi.binary_dilation(fg, iterations=6)
        d = np.linalg.norm(s - np.median(s[bgpx], axis=0), axis=-1)
        items = []
        for k in keep:
            own, core = owner == k, lab == k
            cc, _ = ndi.label(own & (d > 14), structure=EIGHT)   # hysteresis 14 / 34
            a = np.isin(cc, np.unique(cc[own & (d > 34)])[1:])
            a |= ndi.binary_erosion(core, iterations=2) & (d > 7)  # dark pixels inside
            hc, hn = ndi.label(ndi.binary_fill_holes(a) & ~a)
            inside = ndi.binary_dilation(core)
            for j, n in enumerate(np.bincount(hc.ravel())[1:], 1):
                if n <= 30 and inside[hc == j].all():
                    a |= hc == j
            for _ in range(2):  # peel the JPEG ringing fringe
                a &= ~(a & ~ndi.binary_erosion(a) & (d < 22))
            cc, _ = ndi.label(a, structure=EIGHT)
            cs = np.bincount(cc.ravel()); cs[0] = 0
            a &= np.isin(cc, np.nonzero(cs >= 6)[0])
            if a.sum() < 20:
                continue
            ys, xs = np.nonzero(a)
            b = (ys.min(), ys.max() + 1, xs.min(), xs.max() + 1)
            items.append(dict(b=b, a=a, cx=(b[2] + b[3]) / 2, cy=(b[0] + b[1]) / 2))
        parts = []
        for n, it in enumerate(reading_order(items), 1):
            by0, by1, bx0, bx1 = it['b']
            file = f'parts/{key}/{key}-part-{n:02d}.png'
            save(HERE / file, S[y0 + by0:y0 + by1, x0 + bx0:x0 + bx1], it['a'][by0:by1, bx0:bx1])
            parts.append(dict(name=f'part={n:02d}', file=file, x=int(x0 + bx0), y=int(y0 + by0),
                              w=int(bx1 - bx0), h=int(by1 - by0)))
        out.append(dict(key=key, title=title, panel=[x0 - INSET, y0 - INSET, x1 + INSET, y1 + INSET], parts=parts))
    return out


def scene_layers(lab, hexes):
    out = []
    for key, title, (x0, y0, x1, y1), names in SCENES:
        L = lab[y0:y1, x0:x1]; s = S[y0:y1, x0:x1]
        u, c = np.unique(L, return_counts=True)
        layers = []
        for n, i in enumerate(np.argsort(-c), 1):
            m = L == u[i]
            ys, xs = np.nonzero(m)
            by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            file = f'layers/{key}/{key}-layer-{n:03d}.png'
            save(HERE / file, s[by0:by1, bx0:bx1], m[by0:by1, bx0:bx1])
            hexc = hexes[u[i]]
            layers.append(dict(name=f'{n:03d} · {names.get(hexc, "mask")} · {hexc}', file=file,
                               x=int(bx0), y=int(by0), w=int(bx1 - bx0), h=int(by1 - by0)))
        out.append(dict(key=key, title=title, rect=[x0, y0, x1, y1], layers=layers))
    return out


if __name__ == '__main__':
    for old in list(HERE.glob('parts/*/*.png')) + list(HERE.glob('layers/*/*.png')):
        old.unlink()
    lab, hexes = mask_labels()
    manifest = dict(source='source.jpg', mask='clown-mask.webp', sheet=sheet_parts(), scenes=scene_layers(lab, hexes))
    figma = HERE / 'figma-nodes.json'
    if figma.exists():  # attach the Figma node each file fills
        nodes = json.loads(figma.read_text())
        for group in manifest['sheet'] + manifest['scenes']:
            ids = nodes.get(group['key'], [])
            for item, node in zip(group.get('parts', group.get('layers')), ids):
                item['figma'] = node
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    print(sum(len(g['parts']) for g in manifest['sheet']), 'parts,',
          sum(len(g['layers']) for g in manifest['scenes']), 'layers')
