'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const STAGES = [1, 2, 3];
const CLASSES = ['mech', 'runner', 'bulwark', 'herbalist'];
const RATES = [30, 60, 120];

function validateCandidate(data) {
  assert.ok(data && data.gardens && typeof data.gardens === 'object', 'Candidate must contain expected stages 1–3');
  assert.deepEqual(Object.keys(data.gardens).sort(), STAGES.map(String), 'Candidate must contain exactly expected stages 1–3');
  for (const stage of STAGES) {
    const variants = data.gardens[stage];
    assert.ok(Array.isArray(variants) && variants.length === 1, `Stage ${stage} must contain one authored candidate garden`);
    const garden = variants[0];
    assert.ok(garden && Array.isArray(garden.ledges), `Stage ${stage} requires authored surfaces`);
    assert.ok(garden.blocks === undefined || Array.isArray(garden.blocks), `Stage ${stage} blocks must be an array`);
    const surfaces = garden.ledges.concat(garden.blocks || []);
    assert.ok(surfaces.length > 0, `Stage ${stage} requires nonempty authored surfaces`);
    for (const surface of surfaces) {
      assert.ok(surface && [surface.x, surface.rise, surface.w].every(Number.isInteger) && surface.w > 0,
        `Stage ${stage} requires valid native authored surfaces`);
    }
    for (const block of garden.blocks || []) assert.ok(Number.isInteger(block.h) && block.h > 0, `Stage ${stage} requires valid block heights`);
    for (const [key, minimum] of [['reward', 1], ['seed', 1], ['trial', 2], ['start', 1]]) {
      assert.ok(Array.isArray(garden[key]) && garden[key].length >= minimum,
        `Stage ${stage} requires ${key} markers (at least ${minimum})`);
    }
    for (const key of ['reward', 'seed', 'trial', 'bonus', 'puzzle', 'door', 'dig', 'secret', 'start']) {
      assert.ok(garden[key] === undefined || Array.isArray(garden[key]), `Stage ${stage} ${key} must be an array`);
      for (const marker of garden[key] || []) assert.ok(marker && [marker.x, marker.rise].every(Number.isInteger), `Stage ${stage} requires valid native ${key} markers`);
    }
  }
  return STAGES;
}

function caseCoverageFailures(cases, fields = {}) {
  const expected = new Set(STAGES.flatMap(stage => RATES.flatMap(hz => CLASSES.map(classId => `${stage}:${classId}:${hz}`))));
  const seen = new Set(), failures = [];
  for (const entry of cases) {
    const key = `${entry.stage}:${entry.classId}:${entry.hz}`;
    if (!expected.has(key) || seen.has(key)) failures.push({ kind: 'coverage', message: `Unexpected or duplicate class/rate/stage case ${key}` });
    seen.add(key);
    for (const [actual, wanted] of Object.entries(fields)) {
      const count = typeof wanted === 'function' ? wanted(entry) : wanted;
      if (!Number.isInteger(count) || count < 1 || entry[actual] !== count) failures.push({ kind: 'coverage', stage: entry.stage, classId: entry.classId, hz: entry.hz, message: `Incomplete ${actual} coverage: expected ${count}, received ${entry[actual]}` });
    }
  }
  for (const key of expected) if (!seen.has(key)) failures.push({ kind: 'coverage', message: `Missing class/rate/stage case ${key}` });
  return failures;
}

// Reports are review artifacts. Resolve directory aliases and inspect the leaf
// without following links before any simulation or publication takes place.
function createReportWriter(input, output, repo) {
  input = path.resolve(input); output = path.resolve(output);
  const parent = fs.realpathSync(path.dirname(output));
  const destination = path.join(parent, path.basename(output));
  const protectedPaths = [input, path.join(repo, 'levels-data.js')];
  const original = protectedPaths.map(file => ({ file: fs.realpathSync(file), stat: fs.statSync(file) }));
  function preflight() {
    if (fs.realpathSync(path.dirname(output)) !== parent) throw new Error('Report output parent changed; publication refused');
    const entry = fs.lstatSync(destination, { throwIfNoEntry: false });
    if (entry && (!entry.isFile() || entry.nlink !== 1)) throw new Error('Report output must be absent or a regular file with one hard link; symlink and hardlink reports are refused');
    const protectedFiles = original.concat(protectedPaths.map(file => ({ file: fs.realpathSync(file), stat: fs.statSync(file) })));
    for (const protectedFile of protectedFiles) {
      if (destination === protectedFile.file || entry && entry.dev === protectedFile.stat.dev && entry.ino === protectedFile.stat.ino) {
        throw new Error('Report output must not alias its candidate input or runtime levels-data.js');
      }
    }
  }
  preflight();
  return report => {
    preflight();
    const temporary = fs.mkdtempSync(path.join(parent, `.${path.basename(output)}.report-`));
    try {
      const staged = path.join(temporary, 'report.json');
      fs.writeFileSync(staged, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
      preflight();
      fs.renameSync(staged, destination);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  };
}

module.exports = { STAGES, CLASSES, RATES, validateCandidate, caseCoverageFailures, createReportWriter };
