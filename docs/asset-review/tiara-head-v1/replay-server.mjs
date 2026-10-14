#!/usr/bin/env node
// Replay a fresh authenticated Figma hierarchy and actual native export.
// Nothing in the production manifest is used to construct source evidence.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const [runtimePath, vectorPath, pngPath] = process.argv.slice(2);
if (!runtimePath || !vectorPath || !pngPath) throw Error('Usage: node replay-server.mjs actual-runtime-capture.json actual-vector-capture.json actual-figma-export.png');
const runtime = JSON.parse(readFileSync(resolve(runtimePath))), vector = JSON.parse(readFileSync(resolve(vectorPath))), png = readFileSync(resolve(pngPath));
const records = runtime.records ?? runtime.rows;
if (runtime.fileKey !== 'TC0PHGMTCMR6im4hb3CSbF' || !runtime.capturedAt || !Array.isArray(records) || !records.length) throw Error('actual authenticated runtime capture identity or hierarchy is missing');
if (createHash('sha1').update(png).digest('hex') !== vector.png.sha1) throw Error('actual Figma PNG export differs from the captured export hash');
const nodes = new Map(records.map(row => [row[0], { id: row[0], parent: row[1], type: row[2], name: row[3], x: row[4], y: row[5], width: row[6], height: row[7], hashes: row[8], children: [] }]));
if (nodes.size !== records.length) throw Error('duplicate actual source node IDs');
const page = runtime.page ?? { id: runtime.pageId, name: runtime.pageName };
if (page?.id !== '10:2' || typeof page.name !== 'string') throw Error('actual production page identity is missing');
if (!nodes.has(page.id)) nodes.set(page.id, { id: page.id, type: 'CANVAS', name: page.name, x: 0, y: 0, width: 0, height: 0, hashes: [], children: [] });
for (const node of nodes.values()) {
  if (node.id === page.id) continue;
  if (!nodes.has(node.parent)) throw Error(`${node.id}: actual captured parent ${node.parent} is missing`);
  nodes.get(node.parent).children.push(node);
}
const sections = ['451:2', '451:3', '451:4', '451:5', '451:6', '451:7'];
for (const id of sections) if (nodes.get(id)?.type !== 'SECTION' || nodes.get(id).parent !== page.id) throw Error(`actual production section ${id} is missing`);
const master = nodes.get(vector.master.nodeId);
if (!master || !['FRAME', 'COMPONENT'].includes(master.type) || master.type !== vector.master.type || master.name !== vector.master.path || master.children.length !== vector.shapes.length) throw Error('actual native vector master is missing from the fresh runtime hierarchy');
const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
function metadata(node) {
  const type = node.type.toLowerCase().replaceAll('_', '-'), attrs = [['id', node.id], ['name', node.name], ['x', node.x], ['y', node.y], ['width', node.width], ['height', node.height]].map(([key, value]) => `${key}="${xml(value)}"`).join(' ');
  return `<${type} ${attrs}>${node.children.map(metadata).join('')}</${type}>`;
}
function* descendants(node) { yield node; for (const child of node.children) yield* descendants(child); }
function context(node) {
  const images = [...descendants(node)].flatMap(n => (n.hashes ?? []).map(hash => [n.id, hash]));
  if (images.some(([, hash]) => !/^[0-9a-f]{40}$/.test(hash))) throw Error('actual capture has an invalid stored image hash');
  return images.map(([id, hash], i) => `const img${i} = "http://127.0.0.1/assets/${hash}.png";\n<div data-node-id="${xml(id)}"><img src={img${i}} /></div>`).join('\n');
}
const result = text => ({ content: [{ type: 'text', text }] });
const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === `/assets/${vector.png.sha1}.png`) { response.writeHead(200, { 'content-type': 'image/png' }); response.end(png); return; }
    if (request.method !== 'POST' || request.url !== '/mcp') { response.writeHead(404); response.end('No actual captured export at this URL'); return; }
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const message = JSON.parse(Buffer.concat(chunks)); let value;
    if (message.method === 'initialize') value = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'authenticated-figma-capture-replay', version: '1' } };
    else if (message.method === 'notifications/initialized') { response.writeHead(204); response.end(); return; }
    else if (message.method === 'tools/call') {
      const { name, arguments: args } = message.params;
      if (name === 'get_vector_export' && args.nodeId === vector.master.nodeId) value = result(JSON.stringify(vector));
      else {
        const node = nodes.get(args.nodeId);
        if (!node) throw Error(`actual capture has no node ${args.nodeId}`);
        if (name === 'get_metadata') value = result(metadata(node));
        else if (name === 'get_design_context') value = result(context(node));
        else throw Error(`unsupported replay capability ${name}`);
      }
    } else throw Error(`unsupported replay method ${message.method}`);
    response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: value }));
  } catch (error) { response.writeHead(500, { 'content-type': 'text/plain' }); response.end(error.message); }
});
server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ url: `http://127.0.0.1:${server.address().port}/mcp`, capturedAt: runtime.capturedAt, sourceNodes: records.length, pngExport: vector.png.sha1 })));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
