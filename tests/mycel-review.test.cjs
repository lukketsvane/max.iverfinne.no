const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const layout=require('../stage-layout.js');

async function fixture(params=''){
 const html=fs.readFileSync(require.resolve('../review.html'),'utf8'),game=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const dom=new JSDOM(html,{url:'http://localhost/review.html?mode=mycel'+params,runScripts:'outside-only'}),w=dom.window,messages=[];
 w.MaxStageLayout=layout;w.fetch=async()=>({text:async()=>game});w.localStorage.setItem('real-player-marker','retained');
 w.document.querySelector('iframe').contentWindow.postMessage=data=>messages.push(data);
 const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('async function'));
 await w.eval(script);return {dom,w,messages};
}

test('Mycel review compiles ordinary runtime with a real empty-resource garden and pure source observations',async()=>{
 const {dom,w}=await fixture();try{
  const html=w.document.querySelector('iframe').srcdoc;
  for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/type=["']module/.test(m[1])&&m[2].trim())new vm.Script(m[2]);
  assert.equal(w.document.getElementById('review-class').value,'herbalist');
  const start=html.indexOf('var mycelOrigin='),end=html.indexOf('var classBoon=',start),scene=html.slice(start,end);
  assert.match(scene,/mycelCloudPlacement\(\{x:P\.x\+48,y:P\.y-12\}\)\.valid/);
  assert.match(scene,/seed:199\+i\*37/,'revivable identity uses an exact uint32 seed');
  assert.match(scene,/recordGardenPlant\(p\);if\(i===2\)plantFalls\(p\)/,'the actual current object gets the retained-stub lifecycle');
  assert.match(scene,/makeKrek\(1,false,0\)/);assert.match(scene,/combatLineClear\(P\.x,P\.y-12,x,y\)/);
  assert.doesNotMatch(scene,/culture\s*[:=]|mycelState\s*\(|updateFloatKrek\s*=|moveEnemyTo\s*=/,'real hits, generation and enemy AI stay authoritative');
  assert.match(html,/mycelCaptureState\(observedMycel\)/);assert.match(html,/mycelNetwork\(\)\.map/);assert.match(html,/mycelCapturePestEvents\(k\)/);
  assert.match(html,/initialRewardConsumed:s\.initialRewardConsumed/);assert.match(html,/mycelBurnSerial/);assert.match(html,/growth:p\.growth/);
  assert.equal(w.localStorage.getItem('real-player-marker'),'retained');assert.match(w.document.getElementById('fixture-help').textContent,/Start with zero Culture/);
 }finally{dom.window.close();}
});

test('Cloud and Drift are independent normal taps, and the plant-free full build remains selectable',async()=>{
 const {dom,w,messages}=await fixture('&boons=1&network=none&stage=20');try{
  const c=w.document.querySelector('#review-input [data-key="c"]'),v=w.document.querySelector('#review-input [data-key="v"]');
  assert.equal(c.textContent,'Cloud');assert.equal(v.textContent,'Drift');
  c.onclick({detail:1});v.onclick({detail:1});assert.deepEqual(messages.map(m=>[m.key,m.down]),[['c',true],['v',true]]);
  await new Promise(resolve=>setTimeout(resolve,110));assert.deepEqual(messages.slice(2).map(m=>[m.key,m.down]),[['c',false],['v',false]]);
  const html=w.document.querySelector('iframe').srcdoc;assert.ok(/if\(!true\)\{\s*\[-16,26,-34\]/.test(html));assert.ok(/if\(20!==1\)enterLevel\(20\)/.test(html),'stage20 uses the real campaign entry');
  const help=w.document.getElementById('fixture-help').textContent;assert.match(help,/Plant-free setup/);assert.match(help,/All five Mycel boons enabled/);assert.match(help,/caps stay absolute/);
 }finally{dom.window.close();}
});
