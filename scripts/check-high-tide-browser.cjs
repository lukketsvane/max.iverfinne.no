// Isolated review pages only: never signs in or joins a live game.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const {webkit,chromium}=require('playwright');
const port=8776,base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['-m','http.server',String(port),'--directory','dist'],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 fs.mkdirSync('browser-review',{recursive:true});
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await pause(100);}
 for(const [name,engine] of Object.entries({webkit,chromium})){
  const browser=await engine.launch({headless:true});
  try{
   const context=await browser.newContext({viewport:{width:430,height:1120},hasTouch:true,isMobile:true,deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
   for(const zone of [-1,0,1,2,3,4]){
    const params=zone<0?'':'&zone='+zone;
    await page.goto(base+'/review.html?mode=high-tide&portrait=1'+params+(zone>=0?'&still=1':''),{waitUntil:'load'});
    await page.waitForFunction(()=>{const n=document.querySelector('#status');return n.textContent.startsWith('Fixture error:')||n.dataset.state&&JSON.parse(n.dataset.state).tide?.artReady;},{},{timeout:20000});
    const status=await page.locator('#status').getAttribute('data-state');assert.ok(status,await page.locator('#status').innerText());const state=JSON.parse(status);
    assert.equal(state.tide.artReady,true);assert.equal(state.tide.floors,118);assert.equal(state.ended,false);
    if(zone>=0){assert.ok(state.bossId);assert.equal(state.tide.bosses,zone);}
    else{
     const iframe=page.frames().find(f=>f!==page.mainFrame());
     await page.locator('iframe').screenshot({path:`browser-review/${name}-before.png`});
     // WebKit does not transfer keyboard focus after the canvas prevents a
     // pointer's default action. The shipped game runs in the top frame.
     await iframe.evaluate(()=>window.focus());
     assert.equal(await iframe.evaluate(()=>document.hasFocus()),true);
     await page.keyboard.down('ArrowDown');
     try{await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.state).tide.started,{},{timeout:8000});}
     catch(error){
      console.error('Start state:',await page.locator('#status').getAttribute('data-state'),'errors:',errors);
      console.error('Input focus:',await iframe.evaluate(()=>({focused:document.hasFocus(),active:document.activeElement.tagName,locked:!!document.pointerLockElement})));
      await page.locator('iframe').screenshot({path:`browser-review/${name}-failed.png`});throw error;
     }
     await page.keyboard.up('ArrowDown');await page.keyboard.press('ArrowUp');
     await page.waitForFunction(()=>JSON.parse(document.querySelector('#status').dataset.state).tide.height>30,{},{timeout:8000});
    }
    await page.locator('iframe').screenshot({path:`browser-review/${name}-${zone<0?'start':'guardian-'+(zone+1)}.png`});
    assert.deepEqual(errors,[]);console.log(name,zone<0?'start and grow':'guardian '+(zone+1),'OK');
   }
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.kill());
