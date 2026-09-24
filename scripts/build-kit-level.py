"""Build a kit-built picture level from its spec (scripts/levels/<name>.json).

A spec is a garden of the owner's kits, placed by role (see scripts/kitlib.py):

    {"garden": 3, "id": "the-sump", "title": "The Sump", "w": 900, "h": 320, "ground": 296,
     "pieces": [["cave-ledges/ledge-long", 40, 230, "tops", false], ...],
     "markers": [["reward", 400, 120], ...]}

    python3 scripts/build-kit-level.py scripts/levels/garden-03.json [--preview out.png [--reach reach.json]]
      -> assets/levels-v1/<id>.png, levels-v1/<id>.js

Needs Pillow, numpy and scipy.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kitlib  # noqa: E402


def build(spec_path):
    spec = json.loads(Path(spec_path).read_text())
    level = kitlib.Level(spec['w'], spec['h'], spec['ground'])
    for p in spec['pieces']:
        name, x, y, role = p[:4]
        level.place(name, int(x), int(y), role, bool(p[4]) if len(p) > 4 else False)
    level.finish()
    markers = [tuple(m) for m in spec['markers']]
    art, data = 'assets/levels-v1/%s.png' % spec['id'], 'levels-v1/%s.js' % spec['id']
    note = 'Garden %d, %s: built by scripts/build-kit-level.py from %s (the owner\'s kits).' % (
        spec['garden'], spec.get('title', spec['id']), Path(spec_path).as_posix().split('max.iverfinne.no/')[-1])
    out = level.save(spec['garden'], spec['id'], markers, note, art, data)
    return level, markers, out


def main():
    spec = sys.argv[1]
    level, markers, out = build(spec)
    print(out['art'], (level.w, level.h), 'blocks', len(out['blocks']), 'ledges', len(out['ledges']))
    if '--preview' in sys.argv:
        reach = sys.argv[sys.argv.index('--reach') + 1] if '--reach' in sys.argv else None
        level.preview(sys.argv[sys.argv.index('--preview') + 1], markers, reach, sky=(12, 16, 24))


if __name__ == '__main__':
    main()
