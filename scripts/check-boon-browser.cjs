'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'../dist'),output=path.resolve('boon-browser-review');
fs.mkdirSync(output,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{try{const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(requested.endsWith('/')?requested+'index.html':requested));if(!file.startsWith(root+path.sep))throw Error('Outside build');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
const names=game=>game.locator('#perkMenu button:not([data-redraw]) strong').allTextContents();
async function run(){
 const requestedEngine=process.env.BOON_BROWSER_ENGINE;
 assert.ok(requestedEngine===undefined||['chromium','webkit'].includes(requestedEngine),'Empty or unknown browser engine');
 const engines=requestedEngine===undefined?['chromium','webkit']:[requestedEngine];
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port,results=[];
 for(const engine of engines){
  const type={chromium,webkit}[engine];
  const launch=engine==='chromium'&&process.env.BOON_BROWSER_EXECUTABLE?{executablePath:process.env.BOON_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']}:{};
  const browser=await type.launch({headless:true,...launch});
  try{
   for(const viewport of ['phone','compact']){
    const page=await browser.newPage({viewport:viewport==='phone'?{width:390,height:844}:{width:568,height:320},hasTouch:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/review.html?mode=boons&class=herbalist&portrait=1',{waitUntil:'domcontentloaded'});
    if(viewport==='compact')await page.selectOption('#viewport','compact');
    await page.waitForFunction(()=>!!document.querySelector('#status').dataset.state);
    const game=page.frames().find(f=>f!==page.mainFrame());assert.ok(game);
    await game.waitForSelector('#perkMenu button[data-redraw]');
    const before=await names(game);assert.equal(before.length,3);
    const layout=await game.locator('#perkMenu').evaluate(menu=>{const box=menu.getBoundingClientRect();return {x:box.x,y:box.y,right:box.right,bottom:box.bottom,w:innerWidth,h:innerHeight};});
    assert.ok(layout.x>=0&&layout.y>=0&&layout.right<=layout.w+.5&&layout.bottom<=layout.h+.5,'all choices and redraw fit the viewport');
    const elapsed=JSON.parse(await page.locator('#status').getAttribute('data-state')).elapsed;
    await page.locator('iframe').screenshot({path:path.join(output,engine+'-'+viewport+'-before.png')});
    if(viewport==='phone')await game.locator('#perkMenu button[data-redraw]').click();
    else{await game.evaluate(()=>window.focus());await page.keyboard.press('4');}
    await game.waitForFunction(()=>!document.querySelector('#perkMenu button[data-redraw]'));
    const after=await names(game);assert.equal(after.length,3);assert.equal(after[0],before[0]);assert.ok(after.slice(1).every(name=>!before.includes(name)),'the two alternative cards actually change');
    await game.evaluate(()=>window.focus());await page.keyboard.press('4');assert.deepEqual(await names(game),after,'a second redraw is rejected');
    await page.waitForFunction(previous=>JSON.parse(document.querySelector('#status').dataset.state).elapsed>previous,elapsed);
    await page.locator('iframe').screenshot({path:path.join(output,engine+'-'+viewport+'-after.png')});
    await game.locator('#perkMenu button:not([data-redraw])').nth(1).click();
    await game.waitForFunction(()=>getComputedStyle(document.querySelector('#perkMenu')).display==='none');
    assert.deepEqual(errors,[]);results.push({engine,viewport,before,after,worldLive:true,chosen:true});
    await page.close();
   }
  }finally{await browser.close();}
 }
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(results,null,2));
 console.log('BOON_BROWSER_OK',JSON.stringify(results));
}
run().catch(error=>{console.error(error);fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error.stack||error)},null,2));process.exitCode=1;}).finally(()=>{if(server.listening)server.close();});
