// Isolated game clients; no accounts, saved player storage or live rooms.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const {webkit,chromium}=require('playwright');
const port=8777,base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['-m','http.server',String(port),'--directory','dist'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 fs.mkdirSync('browser-review',{recursive:true});
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await pause(100);}
 for(const [name,engine] of Object.entries({webkit,chromium})){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:850,height:1000},hasTouch:true,deviceScaleFactor:1}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
   await page.goto(base+'/night-relay-review.html',{waitUntil:'load'});
   const ready=()=>page.waitForFunction(()=>[...document.querySelectorAll('.status')].every(n=>n.dataset.state&&JSON.parse(n.dataset.state).ready),{},{timeout:30000});
   const wait=async fn=>{try{await page.waitForFunction(fn,{},{timeout:90000});}catch(e){console.error(name,'FAILED STATE',await states(),'ERRORS',errors);await page.screenshot({path:`browser-review/relay-${name}-failed.png`,fullPage:true});throw e;}};
   const states=()=>page.locator('.status').evaluateAll(ns=>ns.map(n=>JSON.parse(n.dataset.state)));
   await ready();await page.getByRole('button',{name:'Play',exact:true}).click();
   await wait(()=>JSON.parse(document.querySelector('.status').dataset.state).time>=2);
   await page.getByRole('button',{name:'Disconnect P2',exact:true}).click();
   await wait(()=>JSON.parse(document.querySelector('.status').dataset.state).waiting);
   const stopped=(await states())[0];await pause(800);assert.ok(Math.abs((await states())[0].time-stopped.time)<.1,'missing partner pauses the clock');
   await page.screenshot({path:`browser-review/relay-${name}-waiting.png`,fullPage:true});
   await page.getByRole('button',{name:'Reconnect P2',exact:true}).click();
   await wait(()=>!JSON.parse(document.querySelector('.status').dataset.state).waiting);
   await wait(()=>JSON.parse(document.querySelector('.status').dataset.state).locks>=1);
   await page.getByRole('button',{name:'Hand off host',exact:true}).click();
   await wait(()=>JSON.parse(document.querySelectorAll('.status')[1].dataset.state).host);
   await wait(()=>[...document.querySelectorAll('.status')].every(n=>JSON.parse(n.dataset.state).locks>=2));
   await page.screenshot({path:`browser-review/relay-${name}-two-players.png`,fullPage:true});
   await wait(()=>[...document.querySelectorAll('.status')].every(n=>JSON.parse(n.dataset.state).ended));
   const result=await states();assert.ok(result.every(s=>s.won&&s.locks===3&&s.passes>=2),JSON.stringify(result));
   for(const frame of page.frames().filter(f=>f!==page.mainFrame())){
    assert.equal(await frame.locator('#runResults').isVisible(),true,'both players see the completed result');
    assert.match(await frame.locator('#runResultsTitle').textContent(),/LIGHT DELIVERED/);
    assert.match(await frame.locator('.run-results-empty').textContent(),/Everyone made it home/);
   }
   await page.screenshot({path:`browser-review/relay-${name}-complete.png`,fullPage:true});
   assert.deepEqual(errors,[]);console.log(name,'two clients completed after disconnect, rejoin and authority handoff',JSON.stringify(result));
   await page.selectOption('#count','1');await page.getByRole('button',{name:'New run',exact:true}).click();await ready();await page.getByRole('button',{name:'Play',exact:true}).click();await pause(2000);
   const alone=(await states())[0];assert.equal(alone.waiting,true);assert.equal(alone.time,0);assert.equal(alone.locks,0);
   assert.deepEqual(errors,[]);
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.kill());
