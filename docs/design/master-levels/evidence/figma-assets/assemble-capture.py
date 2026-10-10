#!/usr/bin/env python3
"""Decode complete, consistent bounded results from authenticated Figma reads."""
import base64
import hashlib
import json
import struct
from pathlib import Path

folder = Path(__file__).resolve().parent
parts = sorted((json.loads(p.read_text()) for p in folder.glob('capture-part-*.json')), key=lambda p: p['index'])
assert parts, 'No authenticated capture parts'
first = parts[0]
assert len(parts) == first['chunkCount'], 'Capture is incomplete'
assert [p['index'] for p in parts] == list(range(first['chunkCount']))
for part in parts:
    for key in ('encoding', 'fingerprint', 'inputLength', 'encodedLength', 'chunkSize', 'chunkCount', 'nodeCount', 'pngCount'):
        assert part[key] == first[key], 'Production data changed across capture reads: ' + key
assert first['encoding'] == 'lzw-u16le-base64'
encoded = ''.join(p['data'] for p in parts)
assert len(encoded) == first['encodedLength']
packed = base64.b64decode(encoded, validate=True)
assert len(packed) % 2 == 0
codes = struct.unpack('<' + 'H' * (len(packed) // 2), packed)
dictionary = {i: chr(i) for i in range(256)}
word = dictionary[codes[0]]
output = [word]
next_id = 256
for code in codes[1:]:
    if code in dictionary:
        entry = dictionary[code]
    else:
        assert code == next_id, 'Invalid LZW code'
        entry = word + word[0]
    output.append(entry)
    dictionary[next_id] = word + entry[0]
    next_id += 1
    word = entry
decoded = ''.join(output)
assert len(decoded) == first['inputLength']
fingerprint = 2166136261
for char in decoded:
    fingerprint = ((fingerprint ^ ord(char)) * 16777619) & 0xffffffff
assert f'{fingerprint:08x}' == first['fingerprint']
capture = json.loads(decoded)
assert capture['fileKey'] == 'TC0PHGMTCMR6im4hb3CSbF'
assert capture['page']['id'] == '10:2'
assert capture['readOnly'] is True
assert len(capture['rows']) == first['nodeCount']
capture['captureEvidence'] = {
    'method': 'Fresh authenticated Figma Plugin API reads using link_6aa94745e2b8819195041de9eb20fd15; complete configured production hierarchies, actual image hashes and native coordinates, and workbench text. No Figma edits.',
    'from': parts[0]['capturedAt'], 'until': parts[-1]['capturedAt'],
    'partCount': len(parts), 'stableAcrossPartsFingerprint': first['fingerprint'],
    'decodedPayloadSHA256': hashlib.sha256(decoded.encode('ascii')).hexdigest(),
    'parts': [{'index': p['index'], 'capturedAt': p['capturedAt']} for p in parts],
}
path = folder / 'production-capture.json'
path.write_text(json.dumps(capture, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'capture': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'nodes': len(capture['rows']), 'pngRectangles': first['pngCount'], 'from': parts[0]['capturedAt'], 'until': parts[-1]['capturedAt']}))
