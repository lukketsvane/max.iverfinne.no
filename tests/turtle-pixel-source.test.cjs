'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'docs/design/turtle-level-04');
const source=path.join(directory,'pixel-mill');
const read=name=>fs.readFileSync(path.join(source,name));
const json=name=>JSON.parse(read(name));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const PHOTO7='c5c8886e855fd2020b7c29c848df3799cc5b8603234e682d909ca379d5429a82';
const PHOTO8='fdd1e07ebf98fc1deea2c06dcbb712a1fd7756444d18f92bc760652da3d63ec0';
const RGBA='35e9e8ab3deef23d9cc3c5911460c2306ac6dc7bb52d7168232b1f6f1d6510c3';
const PNG='7f6c7f626fd3fa9a6700cf33b0332b98d839dcc15304581c39f5893c2b96e9e1';
const MODULES={
  'pixel-core.mjs':'35adc6490b0eb57ec63852a4f0455560179668e52d367610c252279960c523f6',
  'png.mjs':'bac7833380c86589fb42776d51877507329eff43ef659b4cd4903571eebd197b',
  'agent.mjs':'05a702502400e25da6e8ccc323025c36a05bebf855c8c7d3f05621c0f5790d24',
  'io.mjs':'5c3e8fcb323a56f764780768a4469b4f203104d4f38bdd6eb2f161e174e8955d',
  'geometry.mjs':'91f35c29cdcef21b27cb27786d26bb90980ffbec582869b157792e3638649ffe',
  'engine.mjs':'d2b659a390a5720525e491cab183b90b916da1b2823bba6314ef48a6d92185aa',
  'figma-bridge.mjs':'c7dc178dc592df2496aec4b9ea865fe0d007717248753c70d7594e73d85727df',
  'figma-plugin.mjs':'d52b738eba936f1ac156c4ee8d57e3271e1ac8eaf7ff5890616a47adb3356636',
};
const decoder=import(pathToFileURL(path.join(root,'scripts/figma-sync.mjs')).href);

function jpegDimensions(bytes){
  assert.equal(bytes.readUInt16BE(0),0xffd8,'immutable source is a JPEG');
  let at=2;
  while(at<bytes.length){
    assert.equal(bytes[at++],0xff);
    while(bytes[at]===0xff)at++;
    const marker=bytes[at++];
    if(marker===0xd9||marker===0xda)break;
    if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
    const size=bytes.readUInt16BE(at);
    if([0xc0,0xc1,0xc2].includes(marker))return [bytes.readUInt16BE(at+5),bytes.readUInt16BE(at+3)];
    assert.ok(size>=2&&at+size<=bytes.length);at+=size;
  }
  throw Error('JPEG has no supported dimensions');
}
function zipEntries(bytes){
  const entries=new Map();let at=0;
  while(at+30<=bytes.length&&bytes.readUInt32LE(at)===0x04034b50){
    const flags=bytes.readUInt16LE(at+6),method=bytes.readUInt16LE(at+8),size=bytes.readUInt32LE(at+18);
    const nameLength=bytes.readUInt16LE(at+26),extraLength=bytes.readUInt16LE(at+28);
    assert.equal(flags&9,0,'local export has no encryption or deferred sizes');
    const name=bytes.toString('utf8',at+30,at+30+nameLength),start=at+30+nameLength+extraLength;
    assert.ok(!entries.has(name)&&start+size<=bytes.length);
    const body=bytes.subarray(start,start+size);
    assert.ok(method===0||method===8,'supported actual ZIP encoding');
    entries.set(name,method===0?body:zlib.inflateRawSync(body));at=start+size;
  }
  assert.ok(entries.size>0&&bytes.readUInt32LE(at)===0x02014b50,'actual export has a central directory');
  return entries;
}
async function expectedPixels(bytes){
  const image=(await decoder).decode(bytes);
  assert.deepEqual([image.width,image.height],[640,360]);
  assert.equal(sha(image.rgba),RGBA,'export retains the selected Pixel Mill pixels');
  return image.rgba;
}
function imageBytes(src){
  assert.match(src,/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  return Buffer.from(src.slice(src.indexOf(',')+1),'base64');
}

test('turtle treatment preserves both user JPEGs and the actual two-pass Pixel Mill recipe',()=>{
  const photo7=read('photo-7-source.jpg'),photo8=fs.readFileSync(path.join(directory,'references/photo-8-source.jpg'));
  assert.equal(sha(photo7),PHOTO7);assert.deepEqual(jpegDimensions(photo7),[1280,720]);
  assert.equal(sha(photo8),PHOTO8);assert.deepEqual(jpegDimensions(photo8),[1280,960]);
  const recipe=json('recipe.json');
  assert.equal(recipe.format,'max-pixel-mill-native-art-recipe');assert.equal(recipe.version,1);
  assert.equal(recipe.input,'photo-7-source.jpg');assert.equal(recipe.inputSha256,PHOTO7);
  assert.deepEqual(recipe.inputDimensions,{width:1280,height:720});
  assert.equal(recipe.source.repository,'https://github.com/lukketsvane/pixel-mill.iverfinne.no');
  assert.equal(recipe.source.commit,'16cf029abf8e5f7ab791421b17f722d5fc5ff00c');
  assert.deepEqual(recipe.prepass,{function:'removeBackground',color:[255,255,255],tolerance:15,mode:'all',enabled:true,dimensions:'original source dimensions'});
  assert.deepEqual(recipe.options,{width:640,height:360,color:[255,255,255],tolerance:80,mode:'edge',remove:true,palette:48,minArea:1,connectivity:8,bridge:0});
  assert.equal(recipe.source.modules.length,Object.keys(MODULES).length);
  for(const entry of recipe.source.modules){
    assert.equal(entry.sha256,MODULES[entry.name],entry.name+' names the captured Pixel Mill version');
    assert.equal(sha(fs.readFileSync(path.join(directory,'pixel-mill-source/dist',entry.name))),entry.sha256);
  }
  const audit=json('preprocessing-audit.json'),report=json('report.json');
  assert.equal(audit.pass,true);assert.deepEqual(audit.functions,['removeBackground','processPixels']);
  assert.deepEqual(audit.inputDecodedRGBA,{width:1280,height:720,sha256:'16f725fd2170afc1e7ce5ef3781a419f13e55d7aadb31da8c6865b6128046af0'});
  assert.deepEqual(audit.prepassRGBA,{width:1280,height:720,sha256:'973a5f2d12a8db8c06f9da2a9012776bee11464b033c15afbf08bb98af5a032a'});
  assert.deepEqual(audit.finalRGBA,{width:640,height:360,sha256:RGBA});
  assert.equal(audit.nativeScale,.5);assert.deepEqual(recipe.preprocessingHashes,audit);
  assert.equal(report.pass,true);assert.equal(report.rgbaSha256,RGBA);
  assert.deepEqual(report.preprocessingHashes,audit);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.blocked,[]);assert.deepEqual(report.failed,[]);
  assert.deepEqual(report.figma,{synced:false,newSourceIds:false,importPackage:true});
  const modules=json('live-module-audit.json');assert.equal(modules.pass,true);
  assert.equal(modules.modules.length,Object.keys(MODULES).length);
  for(const entry of modules.modules){assert.equal(entry.liveSha256,MODULES[entry.name]);assert.equal(entry.preservedSha256,entry.liveSha256);assert.equal(entry.matches,true);}
  const provenance=JSON.parse(fs.readFileSync(path.join(directory,'provenance.json')));
  assert.equal(provenance.figma.synchronized,false);assert.equal(provenance.runtimeMasterPng,false);
  assert.equal(provenance.figma.authenticatedCapture,null,'local Figma kit makes no synchronization claim');
  for(const file of provenance.files){
    assert.ok(!path.isAbsolute(file.path)&&!file.path.split('/').includes('..'));
    assert.equal(sha(fs.readFileSync(path.join(directory,file.path))),file.sha256,file.path);
  }
  const replay=JSON.parse(fs.readFileSync(path.join(directory,'source-replay-audit.json')));
  assert.equal(replay.pass,true);assert.equal(replay.report.rgbaSha256,RGBA);
  assert.deepEqual(replay.verifiedFiles.map(f=>[f.path,f.byteEqual,f.sha256]),[
    ['turtle-640x360.png',true,PNG],['turtle-640x360.rgba',true,RGBA],
    ['turtle-native-rects.json',true,sha(read('turtle-native-rects.json'))],
  ]);
});

test('the complete native rectangle ledger matches normalized RGBA without overlaps, missing pixels or palette drift',async()=>{
  const png=read('turtle-640x360.png'),rgba=read('turtle-640x360.rgba'),native=json('turtle-native-rects.json');
  assert.equal(sha(png),PNG);assert.equal(sha(rgba),RGBA);assert.deepEqual(await expectedPixels(png),rgba);
  assert.equal(native.format,'max-native-pixel-rects');assert.equal(native.version,1);
  assert.deepEqual([native.width,native.height],[640,360]);assert.deepEqual(native.origin,{x:0,y:0});
  assert.deepEqual(native.rectEncoding,['x','y','width','height','paletteIndex']);
  assert.equal(native.source.rgbaSha256,RGBA);assert.equal(native.source.processedPngSha256,PNG);
  assert.equal(native.palette.length,48);assert.equal(new Set(native.palette).size,48);
  assert.ok(native.palette.every(c=>/^#[0-9a-f]{6}$/.test(c)));
  const palette=native.palette.map(c=>Buffer.from(c.slice(1),'hex')),covered=new Uint8Array(640*360),rebuilt=Buffer.alloc(rgba.length);
  for(const rect of native.rects){
    assert.equal(rect.length,5);assert.ok(rect.every(Number.isInteger));
    const [x,y,w,h,index]=rect;
    assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=640&&y+h<=360&&index>=0&&index<palette.length);
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
      const pixel=yy*640+xx,at=pixel*4;
      assert.equal(covered[pixel],0,'editable rectangles never overlap');covered[pixel]=1;
      rebuilt.set(palette[index],at);rebuilt[at+3]=255;
    }
  }
  assert.deepEqual(rebuilt,rgba,'all opaque pixels have exact source colors and all empty space remains empty');
  const colors=new Set();let opaque=0;
  for(let at=0;at<rgba.length;at+=4){
    assert.ok(rgba[at+3]===0||rgba[at+3]===255,'native alpha is binary');
    if(rgba[at+3]){opaque++;colors.add('#'+rgba.subarray(at,at+3).toString('hex'));}
    else assert.equal(rgba[at]+rgba[at+1]+rgba[at+2],0,'transparent RGB is zero');
  }
  assert.deepEqual([...colors].sort(),native.palette);
  assert.deepEqual(native.verification,{losslessRGBA:true,opaquePixels:opaque,transparentPixels:640*360-opaque,rectangles:native.rects.length,colors:48});
});

test('actual editor and Figma import exports carry the same selected native treatment',async()=>{
  const project=json('pixel-mill-project.json'),transfer=json('level.figma.json');
  assert.equal(project.format,'max-level-studio');assert.equal(project.version,1);
  assert.equal(project.assets.length,1);assert.equal(project.objects.length,1);
  assert.deepEqual([project.objects[0].x,project.objects[0].y,project.objects[0].w,project.objects[0].h,project.objects[0].rotation],[0,0,640,360,0]);
  assert.equal(project.objects[0].kind,'decor','exported artwork does not pretend to author collision');
  assert.equal(project.objects[0].asset,project.assets[0].id);
  await expectedPixels(imageBytes(project.assets[0].src));
  assert.equal(transfer.format,'pixel-mill-figma');assert.equal(transfer.version,1);
  assert.deepEqual(transfer.project,project);assert.deepEqual(transfer.bounds,{x:0,y:0,w:640,h:360});
  for(const image of transfer.rasters)await expectedPixels(imageBytes(image.src));
  const editor=zipEntries(read('pixel-mill-export.zip')),kit=zipEntries(read('pixel-mill-figma-kit.zip'));
  assert.deepEqual(JSON.parse(editor.get('level.json')),project);
  assert.deepEqual(JSON.parse(kit.get('level.json')),project);
  assert.deepEqual(JSON.parse(kit.get('level.figma.json')),transfer);
  for(const [name,bytes] of editor)if(name.endsWith('.png'))await expectedPixels(bytes);
  assert.ok(editor.has('garden-geometry.json')&&kit.has('figma-plugin/manifest.json')&&kit.has('figma-plugin/code.js'));
});

test('runtime source generation is exact and the ordinary Figma production contract remains unchanged',()=>{
  const native=json('turtle-native-rects.json'),data=require('../turtle-garden-art-data.js');
  assert.equal(data.schema,1);assert.equal(data.source,'Pixel Mill');assert.equal(data.sourceSha256,PHOTO7);
  assert.equal(data.rgbaSha256,RGBA);assert.equal(data.recipeSha256,sha(read('recipe.json')));
  assert.deepEqual([data.width,data.height],[640,360]);assert.deepEqual(data.palette,native.palette);assert.deepEqual(data.rects,native.rects);
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'turtle-source-'));
  try{
    const result=require('../scripts/build-turtle-art.cjs')(source),file=path.join(output,'turtle-garden-art-data.js');
    fs.writeFileSync(file,result.code);
    assert.deepEqual(fs.readFileSync(file),fs.readFileSync(path.join(root,'turtle-garden-art-data.js')),'generator reproduces committed editable runtime data');
  }finally{fs.rmSync(output,{recursive:true,force:true});}
  assert.equal(sha(fs.readFileSync(path.join(root,'assets/figma-manifest.json'))),'332492df488c2d11bbc53ab4d66ee95ff7a06ab27ce680c95da3968c082d2f53','original Figma production entries and pins stay intact');
});
