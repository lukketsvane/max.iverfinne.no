'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
const size = file => { const b = readFileSync(join(root, file)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('the page links a favicon, an apple touch icon and the web manifest', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  for (const href of ['/icons/icon-64.png', '/icons/icon-192.png', '/manifest.webmanifest']) assert.ok(html.includes(`href="${href}"`), href);
});

test('manifest icons are whole-number scales of the 64 px Figma master', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(size('icons/icon-64.png'), [64, 64]);
  for (const icon of manifest.icons) {
    const [w, h] = size(icon.src.slice(1));
    assert.equal(`${w}x${h}`, icon.sizes);
    assert.equal(w % 64, 0);
  }
});
