'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'docs/design/native-level-drafts/verification');
const candidate = path.join(root, 'docs/design/native-level-drafts/review/candidate-levels-data.js');
const runners = ['playtest-authored-candidates.cjs', 'playtest-candidate-guardians.cjs', 'playtest-candidate-starts.cjs'];
const { createReportWriter, caseCoverageFailures, STAGES, CLASSES, RATES } = require(path.join(directory, 'native-draft-verifier-utils.cjs'));

function temporary(t) {
  const dir = fs.mkdtempSync(path.join(root, '.native-verifier-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function run(runner, input, output, timeout = 30000) {
  return spawnSync(process.execPath, [path.join(directory, runner), input, output], { cwd: path.dirname(input), encoding: 'utf8', timeout });
}
function writeCandidate(file, data) { fs.writeFileSync(file, 'window.MaxLevelData = ' + JSON.stringify(data) + ';\n'); }
function candidateData() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(candidate, 'utf8'), context);
  return JSON.parse(JSON.stringify(context.window.MaxLevelData));
}

test('all verifier CLIs reject empty or incomplete candidates before changing an existing report', t => {
  const dir = temporary(t), input = path.join(dir, 'candidate.js'), output = path.join(dir, 'report.json');
  const sentinel = Buffer.from('existing report\n\0exact bytes');
  const mutations = [
    () => ({ gardens: {} }),
    data => { delete data.gardens[3]; return data; },
    data => { data.gardens[2][0].ledges = []; data.gardens[2][0].blocks = []; return data; },
    ...['reward', 'seed', 'trial', 'start'].map(key => data => { data.gardens[2][0][key] = key === 'trial' ? [{ x: 0, rise: 0 }] : []; return data; })
  ];
  for (const mutate of mutations) {
    writeCandidate(input, mutate(candidateData())); fs.writeFileSync(output, sentinel);
    for (const runner of runners) {
      const result = run(runner, input, output);
      assert.notEqual(result.status, 0, runner + ' rejects incomplete candidate');
      assert.match(result.stderr, /expected stages|requires.*surfaces|requires.*markers/);
      assert.doesNotMatch(result.stdout, /"passed":true/);
      assert.deepEqual(fs.readFileSync(output), sentinel, runner + ' leaves prior report intact');
    }
  }
});

test('all verifier CLIs refuse report symlinks, hardlinks, and canonical candidate/runtime aliases', t => {
  const dir = temporary(t), input = path.join(dir, 'candidate.js'), runtime = path.join(root, 'levels-data.js');
  writeCandidate(input, { gardens: {} });
  const inputBytes = fs.readFileSync(input), runtimeBytes = fs.readFileSync(runtime);
  const ordinary = path.join(dir, 'ordinary.json'); fs.writeFileSync(ordinary, 'unrelated report sentinel');
  const symlinkInput = path.join(dir, 'symlink-input.json'), hardlinkInput = path.join(dir, 'hardlink-input.json');
  const symlinkRuntime = path.join(dir, 'symlink-runtime.json'), hardlinkRuntime = path.join(dir, 'hardlink-runtime.json');
  const symlinkOrdinary = path.join(dir, 'symlink-report.json'), hardlinkOrdinary = path.join(dir, 'hardlink-report.json');
  fs.symlinkSync(input, symlinkInput);
  fs.symlinkSync(runtime, symlinkRuntime);
  fs.symlinkSync(ordinary, symlinkOrdinary); fs.linkSync(ordinary, hardlinkOrdinary);
  const directoryAlias = path.join(dir, 'repo-alias'); fs.symlinkSync(root, directoryAlias);
  const inputDirectoryAlias = path.join(dir, 'candidate-parent-alias'); fs.symlinkSync(dir, inputDirectoryAlias);
  const directoryOutput = path.join(dir, 'directory-report'); fs.mkdirSync(directoryOutput);
  const outputs = [input, runtime, symlinkInput, symlinkRuntime, symlinkOrdinary, hardlinkOrdinary,
    path.join(directoryAlias, 'levels-data.js'), path.join(inputDirectoryAlias, 'candidate.js'), directoryOutput];
  for (const output of outputs) for (const runner of runners) {
    const result = run(runner, input, output);
    assert.notEqual(result.status, 0, runner + ' refuses ' + path.basename(output));
    assert.match(result.stderr, /Report output/);
    assert.deepEqual(fs.readFileSync(input), inputBytes, 'candidate inode preserved');
    assert.deepEqual(fs.readFileSync(runtime), runtimeBytes, 'runtime inode preserved');
    assert.equal(fs.readFileSync(ordinary, 'utf8'), 'unrelated report sentinel');
  }
  for (const [source, output] of [[input, hardlinkInput], [runtime, hardlinkRuntime]]) {
    fs.linkSync(source, output);
    for (const runner of runners) {
      const result = run(runner, input, output);
      assert.notEqual(result.status, 0); assert.match(result.stderr, /Report output/);
      assert.deepEqual(fs.readFileSync(input), inputBytes); assert.deepEqual(fs.readFileSync(runtime), runtimeBytes);
    }
    fs.unlinkSync(output);
  }
});

test('safe report publication is atomic and preserves the old report on failed installation', t => {
  const dir = temporary(t), input = path.join(dir, 'candidate.js'), output = path.join(dir, 'report.json');
  writeCandidate(input, { gardens: {} }); fs.writeFileSync(output, 'original sentinel');
  const writer = createReportWriter(input, output, root), inode = fs.statSync(output).ino;
  writer({ passed: false, failures: ['review incomplete'] });
  assert.deepEqual(JSON.parse(fs.readFileSync(output)), { passed: false, failures: ['review incomplete'] });
  assert.notEqual(fs.statSync(output).ino, inode, 'publication replaces the directory entry');
  const before = fs.readFileSync(output), rename = fs.renameSync;
  fs.renameSync = () => { throw new Error('injected installation failure'); };
  try { assert.throws(() => writer({ passed: true }), /injected installation failure/); }
  finally { fs.renameSync = rename; }
  assert.deepEqual(fs.readFileSync(output), before);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['candidate.js', 'report.json'], 'temporary publication directory cleaned');
  fs.unlinkSync(output); fs.symlinkSync(input, output);
  assert.throws(() => writer({ passed: true }), /Report output/, 'destination is rechecked before each write');
});

test('coverage gate requires all 36 distinct stage/class/rate cases and positive marker coverage', () => {
  const complete = STAGES.flatMap(stage => RATES.flatMap(hz => CLASSES.map(classId => ({ stage, hz, classId, markers: 1 }))));
  assert.deepEqual(caseCoverageFailures(complete, { markers: 1 }), []);
  assert.ok(caseCoverageFailures([], { markers: 1 }).length >= 36);
  assert.ok(caseCoverageFailures(complete.slice(1), { markers: 1 }).some(f => /Missing/.test(f.message)));
  assert.ok(caseCoverageFailures(complete.concat(complete[0]), { markers: 1 }).some(f => /duplicate/.test(f.message)));
  assert.ok(caseCoverageFailures(complete.map(c => ({ ...c, markers: 0 })), { markers: 1 }).length >= 36);
});

test('portable start-marker CLI completes real movement smoke and safely replaces a regular report', t => {
  const dir = temporary(t), output = path.join(dir, 'report.json'); fs.writeFileSync(output, 'prior review');
  const result = run('playtest-candidate-starts.cjs', candidate, output, 120000);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(output));
  assert.equal(report.passed, true); assert.equal(report.checks.length, 36); assert.equal(report.failures.length, 0);
  assert.ok(report.checks.every(c => c.markers > 0 && c.contactAndReturn));
});
