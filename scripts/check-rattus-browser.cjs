const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist'),results=[];
const out=path.resolve('rattus-browser-review');fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css'};
const server=http.createServer((req,res)=>{const p=path.join(root,new URL(req.url,'http://localhost').pathname);try{res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p.endsWith('/')?p+'index.html':p));}catch{res.writeHead(404);res.end();}});
server.listen(8796,'127.0.0.1',async()=>{
 let browser,activeGame,activePage;
 try{
  for(const [engineName,engine] of Object.entries({chromium,webkit})){
  browser=await engine.launch({headless:true});
  const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/index.html',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(root+'/index.html','utf8').replace('function drawPlayer() {',`window.__rattusReview={get player(){return P;},get debug(){return {paused:runIsPaused(),hidden:document.hidden,heldL,heldR,heldRun,runActive,menuPaused,skin:P.skin,st:P.st,anim:P.anim,motionName:P.motionName,vx:P.vx,x:P.x,grounded:P.grounded};},get coop(){return coop;},avatar:coopAvatar,clean:coopCleanAvatar,begin:beginCoop,state:coopState,capture:coopCapture,input:coopInput,drawPeers:drawCoopPlayers,animate,draw:drawPlayer,setAnim,reset:resetRogueRun,get canvas(){return ctx.canvas;},park(){P.x=levelOriginX(1);P.y=surfaceY(P.x);P.vx=P.vy=0;P.grounded=true;P.st='free';P.motionIdle=0;P.motionName='';P.motionTime=0;P.still=0;clearRunInput();},pause(){menuPaused=true;}};function drawPlayer() {`)}));
  await page.goto('http://127.0.0.1:8796/review.html?mode=layout1&class=runner&portrait=1');
  await page.waitForFunction(()=>document.querySelector('#status').dataset.state);
  const game=page.frames().find(f=>f!==page.mainFrame());activeGame=game;activePage=page;
  const loaded=await game.evaluate(()=>window.MaxNativeArt.load());assert.deepEqual(loaded.failed,[]);
  await game.locator("canvas").click({position:{x:12,y:12}});
  await game.evaluate(()=>window.__rattusReview.park());
  console.log(engineName,"start",await game.evaluate(()=>window.__rattusReview.debug));
  await page.keyboard.down('ArrowRight');
  await game.waitForFunction(()=>window.__rattusReview.player.motionName==='walk');
  await page.locator('iframe').screenshot({path:out+'/'+engineName+'-game-walk.png'});
  await page.keyboard.down('Shift');
  await game.waitForFunction(()=>window.__rattusReview.player.motionName==='run');
  await page.locator('iframe').screenshot({path:out+'/'+engineName+'-game-run.png'});
  await page.keyboard.up('ArrowRight');await page.keyboard.up('Shift');
  await game.waitForFunction(()=>window.__rattusReview.player.motionName==='brake');
  results.push('Keyboard walk, sprint and release-to-brake');
  await game.evaluate(()=>window.__rattusReview.park());
  await game.waitForFunction(()=>window.__rattusReview.player.motionName==='kneel-down',null,{timeout:6000});
  await game.waitForFunction(()=>window.__rattusReview.player.motionName==='kneel');
  await page.locator('iframe').screenshot({path:out+'/'+engineName+'-game-kneel.png'});
  await page.keyboard.down('ArrowLeft');await game.waitForFunction(()=>window.__rattusReview.player.motionName==='walk');await page.keyboard.up('ArrowLeft');
  results.push('Bored idle after 3.5 s, immediate movement cancellation, left-facing render');
  await page.keyboard.press('ArrowUp');await game.waitForFunction(()=>window.__rattusReview.player.motionName==='pounce');
  await game.waitForFunction(()=>window.__rattusReview.player.grounded);
  await page.keyboard.press('b');await game.waitForFunction(()=>window.__rattusReview.player.rattlePose>0);
  await page.locator('iframe').screenshot({path:out+'/'+engineName+'-game-attack.png'});
  results.push('Jump, landing and real attack input');
  const evidence=await game.evaluate(()=>{
   const r=window.__rattusReview;r.pause();let checked=0;
   for(const name of ['walk','run','brake','pounce','guard','kneel-down','kneel','rest','rise','uppercut','rising-kick','turning-kick','double-knee','lunge-punch','jab-cross','sweep','parry','tail-whip','palm-strike','tail-cartwheel','split-kick','swarm-transform','handstand','dive','rat-call']){
    const own={...r.player,skin:'moss-pink',classId:'runner',anim:'idle',motionName:name,motionTime:.24};
    const remote=r.clean({...r.avatar(),...own});if(!remote||remote.motionName!==name||remote.motionTime!==.24)throw Error('Snapshot lost '+name);
    const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=128;a.height=b.height=80;
    const ac=a.getContext('2d'),bc=b.getContext('2d');
    if(!window.MaxNativeArt.drawPlayerMotion(ac,own,48,60)||!window.MaxNativeArt.drawPlayerMotion(bc,remote,48,60))throw Error('Missing '+name);
    if(a.toDataURL()!==b.toDataURL())throw Error('Peer mismatch '+name);checked++;
   }
   return {checked,skin:r.player.skin,smoothing:r.canvas.getContext('2d').imageSmoothingEnabled};
  });
  assert.equal(evidence.checked,25);assert.equal(evidence.smoothing,false);assert.deepEqual(errors,[]);
  results.push('All 25 clips draw identical native pixels after guest snapshot validation');
  const hostPage=await context.newPage();hostPage.on('pageerror',e=>errors.push(e.message));
  await hostPage.goto('http://127.0.0.1:8796/review.html?mode=layout1&class=mech&portrait=1');
  await hostPage.waitForFunction(()=>document.querySelector('#status').dataset.state);
  const hostGame=hostPage.frames().find(f=>f!==hostPage.mainFrame());
  assert.deepEqual((await hostGame.evaluate(()=>window.MaxNativeArt.load())).failed,[]);
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  for(const [frame,isHost] of [[hostGame,true],[game,false]])await frame.evaluate(({ids,isHost})=>{
   const members=ids.map((id,i)=>({id,slot:i+1,classId:i?'runner':'mech'}));
   window.__rattusReview.begin({host:isHost,user:{id:ids[isHost?0:1]},room:{id:'rattus-review',host:ids[0],members},action(){return true;},tick(){},fail(reason){throw Error(reason);}});
  },{ids,isHost});
  await page.bringToFront();await game.locator("canvas").click({position:{x:12,y:12}});await page.keyboard.down('ArrowRight');await page.keyboard.down('Shift');
  await game.waitForFunction(()=>window.__rattusReview.player.motionName==='run');
  for(let i=0;i<3;i++){
   const avatar=await game.evaluate(()=>window.__rattusReview.avatar());
   const remote=await hostGame.evaluate(({id,avatar})=>{const r=window.__rattusReview;r.input(id,{avatar,actions:[]});r.drawPeers(1/60);return r.coop.members[id].avatar;},{id:ids[1],avatar});
   assert.equal(remote.motionName,avatar.motionName);assert.equal(remote.motionTime,avatar.motionTime);
  }
  await hostPage.locator('iframe').screenshot({path:out+'/'+engineName+'-two-players.png'});
  await page.keyboard.up('ArrowRight');await page.keyboard.up('Shift');
  results.push('Two browser players: guest sprint survives host validation and draws in the host world');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/'+engineName+'.json',JSON.stringify({results,evidence,errors},null,2));console.log(engineName,JSON.stringify({results,evidence,errors}));await browser.close();browser=null;
  }
 }catch(e){console.error(e);if(activeGame)console.error("FINAL STATE",await activeGame.evaluate(()=>window.__rattusReview.debug).catch(()=>null));await activePage?.screenshot({path:out+"/failed.png",fullPage:true}).catch(()=>{});process.exitCode=1;}finally{await browser?.close();server.close();}
});
