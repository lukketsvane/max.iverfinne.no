"""Build the Seed Vault picture level (garden 1): the bottom of the silo.

The owner's scene (docs/asset-review/seed-vault-v1/source.png, 1672x941) is a
frozen seed vault: glass tanks of plants, a great wheel of seed jars, pipes, an
ice bridge over a frozen pool, lit doors and ladders between three and four
floors. The run starts here, in the dark and the wet, and climbs out.

Its people and doors are drawn a little smaller than the railway's, so it is
brought to native pixels at 1/3 (557x314) rather than 1/4: Max, about 22 px
tall, stands a head above the vault's keepers and fits its doors. The scene is
used whole and opaque; it is its own cave.

Collision is the floors it shows, all one-way so Max can jump up through them:
the upper and middle floors on the left, the stone blocks and the ice bridge,
the right floors, the pedestal in the frozen pool, and rungs 17 px apart up
each ladder the art draws. The top deck by the lit door gets a wooden ladder
from the Railway Ruins' kit. The lowest floor is the garden's soil.

    python3 scripts/build-seed-vault.py [--preview out.png [--reach reach.json]]
      -> assets/levels-v1/seed-vault.png, levels-v1/seed-vault.js

Needs Pillow, numpy and scipy (and scripts/build-railway-ruins.py for the kit).
"""
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/asset-review/seed-vault-v1/source.png'
ART = 'assets/levels-v1/seed-vault.png'
DATA = 'levels-v1/seed-vault.js'
GARDEN = 1
W, H = 557, 314
GROUND = 253                    # the lowest floor is the garden's soil

rail = importlib.util.spec_from_file_location('rail', ROOT / 'scripts/build-railway-ruins.py')
RAIL = importlib.util.module_from_spec(rail)
rail.loader.exec_module(RAIL)


def rungs(x, w, top, bottom):
    """Rungs every 17 px from a floor down towards the one below."""
    return [(x, y, w) for y in range(top + 17, bottom - 3, 17)]


LEDGES = [
    (2, 123, 165),              # the upper floor on the left, the keepers' door and the rover
    (28, 187, 167),             # the middle floor on the left, under the tanks
    (197, 171, 31), (228, 174, 105), (333, 171, 32),   # stone block, ice bridge, stone block
    (365, 183, 15),             # a step down off the bridge
    (380, 197, 160),            # the middle floor on the right
    (327, 147, 218),            # the upper floor on the right
    (375, 78, 170),             # the top deck by the lit door
    (263, 234, 33),             # the pedestal in the frozen pool
]
LEDGES += rungs(122, 14, 123, 187)      # ladder: upper left to middle left
LEDGES += rungs(75, 14, 187, GROUND)    # ladder: middle left to the soil
LEDGES += rungs(436, 14, 147, 197)      # ladder: upper right to middle right
LEDGES += rungs(454, 14, 197, GROUND)   # ladder: middle right to the soil
LADDER = ('bridges/tall-ladder', 537, 147 - 99)   # the kit ladder up to the top deck
LEDGES += rungs(LADDER[1] - 3, 24, 78, 147)

MARKERS = [
    ('reward', 522, 78), ('reward', 92, 123), ('seed', 279, 234),
    ('trial', 150, GROUND), ('trial', 490, 197),
    ('bonus', 280, 174), ('bonus', 470, 147),
    ('puzzle', 340, GROUND), ('door', 28, 123), ('dig', 205, GROUND), ('secret', 548, 197),
]


def build():
    src = Image.open(SOURCE).convert('RGB')
    art = np.dstack([np.array(src.resize((W, H), Image.BOX)), np.full((H, W), 255)]).astype(np.uint8)
    ladder = RAIL.cut_kits()[LADDER[0]]
    h, w = ladder.shape[:2]
    x, y = LADDER[1], LADDER[2]
    m = ladder[..., 3] > 0
    art[y:y + h, x:x + w][m] = ladder[m]
    return art


def main():
    art = build()
    q = Image.fromarray(art[..., :3]).quantize(255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = np.dstack([np.array(q), art[..., 3]])
    (ROOT / ART).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out, 'RGBA').save(ROOT / ART, optimize=True)
    data = {
        'id': 'seed-vault', 'w': W, 'h': H, 'art': ART, 'entry': {'x': 8, 'y': GROUND},
        'blocks': [], 'ledges': [list(map(int, l)) for l in LEDGES], 'hazards': [],
        'markers': [[m, int(x), int(y)] for m, x, y in MARKERS],
    }
    (ROOT / DATA).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / DATA).write_text(
        '/* Garden 1, the Seed Vault at the bottom of the silo: built by scripts/build-seed-vault.py from\n'
        '   docs/asset-review/seed-vault-v1 (the owner\'s scene). Do not edit by hand. */\n'
        '(window.MaxPictureLevels = window.MaxPictureLevels || {})[%d] = %s;\n' % (GARDEN, json.dumps(data, separators=(',', ':'))))
    print(ART, (W, H), 'ledges', len(LEDGES))
    if '--preview' in sys.argv:
        pv = out.copy()
        for x, y, w in LEDGES:
            pv[max(0, y):y + 1, max(0, x):x + w] = (255, 210, 60, 255)
        for m, x, y in MARKERS:
            pv[max(0, y - 5):y, max(0, x - 2):x + 3] = (80, 255, 120, 255)
        pv[GROUND, :] = (120, 200, 255, 255)
        if '--reach' in sys.argv:
            for p in json.loads(Path(sys.argv[sys.argv.index('--reach') + 1]).read_text())['standing']:
                if 0 <= p['x'] < W and 2 <= p['y'] < H:
                    pv[p['y'] - 2:p['y'], max(0, p['x'] - 1):p['x'] + 1] = (60, 255, 255, 255)
        Image.fromarray(pv, 'RGBA').resize((W * 2, H * 2), Image.NEAREST).save(sys.argv[sys.argv.index('--preview') + 1])


if __name__ == '__main__':
    main()
