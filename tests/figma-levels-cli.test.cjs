'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const fixture = require('./fixtures/figma-levels.json');
const tool = import(pathToFileURL(path.join(root, 'scripts/figma-levels.mjs')).href);
let uid = 0;
const instance = (name, x = 0, y = 0, w = 7, h = 7) => `<instance id="9:${++uid}" name="${name}" x="${x}" y="${y}" width="${w}" height="${h}" />`;
const sentinel = Buffer.from('previous approved level data\r\n\0keep exact bytes\n');

function edit(xml, frame, add = [], drop) {
  const lines = xml.split('\n'), start = lines.findIndex(l => l.includes(`name="${frame}"`)), end = lines.indexOf('  </frame>', start);
  return [...lines.slice(0, start + 1), ...add.map(a => '    ' + a), ...lines.slice(start + 1, end).filter(l => !drop?.test(l)), ...lines.slice(end)].join('\n');
}

function setup(t, metadata = fixture.metadata) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'max-figma-level-cli-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'scripts'));
  fs.mkdirSync(path.join(directory, 'tests'));
  for (const file of ['figma-levels.mjs', 'figma-mcp.mjs']) fs.copyFileSync(path.join(root, 'scripts', file), path.join(directory, 'scripts', file));
  // Keep the real simulation for reach reports, with all CLI writes in an isolated root.
  fs.writeFileSync(path.join(directory, 'tests/game-harness.cjs'), `module.exports = require(${JSON.stringify(path.join(root, 'tests/game-harness.cjs'))});\n`);
  const input = path.join(directory, 'capture.json'), output = path.join(directory, 'levels-data.js');
  fs.writeFileSync(input, JSON.stringify({ page: fixture.page, metadata }));
  fs.writeFileSync(output, sentinel);
  const run = (args, nodeArgs = []) => spawnSync(process.execPath, [...nodeArgs, path.join(directory, 'scripts/figma-levels.mjs'), ...args], { cwd: directory, encoding: 'utf8', timeout: 20000 });
  return { directory, input, output, run };
}

function dataAt(file) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  return JSON.parse(JSON.stringify(context.window.MaxLevelData));
}

test('a valid historical live capture atomically replaces default output and repeated exports leave it unchanged', t => {
  const staged = setup(t, edit(fixture.metadata, 'garden-05', [instance('designed')]));
  const oldLink = path.join(staged.directory, 'previous-levels.js');
  fs.linkSync(staged.output, oldLink);
  const first = staged.run(['--from', staged.input]);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /garden-05\s+219:1233\s+live\s+switchbacks · 22 ledges/);
  assert.match(first.stdout, /levels-data\.js written/);
  assert.equal(dataAt(staged.output).page, '218:2', 'archived capture page remains supported');
  assert.equal(dataAt(staged.output).gardens[5][0].frame, 'garden-05');
  assert.deepEqual(fs.readFileSync(oldLink), sentinel, 'successful replacement must rename a new file, not truncate the approved inode');
  const stat = fs.statSync(staged.output), bytes = fs.readFileSync(staged.output);
  const second = staged.run(['--from', staged.input]);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /levels-data\.js unchanged/);
  assert.deepEqual(fs.readFileSync(staged.output), bytes);
  assert.equal(fs.statSync(staged.output).mtimeMs, stat.mtimeMs);
  assert.ok(!fs.readdirSync(staged.directory).some(name => name.startsWith('.figma-levels-')), 'temporary siblings are cleaned');
});

test('--out creates review data without replacing runtime output, including authored ladders and explicit opt-ins', t => {
  const metadata = edit(fixture.metadata, 'garden-05', [instance('designed'), instance('ladder', 300, 180, 7, 50), instance('replace-picture'), instance('furnish-place')]);
  const staged = setup(t, metadata), target = path.join(staged.directory, 'review-levels.js');
  const result = staged.run(['--out', 'review-levels.js', '--from', staged.input]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /review-levels\.js written/);
  assert.deepEqual(fs.readFileSync(staged.output), sentinel);
  const garden = dataAt(target).gardens[5][0];
  assert.deepEqual(garden.ladders, [{ x: -47, rise: 59, w: 7, h: 50 }]);
  assert.equal(garden.replacePicture, true);
  assert.equal(garden.furnishPlace, true);
});

test('structurally invalid live frames preserve every approved output byte, even beside valid frames', async t => {
  const live = edit(fixture.metadata, 'garden-05', [instance('designed')]);
  const cases = [
    ['missing origin', edit(live, 'garden-01', [instance('designed')], /name="origin"/), /no origin instance/],
    ['duplicate frame names', live.replace('name="garden-01"', 'name="garden-05"'), /2 frames are named garden-05/],
    ['off-grid ladder', edit(live, 'garden-05', [instance('ladder', 300.5, 180, 7, 50)]), /integer pixel grid/],
    ['zero-height ladder', edit(live, 'garden-05', [instance('ladder', 300, 180, 7, 0)]), /positive width and height/]
  ];
  for (const [name, metadata, error] of cases) await t.test(name, child => {
    const staged = setup(child, metadata), result = staged.run(['--from', staged.input]);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, error);
    assert.match(result.stderr, /not written.*structural validation/);
    assert.deepEqual(fs.readFileSync(staged.output), sentinel);
    assert.ok(!fs.readdirSync(staged.directory).some(file => file.startsWith('.figma-levels-')));
    const review = path.join(staged.directory, 'review.js');
    fs.writeFileSync(review, sentinel);
    const preview = staged.run(['--from', staged.input, '--out', review]);
    assert.equal(preview.status, 1, preview.stderr);
    assert.deepEqual(fs.readFileSync(review), sentinel);
  });
});

test('failed atomic replacement preserves the destination and cleans temporary files', t => {
  const staged = setup(t), preload = path.join(staged.directory, 'fail-rename.cjs');
  fs.writeFileSync(preload, "require('node:fs').renameSync = () => { throw new Error('simulated rename failure'); }; require('node:module').syncBuiltinESMExports();\n");
  const result = staged.run(['--from', staged.input], ['--require', preload]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /simulated rename failure/);
  assert.deepEqual(fs.readFileSync(staged.output), sentinel);
  assert.ok(!fs.readdirSync(staged.directory).some(file => file.startsWith('.figma-levels-')));
});

test('malformed fixtures and ambiguous CLI arguments fail without replacing approved data', t => {
  const staged = setup(t);
  for (const args of [
    ['--from'], ['--out'], ['--from', '--out', 'review.js'], ['--unknown'],
    ['--from', staged.input, '--watch'], ['--from', staged.input, '--from', staged.input],
    ['--from', staged.input, '--out', staged.input]
  ]) {
    const before = fs.readFileSync(staged.input), result = staged.run(args);
    assert.equal(result.status, 2, `${args.join(' ')}: ${result.stderr}`);
    assert.match(result.stderr, /Usage:/);
    assert.deepEqual(fs.readFileSync(staged.output), sentinel);
    assert.deepEqual(fs.readFileSync(staged.input), before);
  }
  for (const input of ['{ broken JSON', 'null', '{}', '{"page":"218:2","metadata":""}', JSON.stringify({ page: 'wrong:page', metadata: fixture.metadata })]) {
    fs.writeFileSync(staged.input, input);
    const result = staged.run(['--from', staged.input]);
    assert.equal(result.status, 2, result.stderr);
    assert.deepEqual(fs.readFileSync(staged.output), sentinel);
  }
});

test('authored ladder tags retain native geometry while legacy tags keep their rounding policy', async () => {
  const { gardenOf } = await tool;
  const node = (name, x, y, width, height, children = []) => ({ type: 'instance', name, x, y, width, height, children });
  const base = [node('origin', 100, 90, 1, 30), node('soil', 0, 120, 200, 1), node('designed', 0, 0, 7, 7)];
  const parse = extra => gardenOf({ id: '9:1', name: 'garden-03', children: base.concat(extra) });
  const valid = parse([node('ladder', 75, 42, 8, 78), node('replace-picture', 0, 0, 7, 7), node('furnish-place', 0, 0, 7, 7), node('ledge:stone', 60.4, 100.4, 30.4, 6.4)]);
  assert.deepEqual(valid.problems, []);
  assert.deepEqual(valid.garden.ladders, [{ x: -21, rise: 78, w: 8, h: 78 }]);
  assert.deepEqual(valid.garden.ledges, [{ x: -40, rise: 20, w: 30, style: 'stone' }]);
  assert.match(valid.notes.join('\n'), /off the pixel grid were rounded/);
  for (const values of [[75.5, 42, 8, 78], [75, 42.5, 8, 78], [75, 42, 8.5, 78], [75, 42, 8, 78.5], [75, 42, 0, 78], [75, 42, -8, 78], [75, 42, 8, -1], [NaN, 42, 8, 78], [75, Infinity, 8, 78], [75, 42, Infinity, 78], [75, 42, 8, NaN]]) {
    const result = parse([node('ladder', ...values)]);
    assert.equal(result.live, true);
    assert.equal(result.problems.length, 1, JSON.stringify(values));
    assert.equal(result.garden, undefined, 'invalid ladders cannot enter compiled data');
  }
  const ordinary = parse([]);
  assert.equal(ordinary.garden.ladders, undefined);
  assert.equal(ordinary.garden.replacePicture, undefined);
  assert.equal(ordinary.garden.furnishPlace, undefined);
  const nested = parse([{ type: 'group', name: 'reference', x: 0, y: 0, width: 100, height: 100, children: [node('ladder', 75, 42, 8, 78), node('replace-picture', 0, 0, 7, 7)] }]);
  assert.equal(nested.garden.ladders, undefined);
  assert.equal(nested.garden.replacePicture, undefined);
});
