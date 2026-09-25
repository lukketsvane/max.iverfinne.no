"""Deterministic native conversion of the owner's 56 mannequin poses.

One uniform 0.72 reduction, nearest-neighbour, alpha threshold 128, shared
16-colour median-cut palette, original animation foot anchors and markers.
No per-frame fitting, runtime rotation, antialiasing, or generated poses.
"""
import copy
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REVIEW = ROOT / 'docs/asset-review/polge-v1'
OUT = ROOT / 'assets/max-skins-v1/polge'
SCALE = .72
MAIN = [list(range(8)), list(range(8,16)), list(range(16,24)),
        list(range(48,56)), [24,25,26,27,28,29,30,31],
        [40,41,42,43,44,45,46,47], list(range(8,16)), list(range(48,56))]
INTERACTION = [[0,40,41,42,43,44,43,44], [40,41,42,44,45,44,43,42],
               [0,40,41,42,43,44,45,42], [40,41,43,44,43,44,41,40],
               [40,41,43,45,44,43,41,0], list(range(8,16)),
               [48,49,50,51,52,53,54,55], [24,28,31,32,33,34,38,39]]

def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=1) + '\n')

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted((REVIEW / 'source').glob('*.png'))
    assert len(files) == 56
    poses = []
    pixels = []
    for file in files:
        im = Image.open(file).convert('RGBA')
        im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
        im = im.crop(im.getbbox())
        im = im.resize(tuple(round(n*SCALE) for n in im.size), Image.Resampling.NEAREST)
        poses.append(im)
        pixels.extend(p[:3] for p in im.getdata() if p[3])
    strip = Image.new('RGB', (len(pixels), 1)); strip.putdata(pixels)
    palette = strip.quantize(colors=16, method=Image.Quantize.MEDIANCUT)
    for i, im in enumerate(poses):
        rgb = im.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
        rgb.putalpha(im.getchannel('A'))
        rgb.putdata([p if p[3] else (0,0,0,0) for p in rgb.getdata()])
        poses[i] = rgb
    atlas = json.loads((ROOT / 'assets/max-skins-v1/tide/atlas.json').read_text())
    original = json.loads((ROOT / 'assets/max-skins-v1/source/original-poses.json').read_text())
    atlas['id'] = 'polge'; atlas['frames'] = []; colours = set(); sheets = []
    for name, rows in [('main', MAIN), ('interaction', INTERACTION)]:
        sheet = Image.new('RGBA', (256,256))
        for i, source in enumerate(sum(rows, [])):
            pose = poses[source]
            bottom = min(30, original[name][i]['bodyBounds'][3]-1)
            x = 16-pose.width//2; y = bottom-pose.height+1
            assert x > 0 and y > 0 and x+pose.width <= 31, (name, i, pose.size, y)
            cell = Image.new('RGBA',(32,32)); cell.paste(pose,(x,y))
            sheet.paste(cell,(i%8*32,i//8*32))
            frame = copy.deepcopy(json.loads((ROOT / 'assets/max-skins-v1/tide/atlas.json').read_text())['frames'][len(atlas['frames'])])
            frame['opaqueBounds'] = list(cell.getbbox()); atlas['frames'].append(frame)
        colours.update('#%02x%02x%02x' % p[:3] for p in sheet.getdata() if p[3])
        sheet.save(OUT / (name+'.png')); sheets.append(sheet)
    atlas['palette'] = sorted(colours)
    write_json(OUT / 'atlas.json', atlas)
    contact = Image.new('RGBA', (512,256)); contact.paste(sheets[0]); contact.paste(sheets[1],(256,0))
    contact.save(REVIEW / 'contact-1x.png')
    contact.resize((2048,1024), Image.Resampling.NEAREST).save(REVIEW / 'contact-4x.png')
    pending_path = ROOT / 'assets/figma-pending.json'
    pending = json.loads(pending_path.read_text())
    pending['files'] = [f for f in pending['files'] if '/polge/' not in f['path']]
    for name in ('main', 'interaction'):
        file = OUT / (name+'.png')
        pending['files'].append(dict(path=str(file.relative_to(ROOT)), sha1=hashlib.sha1(file.read_bytes()).hexdigest(), width=256, height=256, note='Owner mannequin poses; scripts/build-polge.py. Figma desktop unavailable.'))
    # Native UI glyph masters: a varnish tin, flying splinters, and a raincoat.
    symbols = {
        'varnish': ['.........','..#####..','..#...#..','...###...','..#####..','..#.#.#..','..#.#.#..','..#####..','.........'],
        'splinters': ['.........','.#...#...','..#..#.#.','...#..#..','.##.#....','....#.#..','..#..#...','.#....#..','.........'],
        'raincoat': ['.........','....#....','...#.#...','..#...#..','.#.#.#.#.','...#.#...','..#...#..','..#####..','.........'],
    }
    for name, rows in symbols.items():
        file = ROOT / 'assets/boon-symbols-v1' / (name+'.png')
        im = Image.new('RGBA',(9,9))
        for y, row in enumerate(rows):
            for x, bit in enumerate(row):
                if bit == '#': im.putpixel((x,y),(232,217,181,255))
        im.save(file)
        pending['files'] = [f for f in pending['files'] if f['path'] != str(file.relative_to(ROOT))]
        pending['files'].append(dict(path=str(file.relative_to(ROOT)), sha1=hashlib.sha1(file.read_bytes()).hexdigest(), width=9, height=9, note='Pølge native boon glyph; master in scripts/build-polge.py. Figma desktop unavailable.'))
    write_json(pending_path, pending)

if __name__ == '__main__':
    build()
