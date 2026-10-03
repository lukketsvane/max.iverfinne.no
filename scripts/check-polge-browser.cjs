'use strict';

// Arrange deterministic enemies in the review fixture, then exercise the real
// input handlers, physics, combat and co-op validation in an actual browser.
// The probe is injected into HTTP responses and never ships in the game.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist');
const output=path.resolve(process.env.POLGE_REVIEW_OUTPUT||'polge-browser-review');
const engines=(process.env.POLGE_BROWSER_ENGINES||'chromium,webkit').split(',');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css','.webmanifest':'application/manifest+json'};
const probe=`
var polgeBrowserFx=[],polgeBrowserBodies={},polgeBrowserOriginalFx=combatFx,polgeBrowserOriginalImage=ctx.drawImage;
combatFx=function(kind,x,y,r,face,combo){polgeBrowserFx.push({kind,x,y,r,bodyX:P.x,bodyY:P.y,owner:skillOwner()});return polgeBrowserOriginalFx(kind,x,y,r,face,combo);};
ctx.drawImage=function(image){
  if(P.skin==='polge'&&image&&image.src&&image.src.indexOf('/max-skins-v1/polge/')>=0){
    var ownFx=booms.slice().reverse().find(function(b){return b.owner===(P.evoKey||skillOwner())&&b.t<.24&&['jab','cross','uppercut','clinch','flurry','finisher'].indexOf(b.strike)>=0;});
    var kind=ownFx?ownFx.strike:P.dodgeT>0||P.dodging?'slip':'idle';
    polgeBrowserBodies[kind]={source:image.src.split('/').pop(),rect:Array.prototype.slice.call(arguments,1)};
  }
  return polgeBrowserOriginalImage.apply(this,arguments);
};
window.__polgeBrowser={
  get player(){return P;},get fighter(){return fighterState();},get enemies(){return floatKrek;},get plots(){return gardenPlots;},get coop(){return coop;},get canvas(){return cv;},
  get state(){return {player:{x:P.x,y:P.y,grounded:P.grounded,wet:P.wet,st:P.st,skin:P.skin,dodgeT:P.dodgeT,dodgeCool:P.dodgeCool,skillCool:P.skillCool},fighter:Object.assign({},fighterState()),attackCool:bombCool,bombs:bombs.length,shots:classShots.length,fx:polgeBrowserFx.slice(),bodies:Object.assign({},polgeBrowserBodies),targets:floatKrek.map(function(k){return {x:k.x,y:k.y,hp:k.hp};}),plants:gardenPlots.map(function(p){return {x:p.x,health:p.health,moisture:p.moisture};}),hazards:runHazards.map(function(h){return Object.assign({},h);})};},
  begin:beginCoop,capture:coopCapture,stateIn:coopState,input:coopInput,avatar:coopAvatar,
  arrange:function(kind){
    clearRunInput();classFighters=[];classShots=[];bombs=[];booms=[];polgeBrowserFx=[];runHazards=[];
    P.x=levelOriginX(1);P.y=surfaceY(P.x);P.vx=P.vy=0;P.grounded=true;P.wet=false;P.st='free';P.face=1;P.dodgeT=P.dodgeCool=P.skillCool=P.secondaryCool=0;P.hurt=0;bombCool=0;
    floatKrek=[];runEncounters=[];gardenRaidActive=false;krekSpawnT=60;gardenRaidT=60;
    gardenPlots.forEach(function(p){p.health=.55;p.moisture=.4;});
    if(kind==='empty')return;
    var e={id:901,x:P.x,y:P.y,type:'cache',cost:0,active:true,done:false,locked:false,progress:0,duration:75,guardsRemaining:0,age:0,away:0};runEncounters=[e];
    var k=makeKrek(1,false,0);Object.assign(k,{x:P.x+12,y:P.y-12,vx:0,vy:0,hp:100,maxHp:100,scout:false,trialGuard:true,eventId:e.id,eventX:e.x,eventY:e.y,bite:kind==='warning'?0:60,hitStaggerCooldown:60});floatKrek.push(k);
    if(kind==='moving'){var distant=makeKrek(1,false,0);Object.assign(distant,{x:P.x+72,y:P.y-12,vx:0,vy:0,hp:100,maxHp:100,scout:false,trialGuard:true,eventId:e.id,eventX:e.x+72,eventY:e.y,bite:60,hitStaggerCooldown:60});floatKrek.push(distant);}
  },
  close:function(){var k=floatKrek[0];if(k)Object.assign(k,{x:P.x+12,y:P.y-12,vx:0,vy:0,flee:0,windup:0,bite:60,hitStaggerCooldown:60});},
  distant:function(){floatKrek.forEach(function(k){k.x=P.x+160;k.y=P.y-12;k.vx=k.vy=0;k.flee=0;k.windup=0;k.bite=60;});},
  plantHere:function(){var p=gardenPlots[0];if(p){p.x=P.x;p.health=.55;p.moisture=.4;}},
  airborne:function(){P.y-=35;P.grounded=false;P.vy=-30;},
  clearFx:function(){polgeBrowserFx=[];}
};
`;
const serve=http.createServer((req,res)=>{
  try{
    const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(requested.endsWith('/')?requested+'index.html':requested));
    if(!file.startsWith(root+path.sep))throw Error('Path outside build');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  }catch{res.writeHead(404);res.end();}
});
let browser,activePage,activeGame;
async function state(frame){return frame.evaluate(()=>window.__polgeBrowser.state);}
async function press(page,frame,key){await frame.evaluate(()=>window.focus());await page.keyboard.press(key);}
async function ready(page){
  await page.waitForFunction(()=>document.querySelector('#status').dataset.guardian,{},{timeout:15000});
  const frame=page.frames().find(f=>f!==page.mainFrame());
  assert.ok(frame,'review iframe renders');
  assert.deepEqual((await frame.evaluate(()=>window.MaxNativeArt.load())).failed,[],'native assets load');
  return frame;
}
async function testKit(page,game,engineName,upgraded){
  const label=upgraded?'boons':'base',results=[];
  await game.evaluate(()=>window.__polgeBrowser.arrange('near'));
  const damage=[];
  for(const expected of ['jab','cross','uppercut']){
    await game.waitForFunction(()=>window.__polgeBrowser.state.attackCool<=0);
    await game.evaluate(()=>window.__polgeBrowser.close());
    const before=await state(game);await press(page,game,'b');
    await game.waitForFunction(kind=>window.__polgeBrowser.state.fx.some(f=>f.kind===kind),expected);
    const after=await state(game);damage.push(before.targets[0].hp-after.targets[0].hp);
    assert.ok(after.targets[0].hp<before.targets[0].hp,expected+' is confirmed contact');
  }
  let s=await state(game);assert.equal(s.fighter.rhythm,3);assert.ok(damage[2]>damage[0]*2);
  assert.deepEqual(s.fx.map(f=>f.kind),['jab','cross','uppercut']);
  results.push('Real B input: jab, cross, uppercut, three confirmed Rhythm and stronger finisher');
  await game.evaluate(()=>{window.__polgeBrowser.close();window.__polgeBrowser.clearFx();});
  const beforeClinch=await state(game);
  if(upgraded)await game.getByRole('button',{name:'Clinch break (C)',exact:true}).tap();
  else await press(page,game,'c');
  await game.waitForFunction(()=>window.__polgeBrowser.state.fx.some(f=>f.kind==='clinch'));
  s=await state(game);assert.equal(s.fighter.rhythm,2);assert.ok(s.fighter.clinchCool>3);assert.ok(s.targets[0].hp<beforeClinch.targets[0].hp);
  await page.locator('iframe').screenshot({path:path.join(output,engineName+'-'+label+'-clinch.png')});
  results.push((upgraded?'Touch Clinch button':'Real C input')+': clinch spends one Rhythm, damages close enemy and starts cooldown');

  await game.evaluate(()=>window.__polgeBrowser.arrange('empty'));
  await press(page,game,'b');await game.waitForFunction(()=>window.__polgeBrowser.state.attackCool<=0);
  const missed=await state(game);await press(page,game,'b');
  s=await state(game);assert.equal(s.fighter.rhythm,0);assert.equal(s.fighter.combo,missed.fighter.combo);
  await press(page,game,'e');s=await state(game);assert.equal(s.player.skillCool,0);assert.equal(s.fighter.flurry,0);
  await press(page,game,'x');await game.waitForFunction(()=>window.__polgeBrowser.player.dodgeT>0);
  s=await state(game);assert.equal(s.fighter.counter,0,'unthreatened slip cannot prime a counter');
  await game.waitForFunction(()=>window.__polgeBrowser.player.dodgeT===0);
  results.push('Whiffs preserve combo; empty skill does not spend cooldown; empty slip gives no counter');

  await game.evaluate(()=>{window.__polgeBrowser.arrange('empty');window.__polgeBrowser.airborne();});
  await press(page,game,'x');s=await state(game);assert.equal(s.player.dodgeT,0);assert.equal(s.fighter.slip,0);
  results.push('Ground slip refuses while airborne');

  await game.evaluate(()=>window.__polgeBrowser.arrange('warning'));
  await game.waitForFunction(()=>window.__polgeBrowser.state.hazards.some(h=>h.tell>0),{},{timeout:3000});
  await page.locator('iframe').screenshot({path:path.join(output,engineName+'-'+label+'-warning.png')});
  // Input on the last warned frames keeps the actual hit inside the short slip.
  await game.waitForFunction(()=>window.__polgeBrowser.state.hazards.some(h=>h.tell>0&&h.tell<.055),{},{timeout:3000});
  await press(page,game,'x');
  await game.waitForFunction(()=>window.__polgeBrowser.fighter.counter>0,{},{timeout:1500});
  await game.evaluate(()=>window.__polgeBrowser.close());
  await press(page,game,'b');await game.waitForFunction(()=>window.__polgeBrowser.fighter.counter===0);
  s=await state(game);assert.ok(s.targets[0].hp<100);assert.equal(s.fighter.rhythm,1);
  results.push('Authentic sentry warning: timed X avoids real contact and one landed B consumes counter');

  await game.evaluate(()=>{window.__polgeBrowser.arrange('near');window.__polgeBrowser.plantHere();});
  const plantBefore=(await state(game)).plants[0];await press(page,game,'e');
  await game.waitForFunction(()=>window.__polgeBrowser.state.fx.some(f=>f.kind==='finisher'),{},{timeout:2500});
  s=await state(game);assert.equal(s.fx.filter(f=>f.kind==='flurry').length,upgraded?9:6);assert.equal(s.fx.filter(f=>f.kind==='finisher').length,1);
  assert.equal(s.fighter.flurry,0);assert.ok(s.targets[0].hp<100);
  if(upgraded)assert.ok(s.plants[0].health>plantBefore.health+.1,'landed Second wind cares for nearby plant');
  else assert.ok(s.plants[0].health<plantBefore.health+.03,'base skill leaves only normal passive plant recovery');
  await page.locator('iframe').screenshot({path:path.join(output,engineName+'-'+label+'-finish.png')});
  results.push('Accepted E flurry has bounded pulses and one finish'+(upgraded?'; landed Second wind restores plant':''));

  await game.evaluate(()=>window.__polgeBrowser.arrange('moving'));
  const origin=(await state(game)).player.x;await press(page,game,'e');
  await game.evaluate(()=>window.focus());await page.keyboard.down('ArrowRight');
  try{await game.waitForFunction(()=>window.__polgeBrowser.state.fx.some(f=>f.kind==='finisher'),{},{timeout:2500});}
  finally{await page.keyboard.up('ArrowRight');}
  s=await state(game);assert.ok(s.player.x>origin+25,'movement remains available throughout flurry');
  assert.ok(s.fx.every(f=>Math.hypot(f.x-f.bodyX,f.y-(f.bodyY-12))<=25),'every pulse follows its current body');
  assert.ok(s.fx.filter(f=>f.kind==='flurry').some(f=>f.bodyX>origin+20),'later pulses follow the moving actor');
  assert.equal(s.bombs,0);assert.equal(s.shots,0);
  const observed=JSON.parse(await page.locator('#status').getAttribute('data-guardian')).combat;
  assert.equal(observed.bombPeak,0);assert.equal(observed.shotPeak,0);assert.equal(observed.shotsCreated,0,'no brief projectile is hidden between observations');
  results.push('ArrowRight steers accepted flurry; every later pulse stays at current body; no bomb or projectile');
  if(upgraded){
    await game.evaluate(()=>window.__polgeBrowser.arrange('empty'));
    await game.getByRole('button',{name:'Slip and counter (X)',exact:true}).tap();
    await game.waitForFunction(()=>window.__polgeBrowser.player.dodgeT>0);
    assert.equal((await state(game)).fighter.counter,0);results.push('Touch Slip button starts legal ground movement without inventing counter');
  }
  const bodies=(await state(game)).bodies;
  for(const kind of ['jab','cross','uppercut','clinch','flurry','finisher','slip']){
    const pose=bodies[kind];assert.ok(pose,'native body renders '+kind);
    assert.ok(['main.png','interaction.png'].includes(pose.source));assert.equal(pose.rect.length,8);
    assert.deepEqual([pose.rect[2],pose.rect[3],pose.rect[6],pose.rect[7]],[32,32,32,32],'body stays native 1:1 for '+kind);
    assert.ok(pose.rect.every(Number.isInteger),'native frame and anchor stay integer');
  }
  assert.equal(bodies.jab.source,'interaction.png');assert.equal(bodies.clinch.source,'interaction.png');assert.equal(bodies.cross.source,'interaction.png');
  assert.equal(bodies.uppercut.source,'main.png');assert.equal(bodies.finisher.source,'main.png');
  results.push('Every strike and slip draws an existing 32 × 32 native body cell at integer anchors without scaling');
  return {label,results,damage};
}
async function testFriendlyPair(context,page,guest,engineName){
  const hostPage=await context.newPage();await hostPage.goto(base+'/review.html?mode=layout1&class=mech&portrait=1');
  const host=await ready(hostPage),ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  for(const [frame,isHost] of [[host,true],[guest,false]])await frame.evaluate(({ids,isHost})=>{
    window.__polgePending=[];
    window.__polgeBrowser.begin({host:isHost,user:{id:ids[isHost?0:1]},room:{id:'polge-browser',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))},loadouts:{[ids[0]]:{classId:'mech',skinId:'tide'},[ids[1]]:{classId:'polge',skinId:'polge'}},action(type,data){window.__polgePending.push({id:window.__polgePending.length+1,type,...data});return true;},tick(){},fail(reason){throw Error(reason);}});
    window.__polgeBrowser.arrange('empty');
  },{ids,isHost});
  await guest.evaluate(snapshot=>window.__polgeBrowser.stateIn(snapshot),await host.evaluate(()=>window.__polgeBrowser.capture()));
  await page.bringToFront();await press(page,guest,'b');
  const input=await guest.evaluate(()=>({avatar:window.__polgeBrowser.avatar(),actions:window.__polgePending}));
  await host.evaluate(({id,input})=>window.__polgeBrowser.input(id,input),{id:ids[1],input});
  await guest.evaluate(snapshot=>window.__polgeBrowser.stateIn(snapshot),await host.evaluate(()=>window.__polgeBrowser.capture()));
  const friendly=await guest.evaluate(()=>({rhythm:window.__polgeBrowser.fighter.rhythm,counter:window.__polgeBrowser.fighter.counter,skillCool:window.__polgeBrowser.player.skillCool,bombs:window.__polgeBrowser.state.bombs,shots:window.__polgeBrowser.state.shots,plots:window.__polgeBrowser.state.plants}));
  assert.equal(friendly.rhythm,0);assert.equal(friendly.counter,0);assert.equal(friendly.bombs,0);assert.equal(friendly.shots,0);
  await press(page,guest,'c');await press(page,guest,'e');
  assert.equal(await guest.evaluate(()=>window.__polgeBrowser.player.skillCool),0,'friendly avatar cannot accept flurry');
  assert.equal(await guest.evaluate(()=>window.__polgePending.filter(a=>a.type==='skill'||a.type==='secondary').length),0,'friendly avatar cannot farm clinch or flurry resources');
  await hostPage.locator('iframe').screenshot({path:path.join(output,engineName+'-friendly-pair.png')});
  await hostPage.close();return 'Two browser players: friendly avatar and plants cannot grant Rhythm, counter, clinch or flurry';
}
let base;
(async()=>{
  fs.mkdirSync(output,{recursive:true});await new Promise(resolve=>serve.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+serve.address().port;
  try{
    for(const engineName of engines){
      const engine={chromium,webkit}[engineName];assert.ok(engine,'supported browser engine');
      const launch={headless:true};if(engineName==='chromium'&&process.env.POLGE_CHROMIUM_EXECUTABLE)launch.executablePath=process.env.POLGE_CHROMIUM_EXECUTABLE;
      browser=await engine.launch(launch);const context=await browser.newContext({viewport:{width:1100,height:1600},deviceScaleFactor:1,hasTouch:true,isMobile:true});
      const errors=[];context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});});
      await context.route('**/index.html',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8').replace('function drawPlayer() {',probe+'\nfunction drawPlayer() {')}));
      const page=await context.newPage();activePage=page;
      await page.goto(base+'/review.html?mode=polge');let game=await ready(page);activeGame=game;
      const visuals=[];
      for(const [viewport,width,height] of [['desktop',1000,650],['phone',390,844],['small',320,568]]){
        await page.locator('#viewport').selectOption(viewport);
        await game.waitForFunction(({width,height})=>innerWidth===width&&innerHeight===height,{width,height});
        const view=await game.evaluate(()=>({width:innerWidth,height:innerHeight,smoothing:window.__polgeBrowser.canvas.getContext('2d').imageSmoothingEnabled,skin:window.__polgeBrowser.player.skin,buttons:Array.from(document.querySelectorAll('#polgeControls button')).map(b=>{var r=b.getBoundingClientRect();return {label:b.getAttribute('aria-label'),left:r.left,right:r.right,top:r.top,bottom:r.bottom,visible:!b.closest('[hidden]')};})}));
        assert.equal(view.skin,'polge');assert.equal(view.smoothing,false);assert.equal(view.buttons.length,2);
        assert.ok(view.buttons.every(b=>b.visible&&b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=height),'touch buttons fit '+viewport);
        assert.ok(view.buttons.every(b=>b.bottom-b.top>=48),'coarse-pointer touch buttons are at least 48 px high');
        await page.locator('iframe').screenshot({path:path.join(output,engineName+'-'+viewport+'.png')});visuals.push(view);
      }
      await page.locator('#viewport').selectOption('phone');
      const kits=[await testKit(page,game,engineName,false)];
      await page.goto(base+'/review.html?mode=polge&portrait=1&boons=1');game=await ready(page);activeGame=game;
      kits.push(await testKit(page,game,engineName,true));
      const pair=await testFriendlyPair(context,page,game,engineName);
      assert.deepEqual(errors,[],'no browser errors');
      const result={engine:engineName,visuals,kits,pair,errors};fs.writeFileSync(path.join(output,engineName+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
      await browser.close();browser=null;
    }
  }catch(e){console.error(e);if(activeGame)console.error('FINAL STATE',await state(activeGame).catch(()=>null));await activePage?.screenshot({path:path.join(output,'failed.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
  finally{await browser?.close();await new Promise(resolve=>serve.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;serve.close();});
