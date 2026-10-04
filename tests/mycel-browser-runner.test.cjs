'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

test('Mycel browser review reaches browser launch and fails closed without hanging',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mycel-browser-runner-'));
  const root=path.resolve(__dirname,'..'),hook=path.join(directory,'playwright-hook.cjs');
  fs.writeFileSync(hook,`const Module=require('node:module'),load=Module._load;
Module._load=function(id){
  if(id==='playwright')return Object.fromEntries(['chromium','webkit'].map(engine=>[engine,{launch:async()=>{
    console.log('MYCEL_LAUNCH:'+engine);throw Error('intentional browser launch failure');
  }}]));
  return load.apply(this,arguments);
};`);
  try{
    for(const [name,settings,launch] of [
      ['launch',{},true],
      ['unknown-engine',{MYCEL_BROWSER_ENGINES:'unknown'},false],
      ['empty-engine',{MYCEL_BROWSER_ENGINES:''},false],
      ['unknown-group',{MYCEL_BROWSER_GROUPS:'unknown'},false],
      ['empty-group',{MYCEL_BROWSER_GROUPS:''},false]
    ]){
      const output=path.join(directory,name);
      const result=spawnSync(process.execPath,['--require',hook,path.join(root,'scripts/check-mycel-combat-browser.cjs')],{
        cwd:root,encoding:'utf8',timeout:5000,
        env:{...process.env,MYCEL_REVIEW_DIST:root,MYCEL_REVIEW_OUTPUT:output,
          MYCEL_BROWSER_ENGINES:'chromium',MYCEL_BROWSER_GROUPS:'primary',...settings}
      });
      assert.equal(result.error,undefined,name+' exits without timeout');
      assert.equal(result.status,1,name+' cannot report a successful no-op');
      assert.equal(result.stdout.includes('MYCEL_LAUNCH:chromium'),launch,name+' reaches the expected stage');
      const report=JSON.parse(fs.readFileSync(path.join(output,'failure.json'),'utf8'));
      assert.match(report.error,launch?/intentional browser launch failure/:/Empty or unknown/);
    }
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
