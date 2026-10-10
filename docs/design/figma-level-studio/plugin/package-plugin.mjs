#!/usr/bin/env node
// Deterministic ZIP of executable desktop plugin files; no dependencies or publish step.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const files = ['manifest.json', 'plugin-main.js', 'ui.html', 'INSTALL.md'];
const crc = bytes => { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = value & 1 ? value >>> 1 ^ 0xedb88320 : value >>> 1; } return (value ^ 0xffffffff) >>> 0; };
const parts = [], directory = []; let offset = 0;
for (const file of files) {
  const name = Buffer.from('max-level-studio/' + file), bytes = readFileSync(new URL('./' + file, import.meta.url)), sum = crc(bytes);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(33, 12); local.writeUInt32LE(sum, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(33, 14); central.writeUInt32LE(sum, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
  parts.push(local, name, bytes); directory.push(central, name); offset += local.length + name.length + bytes.length;
}
const central = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...parts, central, end]); writeFileSync(new URL('./max-level-studio-plugin.zip', import.meta.url), zip);
console.log('Packaged local development plugin SHA-256 ' + createHash('sha256').update(zip).digest('hex'));
