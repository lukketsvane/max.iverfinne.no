const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

test('the production build ships the current MASTER and exact native character assets without retired campaign maps', () => {
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
  const enemies = JSON.parse(readFileSync(join(root, 'dist/assets/enemies-v1/manifest.json'), 'utf8'));
  for (const id of ['thorn-caster', 'dew-leech', 'rammer']) {
    assert.ok(enemies.assets.some(asset => asset.id === id), id + ' ships as a native enemy atlas');
    const relative = `assets/enemies-v1/${id}/atlas.json`;
    assert.deepEqual(readFileSync(join(root, 'dist', relative)), readFileSync(join(root, relative)));
    assert.equal(JSON.parse(readFileSync(join(root, relative), 'utf8')).sheets.sprites.image, '../../enemies-v2/sprites.png');
  }
  assert.deepEqual(readFileSync(join(root, 'dist/assets/enemies-v2/sprites.png')), readFileSync(join(root, 'assets/enemies-v2/sprites.png')), 'restored original enemy master ships byte-equal');
  const scripts = [...readFileSync(join(root, 'dist/index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
  for (const retired of ['levels-data.js', 'scene-levels-data.js', 'level-scenes-data.js', 'level-scenes.js', 'turtle-garden-data.js', 'turtle-garden-art-data.js', 'turtle-garden-art.js', 'campaign-architecture.js', 'stage-expeditions.js', 'guardian-sites.js', 'levels-v1']) {
    assert.equal(existsSync(join(root, 'dist', retired)), false, retired + ' is archived rather than published');
    assert.ok(!scripts.some(script => script === retired || script.startsWith(retired + '/')), retired + ' is not imported');
  }
  assert.equal(existsSync(join(root, 'dist/assets/levels-v2')), false);
  assert.deepEqual(readdirSync(join(root, 'dist/assets/levels-v1')), ['high-tide.png']);
  for (const active of ['master-map-data.js', 'master-map.js', 'levels.js', 'stage-layout.js', 'high-tide-map.js', 'game-menu.js']) assert.ok(scripts.includes(active), active + ' is imported');
  for (const file of ['master-map-data.js', 'master-map.js', 'assets/master-source-v1/map.png', 'assets/levels-v1/high-tide.png']) assert.deepEqual(readFileSync(join(root, 'dist', file)), readFileSync(join(root, file)), file + ' ships byte-equal');
});
