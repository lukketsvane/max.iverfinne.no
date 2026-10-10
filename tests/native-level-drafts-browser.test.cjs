'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const runner = require('../scripts/check-native-level-drafts-browser.cjs');
const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/check-native-level-drafts-browser.cjs');
const source = path.join(root, 'docs/design/native-level-drafts/review/candidate-levels-data.js');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(root, '.native-draft-browser-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const site = path.join(directory, 'site'), candidate = path.join(directory, 'candidate.js'), out = path.join(directory, 'evidence');
  fs.mkdirSync(site); fs.copyFileSync(source, candidate);
  fs.writeFileSync(path.join(site, 'index.html'), '<script>function drawPlayer() {}</script>');
  fs.writeFileSync(path.join(site, 'review.html'), "Object.defineProperty(window,'localStorage'); max-review-state");
  fs.writeFileSync(path.join(site, 'levels-data.js'), 'original built levels bytes');
  return { directory, site, candidate, out, stages: [1, 2, 3] };
}

test('browser preview CLI validates explicit inputs and nonempty unique stage selection', () => {
  const valid = ['--candidate', source, '--out', '/tmp/example-review'];
  assert.deepEqual(runner.parseArguments(valid).stages, [1, 2, 3]);
  assert.deepEqual(runner.parseArguments(valid.concat('--stages', '4,5,6')).stages, [4, 5, 6]);
  for (const args of [[], valid.slice(0, 2), valid.concat('--unknown', 'x'), valid.concat('--out', 'x'),
    ...['', '4,4', '0', '21', '4,5,', '4, 5', '4.5'].map(stages => valid.concat('--stages', stages))]) {
    assert.throws(() => runner.parseArguments(args), /Usage|Invalid --stages/);
  }
});

test('browser preview refuses unsafe report directories and linked artifacts without changing inputs', t => {
  const options = fixture(t), bytes = fs.readFileSync(options.candidate), runtime = fs.readFileSync(path.join(root, 'levels-data.js'));
  for (const out of [root, path.dirname(root), options.directory, options.candidate, path.join(root, 'levels-data.js'),
    options.site, path.join(options.site, 'evidence'), path.join(root, 'dist'), path.join(root, 'assets', 'preview-output')]) {
    assert.throws(() => runner.createPublisher({ ...options, out }), /Review output/);
  }
  fs.mkdirSync(options.out);
  const report = path.join(options.out, 'preview-report.json'), screenshot = path.join(options.out, 'garden-01-phone.png');
  for (const install of [
    () => fs.symlinkSync(options.candidate, report),
    () => fs.linkSync(options.candidate, report),
    () => fs.symlinkSync(path.join(root, 'levels-data.js'), screenshot),
    () => fs.linkSync(path.join(root, 'levels-data.js'), screenshot),
    () => fs.mkdirSync(screenshot),
    () => fs.writeFileSync(path.join(options.out, 'unrelated.txt'), 'sentinel')
  ]) {
    install();
    assert.throws(() => runner.createPublisher(options), /Review output/);
    assert.deepEqual(fs.readFileSync(options.candidate), bytes); assert.deepEqual(fs.readFileSync(path.join(root, 'levels-data.js')), runtime);
    for (const name of fs.readdirSync(options.out)) fs.rmSync(path.join(options.out, name), { recursive: true });
  }
  const alias = path.join(options.directory, 'out-alias'); fs.symlinkSync(options.out, alias);
  assert.throws(() => runner.createPublisher({ ...options, out: alias }), /symlink/);
  const parentAlias = path.join(options.directory, 'site-alias'); fs.symlinkSync(options.site, parentAlias);
  assert.throws(() => runner.createPublisher({ ...options, out: path.join(parentAlias, 'evidence') }), /symlink/);
  fs.linkSync(options.candidate, path.join(options.directory, 'candidate-link.js'));
  assert.throws(() => runner.readCandidate(options.candidate, options.stages), /one hard link/);
});

test('browser artifact publication rechecks its destination and restores a previous report after installation failure', t => {
  const options = fixture(t); fs.mkdirSync(options.out);
  const report = path.join(options.out, 'preview-report.json'); fs.writeFileSync(report, 'old report sentinel');
  const publish = runner.createPublisher(options), rename = fs.renameSync;
  let calls = 0;
  fs.renameSync = (...args) => { if (++calls === 2) throw new Error('injected publication failure'); return rename(...args); };
  try { assert.throws(() => publish({ status: 'passed' }, new Map()), /injected publication failure/); }
  finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(report, 'utf8'), 'old report sentinel');
  assert.deepEqual(fs.readdirSync(options.directory).sort(), ['candidate.js', 'evidence', 'site']);
  fs.unlinkSync(report); fs.symlinkSync(options.candidate, report);
  assert.throws(() => publish({ status: 'passed' }, new Map()), /Review output/);
  fs.unlinkSync(report);
  const parentSwap = path.join(options.directory, 'new-parent'); fs.mkdirSync(parentSwap);
  fs.renameSync(options.out, path.join(parentSwap, 'evidence'));
  fs.symlinkSync(path.join(parentSwap, 'evidence'), options.out);
  assert.throws(() => publish({ status: 'passed' }, new Map()), /symlink/);
});

test('preview server overrides cache-busted candidate requests only in memory and refuses writes or site escapes', async t => {
  const options = fixture(t), original = fs.readFileSync(path.join(options.site, 'levels-data.js'));
  const outside = path.join(options.directory, 'outside.txt'); fs.writeFileSync(outside, 'private sentinel');
  fs.symlinkSync(outside, path.join(options.site, 'escape.txt'));
  const { server } = runner.createPreviewServer(options.site, '<html>in-memory observer</html>', Buffer.from('in-memory candidate'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  assert.equal(await (await fetch(base + '/levels-data.js?v=build')).text(), 'in-memory candidate');
  assert.equal(await (await fetch(base + '/index.html')).text(), '<html>in-memory observer</html>');
  assert.equal((await fetch(base + '/levels-data.js', { method: 'POST', body: 'replacement' })).status, 405);
  assert.equal((await fetch(base + '/escape.txt')).status, 403);
  assert.equal((await fetch(base + '/..%2Foutside.txt')).status, 403);
  assert.equal((await fetch(base + '/%zz')).status, 400);
  assert.deepEqual(fs.readFileSync(path.join(options.site, 'levels-data.js')), original);
});

test('browser CLI rejects candidate coverage before loading browser code or replacing a report', t => {
  const options = fixture(t), report = path.join(options.out, 'preview-report.json'); fs.mkdirSync(options.out); fs.writeFileSync(report, 'prior report');
  for (const content of ['window.MaxLevelData={gardens:{}};', 'while(true){}',
    'Promise.resolve().then(()=>{while(true){}});window.MaxLevelData={gardens:{}};']) {
    fs.writeFileSync(options.candidate, content);
    const result = spawnSync(process.execPath, [script, '--candidate', options.candidate, '--out', options.out,
      '--site', options.site, '--playwright', '/not-an-installed-module'], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.error, undefined); assert.equal(result.status, 1);
    assert.match(result.stderr, /expected stages|timed out/);
    assert.equal(fs.readFileSync(report, 'utf8'), 'prior report');
  }
});

test('browser launch failure exits promptly, writes failed evidence and leaves source/build bytes unchanged', t => {
  const options = fixture(t), module = path.join(options.directory, 'playwright-stub.cjs');
  const before = [options.candidate, path.join(options.site, 'index.html'), path.join(options.site, 'levels-data.js'),
    path.join(root, 'index.html'), path.join(root, 'levels-data.js')].map(file => [file, fs.readFileSync(file)]);
  for (const [failure, launch] of [
    ['launch', "throw Error('intentional launch failure');"],
    ['context', "return {newContext:async()=>{throw Error('intentional context failure');},close:async()=>{throw Error('intentional close failure');}};"]
  ]) {
    fs.writeFileSync(module, `module.exports={chromium:{launch:async()=>{console.log('BROWSER_LAUNCH_REACHED');${launch}}}};`);
    const result = spawnSync(process.execPath, [script, '--candidate', options.candidate, '--out', options.out,
      '--site', options.site, '--playwright', module], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.error, undefined); assert.equal(result.status, 1); assert.match(result.stdout, /BROWSER_LAUNCH_REACHED/, result.stderr);
    const report = JSON.parse(fs.readFileSync(path.join(options.out, 'preview-report.json')));
    assert.equal(report.status, 'failed'); assert.equal(report.inputsUnchanged, true); assert.equal(report.captures.length, 0);
    assert.match(report.failure, new RegExp(`intentional ${failure} failure`));
    if (failure === 'context') assert.match(report.cleanupFailure, /intentional close failure/);
    for (const [file, bytes] of before) assert.deepEqual(fs.readFileSync(file), bytes);
  }
});
