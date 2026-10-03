'use strict';

// Deterministic arrangements exercise real inputs and the authoritative runtime.
// This observer exists only in intercepted review responses, never production.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=path.resolve(process.env.MECH_REVIEW_DIST||path.join(__dirname,'../dist'));
const output=path.resolve(process.env.MECH_REVIEW_OUTPUT||'mech-browser-review');
const engines=(process.env.MECH_BROWSER_ENGINES||'chromium,webkit').split(',');
const build=Object.fromEntries(['index.html','companion.js','assets/max-skins-v1/tide/main.png','assets/max-skins-v1/tide/interaction.png','assets/max-skins-v1/tide/atlas.json'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css','.webmanifest':'application/manifest+json'};
const probe=`
var mechBrowserFx=[],mechBrowserBodies={},mechBrowserRoverFrames=[],mechBrowserWater=[],mechBrowserOriginalCare=mechCircuitCare,mechBrowserOriginalFx=combatFx,mechBrowserOriginalImage=ctx.drawImage;
combatFx=function(kind,x,y,r,face,combo){mechBrowserFx.push({kind,x,y,r,bodyX:P.x,bodyY:P.y,owner:skillOwner(),at:performance.now()});return mechBrowserOriginalFx(kind,x,y,r,face,combo);};
mechCircuitCare=function(member,plant,amount,source){var owner=mechMember(member),holder=owner||rogueRun,before=holder.engineer&&holder.engineer.charge||0,result=mechBrowserOriginalCare.apply(this,arguments);if(plant&&amount>0)mechBrowserWater.push({id:plant.id,amount,source,owner:owner&&owner.id||'',before,after:holder.engineer&&holder.engineer.charge||0});return result;};
ctx.drawImage=function(image){
  if(image&&image.src){
    if(P.skin==='tide'&&image.src.indexOf('/max-skins-v1/tide/')>=0){
      var q=engineerState(),kind=q.overloadWindup>0?'overload':q.fanT>0?'fan':P.dodgeT>0?'dodge':P.throwPose>0&&bombs.length?'bomb':q.utilityCool>0?'utility':'idle';
      mechBrowserBodies[kind]={source:image.src.split('/').pop(),rect:Array.prototype.slice.call(arguments,1)};
    }
    if(/\\/assets\\/(?:companion|native)\\/.+\\.png$/.test(image.src)&&arguments.length===9)mechBrowserRoverFrames.push({source:image.src.split('/').pop(),rect:Array.prototype.slice.call(arguments,1)});
  }
  return mechBrowserOriginalImage.apply(this,arguments);
};
window.__mechBrowser={
  get player(){return P;},get engineer(){return engineerState();},get enemies(){return floatKrek;},get plots(){return gardenPlots;},get coop(){return coop;},get canvas(){return cv;},get crew(){return ensureCrew();},
  get controller(){return {tend:heldSpace,down:heldDown,press:gardenPress,single:!!pad.single,work:!!pad.work,connected:!!lastPad};},
  get state(){return {paused:runIsPaused(),ended:rogueRun.ended,input:readInput(),focus:document.hasFocus(),hidden:document.hidden,player:{x:P.x,y:P.y,vx:P.vx,vy:P.vy,grounded:P.grounded,wet:P.wet,st:P.st,skin:P.skin,dodgeT:P.dodgeT,dodgeCool:P.dodgeCool,skillCool:P.skillCool},engineer:Object.assign({},engineerState()),attackCool:bombCool,bombs:bombs.map(function(b){return {owner:b.owner,x:b.x,y:b.y,planted:b.planted,fuse:b.fuse,fuseMax:b.fuseMax};}),fx:mechBrowserFx.slice(),water:mechBrowserWater.slice(),bodies:Object.assign({},mechBrowserBodies),rovers:ensureCrew().map(function(b){return {kind:b.state.kind,x:b.state.x,water:b.state.water,targetX:b.state.targetX,targetId:b.state.target&&b.state.target.id,dispatchT:b.state.dispatchT,pourT:b.state.pourT,recalling:b.state.recalling,refill:b.state.refill,state:b.state.state};}),targets:floatKrek.map(function(k){return {x:k.x,y:k.y,hp:k.hp,wet:k.mechWet||0,wetBonus:k.mechWetBonus||0,windup:k.windup||0};}),plants:gardenPlots.map(function(p){return {id:p.id,x:p.x,health:p.health,moisture:p.moisture};}),roverFrames:mechBrowserRoverFrames.slice(-80)};},
  begin:beginCoop,capture:coopCapture,stateIn:coopState,input:coopInput,avatar:coopAvatar,roster:coopRoster,
  reviewSeed:function(){rogueRun.seed=1;rogueRun.next=1000000000;},
  separateHost:function(){P.x=dryX(levelOriginX(1)-40);P.y=surfaceY(P.x);P.vx=P.vy=0;},
  seedMember:function(id,fields,water){var m=coop.members[id];coopWithMember(m,function(){Object.assign(engineerState(),fields);if(Number.isFinite(water))ensureCrew().forEach(function(bot){bot.state.water=water;});});},
  memberState:function(id){return coopWithMember(coop.members[id],function(){return window.__mechBrowser.state;});},
  arrangeMember:function(id,kind){var m=coop.members[id];coopWithMember(m,function(){window.__mechBrowser.arrange(kind);m.avatar=Object.assign(m.avatar,coopAvatar());m.place=(m.place||0)+1;});},
  arrange:function(kind){
    clearRunInput();task=holdWater=null;classShots=[];bombs=[];booms=[];mechBrowserFx=[];mechBrowserWater=[];runHazards=[];floatKrek=[];runEncounters=[];
    P.x=levelOriginX(1);P.y=surfaceY(P.x);P.vx=P.vy=0;P.grounded=true;P.wet=false;P.st='free';P.face=1;P.dodgeT=P.dodgeCool=P.skillCool=P.secondaryCool=P.utilityCool=P.mechFanT=P.mechWindup=0;P.hurt=0;bombCool=0;
    gardenRaidActive=false;krekSpawnT=60;gardenRaidT=60;gardenPlots=[];rogueRun.plantedThisWorld=false;rogueRun.ended=false;
    var q=engineerState();['charge','rewardCool','fanCool','utilityCool','specialCool','fanT','fanNext','fanBeats','fanWatered','overloadWindup','priorityT'].forEach(function(k){q[k]=0;});
    ensureCrew().forEach(function(bot){Object.assign(bot.state,{x:P.x-20,water:window.MaxCompanion.tiers[bot.state.tier].capacity,state:'idle',clock:0,target:null,targetId:0,targetX:0,dispatchT:0,pourT:0,recalling:0,refill:0});});
    function plant(dx){var p={id:gardenPlots.length+1,x:P.x+dx,kind:3,seed:79,growth:.2,stalk:false,health:.65,moisture:.25,pulse:0,hit:0,age:0};gardenPlots.push(p);return p;}
    function guard(dx){var e=runEncounters[0];if(!e){e={id:902,x:P.x,y:P.y,type:'cache',cost:0,active:true,done:false,locked:false,progress:0,duration:75,guardsRemaining:0,age:0,away:0};runEncounters=[e];}var k=makeKrek(dx<0?-1:1,false,0);Object.assign(k,{x:P.x+dx,y:P.y-12,vx:0,vy:0,hp:100,maxHp:100,scout:false,trialGuard:true,eventId:e.id,eventX:e.x,eventY:e.y,bite:60,hitStaggerCooldown:60});floatKrek.push(k);return k;}
    if(kind==='care'){plant(10);ensureCrew().forEach(function(b){b.state.water=0;});}
    if(kind==='fan'){q.charge=1;plant(18);guard(18);guard(-18);guard(100);ensureCrew().forEach(function(b){b.state.water=.04;});}
    if(kind==='wet'){q.charge=1;guard(12);guard(-12);ensureCrew().forEach(function(b){b.state.water=0;});}
    if(kind==='utility'){plant(30);}
    if(kind==='recall'){ensureCrew().forEach(function(b){b.state.x=P.x+40;});}
    if(kind==='overload'){q.charge=3;plant(10);var p=plant(40),k=makeKrek(1,false,0);Object.assign(k,{x:p.x,y:surfaceY(p.x)-12,vx:0,vy:0,hp:100,maxHp:100,scout:false,target:p,attackTarget:p,bite:60,hitStaggerCooldown:60});floatKrek.push(k);}
  },
  defend:function(){var p=gardenPlots[0],k=floatKrek[0]||makeKrek(1,false,0);Object.assign(k,{x:p.x,y:surfaceY(p.x)-8,vx:0,vy:0,hp:100,maxHp:100,scout:false,trialGuard:false,target:p,attackTarget:p,windup:.9,tell:.9,bite:0,hitStaggerCooldown:0});floatKrek=[k];runEncounters=[];},
  water:function(value){ensureCrew().forEach(function(b){b.state.water=value;});},
  charge:function(value){engineerState().charge=value;},
  forgetBody:function(kind){delete mechBrowserBodies[kind];},
  clearFx:function(){mechBrowserFx=[];},
};
`;
const server=http.createServer((req,res)=>{try{const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(requested.endsWith('/')?requested+'index.html':requested));if(!file.startsWith(root+path.sep))throw Error('Path outside build');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
let browser,activePage,activeGame,base;
const state=frame=>frame.evaluate(()=>window.__mechBrowser.state);
async function press(page,game,key){await game.evaluate(key=>{window.focus();const kind={b:'bomb',c:'fan',v:'utility',e:'overload',x:'dodge'}[key];if(kind)window.__mechBrowser.forgetBody(kind);},key);await page.keyboard.press(key);}
async function ready(page){await page.waitForFunction(()=>document.querySelector('#status').dataset.guardian,{},{timeout:15000});const game=page.frames().find(f=>f!==page.mainFrame());assert.ok(game);assert.deepEqual((await game.evaluate(()=>window.MaxNativeArt.load())).failed,[]);await game.evaluate(()=>window.MaxCompanion.loadArt());return game;}
async function snapshot(page,engine,name){await page.locator('iframe').screenshot({path:path.join(output,engine+'-'+name+'.png')});}
async function checkBomb(page,game,engine,results){
  await game.evaluate(()=>window.__mechBrowser.arrange('empty'));
  await game.evaluate(()=>window.focus());await page.keyboard.down('b');await page.keyboard.down('ArrowRight');
  await game.waitForFunction(()=>window.__mechBrowser.player.x>3,{},{timeout:2000});await page.keyboard.up('ArrowRight');await page.keyboard.up('b');
  await game.waitForFunction(()=>window.__mechBrowser.state.bombs.length===1);
  const placed=await state(game),b=placed.bombs[0];assert.equal(b.planted,true);assert.equal(b.fuseMax,2,'planted bomb retains its fixed two-second fuse');assert.ok(b.fuse>1.75&&b.fuse<=2);
  await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.bomb);await snapshot(page,engine,'planted-bomb');
  await game.waitForFunction(()=>window.__mechBrowser.state.bombs[0]?.fuse<.7,{},{timeout:2200});const ticking=(await state(game)).bombs[0];assert.equal(ticking.x,b.x);assert.equal(ticking.y,b.y);
  await game.waitForFunction(()=>window.__mechBrowser.state.bombs.length===0,{},{timeout:2200});assert.equal((await state(game)).engineer.charge,0,'empty detonation earns no Circuit');
  results.push('Real B: move while charging, plant stationary bomb, retain exact 2 s fuse; empty blast earns no Circuit');
}
async function checkCircuit(page,game,engine,results){
  await game.evaluate(()=>window.__mechBrowser.arrange('care'));
  await press(page,game,'c');let s=await state(game);assert.equal(s.engineer.charge,0);assert.equal(s.engineer.fanCool,0,'zero-charge fan cannot start');
  await game.evaluate(()=>window.focus());await page.keyboard.down('Space');
  try{await game.waitForFunction(()=>window.__mechBrowser.engineer.charge===1,{},{timeout:3000});assert.ok((await state(game)).engineer.rewardCool>3);await game.waitForTimeout(500);assert.equal((await state(game)).engineer.charge,1,'continuous care cannot farm Circuit inside the gate');}finally{await page.keyboard.up('Space');}
  await press(page,game,'b');await game.waitForFunction(()=>window.__mechBrowser.state.bombs[0]?.fuse<.25,{},{timeout:2600});await game.evaluate(()=>window.__mechBrowser.defend());await game.waitForFunction(()=>window.__mechBrowser.state.bombs.length===0,{},{timeout:2000});
  s=await state(game);assert.ok(s.targets[0].hp<100,'bomb really defends the plant');assert.equal(s.engineer.charge,1,'care and defense share one reward gate');
  assert.equal(s.targets[0].windup,0,'the active plant attack was really interrupted');await snapshot(page,engine,'circuit-care');
  await game.evaluate(()=>window.__mechBrowser.arrange('care'));await press(page,game,'b');await game.waitForFunction(()=>window.__mechBrowser.state.bombs[0]?.fuse<.25,{},{timeout:2600});await game.evaluate(()=>window.__mechBrowser.defend());await game.waitForFunction(()=>window.__mechBrowser.state.bombs.length===0,{},{timeout:2000});assert.equal((await state(game)).engineer.charge,1,'an ungated successful bomb defense earns Circuit');
  results.push('Real Tend and actual interrupted plant attacks earn Circuit; ongoing care and bomb defense share the 4 s gate');
}
async function checkFan(page,game,engine,results){
  await game.evaluate(()=>window.__mechBrowser.arrange('fan'));const before=await state(game);
  await press(page,game,'c');await game.waitForFunction(()=>window.__mechBrowser.state.fx.filter(f=>f.kind==='mist').length===3,{},{timeout:2500});
  const after=await state(game);assert.equal(after.engineer.charge,0);assert.ok(after.engineer.fanCool>4);assert.equal(after.engineer.fanBeats,0);
  assert.ok(after.targets[0].hp<before.targets[0].hp);assert.equal(after.targets[1].hp,before.targets[1].hp);assert.equal(after.targets[2].hp,before.targets[2].hp,'fan remains a forward local cone');
  assert.ok(after.targets[0].wet>0);assert.equal(after.targets[0].wetBonus,1);assert.ok(Math.abs(after.rovers[0].water)<1e-8,'one fan debits exactly .04 of actual rover reserve');assert.ok(Math.abs(before.rovers.reduce((n,r)=>n+r.water,0)-after.rovers.reduce((n,r)=>n+r.water,0)-.04)<1e-8,'the whole crew spends only one .04 debit');assert.ok(after.rovers.slice(1).every((r,i)=>r.water===before.rovers[i+1].water),'other rovers and Guard bot retain their reserve');
  assert.ok(after.plants[0].moisture>before.plants[0].moisture+.02);await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.fan);await snapshot(page,engine,'fan');
  results.push('Real C: one charge, three forward pulses, Wet, one .04 irrigation debit; behind/far enemies and Circuit remain untouched');
  await game.evaluate(()=>{window.__mechBrowser.arrange('fan');window.__mechBrowser.water(0);});const dry=await state(game);await press(page,game,'c');await game.waitForFunction(()=>window.__mechBrowser.state.fx.filter(f=>f.kind==='mist').length===3,{},{timeout:2500});
  assert.ok((await state(game)).plants[0].moisture<=dry.plants[0].moisture,'dry rover cannot manufacture fan irrigation');await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.fan);
  await game.evaluate(()=>window.__mechBrowser.arrange('fan'));await press(page,game,'c');await page.keyboard.down('ArrowRight');try{await game.waitForFunction(()=>window.__mechBrowser.state.fx.filter(f=>f.kind==='mist').length===3,{},{timeout:2500});}finally{await page.keyboard.up('ArrowRight');}const moving=(await state(game)).fx.filter(f=>f.kind==='mist');assert.ok(moving.at(-1).bodyX-moving[0].bodyX>2,'Max can steer during his fan');assert.ok(moving.every(f=>f.x===f.bodyX&&f.y===f.bodyY-12),'every mist pulse follows the current body');await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.fan);results.push('Fan remains steerable and all three contacts follow Max’s current body');
}
async function checkWet(page,game,results){
  await game.evaluate(()=>window.__mechBrowser.arrange('wet'));await press(page,game,'b');await game.waitForFunction(()=>window.__mechBrowser.state.bombs.length===1);await press(page,game,'c');
  await game.waitForFunction(()=>window.__mechBrowser.state.bombs[0]?.fuse<.1,{},{timeout:2600});const before=await state(game);assert.ok(before.targets[0].wet>0);assert.equal(before.targets[1].wet,0);
  await game.waitForFunction(()=>window.__mechBrowser.state.bombs.length===0,{},{timeout:2000});const after=await state(game),wet=before.targets[0].hp-after.targets[0].hp,dry=before.targets[1].hp-after.targets[1].hp;
  assert.ok(wet>0&&dry>0,'both targets receive the actual planted blast');assert.ok(Math.abs(wet/dry-1.25)<.015,'Wet adds the one primary bonus');assert.equal(after.targets[0].wet,0);assert.equal(after.targets[0].wetBonus,0);
  results.push('Plant B, then C: Wet grants exactly one 25% bonus to the real delayed primary blast and is consumed');
}
async function checkUtility(page,game,engine,results){
  await game.evaluate(()=>window.__mechBrowser.arrange('utility'));const before=await state(game);await press(page,game,'v');
  await game.waitForFunction(()=>window.__mechBrowser.state.rovers.some(r=>r.dispatchT>0||r.pourT>0),{},{timeout:2000});
  const dispatched=await state(game);assert.ok(dispatched.engineer.utilityCool>6);assert.ok(dispatched.rovers[0].water<before.rovers[0].water);
  await game.waitForFunction(()=>window.__mechBrowser.state.rovers.some(r=>r.pourT>0),{},{timeout:3500});const arrived=await state(game);assert.ok(arrived.plants[0].moisture>before.plants[0].moisture+.2,'reachable plant receives real dispatch care');
  await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.utility);await snapshot(page,engine,'rover-arrival');
  await game.evaluate(()=>window.__mechBrowser.arrange('recall'));const away=await state(game);await press(page,game,'v');await game.waitForFunction(()=>window.__mechBrowser.state.rovers[0].recalling>0);const recalled=await state(game);assert.ok(recalled.rovers[0].x>away.player.x+30,'recall walks home rather than teleporting');assert.equal(recalled.rovers[0].water,away.rovers[0].water);assert.ok(recalled.engineer.utilityCool>6);
  await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.utility);await page.keyboard.press('v');await game.waitForFunction(()=>window.__mechBrowser.state.rovers[0].recalling===0,{},{timeout:4500});const home=await state(game);assert.ok(home.rovers[0].x<away.rovers[0].x-40);assert.equal(home.rovers[0].water,away.rovers[0].water,'repeated recall cannot manufacture reserve');await snapshot(page,engine,'rover-recall');
  results.push('Real V dispatch reserves water and reaches a plant; ready recall walks home, preserves reserve and respects its cooldown');
}
async function checkOverload(page,game,engine,results){
  await game.evaluate(()=>{window.__mechBrowser.arrange('overload');window.__mechBrowser.charge(2);});await press(page,game,'e');assert.equal((await state(game)).engineer.overloadWindup,0,'overload requires all three charges');
  await game.evaluate(()=>window.__mechBrowser.charge(3));const before=await state(game);await press(page,game,'e');await game.waitForFunction(()=>window.__mechBrowser.engineer.overloadWindup>0);await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.overload);
  await game.evaluate(()=>window.focus());await page.keyboard.down('ArrowRight');await page.keyboard.press('ArrowUp');await page.keyboard.press('x');await page.keyboard.down('Space');
  await game.waitForTimeout(100);const planted=await state(game);assert.ok(planted.engineer.overloadWindup>0,'input locks are observed inside the planted warning');assert.equal(planted.player.x,before.player.x);assert.equal(planted.player.dodgeT,0);assert.equal(planted.engineer.charge,0);assert.equal(planted.water.filter(w=>w.source==='care').length,0,'manual Tend is blocked during the planted warning');await page.keyboard.up('ArrowRight');await page.keyboard.up('Space');
  await game.waitForFunction(()=>window.__mechBrowser.state.fx.some(f=>f.kind==='overload'),{},{timeout:2000});const resolved=await state(game);assert.equal(resolved.fx.filter(f=>f.kind==='overload').length,1);assert.ok(resolved.engineer.specialCool>16);assert.ok(resolved.engineer.priorityT>3&&resolved.engineer.priorityT<=4);assert.ok(resolved.targets[0].hp<before.targets[0].hp);assert.ok(resolved.targets[0].wet>0);
  await snapshot(page,engine,'overload-ring');await game.waitForFunction(()=>window.__mechBrowser.state.rovers[0].targetId===2,{},{timeout:3000});await game.waitForFunction(()=>window.__mechBrowser.state.water.some(w=>w.source==='overload'&&w.id===2),{},{timeout:4000});await snapshot(page,engine,'overload');await game.waitForFunction(()=>window.__mechBrowser.engineer.priorityT===0,{},{timeout:5500});const done=await state(game),care=done.water.filter(w=>w.source==='overload'&&w.id===2);assert.ok(care.length>0&&care.every(w=>w.amount>0&&w.after===w.before),'threatened plant receives real priority care without Circuit refund');assert.ok(done.rovers[0].water<before.rovers[0].water);
  // Priority can expire between browser observations; normal rover care after
  // that point still spends reserve. Manual Tend care never spends rover water.
  const delivered=done.water.filter(w=>w.source==='overload'||w.source==='rover').reduce((n,w)=>n+w.amount,0);
  assert.ok(Math.abs(before.rovers[0].water-done.rovers[0].water-delivered)<1e-8,'actual rover delivery conserves its remaining reserve');
  results.push('Real E requires three charges, plants the .4 s windup, resolves once and prioritizes real rover water for 4 s');
}
async function checkTouch(page,game,results){
  await game.evaluate(()=>{window.__mechBrowser.arrange('empty');window.__mechBrowser.forgetBody('bomb');});await game.locator('#mechPrimary').tap();await game.waitForFunction(()=>window.__mechBrowser.state.bombs.length===1);await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.bomb);
  await game.evaluate(()=>{window.__mechBrowser.arrange('fan');window.__mechBrowser.forgetBody('fan');});await game.locator('#mechFan').tap();await game.waitForFunction(()=>window.__mechBrowser.engineer.fanT>0);await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.fan);
  await game.evaluate(()=>{window.__mechBrowser.arrange('utility');window.__mechBrowser.forgetBody('utility');});await game.locator('#mechUtility').tap();await game.waitForFunction(()=>window.__mechBrowser.state.rovers.some(r=>r.dispatchT>0||r.pourT>0));await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.utility);
  await game.evaluate(()=>{window.__mechBrowser.arrange('overload');window.__mechBrowser.forgetBody('overload');});await game.locator('#mechSpecial').tap();await game.waitForFunction(()=>window.__mechBrowser.engineer.overloadWindup>0);await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.overload);
  await game.evaluate(()=>window.__mechBrowser.arrange('empty'));await press(page,game,'x');await game.waitForFunction(()=>window.__mechBrowser.player.dodgeT>0);await game.waitForFunction(()=>!!window.__mechBrowser.state.bodies.dodge);
  results.push('All four touch slots invoke real actions; X retains the universal ground dodge');
}
async function checkController(page,game,engine,results){
  for(const single of [false,true]){
    await game.evaluate(single=>{
      window.__mechBrowser.arrange('empty');window.__mechBrowser.water(0);window.__mechBrowser.charge(1);
      window.__mechPad={id:single?'Joy-Con (L) Gamepad':'Xbox Wireless Controller',mapping:'standard',connected:true,index:0,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__mechPad?[window.__mechPad]:[]});window.focus();
    },single);
    await game.waitForFunction(()=>window.__mechBrowser.controller.connected);
    await game.evaluate(()=>{for(const n of [1,8])window.__mechPad.buttons[n]={pressed:true,value:1};});
    await game.waitForFunction(()=>window.__mechBrowser.state.rovers[0].refill>0);
    const refilling=await state(game),input=await game.evaluate(()=>window.__mechBrowser.controller);assert.equal(input.single,single);assert.equal(input.tend,false);assert.equal(input.down,false);assert.equal(input.work,false);assert.equal(refilling.engineer.charge,1);assert.equal(refilling.engineer.fanT,0);assert.equal(refilling.plants.length,0,'refill chord never starts gardening');
    await game.waitForFunction(()=>window.__mechBrowser.state.rovers[0].refill===0,{},{timeout:4000});const full=await state(game);assert.equal(full.rovers[0].water,.6);assert.equal(full.engineer.charge,1);assert.equal(full.engineer.fanCool,0);assert.equal(full.plants.length,0);
    await game.evaluate(()=>window.__mechPad.buttons[8]={pressed:false,value:0});await game.waitForFunction(()=>window.__mechBrowser.controller.tend);await game.evaluate(()=>window.__mechPad.buttons[1]={pressed:false,value:0});await game.waitForFunction(()=>!window.__mechBrowser.controller.tend);
    await game.evaluate(()=>{window.__mechBrowser.arrange('empty');window.__mechBrowser.charge(1);});await game.evaluate(()=>window.__mechPad.buttons[8]={pressed:true,value:1});await game.waitForFunction(()=>window.__mechBrowser.engineer.fanT>0);assert.equal((await state(game)).engineer.charge,0);await game.evaluate(()=>window.__mechPad.buttons[8]={pressed:false,value:0});await game.waitForFunction(()=>window.__mechBrowser.state.fx.filter(f=>f.kind==='mist').length===3,{},{timeout:2500});await snapshot(page,engine,'controller-'+(single?'joycon':'standard'));await game.evaluate(()=>window.__mechPad=null);
  }
  results.push('Actual gamepad polling: Tend + Fan refills on both controller layouts without Circuit/cast/gardening side effects; releasing restores Tend and bare Fan still fires');
}
async function checkPair(context,page,guest,engine,results){
  const hostPage=await context.newPage();await hostPage.goto(base+'/review.html?mode=layout1&class=polge&portrait=1');const host=await ready(hostPage),ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  for(const [frame,isHost] of [[host,true],[guest,false]])await frame.evaluate(({ids,isHost})=>{
    window.__mechPending=[];window.__mechBrowser.begin({host:isHost,user:{id:ids[isHost?0:1]},room:{id:'mech-browser',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))},loadouts:{[ids[0]]:{classId:'polge',skinId:'polge'},[ids[1]]:{classId:'mech',skinId:'tide'}},action(type,data){window.__mechPending.push({id:window.__mechPending.length+1,type,...data});return true;},tick(){},fail(reason){throw Error(reason);}});window.__mechBrowser.reviewSeed();window.__mechBrowser.arrange('empty');
  },{ids,isHost});
  await host.evaluate(()=>window.__mechBrowser.separateHost());
  const sync=async()=>guest.evaluate(snapshot=>window.__mechBrowser.stateIn(snapshot),await host.evaluate(()=>window.__mechBrowser.capture()));
  const send=async()=>{const input=await guest.evaluate(()=>({avatar:window.__mechBrowser.avatar(),actions:window.__mechPending}));await hostPage.bringToFront();await host.evaluate(({id,input})=>window.__mechBrowser.input(id,input),{id:ids[1],input});return input;};
  const replay=async input=>{await guest.evaluate(action=>window.__mechPending.push({...action,id:window.__mechPending.length+1}),input.actions.at(-1));return send();};
  const member=async()=>host.evaluate(id=>window.__mechBrowser.memberState(id),ids[1]);
  const scene=async kind=>{await host.evaluate(({id,kind})=>window.__mechBrowser.arrangeMember(id,kind),{id:ids[1],kind});await guest.evaluate(kind=>window.__mechBrowser.arrange(kind),kind);await sync();await page.bringToFront();};
  await scene('fan');const fanBefore=await member();
  await page.bringToFront();await press(page,guest,'c');assert.equal((await state(guest)).engineer.charge,1,'guest prediction never spends authority resources');
  const input=await send();assert.equal(input.actions.at(-1).type,'secondary');await sync();assert.equal((await state(guest)).engineer.charge,0);assert.ok((await state(guest)).engineer.fanCool>0);
  await host.evaluate(({id,input})=>window.__mechBrowser.input(id,input),{id:ids[1],input});
  await hostPage.bringToFront();await host.waitForFunction(()=>window.__mechBrowser.state.fx.filter(f=>f.kind==='mist').length===3,{},{timeout:2500});const fanAfter=await member(),fx=fanAfter.fx.filter(f=>f.kind==='mist');assert.ok(fx.every(f=>f.owner===ids[1]));assert.ok(fanAfter.targets[0].hp<fanBefore.targets[0].hp);assert.equal(fanAfter.rovers[0].water,0);assert.equal(fanAfter.engineer.charge,0);await snapshot(hostPage,engine,'guest-fan');await host.evaluate(id=>window.__mechBrowser.seedMember(id,{charge:1,fanCool:0,fanT:0,fanBeats:0,fanNext:0}),ids[1]);await replay(input);assert.equal((await member()).engineer.charge,1,'old fan tag stays rejected after resource/cooldown gates reopen');assert.equal((await member()).engineer.fanT,0);
  await scene('empty');await press(page,guest,'b');assert.equal((await state(guest)).bombs.length,0,'guest prediction cannot create a bomb');const primary=await send();assert.equal(primary.actions.at(-1).type,'throw');assert.equal((await member()).bombs.length,1);assert.equal((await member()).bombs[0].owner,ids[1]);await host.evaluate(({id,input})=>window.__mechBrowser.input(id,input),{id:ids[1],input:primary});assert.equal((await member()).bombs.length,1);await sync();assert.equal((await state(guest)).bombs.length,1);await hostPage.bringToFront();await host.waitForFunction(()=>window.__mechBrowser.state.bombs.length===0,{},{timeout:3000});await replay(primary);assert.equal((await member()).bombs.length,0,'fresh packet IDs cannot replay an expired primary tag');
  await scene('overload');await press(page,guest,'e');assert.equal((await state(guest)).engineer.charge,3,'predicted overload cannot spend three owner charges');const special=await send();assert.equal(special.actions.at(-1).type,'skill');assert.equal((await member()).engineer.charge,0);await host.evaluate(({id,input})=>window.__mechBrowser.input(id,input),{id:ids[1],input:special});await hostPage.bringToFront();await host.waitForFunction(()=>window.__mechBrowser.state.fx.some(f=>f.kind==='overload'),{},{timeout:2000});assert.equal((await member()).fx.filter(f=>f.kind==='overload').length,1);await sync();assert.ok((await state(guest)).engineer.priorityT>3);await page.bringToFront();await snapshot(page,engine,'guest-overload');await host.evaluate(id=>window.__mechBrowser.seedMember(id,{charge:3,specialCool:0}),ids[1]);await replay(special);assert.equal((await member()).engineer.charge,3);assert.equal((await member()).engineer.overloadWindup,0,'old overload tag cannot start a new planted cast');
  await scene('utility');const reserve=(await state(guest)).rovers[0].water;await press(page,guest,'v');assert.equal((await state(guest)).rovers[0].water,reserve,'predicted dispatch cannot debit a rover');const utility=await send();assert.equal(utility.actions.at(-1).type,'utility');const paid=await member();assert.ok(Math.abs(reserve-paid.rovers[0].water-.25)<1e-8);await host.evaluate(({id,input})=>window.__mechBrowser.input(id,input),{id:ids[1],input:utility});assert.equal((await member()).rovers[0].water,paid.rovers[0].water);await host.evaluate(id=>window.__mechBrowser.seedMember(id,{utilityCool:0}),ids[1]);await replay(utility);assert.equal((await member()).rovers[0].water,paid.rovers[0].water,'old utility tag cannot recall and refund the paid job');assert.equal((await member()).rovers[0].recalling,0);await sync();
  await guest.evaluate(id=>window.__mechBrowser.roster({...window.__mechBrowser.coop.network.room,host:id}),ids[1]);await host.evaluate(id=>window.__mechBrowser.roster({...window.__mechBrowser.coop.network.room,host:id}),ids[1]);await page.bringToFront();await guest.waitForFunction(()=>window.__mechBrowser.state.rovers[0].pourT>0,{},{timeout:3500});const promoted=await state(guest);assert.equal(promoted.rovers.length,1);assert.equal(promoted.rovers[0].water,paid.rovers[0].water);assert.ok(promoted.plants[0].moisture>.9);await snapshot(page,engine,'guest-promotion');
  await hostPage.close();results.push('Two actual browser players: host accepts tagged B/C/V/E once, guest predictions preserve owner resources, and paid dispatch continues through real authority promotion');
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  try{for(const engineName of engines){const engine={chromium,webkit}[engineName];assert.ok(engine);const launch={headless:true};if(engineName==='chromium'&&process.env.MECH_CHROMIUM_EXECUTABLE)launch.executablePath=process.env.MECH_CHROMIUM_EXECUTABLE;
    browser=await engine.launch(launch);const context=await browser.newContext({viewport:{width:1100,height:1700},hasTouch:true,isMobile:true,deviceScaleFactor:1}),errors=[];
    context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});});
    await context.route('**/index.html',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8').replace('function drawPlayer() {',probe+'\nfunction drawPlayer() {')}));
    const page=await context.newPage();activePage=page;await page.goto(base+'/review.html?mode=mech');const game=await ready(page);activeGame=game;const visuals=[],results=[];
    for(const [viewport,width,height] of [['desktop',1000,650],['phone',390,844],['small',320,568]]){
      await page.locator('#viewport').selectOption(viewport);await game.waitForFunction(({width,height})=>innerWidth===width&&innerHeight===height,{width,height});
      const view=await game.evaluate(()=>({width:innerWidth,height:innerHeight,skin:window.__mechBrowser.player.skin,smoothing:window.__mechBrowser.canvas.getContext('2d').imageSmoothingEnabled,buttons:Array.from(document.querySelectorAll('#mechControls button')).map(b=>{const r=b.getBoundingClientRect();return {id:b.id,label:b.getAttribute('aria-label'),left:r.left,right:r.right,top:r.top,bottom:r.bottom,visible:!b.closest('[hidden]')};})}));
      assert.equal(view.skin,'tide');assert.equal(view.smoothing,false);assert.equal(view.buttons.length,4);assert.ok(view.buttons.every(b=>b.visible&&b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=height&&b.bottom-b.top>=48),'four coarse-pointer controls fit '+viewport);await snapshot(page,engineName,viewport);visuals.push(view);
    }
    await page.locator('#viewport').selectOption('phone');
    await checkBomb(page,game,engineName,results);await checkCircuit(page,game,engineName,results);await checkFan(page,game,engineName,results);await checkWet(page,game,results);await checkUtility(page,game,engineName,results);await checkOverload(page,game,engineName,results);await checkTouch(page,game,results);
    const rendered=(await state(game));for(const kind of ['bomb','fan','utility','overload','dodge']){const body=rendered.bodies[kind];assert.ok(body,'accepted '+kind+' renders native body');assert.deepEqual([body.rect[2],body.rect[3],body.rect[6],body.rect[7]],[32,32,32,32]);assert.ok(body.rect.every(Number.isInteger));assert.ok(['main.png','interaction.png'].includes(body.source));}
    assert.ok(rendered.roverFrames.length);assert.ok(rendered.roverFrames.every(f=>f.rect[2]===f.rect[6]&&f.rect[3]===f.rect[7]&&f.rect.every(Number.isInteger)),'rover cells retain their own native size and integer anchors');results.push('Tide body and supplied rover cells keep native 1:1 pixels, integer registration and disabled smoothing');
    await checkController(page,game,engineName,results);await checkPair(context,page,game,engineName,results);
    await page.goto(base+'/review.html?mode=mech&portrait=1&boons=1');const upgraded=await ready(page);activeGame=upgraded;await upgraded.evaluate(()=>window.__mechBrowser.arrange('empty'));const crew=(await state(upgraded)).rovers;assert.equal(crew.filter(r=>r.kind==='water').length,3);assert.equal(crew.filter(r=>r.kind==='sentry').length,1);await snapshot(page,engineName,'upgraded');await checkBomb(page,upgraded,engineName+'-upgraded',results);await checkFan(page,upgraded,engineName+'-upgraded',results);const frames=(await state(upgraded)).roverFrames;assert.ok(frames.some(f=>f.rect[2]===80&&f.rect[3]===48));assert.ok(frames.every(f=>f.rect[2]===f.rect[6]&&f.rect[3]===f.rect[7]&&f.rect.every(Number.isInteger)));results.push('Existing bomb branches, three upgraded native rovers and Guard bot preserve the new engineer kit and fixed fuse');
    assert.deepEqual(errors,[]);const evidence={engine:engineName,build,visuals,results,errors};fs.writeFileSync(path.join(output,engineName+'.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));await browser.close();browser=null;
  }}catch(e){console.error(e);if(activeGame)console.error('FINAL STATE',await state(activeGame).catch(()=>null));await activePage?.screenshot({path:path.join(output,'failed.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
  finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
