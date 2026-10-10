const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const {chromium} = require('playwright');

const sourceRoot = process.env.PIXEL_MILL_SOURCE_ROOT || '/tmp/pixel-mill-source';
const out = process.env.PIXEL_MILL_OUT || '/tmp/max-turtle-pixel-mill';
const paletteLimit = Number(process.env.PIXEL_MILL_PALETTE || 32);
const tolerance = Number(process.env.PIXEL_MILL_TOLERANCE || 15);
const removalMode = process.env.PIXEL_MILL_MODE || 'all';
const reviewBackground = process.env.PIXEL_MILL_REVIEW_BACKGROUND || '#22304b';
const preclearTolerance = process.env.PIXEL_MILL_PRECLEAR_TOLERANCE ? Number(process.env.PIXEL_MILL_PRECLEAR_TOLERANCE) : null;
const sourceCommit = process.env.PIXEL_MILL_SOURCE_COMMIT || cp.execFileSync('git',['-C',sourceRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const input = process.env.PIXEL_MILL_INPUT || '/tmp/codex-remote-attachments/01a12680-9f84-7781-8bd0-a86617b3a055/1F4122D9-1449-413C-9413-85337AF6923D/7-Photo-7.jpg';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
fs.mkdirSync(out, {recursive:true});
fs.copyFileSync(input, path.join(out, 'photo-7-source.jpg'));
const recipe = {
  format:'max-pixel-mill-native-art-recipe',version:1,
  name:'Garden 4 — Mossy Turtle reference treatment',
  input:'photo-7-source.jpg',inputSha256:sha(fs.readFileSync(input)),
  inputDimensions:{width:1280,height:720},
  source:{repository:'https://github.com/lukketsvane/pixel-mill.iverfinne.no',
    commit:sourceCommit,
    modules:['pixel-core.mjs','png.mjs','agent.mjs','io.mjs','geometry.mjs','engine.mjs','figma-bridge.mjs','figma-plugin.mjs'].map(name=>({name,sha256:sha(fs.readFileSync(path.join(sourceRoot,'dist',name)))}))},
  options:{width:640,height:360,color:[255,255,255],tolerance,mode:removalMode,remove:true,palette:paletteLimit,minArea:1,connectivity:8,bridge:0},
  ...(preclearTolerance!==null?{prepass:{function:'removeBackground',color:[255,255,255],tolerance:preclearTolerance,mode:'all',enabled:true,dimensions:'original source dimensions'}}:{}),
  executionEnvironment:{PIXEL_MILL_SOURCE_ROOT:sourceRoot,PIXEL_MILL_SOURCE_COMMIT:sourceCommit,PIXEL_MILL_INPUT:input,PIXEL_MILL_OUT:out,PIXEL_MILL_PALETTE:String(paletteLimit),PIXEL_MILL_TOLERANCE:String(tolerance),PIXEL_MILL_MODE:removalMode,PIXEL_MILL_REVIEW_BACKGROUND:reviewBackground,...(preclearTolerance!==null?{PIXEL_MILL_PRECLEAR_TOLERANCE:String(preclearTolerance)}:{})},
  scaling:'Pixel Mill resizePixels: nearest-neighbor source samples floor((coordinate+0.5)*sourceDimension/targetDimension).',
  transparency:`White within RMS RGB distance ${tolerance} removed in ${removalMode} mode; dark shell/cave colors retained. Alpha is binary.`,
  palette:`Pixel Mill weighted median-cut quantize with ${paletteLimit} colors, followed by exact RGB enumeration.`,
  reviewBackground,
  authority:'User-provided JPEG reference treatment. No new Figma node IDs or runtime PNG master authority. Figma kits are local import packages and are unsynced.',
  coordinates:'640×360 native pixels; x right, y down; drawing origin 0,0. MAX runtime registration and geometry are separate.'
};
const server = http.createServer((req,res)=>{
  const u = new URL(req.url,'http://localhost');
  if(u.pathname==='/isolated') {res.setHeader('content-type','text/html');res.end('<!doctype html><title>Isolated Pixel Mill source processing</title><body style="margin:0;background:'+reviewBackground+'"></body>');return;}
  const file = u.pathname==='/source.jpg'?input:path.join(sourceRoot,'dist',u.pathname.slice(1));
  if(!file.startsWith(sourceRoot)&&file!==input){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.png')?'image/png':'text/plain');
  res.end(fs.readFileSync(file));
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:'+server.address().port;
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context = await browser.newContext({viewport:{width:640,height:360},acceptDownloads:true});
  const errors=[],blocked=[],failed=[];
  await context.route('**/*',route=>{
    if(route.request().url().startsWith(origin+'/')&&route.request().method()==='GET')return route.continue();
    if(route.request().url().startsWith('data:')||route.request().url().startsWith('blob:'))return route.continue();
    blocked.push({url:route.request().url(),method:route.request().method()});return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(origin+'/isolated');
  const result = await page.evaluate(async({recipe})=>{
    const core = await import('/pixel-core.mjs');
    const png = await import('/png.mjs');
    const agent = await import('/agent.mjs');
    const io = await import('/io.mjs');
    const figma = await import('/figma-bridge.mjs');
    const image = new Image();image.src='/source.jpg';await image.decode();
    const source = document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
    const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const input=ctx.getImageData(0,0,source.width,source.height).data;
    const processingInput=recipe.prepass?core.removeBackground(input,source.width,source.height,recipe.prepass.color,recipe.prepass.tolerance,recipe.prepass.mode,recipe.prepass.enabled):input;
    const processed=core.processPixels({data:processingInput,width:source.width,height:source.height,options:recipe.options});
    const encoded=await png.encodePNG({w:processed.width,h:processed.height,pixels:processed.data});
    const dataUrl=png.dataURL(encoded);
    const empty={format:'max-level-studio',version:1,name:'Garden 4 Mossy Turtle — processed reference',assets:[],objects:[],spawn:{x:320,y:300}};
    const imported=await agent.imageProject(empty,'import_image',{name:'Photo 7 turtle — 640×360 Pixel Mill treatment',dataUrl,autoGroup:false});
    const assetId=imported.details.assetIds[0];
    const project=agent.editProject(imported.project,[{type:'place',id:'turtle-reference-treatment',assetId,x:0,y:0,width:640,height:360,kind:'decor',role:'decoration',name:'Mossy turtle reference treatment — native pixels'}]);
    const decoded=await io.decode(dataUrl);
    const images=new Map([[assetId,decoded]]);
    window.pixelMillResult={project,images,io,figma,processed};
    const display=document.createElement('canvas');display.width=640;display.height=360;display.style='display:block;width:640px;height:360px;image-rendering:pixelated';
    display.getContext('2d').putImageData(new ImageData(processed.data,640,360),0,0);document.body.appendChild(display);
    const parts=processed.parts.map(({id,x,y,w,h,area})=>({id,x,y,w,h,area}));
    return {project,png:dataUrl.split(',')[1],rgba:Array.from(processed.data),parts};
  },{recipe});
  fs.writeFileSync(path.join(out,'turtle-640x360.png'),Buffer.from(result.png,'base64'));
  const rgba=Buffer.from(result.rgba);fs.writeFileSync(path.join(out,'turtle-640x360.rgba'),rgba);
  fs.writeFileSync(path.join(out,'pixel-mill-project.json'),JSON.stringify(result.project,null,2)+'\n');
  fs.writeFileSync(path.join(out,'connected-cuts.json'),JSON.stringify({format:'pixel-mill-connected-source-cuts',width:640,height:360,parts:result.parts},null,2)+'\n');
  await page.screenshot({path:path.join(out,'pixel-mill-processed-review.png')});
  let pending=page.waitForEvent('download');await page.evaluate(()=>window.pixelMillResult.io.exportProject(window.pixelMillResult.project,window.pixelMillResult.images));
  let download=await pending;await download.saveAs(path.join(out,'pixel-mill-export.zip'));
  pending=page.waitForEvent('download');await page.evaluate(()=>window.pixelMillResult.figma.exportFigmaKit(window.pixelMillResult.project,window.pixelMillResult.images));
  download=await pending;await download.saveAs(path.join(out,'pixel-mill-figma-kit.zip'));
  const transfer=await page.evaluate(()=>window.pixelMillResult.figma.createFigmaTransfer(window.pixelMillResult.project,window.pixelMillResult.images));
  fs.writeFileSync(path.join(out,'level.figma.json'),JSON.stringify(transfer,null,2)+'\n');

  const counts=new Map();let opaque=0,transparent=0;
  for(let i=0;i<rgba.length;i+=4){if(!rgba[i+3]){transparent++;continue}if(rgba[i+3]!==255)throw Error('Unexpected partial alpha');opaque++;const color='#'+rgba.subarray(i,i+3).toString('hex');counts.set(color,(counts.get(color)||0)+1);}
  const palette=[...counts.keys()].sort();const indices=new Map(palette.map((c,i)=>[c,i]));
  const at=(x,y)=>{const i=(y*640+x)*4;return rgba[i+3]===0?-1:indices.get('#'+rgba.subarray(i,i+3).toString('hex'));};
  const rects=[];let active=new Map();
  for(let y=0;y<360;y++){
    const next=new Map();let x=0;
    while(x<640){const p=at(x,y),start=x++;while(x<640&&at(x,y)===p)x++;if(p<0)continue;const w=x-start,key=start+':'+w+':'+p;
      if(active.has(key)){const index=active.get(key);rects[index][3]++;next.set(key,index);}else{next.set(key,rects.length);rects.push([start,y,w,1,p]);}
    }
    active=next;
  }
  const rebuilt=Buffer.alloc(rgba.length);
  for(const [x,y,w,h,p] of rects){const rgb=Buffer.from(palette[p].slice(1),'hex');for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const i=(yy*640+xx)*4;rebuilt[i]=rgb[0];rebuilt[i+1]=rgb[1];rebuilt[i+2]=rgb[2];rebuilt[i+3]=255;}}
  if(!rebuilt.equals(rgba))throw Error('Rectangle decomposition did not reproduce exact Pixel Mill RGBA');
  const native={format:'max-native-pixel-rects',version:1,width:640,height:360,origin:{x:0,y:0},palette,
    rectEncoding:['x','y','width','height','paletteIndex'],rects,
    source:{recipe:'recipe.json',rgbaSha256:sha(rgba),processedPngSha256:sha(fs.readFileSync(path.join(out,'turtle-640x360.png')))},
    verification:{losslessRGBA:true,opaquePixels:opaque,transparentPixels:transparent,rectangles:rects.length,colors:palette.length}};
  fs.writeFileSync(path.join(out,'turtle-native-rects.json'),JSON.stringify(native)+'\n');
  fs.writeFileSync(path.join(out,'palette.json'),JSON.stringify(palette.map((color,index)=>({index,color,pixels:counts.get(color)})),null,2)+'\n');
  fs.writeFileSync(path.join(out,'recipe.json'),JSON.stringify(recipe,null,2)+'\n');
  fs.copyFileSync(__filename,path.join(out,'reproduce.cjs'));
  const report={pass:true,sourceCommit:recipe.source.commit,output:out,dimensions:[640,360],...native.verification,rgbaSha256:sha(rgba),errors,blocked,failed,
    exports:['pixel-mill-project.json','pixel-mill-export.zip','pixel-mill-figma-kit.zip','level.figma.json','turtle-640x360.png','turtle-640x360.rgba','turtle-native-rects.json','palette.json','connected-cuts.json','recipe.json'],
    figma:{synced:false,newSourceIds:false,importPackage:true},runtimeMasterPng:false};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();await new Promise(resolve=>server.close(resolve));
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
