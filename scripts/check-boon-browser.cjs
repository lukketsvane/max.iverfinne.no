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
const scenarios=[
 {classId:'herbalist',fixture:'redraw'},
 {classId:'runner',hint:'Toward Flying press · Needs Ring tempo ×1 · Spring step ×1'},
 {classId:'bulwark',hint:'Toward Sanctuary · Needs Stone pulse ×1 · Green thumb ×1'},
 {classId:'herbalist',hint:'Toward Outbreak · Needs Far spores ×1 · Ferment ×1'},
 {classId:'polge',hint:'Toward Haymaker · Needs Heavy hands ×2'},
 {classId:'mech',hint:'Toward Bloom pulse · Needs Quick roots ×1 · Sap ×1'},
 {classId:'sligo',hint:'Toward Bloom pulse · Needs Quick roots ×1 · Sap ×1'}
];
const measure=game=>game.locator('#perkMenu').evaluate(menu=>{
 const box=menu.getBoundingClientRect();
 const textFits=[...menu.querySelectorAll('strong,small,.perkUnlock')].every(part=>{const text=part.getBoundingClientRect(),card=part.closest('button').getBoundingClientRect();return text.x>=card.x&&text.right<=card.right+.5&&text.y>=card.y&&text.bottom<=card.bottom-12+.5&&part.scrollWidth<=part.clientWidth+1&&part.scrollHeight<=part.clientHeight+1;});
 return {x:box.x,y:box.y,right:box.right,bottom:box.bottom,w:innerWidth,h:innerHeight,textFits};
});
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
   for(const scenario of scenarios)for(const viewport of ['phone','compact']){
    const page=await browser.newPage({viewport:viewport==='phone'?{width:390,height:844}:{width:568,height:320},hasTouch:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/review.html?mode=boons&class='+scenario.classId+'&portrait=1'+(scenario.hint?'&progress=1':''),{waitUntil:'domcontentloaded'});
    if(viewport==='compact')await page.selectOption('#viewport','compact');
    await page.waitForFunction(()=>!!document.querySelector('#status').dataset.state);
    const game=page.frames().find(f=>f!==page.mainFrame());assert.ok(game);
    await game.waitForSelector('#perkMenu button[data-redraw]');
    const before=await names(game);assert.equal(before.length,3);
    const first=game.locator('#perkMenu button:not([data-redraw])').first();
    if(scenario.hint){assert.equal(await first.locator('.perkUnlock').textContent(),scenario.hint);assert.ok((await first.getAttribute('aria-label')).includes(scenario.hint),'the exact after-pick requirements are accessible');}
    const layout=await measure(game);assert.ok(layout.textFits,'every name, effect and requirement fits its card above the rank dots');
    assert.ok(layout.x>=0&&layout.y>=0&&layout.right<=layout.w+.5&&layout.bottom<=layout.h+.5,'all choices and redraw fit the viewport');
    const elapsed=JSON.parse(await page.locator('#status').getAttribute('data-state')).elapsed;
    const stem=engine+'-'+viewport+'-'+scenario.classId+'-'+(scenario.fixture||'progress');
    await page.locator('iframe').screenshot({path:path.join(output,stem+'-before.png')});
    if(viewport==='phone')await game.locator('#perkMenu button[data-redraw]').tap();
    else{await game.evaluate(()=>window.focus());await page.keyboard.press('4');}
    await game.waitForFunction(()=>!document.querySelector('#perkMenu button[data-redraw]'));
    const after=await names(game);assert.equal(after.length,3);assert.equal(after[0],before[0]);assert.ok(after.slice(1).every(name=>!before.includes(name)),'the two alternative cards actually change');
    if(scenario.hint)assert.equal(await first.locator('.perkUnlock').textContent(),scenario.hint,'redraw preserves the build destination and remaining ranks');
    const afterLayout=await measure(game);assert.ok(afterLayout.textFits,'redrawing cannot clip the requirements or effects');
    assert.ok(afterLayout.x>=0&&afterLayout.y>=0&&afterLayout.right<=afterLayout.w+.5&&afterLayout.bottom<=afterLayout.h+.5,'redrawn cards and hints fit without clipping');
    await game.evaluate(()=>window.focus());await page.keyboard.press('4');assert.deepEqual(await names(game),after,'a second redraw is rejected');
    await page.waitForFunction(previous=>JSON.parse(document.querySelector('#status').dataset.state).elapsed>previous,elapsed);
    await page.locator('iframe').screenshot({path:path.join(output,stem+'-after.png')});
    const chosenIndex=scenario.hint?0:1;
    if(viewport==='phone')await game.locator('#perkMenu button:not([data-redraw])').nth(chosenIndex).tap();
    else{await game.evaluate(()=>window.focus());await page.keyboard.press(String(chosenIndex+1));}
    await game.waitForFunction(()=>getComputedStyle(document.querySelector('#perkMenu')).display==='none');
    assert.deepEqual(errors,[]);results.push({engine,viewport,classId:scenario.classId,fixture:scenario.fixture||'progress',hint:scenario.hint||null,before,after,layout,afterLayout,input:viewport==='phone'?'touch':'keyboard',worldLive:true,chosen:after[chosenIndex]});
    await page.close();
   }
  }finally{await browser.close();}
 }
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(results,null,2));
 console.log('BOON_BROWSER_OK',JSON.stringify(results));
}
run().catch(error=>{console.error(error);fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error.stack||error)},null,2));process.exitCode=1;}).finally(()=>{if(server.listening)server.close();});
