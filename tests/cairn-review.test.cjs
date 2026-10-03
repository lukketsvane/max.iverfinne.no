const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const layout=require('../stage-layout.js');

async function fixture(params=''){
 const html=fs.readFileSync(require.resolve('../review.html'),'utf8'),game=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const dom=new JSDOM(html,{url:'http://localhost/review.html?mode=cairn'+params,runScripts:'outside-only'}),w=dom.window,messages=[];
 w.MaxStageLayout=layout;w.fetch=async()=>({text:async()=>game});w.localStorage.setItem('real-player-marker','retained');
 w.document.querySelector('iframe').contentWindow.postMessage=data=>messages.push(data);
 const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('async function'));
 await w.eval(script);return {dom,w,messages};
}

test('Cairn review compiles normal runtime with real ground actors, pure observations and isolated saves',async()=>{
 const {dom,w}=await fixture();try{
  const html=w.document.querySelector('iframe').srcdoc;
  for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/type=["']module/.test(m[1])&&m[2].trim())new vm.Script(m[2]);
  assert.equal(w.document.getElementById('review-class').value,'bulwark');
  assert.match(html,/cairnRidgePlacement\(\)\.valid/);assert.match(html,/makeRat\(1,false,'common'\)/);assert.match(html,/makeKrek\(1,false,11\)/);
  assert.match(html,/cairnCaptureState\(observedCairn\)/);assert.match(html,/cairnPlacement:observedPlacement/);
  const hook=html.slice(html.indexOf('"MAX_REVIEW_FIXTURE_START"'));
  assert.doesNotMatch(hook,/strata\s*[:=]\s*[1-3]\b/,'the scene must earn its plates');
  assert.doesNotMatch(hook,/updateRat\s*=|ratMove\s*=|cairnProtection\s*=/,'actual AI and guard are not replaced');
  assert.equal(w.localStorage.getItem('real-player-marker'),'retained');
  assert.match(w.document.getElementById('fixture-help').textContent,/Start with zero plates/);
 }finally{dom.window.close();}
});

test('review Stone and Brace send normal independent tap keys without borrowing held Driving controls',async()=>{
 const {dom,w,messages}=await fixture('&boons=1');try{
  const c=w.document.querySelector('#review-input [data-key="c"]'),v=w.document.querySelector('#review-input [data-key="v"]');
  assert.equal(c.textContent,'Stone');assert.equal(v.textContent,'Brace');
  c.onclick({detail:1});v.onclick({detail:1});
  assert.deepEqual(messages.map(m=>[m.key,m.down]),[['c',true],['v',true]]);
  await new Promise(resolve=>setTimeout(resolve,110));
  assert.deepEqual(messages.slice(2).map(m=>[m.key,m.down]),[['c',false],['v',false]]);
  assert.match(w.document.getElementById('fixture-help').textContent,/All five Cairn boons enabled/);
 }finally{dom.window.close();}
});
