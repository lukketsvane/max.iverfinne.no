'use strict';
// Runtime renderer generation is separate from actual Figma scene-data export.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const folder = __dirname, repo = path.resolve(folder, '../../../..');
const source = fs.readFileSync(path.join(folder, 'native-renderer.js'), 'utf8');
const wrapper = fs.readFileSync(path.join(folder, 'production-wrapper.template.js'), 'utf8');
const result = '// Ordered Figma native primitives; generated from reviewed renderer sources.\n' + source + '\n' + wrapper;
fs.writeFileSync(path.join(repo, 'level-scenes.js'), result);
console.log(JSON.stringify({ output: 'level-scenes.js', bytes: Buffer.byteLength(result), sha256: crypto.createHash('sha256').update(result).digest('hex') }));
