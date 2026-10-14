'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('menu layout review rejects absent coverage, reaches real launch and records clean failures', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-layout-config-'));
  const hook = path.join(directory, 'playwright-hook.cjs');
  fs.writeFileSync(hook, `const Module=require('node:module'),load=Module._load;
Module._load=function(id){
  if(id==='playwright')return Object.fromEntries(['chromium','webkit'].map(engine=>[engine,{launch:async()=>{
    console.log('MENU_LAYOUT_LAUNCH:'+engine);throw Error('intentional menu launch failure');
  }}]));
  return load.apply(this,arguments);
};`);
  try {
    for (const [name, engine, expected] of [['default', undefined, 'chromium'], ['chromium', 'chromium', 'chromium'], ['webkit', 'webkit', 'webkit'], ['empty', '', null], ['unknown', 'firefox', null]]) {
      const output = path.join(directory, name), env = { ...process.env, MENU_BROWSER_OUTPUT: output };
      delete env.MENU_BROWSER_ENGINE; delete env.MENU_BROWSER_EXECUTABLE;
      if (engine !== undefined) env.MENU_BROWSER_ENGINE = engine;
      const result = spawnSync(process.execPath, ['--require', hook, path.join(root, 'scripts/check-menu-layout-browser.cjs')], { cwd: directory, encoding: 'utf8', timeout: 5000, env });
      assert.equal(result.error, undefined, name + ' exits without hanging');
      assert.equal(result.status, 1, name + ' never reports a successful no-op');
      assert.deepEqual([...result.stdout.matchAll(/MENU_LAYOUT_LAUNCH:(\w+)/g)].map(match => match[1]), expected ? [expected] : [], name + ' validates before launch');
      const report = JSON.parse(fs.readFileSync(path.join(output, 'failure.json'), 'utf8'));
      assert.match(report.error, expected ? /intentional menu launch failure/ : /Empty or unknown menu review engine/);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('menu layout CI requires both browser engines and actual evidence after the production build', () => {
  const source = fs.readFileSync(path.join(root, '.github/workflows/menu-layout-review.yml'), 'utf8');
  assert.match(source, /node-version: 22/);
  assert.match(source, /npm ci/); assert.match(source, /npm run build/);
  assert.match(source, /playwright install --with-deps chromium webkit/);
  assert.match(source, /node scripts\/check-menu-layout-browser\.cjs/);
  assert.match(source, /path: menu-browser-review\//);
  assert.match(source, /if-no-files-found: error/);
  assert.doesNotMatch(source, /MENU_BROWSER_ENGINE:/, 'the CI gate cannot silently select partial coverage');
});
