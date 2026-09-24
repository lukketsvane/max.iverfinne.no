"""Build Max Sligo Neverdahl, the easter-egg player skin, from the owner's sheet.

The owner's sheet (docs/asset-review/sligo-v1/source.png, 1254x1254) is an
8x8 grid of a pink, one-eyed, tardigrade-like creature whose rows follow Max's
main sheet: idle, walk, run, look, jump, land, a spare row of crawling poses
and stretch. It came out of an image generator with its background removed, so
a red and yellow halo and speckle fill the transparent pixels round every frame.

- Frames: the 64 creatures are found by their opaque cores (alpha at least
  half). The grid pitch is 156.75 px, so each core goes to the cell its centre
  is in; there must be exactly one per cell.
- Cleaning: a creature is its core plus the pixels of at least 1/8 alpha joined
  to it, less halo colours (bright red or yellow with almost no blue), with
  enclosed holes filled from the nearest body colour. The halo and the speckle
  lie below 1/8 alpha or apart from the body, so none of it is kept.
- Scale: one for the whole sheet, SCALE source pixels to a game pixel, so the
  standing creature is 24 px tall like the other skins (tide stands 25). Each
  frame is a premultiplied box filter with hard alpha at half. The drawing's
  features keep their pixels at that size: a game pixel on the silhouette takes
  the colour of the source's outline band, one at least 30% crease the creases'
  colour, one at least half eye the eye's own dark, and the eye's highlight
  becomes the one pixel it covers most.
- Palette: one for both sheets, 16 colours: median cut (no dither) to 14 over
  the distinct body colours, plus the eye's dark and the highlight.
- Registration, as the other skins: centred on x=16, the lowest row on the
  original Max frame's body bottom (source/original-poses.json), so feet stand
  on the soil and jump frames keep their lift. Where that bottom is the cell's
  last row (walk, stretch, two run frames) the frame stands one pixel higher,
  so no cell is touched at its edge. A frame that would overflow its cell
  stops the build: choose a smaller SCALE for every frame, never crop.
- Sheets: main.png is the owner's sheet row for row (MIRROR turns three
  profiles to face the player's way). interaction.png is built from the same
  poses, as the sheet has none of Max's interaction poses (INTERACTION).
  atlas.json has the other skins' schema and the original clips and markers.

    python3 scripts/build-sligo.py [--export DIR]
      -> assets/max-skins-v1/sligo/{main.png, interaction.png, atlas.json}
         docs/asset-review/sligo-v1/{contact-1x.png, contact-4x.png,
                                     animations-4x.gif, registration.json}
    --export DIR also writes copies for the owner: both sheets at 1x and padded
    to 36x36 cells (feet at 18,33, two clear pixels round every cell).
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
REVIEW = ROOT / 'docs/asset-review/sligo-v1'
SKINS = ROOT / 'assets/max-skins-v1'
OUT = SKINS / 'sligo'
SCALE = 8.0                  # source pixels per game pixel: Sligo stands half as tall as Max (the owner asked)
CELL = 32
LOWEST = CELL - 2            # the lowest row a frame may use; row 31 stays clear
CANVAS = 48                  # working canvas, larger than a cell
RIM = 2.5                    # the source outline: body pixels this close to the edge
CREASE_DEPTH = 12            # a crease pixel is this much darker (luma) than the body round it
CREASE_SHARE = .3            # a game pixel this much crease draws as crease
EIGHT = np.ones((3, 3), bool)
CROSS = ndimage.generate_binary_structure(2, 1)
NEAREST = Image.Resampling.NEAREST

# Left-facing profiles in the loops that play while the player stands or walks
# (idle 5 and 7, walk 7): mirrored, so Sligo faces the way the player faces.
# The fidgets keep the owner's turns (look ends facing left, stretch turns
# about) and so do the back views (idle 6, walk 6), as drawn.
MIRROR = {(0, 5), (0, 7), (1, 7)}

# interaction.png, cell for cell: the main-sheet pose (row, col) each cell
# shows, or (row, col, 'm') for its mirror image. See the README.
STAND, CROUCH, CURL = (0, 0), (5, 0), (4, 6)
INTERACTION = [
    # crouch 0-3 (stand plays it back): the landing row run backwards;
    # squat 4-7 stays low and alert
    [STAND, (5, 4), (5, 2), (5, 1), (5, 1), (6, 0), (6, 1), (6, 0)],
    # dig: lean in, nose to the soil on the hit (3), again, back to a crouch
    [STAND, (5, 4), (5, 2), (5, 3), (6, 3), (5, 3), (5, 1), CROUCH],
    # sow: lean, reach (toss throws on 2), bend low, sow on 6, crouch
    [STAND, (5, 4), (4, 3), (5, 2), (5, 3), (6, 4), (5, 3), CROUCH],
    # water: lean over the plant; 2-5 pour and loop while held
    [STAND, (5, 4), (5, 5), (2, 6), (5, 5), (2, 6), (5, 4), STAND],
    # pick: bend, reach down, pick on 3, come up
    [(5, 4), (5, 2), (5, 3), (6, 4), (5, 3), (5, 1), (5, 4), STAND],
    # not used by any clip (Max carries a crate here): the walk, as on main
    [(1, c, 'm') if (1, c) in MIRROR else (1, c) for c in range(8)],
    # lampUp 0-3 turns to face out, lampHold 4-7 looks out (the lantern's glow
    # sits on its face), lampDn plays 0-3 back
    [STAND, (3, 2), (3, 3), (3, 4), (3, 4), (7, 7), (7, 7), (3, 4)],
    # sit 0-5 curls up (a tardigrade rests as a tun), rest 6-7 breathes,
    # unsit plays it back; the curl leaves the lantern's place beside it clear
    [STAND, (5, 4), (5, 1), (6, 0), CURL, CROUCH, CROUCH, CURL],
]


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=1) + '\n')


def creatures(alpha):
    """Label every opaque core and give each cell its one creature."""
    core = alpha >= 128
    labels, count = ndimage.label(core, EIGHT)
    boxes = ndimage.find_objects(labels)
    area = ndimage.sum(core, labels, range(1, count + 1))
    pitch_y, pitch_x = alpha.shape[0] / 8, alpha.shape[1] / 8
    found = {}
    for ident, (box, size) in enumerate(zip(boxes, area), 1):
        if size < 400:
            continue
        cy, cx = (box[0].start + box[0].stop) / 2, (box[1].start + box[1].stop) / 2
        key = (int(cy // pitch_y), int(cx // pitch_x))
        assert key not in found, f'two creatures in cell {key}'
        found[key] = (ident, box)
    assert sorted(found) == [(r, c) for r in range(8) for c in range(8)], 'expected one creature per cell'
    return labels, found


def clean(rgba, labels, ident, box, margin=12):
    """The creature alone: its core, the soft edge joined to it, holes filled."""
    y0, x0 = max(0, box[0].start - margin), max(0, box[1].start - margin)
    y1, x1 = box[0].stop + margin, box[1].stop + margin
    rgb = rgba[y0:y1, x0:x1, :3].copy()
    alpha = rgba[y0:y1, x0:x1, 3]
    own = labels[y0:y1, x0:x1]
    core = own == ident
    others = (own != 0) & ~core
    red, blue = rgb[..., 0], rgb[..., 2]
    halo = (red > 150) & (blue < 0.22 * red) & ~core
    soft = (alpha >= 32) & ~halo & ~others
    parts, _ = ndimage.label(soft | core, EIGHT)
    body = np.isin(parts, np.unique(parts[core]))
    solid = ndimage.binary_fill_holes(body)
    holes = solid & ~body
    weight = np.where(body, alpha / 255.0, 0.0)
    if holes.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~body, return_indices=True)
        rgb[holes] = rgb[iy[holes], ix[holes]]
        weight[holes] = 1.0
    ys, xs = np.nonzero(core)
    eye = solid & (rgb.max(-1) < 90)
    glint = solid & (rgb.min(-1) > 185) & ndimage.binary_dilation(eye, iterations=3)
    inside = weight >= .5
    depth = ndimage.distance_transform_edt(inside)
    rim = inside & (depth <= RIM) & ~eye
    # creases: body pixels darker than the body round them
    luma = rgb @ np.array([.299, .587, .114])
    inner = inside & (depth > RIM + .5) & ~ndimage.binary_dilation(eye, iterations=2)
    local = ndimage.gaussian_filter(luma * inner, 3) / np.maximum(ndimage.gaussian_filter(inner * 1.0, 3), 1e-6)
    crease = inner & (luma < local - CREASE_DEPTH)
    stats = {'halo': int((halo & (alpha >= 32)).sum()), 'loose': int((soft & ~body).sum()),
             'holes': int(holes.sum())}
    return {'rgb': rgb, 'weight': weight, 'glint': glint.astype(float), 'eye': eye.astype(float),
            'rim': rim.astype(float), 'crease': crease.astype(float),
            'box': [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
            'origin': [x0, y0], 'stats': stats}


def weights(origin, count, size):
    """Area of each source pixel inside each game pixel (a box filter)."""
    edges = origin + SCALE * np.arange(count + 1)
    pixels = np.arange(size)
    low = np.clip(edges[:-1, None], pixels, pixels + 1)
    high = np.clip(edges[1:, None], pixels, pixels + 1)
    return high - low


def native(creature, mirror, eye_colour, glint_colour):
    """One creature at game scale on a working canvas, feet near its foot."""
    layers = {k: creature[k] for k in ['rgb', 'weight', 'glint', 'eye', 'rim', 'crease']}
    box = list(creature['box'])
    if mirror:
        layers = {k: v[:, ::-1] for k, v in layers.items()}
        width = layers['weight'].shape[1]
        box[0], box[2] = width - box[2], width - box[0]
    rgb, weight = layers['rgb'], layers['weight']
    centre = (box[0] + box[2]) / 2
    wx = weights(centre - (CANVAS // 2 + .5) * SCALE, CANVAS, weight.shape[1])
    wy = weights(box[3] - (CANVAS - 8) * SCALE, CANVAS, weight.shape[0])
    area = SCALE * SCALE

    def mean(mask):
        """Premultiplied box filter over the masked pixels: colour and coverage."""
        w = weight * mask
        cover = wy @ w @ wx.T
        paint = np.stack([wy @ (rgb[..., k] * w) @ wx.T for k in range(3)], -1)
        return np.where(cover[..., None] > 0, paint / np.maximum(cover[..., None], 1e-9), 0), cover / area

    colour, cover = mean(1.0)
    opaque = cover >= .5
    assert not (opaque[0].any() or opaque[:, 0].any() or opaque[:, -1].any()), 'creature larger than the working canvas'
    parts, count = ndimage.label(opaque, EIGHT)
    specks = 0
    if count > 1:
        sizes = ndimage.sum(opaque, parts, range(1, count + 1))
        keep = 1 + int(np.argmax(sizes))
        specks = int(opaque.sum() - sizes[keep - 1])
        opaque = parts == keep
    opaque = ndimage.binary_fill_holes(opaque)
    edge = opaque & ~ndimage.binary_erosion(opaque, CROSS, border_value=0)
    # The creases: a game pixel whose body is at least CREASE_SHARE crease
    # takes the creases' colour, so the segments still read.
    crease_colour, crease_cover = mean(layers['crease'])
    lines = opaque & ~edge & (crease_cover >= CREASE_SHARE * cover)
    colour[lines] = crease_colour[lines]
    # The outline: a game pixel on the silhouette takes the colour of the
    # outline band inside it, not its mix with the body behind.
    rim_colour, rim_cover = mean(layers['rim'])
    outline = edge & (rim_cover > 0)
    colour[outline] = rim_colour[outline]
    # The eye: a game pixel at least half eye is the eye's own dark, and the
    # highlight is the one pixel it covers most.
    _, eye_cover = mean(layers['eye'])
    colour[opaque & (eye_cover >= .5 * cover)] = eye_colour
    shine = wy @ layers['glint'] @ wx.T / area
    spot = None
    if shine.max() > .08:
        index = int(np.argmax(np.where(opaque, shine, -1)))
        spot = divmod(index, CANVAS)
        colour[spot] = glint_colour
    return {'rgb': colour, 'opaque': opaque, 'glint': spot, 'specks': specks}


def place(frame, bottom):
    """Centre on x=16 and stand the lowest row on `bottom` (lifted off row 31)."""
    ys, xs = np.nonzero(frame['opaque'])
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    target = min(bottom, LOWEST)
    dx = 16 - (x0 + x1 - 1) // 2
    dy = target - int(ys.max())
    rgb = np.zeros((CELL, CELL, 3))
    opaque = np.zeros((CELL, CELL), bool)
    gy, gx = ys + dy, xs + dx
    if gx.min() < 1 or gx.max() > CELL - 2 or gy.min() < 1:
        raise SystemExit(f'frame overflows its cell at SCALE {SCALE}: x {gx.min()}..{gx.max()}, top {gy.min()}; '
                         'choose a smaller scale for every frame')
    rgb[gy, gx] = frame['rgb'][ys, xs]
    opaque[gy, gx] = True
    glint = None if frame['glint'] is None else (frame['glint'][0] + dy, frame['glint'][1] + dx)
    return {'rgb': rgb, 'opaque': opaque, 'glint': glint,
            'shift': [dx, dy], 'lift': bottom - target, 'size': [x1 - x0, int(ys.max() - ys.min()) + 1]}


def is_any(rgb, colours):
    return np.any([np.all(np.abs(rgb - c) <= .5, axis=-1) for c in colours], axis=0)


def palette_for(cells, fixed):
    """Median cut over the distinct body colours of both sheets, plus `fixed`.

    Cutting the distinct colours rather than every pixel keeps the outline and
    the shading: by pixel count the pink body would take them all. The eye's
    dark and the glint are flat colours of their own and keep their entries.
    """
    pixels = np.concatenate([cell['rgb'][cell['opaque']] for cell in cells])
    pixels = pixels[~is_any(pixels, fixed)]
    distinct = np.unique(np.clip(np.round(pixels), 0, 255).astype(np.uint8), axis=0)
    strip = Image.fromarray(distinct.reshape(-1, 1, 3), 'RGB')
    quantised = strip.quantize(16 - len(fixed), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    used = sorted(set(np.array(quantised).ravel().tolist()))
    flat = quantised.getpalette()
    colours = [tuple(flat[3 * i:3 * i + 3]) for i in used] + [tuple(int(v) for v in c) for c in fixed]
    colours = sorted(set(colours), key=lambda c: (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], c))
    assert len(colours) <= 16
    return np.array(colours, float)


def paint(cell, palette, fixed):
    """Every opaque pixel on its nearest body colour; the eye and glint exactly."""
    out = np.zeros((CELL, CELL, 4), np.uint8)
    ys, xs = np.nonzero(cell['opaque'])
    rgb = cell['rgb'][ys, xs]
    body = palette[~is_any(palette, fixed)]
    nearest = body[((rgb[:, None, :] - body[None, :, :]) ** 2).sum(-1).argmin(1)]
    keep = is_any(rgb, fixed)
    nearest[keep] = np.round(rgb[keep])
    out[ys, xs, :3] = nearest
    out[ys, xs, 3] = 255
    return out


def sheet(cells, palette, fixed):
    image = np.zeros((CELL * 8, CELL * 8, 4), np.uint8)
    for index, cell in enumerate(cells):
        r, c = divmod(index, 8)
        image[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = paint(cell, palette, fixed)
    return Image.fromarray(image, 'RGBA')


def atlas(palette):
    original = json.loads((SKINS / 'source/animations.json').read_text())
    frames = []
    for name in ['main', 'interaction']:
        image = Image.open(OUT / f'{name}.png')
        for index in range(64):
            r, c = divmod(index, 8)
            tile = image.crop((c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL))
            box = tile.getbbox()
            frames.append({'sheet': name, 'rect': [c * CELL, r * CELL, CELL, CELL], 'anchor': [16, 31],
                           'opaqueBounds': list(box) if box else None})
    clips = {}
    for name, clip in original.items():
        offset = 0 if clip['sheet'] == 'main' else 64
        clips[name] = {'frames': [offset + clip['row'] * 8 + f for f in clip['f']], 'fps': clip['fps'], 'loop': clip['loop']}
        for key in ['hit', 'pour']:
            if key in clip:
                clips[name][key] = clip[key]
    return {'schema': 'max-native-atlas/v1', 'id': 'sligo', 'kind': 'player-skin', 'cell': [CELL, CELL],
            'anchor': [16, 31], 'cosmeticOnly': True, 'facing': 'right',
            'palette': ['#%02x%02x%02x' % tuple(int(v) for v in colour) for colour in palette],
            'sheets': {'main': {'image': 'main.png', 'size': [256, 256]},
                       'interaction': {'image': 'interaction.png', 'size': [256, 256]}},
            'frames': frames, 'animations': clips}


def text(draw, xy, words, fill='#bccbc1'):
    draw.text(xy, words, fill=fill, font=ImageFont.load_default(size=9))


def tile(images, manifest, index):
    f = manifest['frames'][index]
    x, y, w, h = f['rect']
    return images[f['sheet']].crop((x, y, x + w, y + h))


def previews(manifest, images):
    """Contact sheets at 1x and exactly 4x, and every clip playing at 4x."""
    tide = json.loads((SKINS / 'tide/atlas.json').read_text())
    tide_images = {k: Image.open(SKINS / 'tide' / v['image']).convert('RGBA') for k, v in tide['sheets'].items()}
    # Top: the tide skin and Sligo in the same clips (frame 3 of each), on
    # one soil line. Below: both sheets cell by cell, each cell's row 31 marked.
    columns = ['idle', 'walk', 'run', 'rise', 'fall', 'land', 'crouch', 'dig', 'sow', 'water', 'pick', 'lampHold', 'rest']
    slot, pitch, margin = 40, CELL + 2, 52
    sheet_w = 8 * pitch
    width = max(margin + len(columns) * slot, 2 * (margin + sheet_w) + 8)
    height = 20 + 2 * 44 + 18 + 8 * pitch + 4
    contact = Image.new('RGBA', (width, height), '#1c242b')
    draw = ImageDraw.Draw(contact)
    for i, name in enumerate(columns):
        text(draw, (margin + i * slot, 6), name.replace('Hold', ''))
    for row, (label, data, pics) in enumerate([('tide', tide, tide_images), ('sligo', manifest, images)]):
        top = 20 + row * 44
        text(draw, (4, top + 16), label)
        for i, name in enumerate(columns):
            frames = data['animations'][name]['frames']
            draw.line([(margin + i * slot, top + 32), (margin + i * slot + 31, top + 32)], fill='#35432f')
            contact.alpha_composite(tile(pics, data, frames[min(3, len(frames) - 1)]), (margin + i * slot, top + 1))
    top = 20 + 2 * 44 + 4
    rows = {'main': ['idle', 'walk', 'run', 'look', 'jump', 'land', 'crawl', 'stretch'],
            'interaction': ['crouch', 'dig', 'sow', 'water', 'pick', 'unused', 'lamp', 'sit']}
    for s, name in enumerate(['main', 'interaction']):
        left = margin + s * (margin + sheet_w + 8)
        text(draw, (left, top), name + '.png')
        for r in range(8):
            text(draw, (left - margin + 4, top + 24 + r * pitch), rows[name][r])
        for index in range(64):
            r, c = divmod(index, 8)
            x, y = left + c * pitch, top + 14 + r * pitch
            draw.rectangle([x, y, x + CELL - 1, y + CELL - 1], fill='#232d35')
            draw.line([(x, y + 31), (x + CELL - 1, y + 31)], fill='#35432f')
            contact.alpha_composite(tile(images, manifest, s * 64 + index), (x, y))
    contact = contact.convert('RGB')
    contact.save(REVIEW / 'contact-1x.png')
    contact.resize((contact.width * 4, contact.height * 4), NEAREST).save(REVIEW / 'contact-4x.png')

    names = list(manifest['animations']) + ['tide idle', 'tide walk']
    across, box_w, box_h = 7, 52, 50
    frames = []
    for tick in range(40):
        seconds = tick / 10
        frame = Image.new('RGBA', (across * box_w, -(-len(names) // across) * box_h), '#1c242b')
        draw = ImageDraw.Draw(frame)
        for i, name in enumerate(names):
            data, pics, clip_name = (tide, tide_images, name[5:]) if name.startswith('tide ') else (manifest, images, name)
            clip = data['animations'][clip_name]
            step = int(seconds * clip['fps'])
            step = step % len(clip['frames']) if clip['loop'] else min(step, len(clip['frames']) - 1)
            x, y = (i % across) * box_w, (i // across) * box_h
            draw.line([(x + 10, y + 34), (x + 41, y + 34)], fill='#35432f')
            frame.alpha_composite(tile(pics, data, clip['frames'][step]), (x + 10, y + 3))
            text(draw, (x + 3, y + 37), name)
        frames.append(frame.convert('RGB'))
    # One palette for every frame (the art, the ground line and the labels
    # have few colours); each frame after the first keeps only the pixels that
    # changed (index 255 is transparent), then 4x: small and exact.
    strip = Image.new('RGB', (frames[0].width, frames[0].height * len(frames)))
    for i, frame in enumerate(frames):
        strip.paste(frame, (0, i * frame.height))
    shared = strip.quantize(255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    colours = shared.getpalette()[:3 * 255]
    colours += [0] * (3 * 256 - len(colours))
    indexed = [np.array(f.quantize(palette=shared, dither=Image.Dither.NONE)) for f in frames]
    out = []
    for i, now in enumerate(indexed):
        delta = now.copy()
        if i:
            delta[now == indexed[i - 1]] = 255
        image = Image.fromarray(delta, 'P')
        image.putpalette(colours)
        out.append(image.resize((image.width * 4, image.height * 4), NEAREST))
    out[0].save(REVIEW / 'animations-4x.gif', save_all=True, append_images=out[1:], duration=100, loop=0,
                disposal=1, transparency=255, optimize=False)


def export(folder, images):
    folder.mkdir(parents=True, exist_ok=True)
    for name, image in images.items():
        image.save(folder / f'sligo-{name}-8x8.png')
        padded = Image.new('RGBA', (36 * 8, 36 * 8))
        for index in range(64):
            r, c = divmod(index, 8)
            padded.paste(image.crop((c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL)), (c * 36 + 2, r * 36 + 2))
        padded.save(folder / f'sligo-{name}-8x8-36px.png')
    (folder / 'contact-4x.png').write_bytes((REVIEW / 'contact-4x.png').read_bytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--export', type=Path, help='also write copies for the owner into this folder')
    args = parser.parse_args()

    source_bytes = (REVIEW / 'source.png').read_bytes()
    rgba = np.array(Image.open(REVIEW / 'source.png').convert('RGBA')).astype(float)
    labels, found = creatures(rgba[..., 3])
    cleaned = {key: clean(rgba, labels, ident, box) for key, (ident, box) in found.items()}
    glints = np.concatenate([c['rgb'][c['glint'] > 0] for c in cleaned.values()])
    glint_colour = np.round(glints.mean(0))
    eyes = np.concatenate([c['rgb'][c['eye'] > 0] for c in cleaned.values()])
    eye_colour = np.round(eyes.mean(0))
    poses = {}

    def pose(key, mirror):
        if (key, mirror) not in poses:
            poses[key, mirror] = native(cleaned[key], mirror, eye_colour, glint_colour)
        return poses[key, mirror]

    reference = json.loads((SKINS / 'source/original-poses.json').read_text())
    cells, record = [], {'main': [], 'interaction': []}
    for name in ['main', 'interaction']:
        for index in range(64):
            r, c = divmod(index, 8)
            if name == 'main':
                key, mirror = (r, c), (r, c) in MIRROR
            else:
                entry = INTERACTION[r][c]
                key, mirror = (entry[0], entry[1]), len(entry) > 2
            bottom = reference[name][index]['bodyBounds'][3] - 1
            placed = place(pose(key, mirror), bottom)
            cells.append(placed)
            record[name].append({'cell': [r, c], 'pose': list(key), 'mirror': mirror, 'bottom': bottom,
                                 'lift': placed['lift'], 'size': placed['size'], 'glint': placed['glint'] is not None,
                                 'specks': pose(key, mirror)['specks']})

    fixed = [eye_colour, glint_colour]
    palette = palette_for(cells, fixed)
    OUT.mkdir(parents=True, exist_ok=True)
    images = {'main': sheet(cells[:64], palette, fixed), 'interaction': sheet(cells[64:], palette, fixed)}
    for name, image in images.items():
        image.save(OUT / f'{name}.png')
    manifest = atlas(palette)
    save_json(OUT / 'atlas.json', manifest)
    hexed = lambda colour: '#%02x%02x%02x' % tuple(int(v) for v in colour)
    save_json(REVIEW / 'registration.json', {
        'source': {'file': 'source.png', 'sha1': hashlib.sha1(source_bytes).hexdigest(), 'size': list(rgba.shape[1::-1])},
        'scale': SCALE, 'anchor': [16, 31], 'lowestRow': LOWEST, 'palette': manifest['palette'],
        'eye': hexed(eye_colour), 'glint': hexed(glint_colour),
        'poses': {f'{r},{c}': {'box': [v['box'][0] + v['origin'][0], v['box'][1] + v['origin'][1],
                                       v['box'][2] + v['origin'][0], v['box'][3] + v['origin'][1]], **v['stats']}
                  for (r, c), v in sorted(cleaned.items())},
        'cells': record})
    images = {k: v.convert('RGBA') for k, v in images.items()}
    previews(manifest, images)
    if args.export:
        export(args.export, images)
    idle = [record['main'][i]['size'][1] for i in range(8)]
    print(f'Built Sligo at 1/{SCALE:g}: {len(manifest["palette"])} colours, standing idle {min(idle)}-{max(idle)} px tall, '
          f'{sum(1 for m in record["main"] + record["interaction"] if m["lift"])} cells lifted off the edge row.')


if __name__ == '__main__':
    main()
