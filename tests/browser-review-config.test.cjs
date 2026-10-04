'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const marker='BROWSER_REVIEW_LAUNCH:';
const launchFailure='intentional browser-review launch failure';

function reviewCases(prefix,script,failureFile,cases){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'browser-review-config-'));
  const hook=path.join(directory,'playwright-hook.cjs'),failures=[];
  fs.writeFileSync(hook,`const Module=require('node:module'),load=Module._load;
Module._load=function(id){
  if(id==='playwright')return Object.fromEntries(['chromium','webkit'].map(engine=>[engine,{launch:async()=>{
    console.log(${JSON.stringify(marker)}+engine);throw Error(${JSON.stringify(launchFailure)});
  }}]));
  return load.apply(this,arguments);
};`);
  try{
    for(const [name,settings,engine,error] of cases){
      const cwd=path.join(directory,name),output=prefix==='BOON'?path.join(cwd,'boon-browser-review'):path.join(cwd,'output');
      fs.mkdirSync(cwd,{recursive:true});
      const env={...process.env};
      for(const key of Object.keys(env))if(/^(?:BOON|CAIRN|RATTUS)_(?:BROWSER|REVIEW)_/.test(key))delete env[key];
      if(prefix!=='BOON')Object.assign(env,{[prefix+'_REVIEW_DIST']:root,[prefix+'_REVIEW_OUTPUT']:output});
      Object.assign(env,settings);
      const result=spawnSync(process.execPath,['--require',hook,path.join(root,'scripts',script)],{
        cwd:prefix==='BOON'?cwd:root,encoding:'utf8',timeout:5000,env
      });
      const launches=Array.from((result.stdout||'').matchAll(/BROWSER_REVIEW_LAUNCH:(\w+)/g),match=>match[1]);
      const problems=[],check=fn=>{try{fn();}catch(cause){problems.push(cause.message);}};
      check(()=>assert.equal(result.error,undefined,'exits without timeout'));
      check(()=>assert.equal(result.status,1,'cannot report a successful no-op'));
      check(()=>assert.deepEqual(launches,engine?[engine]:[],engine?'valid configuration reaches the intended engine':'invalid configuration fails before browser launch'));
      check(()=>{
        const report=JSON.parse(fs.readFileSync(path.join(output,failureFile),'utf8'));
        assert.equal(typeof report.error,'string','failure evidence records the error');
        assert.match(report.error,error||new RegExp(launchFailure),'failure evidence preserves the intended cause');
      });
      if(problems.length)failures.push(name+' (exit='+result.status+', launches='+JSON.stringify(launches)+'): '+problems.join('; '));
    }
    assert.equal(failures.length,0,failures.join('\n'));
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
}

test('Boon browser review rejects empty or unknown engines before launch and records failures',()=>{
  reviewCases('BOON','check-boon-browser.cjs','failure.json',[
    ['default',{},'chromium'],
    ['chromium',{BOON_BROWSER_ENGINE:'chromium'},'chromium'],
    ['webkit',{BOON_BROWSER_ENGINE:'webkit'},'webkit'],
    ['unknown-engine',{BOON_BROWSER_ENGINE:'firefox'},null,/Empty or unknown browser engine/],
    ['empty-engine',{BOON_BROWSER_ENGINE:''},null,/Empty or unknown browser engine/]
  ]);
});

test('Cairn browser review validates effective groups before launch and records failures',()=>{
  reviewCases('CAIRN','check-cairn-combat-browser.cjs','failure-state.json',[
    ['default',{},'chromium'],
    ['primary',{CAIRN_BROWSER_GROUPS:'primary'},'chromium'],
    ['pair-only',{CAIRN_BROWSER_PAIR_ONLY:'1'},'chromium'],
    ['solo-only',{CAIRN_BROWSER_SOLO_ONLY:'1'},'chromium'],
    ['skip-idle',{CAIRN_BROWSER_SKIP_IDLE:'1'},'chromium'],
    ['empty-group',{CAIRN_BROWSER_GROUPS:''},null,/Empty or unknown verification group/],
    ['unknown-group',{CAIRN_BROWSER_GROUPS:'unknown'},null,/Empty or unknown verification group/],
    ['constructor-group',{CAIRN_BROWSER_GROUPS:'constructor'},null,/Empty or unknown verification group/],
    ['toString-group',{CAIRN_BROWSER_GROUPS:'toString'},null,/Empty or unknown verification group/],
    ['valueOf-group',{CAIRN_BROWSER_GROUPS:'valueOf'},null,/Empty or unknown verification group/],
    ['both-only',{CAIRN_BROWSER_PAIR_ONLY:'1',CAIRN_BROWSER_SOLO_ONLY:'1'},null,/PAIR_ONLY and SOLO_ONLY are mutually exclusive/],
    ['primary-excluded',{CAIRN_BROWSER_GROUPS:'primary',CAIRN_BROWSER_PAIR_ONLY:'1'},null,/No verification groups selected/],
    ['pair-excluded',{CAIRN_BROWSER_GROUPS:'pair',CAIRN_BROWSER_SOLO_ONLY:'1'},null,/No verification groups selected/],
    ['idle-excluded',{CAIRN_BROWSER_GROUPS:'idle',CAIRN_BROWSER_SKIP_IDLE:'1'},null,/No verification groups selected/]
  ]);
});

test('Rattus browser review rejects contradictory coverage flags before launch and records failures',()=>{
  reviewCases('RATTUS','check-rattus-combat-browser.cjs','failure-state.json',[
    ['default',{},'chromium'],
    ['pair-only',{RATTUS_BROWSER_PAIR_ONLY:'1'},'chromium'],
    ['solo-only',{RATTUS_BROWSER_SOLO_ONLY:'1'},'chromium'],
    ['both-only',{RATTUS_BROWSER_PAIR_ONLY:'1',RATTUS_BROWSER_SOLO_ONLY:'1'},null,/RATTUS_BROWSER_PAIR_ONLY and RATTUS_BROWSER_SOLO_ONLY are mutually exclusive/]
  ]);
});
