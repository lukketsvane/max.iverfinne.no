const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

test('the production build ships every character outfit with its exact native sheets and atlas', () => {
  const root = join(__dirname, '..');
  execFileSync(process.execPath, ['scripts/build-static.cjs'], { cwd: root, stdio: 'pipe' });
  const pack = 'assets/characters-v2';
  const source = JSON.parse(readFileSync(join(root, pack, 'manifest.json'), 'utf8'));
  const shipped = JSON.parse(readFileSync(join(root, 'dist', pack, 'manifest.json'), 'utf8'));
  assert.deepEqual(shipped.assets, source.assets);
  assert.ok(shipped.assets.some(asset => asset.id === 'rattle-norvegicus-pink'));
  assert.equal(shipped.assets.some(asset => asset.id === 'rattle-norvegicus'), false);
  assert.equal(existsSync(join(root, 'dist', pack, 'rattle-norvegicus')), false);
  for (const asset of shipped.assets) for (const file of ['atlas.json', 'main.png', 'interaction.png']) {
    assert.deepEqual(readFileSync(join(root, 'dist', pack, asset.id, file)), readFileSync(join(root, pack, asset.id, file)), `${asset.id}/${file} ships unchanged`);
  }
});
