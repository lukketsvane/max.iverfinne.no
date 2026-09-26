// CI-only browser regression; isolated fixtures never join a live room.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {spawn}=require('node:child_process'),{webkit,chromium}=require('playwright');
const port=8782,base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['-m','http.server',String(port),'--directory','dist'],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const names=['sprout-sentinel','dew-duke','thorn-duelist','spore-oracle','mossback','root-ram','silk-weaver','dew-duke','spore-oracle','bellkeeper','frostjaw','root-ram','silk-weaver','thorn-duelist','moon-moth','kiln-beetle','spore-oracle','kiln-beetle','root-ram','hollow-crown'];
(async()=>{
 fs.mkdirSync('guardian-browser-review',{recursive:true});
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await pause(100);}
 for(const [engineName,engine] of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1050,height:1030},deviceScaleFactor:1}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
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
   await page.goto(base+'/review.html?mode=layout1&portrait=1');
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
   await page.locator('iframe').screenshot({path:`guardian-browser-review/${engineName}-mech-fuse.png`});
   await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.guardian).bombs.length===0,{},{timeout:2000});
   assert.deepEqual(errors,[]);console.log(engineName,'Mech charge movement, stationary placement and delayed explosion OK');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.kill());
