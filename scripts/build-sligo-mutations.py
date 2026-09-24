"""Pack the owner's Untitled(1).zip poses at one shared 0.75 scale.

Sources remain unchanged. 64px cells leave room for the actual extended tissue;
no frame is independently fitted to a cell. Runtime draws at native 1x.
"""
import importlib.util
import json
import io
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/asset-review/sligo-mutations-v1'
OUT = ROOT / 'assets/max-skins-v1/sligo'
spec = importlib.util.spec_from_file_location('specials', ROOT / 'scripts/build-sligo-specials.py')
specials = importlib.util.module_from_spec(spec)
spec.loader.exec_module(specials)
CLIPS = {
    'crawl': list(range(37, 48)),
    'throw': list(range(109, 117)),
    'tend': list(range(117, 131)),
    'float': list(range(13, 22)) + list(range(24, 37)),
    'fall': list(range(239, 255)),
    'rise': list(range(274, 283)),
}


def main():
    archive = zipfile.ZipFile(SOURCE / 'source.zip')
    paths = {int(name[:3]): name for name in archive.namelist()}
    count = sum(map(len, CLIPS.values()))
    result = np.zeros((((count + 7) // 8) * 64, 512, 4), dtype=np.uint8)
    old = np.array(Image.open(OUT / 'specials.png').convert('RGBA'))
    palette = np.unique(old[old[..., 3] > 0, :3], axis=0)
    clips, records = {}, []
    for name, ids in CLIPS.items():
        clips[name] = []
        for source_id in ids:
            raw = np.array(Image.open(io.BytesIO(archive.read(paths[source_id]))).convert('RGBA'))
            frame = specials.native(raw, (0, 0, raw.shape[1], raw.shape[0]), .75)
            h, w = frame.shape[:2]
            assert w <= 60 and h <= 62, (source_id, w, h)
            index = len(records)
            x, y = (index % 8) * 64 + 32 - w // 2, (index // 8) * 64 + 63 - h + 1
            if name in ('throw', 'tend'):
                eye = (frame[..., :3].max(-1) < 100) & (frame[..., 3] > 0)
                if eye.any():
                    x = (index % 8) * 64 + 34 - int(round(np.nonzero(eye)[1].mean()))
                    assert (index % 8) * 64 < x and x + w < (index % 8 + 1) * 64
            # Preserve the source silhouette; snap colours to the existing Sligo ramp.
            rgb = frame[..., :3].astype(np.int32)
            distance = ((rgb[..., None, :] - palette.astype(np.int32)) ** 2).sum(-1)
            frame[..., :3] = palette[distance.argmin(-1)]
            frame[frame[..., 3] == 0] = 0
            result[y:y+h, x:x+w] = frame
            clips[name].append(index)
            records.append({'source': 'source.zip/' + paths[source_id], 'frame': index})
    im = Image.fromarray(result)
    im.save(OUT / 'mutations.png', optimize=True)
    (OUT / 'mutations.json').write_text(json.dumps({
        'schema': 'max-sligo-mutations/v1', 'image': 'mutations.png',
        'cell': [64, 64], 'columns': 8, 'anchor': [32, 63], 'scale': .75,
        'palette': ['#' + ''.join(f'{c:02x}' for c in rgb) for rgb in palette],
        'clips': clips, 'frames': records,
    }, indent=1) + '\n')
    review = Image.new('RGBA', im.size, '#243039')
    review.alpha_composite(im)
    review.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST).save(SOURCE / 'contact-2x.png')
    print('mutations:', count, 'frames;', im.size, clips)


if __name__ == '__main__':
    main()
