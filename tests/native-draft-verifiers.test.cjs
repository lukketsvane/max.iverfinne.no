'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'docs/design/native-level-drafts/verification');
const candidate = path.join(root, 'docs/design/native-level-drafts/review/candidate-levels-data.js');
const runners = ['playtest-authored-candidates.cjs', 'playtest-candidate-guardians.cjs', 'playtest-candidate-starts.cjs'];
const { createReportWriter, parseVerifierArguments, validateCandidate, caseCoverageFailures, STAGES, CLASSES, RATES } = require(path.join(directory, 'native-draft-verifier-utils.cjs'));

function temporary(t) {
  const dir = fs.mkdtempSync(path.join(root, '.native-verifier-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function run(runner, input, output, timeout = 30000, extra = []) {
  return spawnSync(process.execPath, [path.join(directory, runner), input, output, ...extra], { cwd: path.dirname(input), encoding: 'utf8', timeout });
}
function writeCandidate(file, data) { fs.writeFileSync(file, 'window.MaxLevelData = ' + JSON.stringify(data) + ';\n'); }
function candidateData() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(candidate, 'utf8'), context);
  return JSON.parse(JSON.stringify(context.window.MaxLevelData));
}
function selectedCandidate(stages) {
  const data = candidateData(), template = data.gardens[3][0];
  data.gardens = Object.fromEntries(stages.map(stage => [stage, [{ ...JSON.parse(JSON.stringify(template)), frame: `garden-${String(stage).padStart(2, '0')}` }]]));
  return data;
}

test('shared stage selection preserves defaults and accepts only a nonempty unique native stage list', () => {
  const defaults = parseVerifierArguments(['candidate.js', 'report.json'], 'test.cjs');
  assert.deepEqual(defaults.stages, [1, 2, 3]); assert.notEqual(defaults.stages, STAGES);
  assert.equal(defaults.input, path.resolve('candidate.js')); assert.equal(defaults.output, path.resolve('report.json'));
  for (const args of [['candidate.js', 'report.json', '--stages', '4,5,6'], ['--stages', '4,5,6', 'candidate.js', 'report.json']]) assert.deepEqual(parseVerifierArguments(args, 'test.cjs').stages, [4, 5, 6]);
  assert.deepEqual(parseVerifierArguments(['candidate.js', 'report.json', '--stages', '20,1,10'], 'test.cjs').stages, [20, 1, 10]);
  for (const value of ['', '0', '21', '-1', '4.0', '04', '4,4', '4,,5', '4,', ',4', '4, 5', '+4', 'NaN', '4e0']) assert.throws(() => parseVerifierArguments(['candidate.js', 'report.json', '--stages', value], 'test.cjs'), /stages|Stage selection/);
  for (const args of [[], ['candidate.js'], ['candidate.js', 'report.json', '--stages'], ['candidate.js', 'report.json', '--stage', '4'], ['candidate.js', 'report.json', '--stages', '4', '--stages', '5'], ['candidate.js', 'report.json', 'third']]) assert.throws(() => parseVerifierArguments(args, 'test.cjs'), /Usage|Invalid/);
});

test('selected candidate validation requires exact stage keys and one matching source while preserving compiler fields', () => {
  const data = selectedCandidate([10, 2]), before = JSON.stringify(data);
  assert.deepEqual(validateCandidate(data, [10, 2]), [10, 2]);
  assert.equal(JSON.stringify(data), before, 'validation preserves all native compiled fields and geometry');
  assert.deepEqual(validateCandidate(candidateData()), STAGES, 'original 1–3 candidate remains compatible');
  for (const stages of [[], [4, 4], [0], [21], [4.5]]) assert.throws(() => validateCandidate(selectedCandidate([4]), stages), /Stage selection/);
  const four = selectedCandidate([4]); four.gardens[4].push(four.gardens[4][0]);
  assert.throws(() => validateCandidate(four, [4]), /one authored candidate/);
  const wrongName = selectedCandidate([4]); wrongName.gardens[4][0].frame = 'garden-03';
  assert.throws(() => validateCandidate(wrongName, [4]), /source frame/);
  const malformedLadder = selectedCandidate([4]); malformedLadder.gardens[4][0].ladders[0].h = 0;
  assert.throws(() => validateCandidate(malformedLadder, [4]), /native ladder geometry/);
  assert.throws(() => validateCandidate(selectedCandidate([4]), [4, 5]), /exactly expected stages/);
  assert.throws(() => validateCandidate(selectedCandidate([4, 5]), [4]), /exactly expected stages/);
  const aliasKey = selectedCandidate([4]); aliasKey.gardens['04'] = aliasKey.gardens[4]; delete aliasKey.gardens[4];
  assert.throws(() => validateCandidate(aliasKey, [4]), /exactly expected stages/);
});

test('all verifier CLIs reject malformed stage selections before changing prior reports', t => {
  const dir = temporary(t), input = path.join(dir, 'candidate.js'), output = path.join(dir, 'report.json');
  writeCandidate(input, selectedCandidate([4, 5, 6]));
  const sentinel = Buffer.from('prior selected-stage report\n'); fs.writeFileSync(output, sentinel);
  for (const extra of [['--stages'], ['--stages', ''], ['--stages', '4,4'], ['--stages', '04'], ['--stages', '4', '--stages', '5']]) for (const runner of runners) {
    const result = run(runner, input, output, 30000, extra);
    assert.notEqual(result.status, 0, runner); assert.match(result.stderr, /stages|Stage selection/);
    assert.deepEqual(fs.readFileSync(output), sentinel); assert.doesNotMatch(result.stdout, /"passed":true/);
  }
});

test('all verifier CLIs reject mismatched selected fixtures and zero-coverage defaults before physics', t => {
  const dir = temporary(t), input = path.join(dir, 'candidate.js'), output = path.join(dir, 'report.json');
  const sentinel = Buffer.from('prior fixture report\n'); fs.writeFileSync(output, sentinel);
  const mutations = [
    () => candidateData(),
    data => { delete data.gardens[5]; return data; },
    data => { data.gardens[7] = selectedCandidate([7]).gardens[7]; return data; },
    data => { data.gardens[4].push(data.gardens[4][0]); return data; },
    data => { data.gardens[5][0].frame = 'garden-04'; return data; },
    data => { data.gardens[6][0].start = []; return data; }
  ];
  for (const mutate of mutations) {
    writeCandidate(input, mutate(selectedCandidate([4, 5, 6])));
    for (const runner of runners) {
      const result = run(runner, input, output, 30000, ['--stages', '4,5,6']);
      assert.notEqual(result.status, 0, runner); assert.match(result.stderr, /expected stages|one authored candidate|source frame|requires.*markers/);
      assert.deepEqual(fs.readFileSync(output), sentinel); assert.doesNotMatch(result.stdout, /"passed":true/);
    }
  }
  writeCandidate(input, selectedCandidate([4, 5, 6]));
  for (const runner of runners) {
    const result = run(runner, input, output);
    assert.notEqual(result.status, 0); assert.match(result.stderr, /exactly expected stages 1,2,3/);
    assert.deepEqual(fs.readFileSync(output), sentinel, 'default does not silently skip candidate stages 4–6');
  }
});

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
  const selected = [4, 5, 6], other = selected.flatMap(stage => RATES.flatMap(hz => CLASSES.map(classId => ({ stage, hz, classId, markers: 1 }))));
  assert.deepEqual(caseCoverageFailures(other, { markers: 1 }, selected), []);
  assert.equal(caseCoverageFailures([], { markers: 1 }, selected).length, 36);
  assert.ok(caseCoverageFailures(complete, { markers: 1 }, selected).some(f => /Unexpected/.test(f.message)), 'old-stage cases do not satisfy selected coverage');
  assert.throws(() => caseCoverageFailures([], {}, []), /Stage selection/, 'empty selection cannot pass coverage');
});

test('portable start-marker CLI completes real movement smoke and safely replaces a regular report', t => {
  const dir = temporary(t), output = path.join(dir, 'report.json'); fs.writeFileSync(output, 'prior review');
  const result = run('playtest-candidate-starts.cjs', candidate, output, 120000);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(output));
  assert.equal(report.passed, true); assert.equal(report.checks.length, 36); assert.equal(report.failures.length, 0);
  assert.deepEqual(report.stages, [1, 2, 3]); assert.equal(report.expectedCases, 36);
  assert.equal(report.sha256, crypto.createHash('sha256').update(fs.readFileSync(candidate)).digest('hex'));
  assert.ok(report.checks.every(c => c.markers > 0 && c.contactAndReturn));
});

test('explicit selected-stage start verifier runs every class/rate case using real movement', t => {
  const dir = temporary(t), input = path.join(dir, 'candidate.js'), output = path.join(dir, 'report.json');
  writeCandidate(input, selectedCandidate([4])); fs.writeFileSync(output, 'prior selected review');
  const result = run('playtest-candidate-starts.cjs', input, output, 120000, ['--stages', '4']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(output));
  assert.equal(report.passed, true); assert.deepEqual(report.stages, [4]); assert.equal(report.expectedCases, 12);
  assert.equal(report.input, input); assert.equal(report.sha256, crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'));
  assert.equal(report.checks.length, 12); assert.equal(report.failures.length, 0);
  assert.deepEqual(caseCoverageFailures(report.checks, { markers: 1 }, [4]), []);
  assert.ok(report.checks.every(c => c.stage === 4 && c.markers > 0 && c.contactAndReturn));
});
