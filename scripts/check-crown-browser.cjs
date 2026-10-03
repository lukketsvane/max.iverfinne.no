'use strict';
// Uses the memory-only fixture and normal game key events. No production API.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const port=Number(process.env.CROWN_REVIEW_PORT)||8783,base=`http://127.0.0.1:${port}`;
const output=process.env.CROWN_REVIEW_OUTPUT||'crown-browser-review';
const server=spawn('python3',['-m','http.server',String(port),'--directory','dist'],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
async function state(page){return page.locator('#status').evaluate(n=>n.dataset.state?JSON.parse(n.dataset.state):null);}
async function ready(page){
 await page.waitForFunction(()=>{const n=document.querySelector('#status');return n.dataset.error||n.dataset.state&&JSON.parse(n.dataset.state).ready;},{},{timeout:25000});
 assert.equal(await page.locator('#status').getAttribute('data-error'),null,await page.locator('#status').innerText());
 const s=await state(page);assert.equal(s.summoned,true);assert.equal(s.world,20);assert.equal(s.view.smoothing,false);
 if(s.boss)assert.equal(s.boss.guardianStage,20);
 return s;
}
async function capture(page,name){
 const s=await state(page);await page.locator('iframe').screenshot({path:path.join(output,name+'.png')});
 fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(s,null,2)+'\n');return s;
}
async function actualVictory(page,engine){
 await page.goto(base+'/crown-review.html?class=bulwark&difficulty=easy&build=campaign',{waitUntil:'load'});await ready(page);
 const phases=[],began=Date.now(),set=async(name,on)=>{const b=page.getByRole('button',{name:'Game '+name,exact:true});if((await b.getAttribute('aria-pressed')==='true')!==on)await b.click();};
 for(;Date.now()-began<60000;){
  const s=await state(page);
  if(s.won){
   assert.deepEqual(phases,[1,2,3,4]);assert.equal(s.shrine.status,'defeated');assert.ok(s.plants.some(p=>!p.dead&&p.health>0));
   await capture(page,engine+'-actual-victory');
   fs.writeFileSync(path.join(output,engine+'-actual-fight.json'),JSON.stringify({phases,seconds:s.elapsed,state:s},null,2)+'\n');
   return;
  }
  assert.equal(s.ended,false,'actual fight must reach victory');
  if(!s.boss){await pause(100);continue;}
  if(phases.at(-1)!==s.boss.phase){phases.push(s.boss.phase);await capture(page,engine+'-actual-act-'+s.boss.phase);}
  const node=(s.boss.phase===2?s.boss.nodes:[]).filter(n=>n.hp>0).sort((a,b)=>Math.abs(a.x-s.player.x)-Math.abs(b.x-s.player.x))[0];
  const delta=(node?node.x:s.boss.x)+18-s.player.x;
  await set('Left',delta<-7);await set('Right',delta>7);
  await page.getByRole('button',{name:'Game Attack',exact:true}).click();await pause(250);
 }
 throw new Error('Actual input fight failed to defeat all four acts within 60 seconds.');
}
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await pause(100);}
 const engines=process.argv.includes('--chromium-only')?{chromium}:{chromium,webkit};
 for(const [name,engine]of Object.entries(engines)){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1240,height:1120},deviceScaleFactor:1}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
   await page.goto(base+'/crown-review.html',{waitUntil:'load'});let s=await ready(page);
   assert.equal(s.boss.phase,1);assert.ok(s.plants.some(p=>p.growth>.12&&p.growth<.5&&p.health>0));
   const game=page.frames().find(f=>f!==page.mainFrame());
   assert.deepEqual((await game.evaluate(()=>window.MaxNativeArt.load())).failed,[]);
   await page.getByRole('button',{name:'Pause review',exact:true}).click();
   await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.state).paused);
   await capture(page,name+'-arrival-desktop');
   for(const [label,phase]of [['I · Sovereign',1],['II · Seals',2],['III · Ascendant',3],['IV · Dethroned',4]]){
    await page.locator('details').evaluate(n=>n.open=true);
    await page.getByRole('button',{name:'Demonstrate '+label,exact:true}).click();await ready(page);
    await page.waitForFunction(phase=>JSON.parse(document.querySelector('#status').dataset.state).boss?.phase===phase,phase);
    await page.getByRole('button',{name:'Pause review',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.state).paused);
    s=await capture(page,name+'-act-'+phase);assert.equal(s.boss.phase,phase);
    if(phase===4)assert.ok(s.art.clip.startsWith('wounded/'),'last stand must draw the separate weaponless bank');
    if(phase===2||phase===4)assert.equal(s.boss.nodes.length,3);
   }
   for(const kind of ['hammer-warning','hammer-slam','leap','lanes','wounded']){
    await page.goto(base+'/crown-review.html?capture='+kind,{waitUntil:'load'});await ready(page);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.state).paused,{},{timeout:8000});
    s=await capture(page,name+'-'+kind);
    assert.equal(s.capture,kind);assert.ok(s.boss.hp>0);
    if(kind==='hammer-warning')assert.ok(s.boss.windup>0);
    if(kind==='hammer-slam')assert.ok(s.boss.attackT>0);
    if(kind==='lanes')assert.ok(s.hazards.some(h=>h.type==='crown-lane'&&h.tell<=0));
    if(kind==='wounded')assert.equal(s.boss.phase,4);
    if(kind==='wounded')assert.ok(s.art.clip.startsWith('wounded/'));
   }
   const phone=await browser.newPage({viewport:{width:390,height:1250},isMobile:true,hasTouch:true,deviceScaleFactor:1});
   phone.on('pageerror',error=>errors.push(error.message));phone.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
   for(const phase of [1,2,3,4]){
    await phone.goto(base+'/crown-review.html?portrait=1&phase='+phase,{waitUntil:'load'});await ready(phone);
    await phone.getByRole('button',{name:'Pause review',exact:true}).click();await phone.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.state).paused);
    s=await capture(phone,name+'-act-'+phase+'-phone');
    assert.equal(s.view.width,390);assert.equal(s.view.height,844);assert.equal(s.boss.phase,phase);
    assert.ok(s.boss.screen.x>20*s.view.scale&&s.boss.screen.x<390-20*s.view.scale,'opaque boss body must be visible on phone');
    assert.ok(s.boss.screen.y>70*s.view.scale&&s.boss.screen.y<844-32*s.view.scale,'entire tall boss must be visible on phone');
    assert.ok(s.player.screen.x>=10*s.view.scale&&s.player.screen.x<=390-10*s.view.scale,'gardener must remain visible beside Crown');
   }
   await phone.close();
   await page.goto(base+'/crown-review.html?class=polge&difficulty=easy',{waitUntil:'load'});await ready(page);
   await page.getByRole('button',{name:'Game Dodge',exact:true}).click();await pause(500);await page.getByRole('button',{name:'Game Jump',exact:true}).click();
   await page.getByRole('button',{name:'Game Attack',exact:true}).click();await page.getByRole('button',{name:'Game Skill',exact:true}).click();
   await page.getByRole('button',{name:'Game Tend',exact:true}).click();await pause(450);await page.getByRole('button',{name:'Game Tend',exact:true}).click();
   await page.waitForFunction(()=>{const s=JSON.parse(document.querySelector('#status').dataset.state);return s.log.jumps>0&&s.log.dodges>0&&s.log.attackInputs>0&&s.log.tends>0;});
   s=await state(page);assert.equal(s.classId,'polge');assert.equal(s.difficulty,'easy');assert.ok(s.elapsed>0);assert.ok(s.log.dodgeFrames>0);assert.ok(s.log.maxJumpHeight>5);assert.ok(s.log.strikes>0);
   await actualVictory(page,name);
   for(const oldMode of ['boss','native-crown','final-boss']){
    await page.goto(base+'/review.html?mode='+oldMode+'&portrait=1',{waitUntil:'load'});await page.waitForURL('**/crown-review.html?**');await ready(page);
   }
   assert.deepEqual(errors,[]);results.push({engine:name,captures:19,actualVictory:true,errors,passed:true});console.log(name,'Crown: actual shrine, four acts, five attack captures, phone visibility, normal inputs, actual four-act victory and legacy routes OK');
  }finally{await browser.close();}
 }
 fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(results,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.kill());
