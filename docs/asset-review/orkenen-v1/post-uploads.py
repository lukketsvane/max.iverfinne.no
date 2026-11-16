"""POST the split PNGs to Figma upload URLs.

Ask the Figma MCP `upload_assets` tool for URLs with `nodeIds` taken from
manifest.json (`figma` of each part / layer, at most 60 per call), save its
`uploads` array as JSON, then:

    python docs/asset-review/orkenen-v1/post-uploads.py uploads.json

Each upload fills its target node with the file that manifest.json assigns to it.
"""
import json
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
manifest = json.loads((HERE / 'manifest.json').read_text())
by_node = {item['figma']: item['file']
           for group in manifest['sheet'] + manifest['scenes']
           for item in group.get('parts', group.get('layers')) if 'figma' in item}

for up in json.loads(Path(sys.argv[1]).read_text()):
    file = by_node[up['targetNodeId']]
    req = urllib.request.Request(up['submitUrl'], data=(HERE / file).read_bytes(),
                                 headers={'Content-Type': 'image/png'}, method='POST')
    with urllib.request.urlopen(req, timeout=60) as res:
        print(res.status, up['targetNodeId'], file)
