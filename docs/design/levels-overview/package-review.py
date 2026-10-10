#!/usr/bin/env python3
"""Package the review and embedded local plugin as separate untracked ZIPs."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=Path('/tmp/max-level-scene-delivery'))
args = parser.parse_args()
base = Path(__file__).resolve().parent
args.out.mkdir(parents=True, exist_ok=True)

review = args.out / 'max-twenty-level-scene-stack.zip'
plugin = args.out / 'max-level-scene-figma-plugin.zip'
review_paths = ['stack.html', 'README.md', 'inventory.json', 'package-audit.json', 'build-stack.cjs']
review_paths += [str(p.relative_to(base)) for folder in ['generated', 'current-captures', 'validation'] for p in sorted((base / folder).glob('*')) if p.is_file()]
plugin_paths = ['plugin/manifest.json', 'plugin/code.js', 'plugin/ui.html', 'plugin/INSTALL.md', 'package-audit.json']

def package(target, paths, flatten=False):
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for rel in paths:
            path = base / rel
            archive.write(path, path.name if flatten else rel)
    raw = target.read_bytes()
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        records = []
        for entry in archive.infolist():
            data = archive.read(entry)
            records.append({'path': entry.filename, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    return {'path': str(target.resolve()), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'files': records}

receipt = {
    'format': 'max-level-scene-delivery/v1',
    'cloudSynchronized': False,
    'actualFigmaExecution': False,
    'runtimeSource': False,
    'sourceManifestSHA256': hashlib.sha256((base / 'generated/source.json').read_bytes()).hexdigest(),
    'compiledPluginBytes': (base / 'plugin/code.js').stat().st_size,
    'compiledPluginTracked': False,
    'reviewZip': package(review, review_paths),
    'figmaPluginZip': package(plugin, plugin_paths, flatten=True),
}
assert receipt['compiledPluginBytes'] < 100 * 1024 * 1024
(args.out / 'delivery-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
(base / 'delivery-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({k: {'path': v['path'], 'bytes': v['bytes'], 'sha256': v['sha256']} for k, v in receipt.items() if k.endswith('Zip')}, indent=2))
