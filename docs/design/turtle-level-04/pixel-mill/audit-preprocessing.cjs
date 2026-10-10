const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const out='/tmp/max-turtle-pixel-mill-clean-p48';
const source='/tmp/pixel-mill-source/dist';
const recipe=JSON.parse(fs.readFileSync(path.join(out,'recipe.json')));
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Pixel Mill preprocessing hash audit</title>');return;}
  const file=req.url==='/photo.jpg'?path.join(out,'photo-7-source.jpg'):path.join(source,req.url.slice(1));
  res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':'image/jpeg');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();
 await page.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
 await page.goto(origin);
 const audit=await page.evaluate(async recipe=>{
  const core=await import('/pixel-core.mjs');
  const image=new Image();image.src='/photo.jpg';await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const pre=core.removeBackground(data,canvas.width,canvas.height,recipe.prepass.color,recipe.prepass.tolerance,recipe.prepass.mode,recipe.prepass.enabled);
  const final=core.processPixels({data:pre,width:canvas.width,height:canvas.height,options:recipe.options});
  return {format:'pixel-mill-preprocessing-audit',version:1,inputDecodedRGBA:{width:canvas.width,height:canvas.height,sha256:await digest(data)},prepassRGBA:{width:canvas.width,height:canvas.height,sha256:await digest(pre)},finalRGBA:{width:final.width,height:final.height,sha256:await digest(final.data)},functions:['removeBackground','processPixels'],nativeScale:0.5};
 },recipe);
 const report=JSON.parse(fs.readFileSync(path.join(out,'report.json')));
 if(audit.finalRGBA.sha256!==report.rgbaSha256)throw Error('Audit did not reproduce chosen final RGBA');
 audit.pass=true;recipe.preprocessingHashes=audit;report.preprocessingHashes=audit;
 fs.writeFileSync(path.join(out,'preprocessing-audit.json'),JSON.stringify(audit,null,2)+'\n');
 fs.writeFileSync(path.join(out,'recipe.json'),JSON.stringify(recipe,null,2)+'\n');
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 fs.copyFileSync(__filename,path.join(out,'audit-preprocessing.cjs'));
 await browser.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify(audit,null,2));
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
