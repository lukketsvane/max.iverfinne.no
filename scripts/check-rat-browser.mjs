// Optional browser acceptance: npm run build; npm install --no-save playwright;
// npx playwright install chromium; node scripts/check-rat-browser.mjs
// Uses only local compiled files and isolated review data. No production writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('dist'),out=resolve('rat-browser-evidence');
await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+'/')||!(await stat(file)).isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const results=[];
try{
  for(const [name,width,height] of [['landscape',1180,900],['portrait',390,1100]]){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    const errors=[],failed=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))failed.push({status:response.status(),url:response.url()});});
    await page.addInitScript(()=>{
      window.__ratDraws=[];
      const original=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(...args){
        if(String(args[0]?.src).includes('/rat-enemies-v1/')&&window.__ratDraws.length<3000)
          window.__ratDraws.push({src:args[0].src,args:args.slice(1),smooth:this.imageSmoothingEnabled});
        return original.apply(this,args);
      };
    });
    await page.goto(base+'/review.html?mode=rats&class=runner'+(name==='portrait'?'&portrait=1':''),{waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#status').dataset.state);
    const handle=await page.locator('iframe').elementHandle(),frame=await handle.contentFrame();
    const status=await frame.evaluate(()=>window.MaxNativeArt.load());
    assert.deepEqual(status.failed,[],'every native atlas loads');
    assert.equal(status.loaded.filter(id=>id.startsWith('rat-')).length,4);
    await page.waitForTimeout(650);
    await page.locator('iframe').screenshot({path:out+'/rats-'+name+'.png'});
    const start=JSON.parse(await page.locator('#status').getAttribute('data-state'));
    await frame.locator('canvas').first().click({position:{x:100,y:100}});
    await page.keyboard.down('b');await page.waitForTimeout(3500);await page.keyboard.up('b');
    const after=JSON.parse(await page.locator('#status').getAttribute('data-state'));
    const draws=await frame.evaluate(()=>window.__ratDraws);
    assert.ok(draws.length>0,'actual game renderer draws rats');
    assert.ok(draws.every(d=>d.smooth===false),'no filtering blur');
    assert.ok(draws.every(d=>d.args[2]===48&&d.args[3]===32&&d.args[6]===48&&d.args[7]===32),'native 1:1 source/destination rectangles');
    const variants=[...new Set(draws.map(d=>d.src.split('/').at(-2)))].sort();
    assert.deepEqual(variants,['albino','black','common','plague']);
    assert.ok(after.elapsed>start.elapsed,'game continues during combat');
    await page.locator('iframe').screenshot({path:out+'/rats-'+name+'-combat.png'});
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    results.push({viewport:name,nativeStatus:status,variants,draws:draws.length,start,after,errors,failed});
    await page.close();
  }
  console.log(JSON.stringify(results,null,2));
}finally{
  await writeFile(out+'/verification.json',JSON.stringify(results,null,2)+'\n');
  await browser.close();server.close();
}
