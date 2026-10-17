const assert=require('node:assert/strict'),fs=require('node:fs');
const {spawn}=require('node:child_process'),{webkit,chromium}=require('playwright');
const port=8782,base=`http://127.0.0.1:${port}`;
const server=spawn(process.platform==='win32'?'python':'python3',['-m','http.server',String(port),'--directory',process.env.GUARDIANS_REVIEW_DIST||'dist'],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const names=['sprout-sentinel','dew-duke','thorn-duelist','spore-oracle','mossback','root-ram','silk-weaver','glass-snail','wick-hermit','tiara-head','frostjaw','spindle-widow','orchard-mimic','tuning-fork','moon-moth','kiln-beetle','ash-ferryman','compost-choir','seed-engine','hollow-crown'];
async function checkNativeRoles(page,engineName,errors){
 await page.goto(base+'/review.html?mode=native-enemies&portrait=1');
 await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.maxNativeRoleObservation,{},{timeout:15000});
 const game=page.frames().find(f=>f!==page.mainFrame());
 const status=await game.evaluate(()=>window.MaxNativeArt.ready());assert.deepEqual(status.failed,[]);
 await game.waitForFunction(()=>Object.keys(window.maxNativeRoleObservation().bodies).length===7,{},{timeout:5000});
 const observation=await game.evaluate(()=>window.maxNativeRoleObservation());
 assert.deepEqual(observation.roles,[3,4,5,6,9,10,11]);
 for(const kind of observation.roles){
  const {body}=observation.bodies[kind],cell=kind>=9?32:16;
  assert.equal(body.smoothing,false,'role '+kind+' preserves native pixels');
  assert.equal(body.rect.length,8);assert.deepEqual(body.rect.slice(2,4),[cell,cell]);assert.deepEqual(body.rect.slice(6),[cell,cell]);
  assert.ok(body.rect.every(Number.isInteger));
  if(kind>=9){assert.match(body.src,/\/assets\/enemies-v2\/sprites\.png$/);assert.equal(body.rect[1],({9:6,10:1,11:4})[kind]*32);assert.deepEqual(body.rect.slice(4,6),[-16,-31]);}
 }
 await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-native-roles-phone.png`});
 assert.deepEqual(errors,[]);console.log(engineName,'all seven role bodies draw decoded original native sprites on phone OK');
}
async function checkMasterStages(page,engineName,errors){
 for(let stage=1;stage<=20;stage++){
  await page.goto(base+'/review.html?mode=layout'+stage+'&portrait=1');
  await page.waitForFunction(()=>document.querySelector('#status').dataset.guardian&&document.querySelector('iframe')?.contentWindow?.maxMasterMapObservation,{},{timeout:15000});
  const game=page.frames().find(f=>f!==page.mainFrame());
  const observed=await game.evaluate(()=>window.maxMasterMapObservation()),layout=observed.layout;
  assert.equal(observed.world,stage);assert.equal(layout.stage,stage);assert.equal(layout.master,true);
  assert.equal(layout.source.fileKey,'TC0PHGMTCMR6im4hb3CSbF');assert.equal(layout.source.masterNodeId,'1433:22060');
  assert.equal(layout.source.art,'assets/master-source-v1/map.png');
  assert.deepEqual(layout.bounds,{x0:0,y0:0,x1:836,y1:561});
  assert.deepEqual(layout.platforms,[{id:'master-ground',x:0,y:380,w:836,h:181,solid:true,art:true}]);
  for(const key of ['routes','rewards','trials','bonuses','nodes','hazards','ladders','ponds'])assert.deepEqual(layout[key],[],key);
  assert.deepEqual(layout.spots,{});assert.equal(layout.guardianSites,undefined);
  for(const key of ['shrine','expedition','weather'])assert.equal(observed[key],null,key);
  for(const key of ['encounters','loot','hazards','plants'])assert.equal(observed[key],0,key);
  assert.ok(observed.seeds.every(seed=>seed.x>=0&&seed.x<=836&&!seed.guardianCache&&!seed.routeReward&&!seed.placeCache),'ordinary seeds stay within MASTER without retired campaign caches');
  assert.deepEqual(errors,[]);
  if(stage===1||stage===20)await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-master-${stage}-phone.png`});
 }
 console.log(engineName,'all twenty campaign stages use only the current empty MASTER geometry OK');
}
(async()=>{
 fs.mkdirSync('guardian-browser-review',{recursive:true});
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await pause(100);}
 const engines=process.argv.includes('--chromium-only')?{chromium}:{chromium,webkit};
 for(const [engineName,engine] of Object.entries(engines)){
  const browser=await engine.launch({headless:true,...(engineName==='chromium'&&process.env.GUARDIANS_CHROMIUM_EXECUTABLE?{executablePath:process.env.GUARDIANS_CHROMIUM_EXECUTABLE}:{})});
  try{
   const page=await browser.newPage({viewport:{width:1050,height:1030},deviceScaleFactor:1}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
   if(!process.argv.includes('--native-kits-only')){
   await checkNativeRoles(page,engineName,errors);
   await checkMasterStages(page,engineName,errors);
   if(process.argv.includes('--master-only'))continue;
   for(let stage=1;stage<=20;stage++){
    await page.goto(base+'/review.html?mode='+(stage===20?'boss':'boss'+stage));
    if(stage===20)await page.waitForURL('**/crown-review.html?**');
    const channel=stage===20?'state':'guardian';
    await page.waitForFunction(channel=>{
     const data=document.querySelector('#status')?.dataset[channel];
     if(!data)return false;
     const observed=JSON.parse(data);
     return channel==='guardian'||observed.ready&&observed.summoned&&observed.boss?.guardianStage===20;
    },channel,{timeout:15000});
    const game=page.frames().find(f=>f!==page.mainFrame());
    const art=await game.evaluate(()=>window.MaxNativeArt.load());assert.deepEqual(art.failed,[]);
    await page.waitForFunction(channel=>JSON.parse(document.querySelector('#status').dataset[channel]).boss?.windup>0,channel,{timeout:10000});
    const observed=JSON.parse(await page.locator('#status').getAttribute('data-'+channel));
    assert.equal(observed.boss.id,names[stage-1]);assert.ok(observed.boss.hp>0);
    if(stage===20){
     assert.equal(observed.world,20);assert.equal(observed.summoned,true);assert.equal(observed.boss.guardianStage,20);
     assert.equal(observed.shrine.stage,20);assert.equal(observed.shrine.status,'active');
     assert.ok(observed.boss.x>=observed.shrine.courtLeft&&observed.boss.x<=observed.shrine.courtRight);
     assert.ok(observed.art?.clip&&Number.isFinite(observed.art.top),'the real Crown warning draws loaded native artwork');
    }
    await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-${String(stage).padStart(2,'0')}.png`});
    assert.deepEqual(errors,[]);console.log(engineName,'guardian',stage,'native art + live warning OK');
   }
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
   }
   for(const [classId,primary] of [['runner','dropkick'],['bulwark','cairn-sweep'],['herbalist','mycel-dart'],['polge','jab']]){
    await page.goto(base+'/review.html?mode='+(classId==='herbalist'?'mycel':'class-kits')+'&portrait=1&class='+classId);
    await page.waitForFunction(()=>!!document.querySelector('#status').dataset.guardian,{},{timeout:15000});
    const beforePrimary=classId==='herbalist'?JSON.parse(await page.locator('#status').getAttribute('data-guardian')).combat:null;
    if(beforePrimary)assert.ok((beforePrimary.mycel?.culture||0)<4,'Mycel starts without prefilled Bloom stock');
    const game=page.frames().find(f=>f!==page.mainFrame());
    const art=await game.evaluate(()=>window.MaxNativeArt.load());assert.deepEqual(art.failed,[]);
    await page.getByRole('button',{name:'Game Attack',exact:true}).click();
    await page.waitForFunction(kind=>{const c=JSON.parse(document.querySelector('#status').dataset.guardian).combat;return c&&c.strikes[kind]>0;},primary,{timeout:4000});
    let observation=JSON.parse(await page.locator('#status').getAttribute('data-guardian'));
    assert.equal(observation.combat.classId,classId);assert.equal(observation.combat.bombPeak,0);
    if(classId==='herbalist')assert.ok(observation.combat.shotsCreated>0,'native projectile was created');
    else assert.equal(observation.combat.shotsCreated,0,'melee never creates a projectile');
    await page.waitForFunction(()=>{const c=JSON.parse(document.querySelector('#status').dataset.guardian).combat;return c.grounded&&c.attackCool<=0&&(c.classId!=='bulwark'||!c.phasePolicy?.blockBrace);},{},{timeout:3000});
    await game.evaluate(()=>window.focus());
    if(classId==='runner'){
     await page.keyboard.down('ArrowUp');
     try{
      await page.waitForFunction(()=>!JSON.parse(document.querySelector('#status').dataset.guardian).combat.grounded,{},{timeout:3000});
      await page.keyboard.press('b');
      await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.guardian).combat.strikes.salto>0,{},{timeout:3000});
     }finally{await page.keyboard.up('ArrowUp');}
     await page.waitForFunction(()=>{const c=JSON.parse(document.querySelector('#status').dataset.guardian).combat;return c.grounded&&c.attackCool<=0;},{},{timeout:3000});
    }
    if(classId==='bulwark'){
     // Brace moved to V; E now requires three genuinely earned Strata. The
     // dedicated Cairn gate verifies the paid Ridge and all contact budgets.
     await page.keyboard.press('v');
     await page.waitForFunction(()=>{
      const c=JSON.parse(document.querySelector('#status').dataset.guardian).combat;
      return c.cairn?.braceT>0&&c.cairn.utilityCool>0&&c.strikes['cairn-brace']>0&&c.cairnMotionCell;
     },{},{timeout:3000});
     const beforeRidgeData=await page.locator('#status').getAttribute('data-guardian'),beforeRidge=JSON.parse(beforeRidgeData).combat.cairn;
     assert.ok(beforeRidge.strata<3,'the native-kit fixture does not prefill Ridge plates');
     await page.keyboard.press('e');
     await page.waitForFunction(previous=>document.querySelector('#status').dataset.guardian!==previous,beforeRidgeData,{timeout:2000});
     const afterRidge=JSON.parse(await page.locator('#status').getAttribute('data-guardian')).combat;
     assert.ok(afterRidge.cairn.strata>=beforeRidge.strata,'an unaffordable Ridge never debits earned plates');
     assert.equal(afterRidge.cairn.ridgeSerial,beforeRidge.ridgeSerial,'a denied E never allocates a Ridge');
     assert.equal(afterRidge.cairn.ridgePhase,0);assert.equal(afterRidge.cairn.ridgeReserved,0);
     assert.equal(afterRidge.cairn.specialCool,0,'an unaffordable Ridge starts no cooldown');
     assert.ok(afterRidge.cairnMotionCell,'Brace retains the original native body pose');
    }else if(classId==='herbalist'){
     // Actual initial dart contact and current wet plants fund the new paid E.
     // No fixture grant, clock jump or callback replaces its ordinary pulses.
     await page.waitForFunction(previous=>{
      const c=JSON.parse(document.querySelector('#status').dataset.guardian).combat;
      return c.mycel?.culture>=.5&&c.targets.some(k=>{const old=previous.find(p=>p.id===k.id);return old&&k.hp<old.hp-.8;});
     },beforePrimary.targets,{timeout:4000});
     await page.waitForFunction(()=>{
      const c=JSON.parse(document.querySelector('#status').dataset.guardian).combat;
      return c.grounded&&c.body.st==='free'&&c.mycel?.culture>=4&&c.mycel.specialCool<=0&&c.phasePolicy.phase==='none';
     },{},{timeout:12000});
     const beforeBloom=JSON.parse(await page.locator('#status').getAttribute('data-guardian')).combat,beforeBloomAt=Date.now();
     await page.keyboard.press('e');
     await page.waitForFunction(serial=>{
      const c=JSON.parse(document.querySelector('#status').dataset.guardian).combat;
      return c.mycel?.bloom?.serial>serial&&c.mycel.specialCool>0&&(c.mycel.bloom.pulseMask&1)&&c.strikes['mycel-bloom']>0;
     },beforeBloom.mycel.bloom?.serial||0,{timeout:4000});
     const afterBloom=JSON.parse(await page.locator('#status').getAttribute('data-guardian')).combat;
     const maximumPassive=(Date.now()-beforeBloomAt)/1000+.1;
     assert.ok(afterBloom.mycel.culture<=beforeBloom.mycel.culture-4+maximumPassive,'accepted Bloom pays four; only real bounded passive generation follows');
     assert.equal(afterBloom.mycel.bloom.x,beforeBloom.body.x,'Bloom keeps its accepted center');
     assert.equal(afterBloom.mycel.bloom.y,beforeBloom.body.y-12);
     assert.ok(afterBloom.targets.some(k=>k.mycelEvents?.mycelBloomEvents.some(e=>e.serial===afterBloom.mycel.bloom.serial&&(e.mask&1)))||afterBloom.mycel.bloom.plots.some(p=>p.healthUsed>0||p.waterUsed>0),'the first ordinary host pulse has a real consumed target or plot debt');
    }else{
     await page.keyboard.press('e');
     await page.waitForFunction(id=>{
     const c=JSON.parse(document.querySelector('#status').dataset.guardian).combat;
     return c.skillCool>0&&(id==='runner'?c.strikes.splits>0:c.strikes.flurry>0);
     },classId,{timeout:5000});
    }
    observation=JSON.parse(await page.locator('#status').getAttribute('data-guardian'));
    assert.equal(observation.combat.bombPeak,0,'native specials never place bombs');
    if(classId==='polge'||classId==='runner')assert.equal(observation.combat.shotsCreated,0,'close specials stay melee');
    await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-${classId}-native-kit.png`});
    assert.deepEqual(errors,[]);console.log(engineName,classId,classId==='bulwark'?'parent Attack, keyboard Brace and unpaid Ridge rejection OK':classId==='herbalist'?'real Dart contact, naturally earned Culture and paid host Bloom pulse OK':'parent Attack control and keyboard special OK');
   }
   if(process.argv.includes('--native-kits-only'))continue;
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
    const bounds=await boonFrame.locator('#perkMenu button:not([data-redraw])').evaluateAll((buttons,player)=>buttons.map(b=>{
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
   await boonFrame.locator('#perkMenu button:not([data-redraw])').first().click();
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
