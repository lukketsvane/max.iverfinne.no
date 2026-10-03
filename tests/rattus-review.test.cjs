const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const layout=require('../stage-layout.js');

async function fixture(){
 const html=fs.readFileSync(require.resolve('../review.html'),'utf8');
 const game=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const dom=new JSDOM(html,{url:'http://localhost/review.html?mode=runner',runScripts:'outside-only'}),w=dom.window;
 w.MaxStageLayout=layout;w.fetch=async()=>({text:async()=>game});
 w.localStorage.setItem('real-player-marker','retained');
 const messages=[];w.document.querySelector('iframe').contentWindow.postMessage=data=>messages.push(data);
 const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('async function'));
 await w.eval(script);return {dom,w,messages};
}

test('runner review compiles real runtime, preserves storage isolation and never precredits Momentum',async()=>{
 const {dom,w}=await fixture();try{
  const html=w.document.querySelector('iframe').srcdoc;
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/type=["']module/.test(match[1])&&match[2].trim())new vm.Script(match[2]);
  assert.equal(w.document.getElementById('review-class').value,'runner');
  assert.match(html,/Object\.defineProperty\(window,'localStorage',\{value:storage/);
  assert.match(html,/wrestlingTrial/);assert.match(html,/rattusCaptureWrestler\(observedWrestler\)/);
  assert.doesNotMatch(html.slice(html.indexOf('"MAX_REVIEW_FIXTURE_START"')),/momentum\s*[:=]\s*(?:40|50|100)/);
  assert.equal(w.localStorage.getItem('real-player-marker'),'retained');
 }finally{dom.window.close();}
});

test('review held Driving releases once and drag-out cancels through ordinary blur rather than committing',async()=>{
 const {dom,w,messages}=await fixture();try{
  const b=w.document.querySelector('#review-input [data-key="v"]');
  b.setPointerCapture=()=>{};b.getBoundingClientRect=()=>({left:0,right:80,top:0,bottom:40});
  const event={button:0,pointerId:9,clientX:20,clientY:20,preventDefault(){}};
  b.onpointerdown(event);assert.equal(messages.at(-1).key,'v');assert.equal(messages.at(-1).down,true);
  await new Promise(resolve=>setTimeout(resolve,110));
  assert.equal(messages.length,1,'held utility has no automatic 80 ms tap release');
  b.onpointerup(event);assert.equal(messages.length,2);assert.equal(messages.at(-1).down,false);assert.equal(messages.at(-1).cancel,false);
  b.onlostpointercapture();assert.equal(messages.length,2,'capture cleanup cannot duplicate a release');
  b.onpointerdown(event);b.onpointermove({...event,clientX:81});
  assert.equal(messages.at(-1).cancel,true);assert.equal(b.getAttribute('aria-pressed'),'false');
  b.onpointerup(event);assert.equal(messages.length,4,'drag-out cannot later commit the same hold');
  const c=w.document.querySelector('#review-input [data-key="c"]');c.setPointerCapture=()=>{};
  c.onpointerdown(event);c.onpointercancel();assert.equal(messages.at(-1).key,'c');assert.equal(messages.at(-1).cancel,true);
 }finally{dom.window.close();}
});
