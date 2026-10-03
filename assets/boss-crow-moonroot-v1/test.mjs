import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
// Same module used by native-art.mjs, not an invented runtime API.
import { sampleFrame, drawAtlas } from '../native-atlas.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const read=name=>JSON.parse(readFileSync(join(root,name),'utf8'));
function decode(path){
 const b=readFileSync(path);assert.equal(b.subarray(1,4).toString(),'PNG');let p=8,idat=[],w,h,plte,trns;
 while(p<b.length){const n=b.readUInt32BE(p),kind=b.toString('ascii',p+4,p+8),data=b.subarray(p+8,p+8+n);p+=n+12;
  if(kind==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],3);}
  if(kind==='PLTE')plte=data;if(kind==='tRNS')trns=data;if(kind==='IDAT')idat.push(data);
 }
 const raw=inflateSync(Buffer.concat(idat)),pixels=Buffer.alloc(w*h);assert.equal(raw.length,h*(w+1));
 for(let y=0;y<h;y++){assert.equal(raw[y*(w+1)],0);raw.copy(pixels,y*w,y*(w+1)+1,(y+1)*(w+1));}
 return {w,h,pixels,plte,trns};
}
for(const kind of ['raven','moonroot','effects']){
 const manifest=read(kind+'.json'),image=decode(join(root,kind+'.png'));
 test(kind+': exact atlas grid, native palette, binary alpha, transparent gutter',()=>{
  assert.deepEqual([image.w,image.h],manifest.sheets.main.size);assert.equal(image.trns[0],0);assert.ok([...image.trns.subarray(1)].every(a=>a===255));
  assert.deepEqual([...image.plte.subarray(0,3)],[0,0,0]);
  const palette=read('manifest.json').palette.map(x=>x.slice(1)).join('');assert.equal(image.plte.toString('hex'),palette);
  for(const f of Object.values(manifest.frames)){
   const [x,y,w,h]=f.rect;assert.ok([x,y,w,h,...f.anchor].every(Number.isInteger));assert.ok(x>=0&&y>=0&&x+w<=image.w&&y+h<=image.h);
   for(let xx=0;xx<w;xx++){assert.equal(image.pixels[y*image.w+x+xx],0);assert.equal(image.pixels[(y+h-1)*image.w+x+xx],0);}
   for(let yy=0;yy<h;yy++){assert.equal(image.pixels[(y+yy)*image.w+x],0);assert.equal(image.pixels[(y+yy)*image.w+x+w-1],0);}
  }
 });
 test(kind+': all isolated PNGs byte-match their atlas cutouts',()=>{
  assert.equal(readdirSync(join(root,'frames',kind)).filter(x=>x.endsWith('.png')).length,Object.keys(manifest.frames).length);
  for(const [name,f] of Object.entries(manifest.frames)){
   const crop=decode(join(root,'frames',kind,name+'.png')),[x,y,w,h]=f.rect;assert.deepEqual([crop.w,crop.h],[w,h]);
   for(let yy=0;yy<h;yy++)assert.deepEqual(crop.pixels.subarray(yy*w,(yy+1)*w),image.pixels.subarray((y+yy)*image.w+x,(y+yy)*image.w+x+w));
  }
 });
 test(kind+': existing sampler handles clips, tells and non-looping death',()=>{
  for(const [name,clip] of Object.entries(manifest.animations)){
   assert.equal(sampleFrame(manifest,name,0),manifest.frames[clip.frames[0]]);
   assert.equal(sampleFrame(manifest,name,10,1),manifest.frames[clip.frames.at(-1)]);
   if(!clip.loop)assert.equal(sampleFrame(manifest,name,100),manifest.frames[clip.frames.at(-1)]);
  }
 });
 test(kind+': existing renderer draws all frames 1:1, both facings, integer anchors',()=>{
  const calls=[],ctx={save(){},restore(){},translate(...x){calls.push(['translate',...x]);},scale(...x){calls.push(['scale',...x]);},drawImage(...x){calls.push(['draw',...x]);}};
  for(const name of Object.keys(manifest.animations))for(const facing of [1,-1]){
   calls.length=0;const frame=drawAtlas(ctx,{manifest,images:{main:{}}},name,.3,20.4,40.6,{facing});
   const draw=calls.find(x=>x[0]==='draw');assert.equal(draw[4],draw[8]);assert.equal(draw[5],draw[9]);assert.deepEqual(calls[0],['translate',20,41]);
   assert.equal(ctx.imageSmoothingEnabled,false);if(facing<0)assert.ok(calls.some(x=>x[0]==='scale'&&x[1]===-1));
   assert.ok(frame);
  }
 });
}
test('Bodies keep one ground anchor; fx/sprouts are not mislabelled body frames',()=>{
 for(const kind of ['raven','moonroot'])for(const f of Object.values(read(kind+'.json').frames))assert.deepEqual(f.anchor,[24,44]);
 assert.equal(Object.keys(read('raven.json').frames).length,32);assert.equal(Object.keys(read('moonroot.json').frames).length,30);
 const fx=read('effects.json').frames;assert.ok(fx.vine_lash&&fx.sprout_blue&&fx.sprout_curl&&fx.sprout_pink);
});
