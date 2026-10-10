#!/usr/bin/env python3
"""Replay a fresh authenticated production capture for the unchanged check command.

This scoped server intentionally cannot supply unrelated drafts or PNG bytes.
It does not read repository pins, mutate Figma, or write any repository files.
"""
import argparse
import hashlib
import html
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--capture', type=Path, required=True)
parser.add_argument('--receipt', type=Path, required=True)
parser.add_argument('--port', type=int, default=0)
args = parser.parse_args()
raw = args.capture.read_bytes()
capture = json.loads(raw)
assert capture['fileKey'] == 'TC0PHGMTCMR6im4hb3CSbF'
assert capture['page']['id'] == '10:2'
assert capture['sectionIds'] == ['451:2', '451:3', '451:4', '451:5', '451:6', '451:7']
assert capture['readOnly'] is True
assert capture['rowFields'] == ['id', 'parentId', 'type', 'name', 'x', 'y', 'width', 'height', 'imageHashes']
nodes = {r[0]: dict(zip(capture['rowFields'], r)) for r in capture['rows']}
assert len(nodes) == len(capture['rows']), 'Duplicate node ID in capture'
assert '887:13531' not in nodes, 'Unfinished ART must not be captured'
nodes['10:2'] = {**capture['page'], 'parentId': None, 'x': 0, 'y': 0, 'width': 0, 'height': 0, 'imageHashes': []}
children = {node_id: [] for node_id in nodes}
for row in capture['rows']:
    assert row[1] in nodes, 'Captured parent is missing: ' + str(row[1])
    children[row[1]].append(row[0])

def xml(node_id):
    node = nodes[node_id]
    tag = node['type'].lower().replace('_', '-')
    # The repository decoder supports named entities and decimal references;
    # apostrophes are safe inside double-quoted attributes.
    escape_attr = lambda value: html.escape(str(value), quote=False).replace('"', '&quot;')
    attrs = ' '.join(f'{key}="{escape_attr(node[key])}"' for key in ('id', 'name', 'x', 'y', 'width', 'height'))
    content = ''.join(xml(child) for child in children[node_id])
    return f'<{tag} {attrs}>{content}</{tag}>'

def descendants(node_id):
    yield node_id
    for child in children[node_id]:
        yield from descendants(child)

def context(node_id):
    declarations, body = [], []
    for index, current_id in enumerate(descendants(node_id)):
        node = nodes[current_id]
        tags = []
        for image_index, image_hash in enumerate(node['imageHashes']):
            assert len(image_hash) == 40 and all(c in '0123456789abcdef' for c in image_hash)
            name = f'img{index}_{image_index}'
            declarations.append(f'const {name} = "http://127.0.0.1:{server.server_port}/assets/{image_hash}.png";')
            tags.append(f'<img src={{{name}}} />')
        if tags:
            body.append(f'<div data-node-id="{html.escape(current_id, quote=True)}">' + ''.join(tags) + '</div>')
    return '\n'.join(declarations) + '\nreturn (<div>' + ''.join(body) + '</div>);'

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        # An actual changed image needs a fresh authenticated byte export;
        # repository bytes must never stand in for that missing evidence.
        self.send_response(404)
        self.end_headers()
        self.wfile.write(b'PNG bytes were not captured; this replay supports a read-only comparison of matching source hashes only.\n')

    def do_POST(self):
        request = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        method = request.get('method')
        if 'id' not in request:
            self.send_response(204)
            self.end_headers()
            return
        if method == 'initialize':
            result = {'protocolVersion': '2025-03-26', 'capabilities': {'tools': {}}, 'serverInfo': {'name': 'max-fresh-production-capture-replay', 'version': '1'}}
        elif method == 'tools/call':
            params = request['params']
            name, node_id = params['name'], params['arguments']['nodeId']
            if node_id not in nodes or name not in ('get_metadata', 'get_design_context'):
                result = {'isError': True, 'content': [{'type': 'text', 'text': 'Requested node or tool is outside this authenticated production-only capture.'}]}
            else:
                value = xml(node_id) if name == 'get_metadata' else context(node_id)
                result = {'content': [{'type': 'text', 'text': value}]}
        else:
            result = {'isError': True, 'content': [{'type': 'text', 'text': 'Unsupported replay operation.'}]}
        response = json.dumps({'jsonrpc': '2.0', 'id': request['id'], 'result': result}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response)))
        self.end_headers()
        self.wfile.write(response)

server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
receipt = {'url': f'http://127.0.0.1:{server.server_port}/mcp', 'capture': str(args.capture.resolve()), 'captureSHA256': hashlib.sha256(raw).hexdigest(), 'nodeCount': len(capture['rows']), 'scope': capture['scope'], 'supportedCommand': 'npm run figma:check', 'repositoryPinsUsedByReplay': False}
args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt), flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
