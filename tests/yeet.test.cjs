const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');

test('Yeet is a guaranteed westbound encounter and is wired into runtime', () => {
  const yeet = readFileSync(join(root, 'yeet.inc.js'), 'utf8');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const coop = readFileSync(join(root, 'coop-game.inc.js'), 'utf8');
  assert.match(yeet, /west<=origin-260/);
  assert.match(yeet, /yeetStart\(west\)/);
  assert.match(yeet, /phase='flash'/);
  assert.match(yeet, /phase='flee'/);
  assert.match(yeet, /assets\/yeet-encounter-v1\/01-encounter\.png/);
  assert.match(yeet, /ctx\.drawImage\(YEET_SHEET/);
  assert.ok(existsSync(join(root, 'assets/yeet-encounter-v1/01-encounter.png')));
  assert.match(html, /"MAX_YEET";/);
  assert.match(html, /updateYeet\(dt\)/);
  assert.match(html, /drawYeet\(tSec\)/);
  assert.match(coop, /yeet:coopPlain\(yeet\)/);
  assert.match(coop, /yeetSync\(s\.yeet\)/);
});

test('production source expansion embeds Yeet code', () => {
  const built = require('../scripts/game-source.cjs')();
  assert.doesNotMatch(built, /"MAX_YEET";/);
  assert.match(built, /function updateYeet\(dt\)/);
});
