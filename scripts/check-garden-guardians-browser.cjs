// CI-only browser regression; isolated fixtures never join a live room.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {spawn}=require('node:child_process'),{webkit,chromium}=require('playwright');
const port=8782,base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['-m','http.server',String(port),'--directory','dist'],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const names=['sprout-sentinel','dew-duke','thorn-duelist','spore-oracle','mossback','root-ram','silk-weaver','glass-snail','wick-hermit','bellkeeper','frostjaw','spindle-widow','orchard-mimic','tuning-fork','moon-moth','kiln-beetle','ash-ferryman','compost-choir','seed-engine','hollow-crown'];
async function checkCircuit(page,engineName,errors){
 const observation=async()=>JSON.parse(await page.locator('#status').getAttribute('data-circuit'));
 const ready=async()=>page.waitForFunction(()=>{
  const data=document.querySelector('#status').dataset.circuit;return data&&JSON.parse(data).propsReady;
 },{},{timeout:15000});
 await page.goto(base+'/review.html?mode=circuit&portrait=1');await ready();
 const initial=await observation(),geometry=JSON.stringify(initial.geometry);
 assert.equal(initial.classId,'polge');assert.equal(initial.world,8);assert.equal(initial.seed,73);
 assert.equal(initial.geometry.family,'bell');assert.equal(initial.choice,-1);assert.equal(initial.active,false);
 assert.equal(initial.guards.length,0);assert.equal(initial.boonOpen,false);
 assert.ok(Math.abs(initial.player.x-initial.geometry.choices[0].x)<2);
 await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-circuit-bell-phone.png`});
 await page.getByRole('button',{name:'Game Tend',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.circuit).active,{},{timeout:4000});
 await page.getByRole('button',{name:'Game Tend',exact:true}).click();
 const warning=await observation();assert.equal(warning.choice,0);assert.equal(warning.spawned,0);
 assert.equal(warning.guards.length,0);assert.ok(warning.tell>0);
 await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-circuit-bell-warning.png`});
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.circuit).log.arrivals.length>0,{},{timeout:5000});
 const active=await observation(),arrival=active.log.arrivals[0];
 assert.ok(active.log.warnings[0].tell>=1.3,'the first ingress receives the full warning');
 assert.ok(arrival.warning.shownFor>=1.3,'a keeper never arrives early');
 assert.ok(Math.hypot(arrival.x-arrival.warning.x,arrival.y-arrival.warning.y)<8,'keeper arrives at its displayed marker');
 assert.equal(JSON.stringify(active.geometry),geometry,'combat preserves the generated geometry');
 await page.locator('#viewport').selectOption('landscape');
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.guardian).view.width===844,{},{timeout:3000});
 await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-circuit-bell-landscape.png`});
 const beforeLeaving=await observation(),a=beforeLeaving.geometry.arena;
 const key=beforeLeaving.player.x-a.left<a.right-beforeLeaving.player.x?'ArrowLeft':'ArrowRight';
 const game=page.frames().find(f=>f!==page.mainFrame());await game.evaluate(()=>window.focus());
 await page.keyboard.down('Shift');await page.keyboard.down(key);
 try{
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.circuit).failed,{},{timeout:18000});
 }finally{await page.keyboard.up(key);await page.keyboard.up('Shift');}
 const withdrawn=await observation();
 assert.equal(withdrawn.active,false);assert.equal(withdrawn.done,false);assert.equal(withdrawn.queued,0);
 assert.equal(withdrawn.tell,0);assert.equal(withdrawn.guards.length,0);assert.equal(withdrawn.log.rewards.length,0);
 assert.equal(withdrawn.boonOpen,false);assert.equal(withdrawn.ended,false);assert.ok(withdrawn.away>=4);
 assert.equal(JSON.stringify(withdrawn.geometry),geometry);
 await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-circuit-withdrawn.png`});
 // Other court families use the same state machine; inspect their own native
 // landmarks without repeating the full combat sequence for each seed.
 for(const [seed,family] of [[8,'arch'],[3,'pump']]){
  await page.goto(base+'/review.html?mode=circuit&portrait=1&seed='+seed);await ready();
  const variant=await observation();assert.equal(variant.geometry.family,family);assert.equal(variant.active,false);
  await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-circuit-${family}-phone.png`});
 }
 assert.deepEqual(errors,[]);console.log(engineName,'circuit native props, Tend commitment, warned ingress, fixed geometry and real-input withdrawal OK');
}
(async()=>{
 fs.mkdirSync('guardian-browser-review',{recursive:true});
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await pause(100);}
 for(const [engineName,engine] of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1050,height:1030},deviceScaleFactor:1}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
   await checkCircuit(page,engineName,errors);
   if(process.argv.includes('--circuit-only'))continue;
   for(let stage=1;stage<=20;stage++){
    await page.goto(base+'/review.html?mode='+(stage===20?'boss':'boss'+stage));
    await page.waitForFunction(()=>!!document.querySelector('#status').dataset.guardian,{},{timeout:15000});
    const game=page.frames().find(f=>f!==page.mainFrame());
    const art=await game.evaluate(()=>window.MaxNativeArt.load());assert.deepEqual(art.failed,[]);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.guardian).boss?.windup>0,{},{timeout:10000});
    const observed=JSON.parse(await page.locator('#status').getAttribute('data-guardian'));
    assert.equal(observed.boss.id,names[stage-1]);assert.ok(observed.boss.hp>0);
    await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-${String(stage).padStart(2,'0')}.png`});
    assert.deepEqual(errors,[]);console.log(engineName,'guardian',stage,'native art + live warning OK');
   }
   for(let stage=1;stage<=20;stage++)for(let site=0;site<3;site++){
    await page.goto(base+'/review.html?mode=layout'+stage+'&site='+site+'&portrait=1');
    await page.waitForFunction(()=>!!document.querySelector('#status').dataset.guardian,{},{timeout:15000});
    const observed=JSON.parse(await page.locator('#status').getAttribute('data-guardian'));
    assert.equal(observed.sites.length,3);assert.equal(new Set(observed.sites.map(s=>s.id)).size,3);
    assert.equal(observed.shrine.siteId,observed.sites[site].id);
    assert.equal(observed.shrine.siteIndex,site);assert.ok(Math.abs(observed.shrine.x-observed.entrance.x)+Math.abs(observed.shrine.y-observed.entrance.y)>=160,'shrine requires exploring away from the entrance');
    await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-shrine-${stage}-${site}.png`});
    assert.deepEqual(errors,[]);
   }
   console.log(engineName,'all sixty authored shrine destinations render away from their entrances OK');
   for(const stage of [1,2]){
    await page.goto(base+'/review.html?mode=layout'+stage+'&ladder=0&portrait=1&class=bulwark');
    await page.waitForFunction(()=>!!document.querySelector('#status').dataset.guardian,{},{timeout:15000});
    const first=JSON.parse(await page.locator('#status').getAttribute('data-guardian'));
    for(let ladder=0;ladder<first.ladders.length;ladder++){
     if(ladder){await page.goto(base+'/review.html?mode=layout'+stage+'&ladder='+ladder+'&portrait=1&class=bulwark');await page.waitForFunction(()=>!!document.querySelector('#status').dataset.guardian,{},{timeout:15000});}
     const game=page.frames().find(f=>f!==page.mainFrame());await game.evaluate(()=>window.focus());
     await page.keyboard.down('ArrowUp');
     await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.guardian).motion==='ladder',{},{timeout:3000});
     await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-ladder-${stage}-${ladder}.png`});
     await page.waitForFunction(index=>{const o=JSON.parse(document.querySelector('#status').dataset.guardian);return o.playerY<=o.ladders[index].top+2;},ladder,{timeout:10000});
     await page.keyboard.up('ArrowUp');assert.deepEqual(errors,[]);
    }
   }
   console.log(engineName,'all nine authored ladders climb with real Cairn keyboard input OK');
   for(const classId of ['mech']){
   await page.goto(base+'/review.html?mode=layout1&portrait=1&class='+classId);
   await page.waitForFunction(()=>!!document.querySelector('#status').dataset.guardian,{},{timeout:15000});
   const game=page.frames().find(f=>f!==page.mainFrame());await game.evaluate(()=>window.focus());
   await page.keyboard.down('b');await page.keyboard.down('ArrowRight');
   await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.guardian).x>8,{},{timeout:4000});
   await page.keyboard.up('b');
   await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.guardian).bombs.length===1,{},{timeout:2000});
   const placed=JSON.parse(await page.locator('#status').getAttribute('data-guardian')).bombs[0];
   assert.equal(placed.planted,true);assert.ok(placed.fuse>1);
   await page.keyboard.up('ArrowRight');
   await page.waitForFunction(()=>{const b=JSON.parse(document.querySelector('#status').dataset.guardian).bombs[0];return b&&b.fuse<.7;},{},{timeout:2000});
   const ticking=JSON.parse(await page.locator('#status').getAttribute('data-guardian')).bombs[0];
   assert.equal(ticking.x,placed.x);assert.equal(ticking.y,placed.y);
   await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-${classId}-fuse.png`});
   await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.guardian).bombs.length===0,{},{timeout:2000});
   assert.deepEqual(errors,[]);console.log(engineName,classId,'charge movement, stationary placement and delayed explosion OK');
   }
   // Attack through the parent review control, then use the real keyboard for
   // the special. Cumulative real effects avoid short-frame races.
   for(const [classId,primary] of [['runner','needle'],['bulwark','cleave'],['herbalist','spore'],['polge','jab']]){
    await page.goto(base+'/review.html?mode=class-kits&portrait=1&class='+classId);
    await page.waitForFunction(()=>!!document.querySelector('#status').dataset.guardian,{},{timeout:15000});
    const game=page.frames().find(f=>f!==page.mainFrame());
    const art=await game.evaluate(()=>window.MaxNativeArt.load());assert.deepEqual(art.failed,[]);
    await page.getByRole('button',{name:'Game Attack',exact:true}).click();
    await page.waitForFunction(kind=>{const c=JSON.parse(document.querySelector('#status').dataset.guardian).combat;return c&&c.strikes[kind]>0;},primary,{timeout:4000});
    let observation=JSON.parse(await page.locator('#status').getAttribute('data-guardian'));
    assert.equal(observation.combat.classId,classId);assert.equal(observation.combat.bombPeak,0);
    if(classId==='runner'||classId==='herbalist')assert.ok(observation.combat.shotsCreated>0,'native projectile was created');
    else assert.equal(observation.combat.shotsCreated,0,'melee never creates a projectile');
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.guardian).combat.grounded,{},{timeout:3000});
    await game.evaluate(()=>window.focus());
    await page.keyboard.press('e');
    await page.waitForFunction(id=>{
     const c=JSON.parse(document.querySelector('#status').dataset.guardian).combat;
     return c.skillCool>0&&(id==='runner'?c.cues.slam>0:id==='bulwark'?c.cues.brace>0||c.cues.parry>0:id==='herbalist'?c.cues.bloom>0||c.cues.revive>0:c.strikes.flurry>0);
    },classId,{timeout:5000});
    observation=JSON.parse(await page.locator('#status').getAttribute('data-guardian'));
    assert.equal(observation.combat.bombPeak,0,'native specials never place bombs');
    if(classId==='polge')assert.equal(observation.combat.shotsCreated,0,'boxing special stays melee');
    await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-${classId}-native-kit.png`});
    assert.deepEqual(errors,[]);console.log(engineName,classId,'parent Attack control and keyboard special OK');
   }
   await page.goto(base+'/review.html?mode=boons&portrait=1');
   await page.waitForFunction(()=>!!document.querySelector('#status').dataset.state,{},{timeout:15000});
   const boonFrame=page.frames().find(f=>f!==page.mainFrame());
   for(const viewport of ['phone','small','landscape','compact']){
    await page.locator('#viewport').selectOption(viewport);
    await page.waitForFunction(name=>{
     const view=JSON.parse(document.querySelector('#status').dataset.guardian).view;
     return view.width===({phone:390,small:320,landscape:844,compact:568})[name];
    },viewport,{timeout:3000});
    const player=JSON.parse(await page.locator('#status').getAttribute('data-guardian')).view.player;
    const bounds=await boonFrame.locator('#perkMenu button').evaluateAll((buttons,player)=>buttons.map(b=>{
     const r=b.getBoundingClientRect(),n=b.querySelector('strong'),d=b.querySelector('small');
     return {name:n?.textContent,description:d?.textContent,nameVisible:getComputedStyle(n).display!=='none',descriptionVisible:getComputedStyle(d).display!=='none',inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,overflow:b.scrollWidth>b.clientWidth,overlapsPlayer:r.left<player.right&&r.right>player.left&&r.top<player.bottom&&r.bottom>player.top};
    }),player);
   assert.equal(bounds.length,3);
    await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-boons-${viewport}.png`});
    assert.ok(bounds.every(b=>b.name&&b.description&&b.nameVisible&&b.descriptionVisible&&b.inside&&!b.overflow&&!b.overlapsPlayer),JSON.stringify({viewport,player,bounds}));
   }
   assert.match(await boonFrame.locator('#perkMenu').innerText(),/Unlocks Chain bloom/);
   const before=JSON.parse(await page.locator('#status').getAttribute('data-state')).elapsed;
   await page.waitForFunction(t=>JSON.parse(document.querySelector('#status').dataset.state).elapsed>t,before,{timeout:3000});
   await boonFrame.locator('#perkMenu button').first().click();
   await boonFrame.locator('#perkMenu').waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);console.log(engineName,'readable live boon choices fit four phone orientations and select OK');
   await page.goto(base+'/guardian-motion-review.html');
   await page.waitForFunction(()=>document.querySelector('#status').dataset.ready==='true',{},{timeout:15000});
   for(const action of ['idle','move','windup','attack','recover','vulnerable','hurt','death']){
    await page.locator('#action').selectOption(action);
    const samples=[];
    for(let frame=0;frame<4;frame++){
     await page.waitForTimeout(160);
     samples.push(await page.locator('canvas').evaluate(c=>c.toDataURL()));
    }
    assert.ok(new Set(samples).size>=2,engineName+' '+action+' must visibly animate');
    await page.locator('canvas').screenshot({path:`guardian-browser-review/${engineName}-motion-${action}.png`});
   }
   assert.deepEqual(errors,[]);console.log(engineName,'all sixteen guardians animate in all eight actions OK');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.kill());
