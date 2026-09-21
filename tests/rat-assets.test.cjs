'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.join(__dirname,'../assets/rat-enemies-v1');
const source=JSON.parse(fs.readFileSync(path.join(root,'source-poses.json')));
const expected=zlib.inflateSync(Buffer.from(source.framesZlibBase64,'base64'));
function decode(file){
 const data=fs.readFileSync(file);assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 let w,h,palette,alpha,chunks=[];
 for(let p=8;p<data.length;){const n=data.readUInt32BE(p),type=data.toString('ascii',p+4,p+8),part=data.subarray(p+8,p+8+n);p+=12+n;
  if(type==='IHDR'){w=part.readUInt32BE(0);h=part.readUInt32BE(4);assert.deepEqual([...part.subarray(8)],[8,3,0,0,0]);}
  if(type==='PLTE')palette=part;if(type==='tRNS')alpha=part;if(type==='IDAT')chunks.push(part);
 }
 const raw=zlib.inflateSync(Buffer.concat(chunks)),pixels=Buffer.alloc(w*h);assert.equal(raw.length,(w+1)*h);
 for(let y=0;y<h;y++){assert.equal(raw[y*(w+1)],0,'deterministic exporter uses unfiltered indexed rows');raw.copy(pixels,y*w,y*(w+1)+1,(y+1)*(w+1));}
 assert.deepEqual([...alpha],[0,...Array(15).fill(255)]);assert.equal(palette.length,48);
 for(const index of pixels)assert.ok(index<16);
 return {w,h,pixels,palette,alpha};
}
for(const variant of ['common','black','albino','plague'])test(variant+': exact native atlas, 39 isolated cells, binary alpha, fixed anchors and empty death',()=>{
 const atlas=JSON.parse(fs.readFileSync(path.join(root,variant,'atlas.json'))),sheet=decode(path.join(root,variant,'sprites.png'));
 assert.deepEqual([sheet.w,sheet.h],[384,160]);assert.equal(Object.keys(atlas.frames).length,39);
 const colors=Array.from({length:15},(_,i)=>'#'+sheet.palette.subarray((i+1)*3,(i+2)*3).toString('hex'));
 assert.deepEqual(atlas.palette,colors);
 source.names.forEach((name,i)=>{
  const frame=atlas.frames[name],single=decode(path.join(root,variant,'frames',name+'.png'));
  assert.deepEqual([single.w,single.h],[48,32]);assert.deepEqual(frame.anchor,[28,28]);assert.deepEqual(frame.rect,[(i%8)*48,Math.floor(i/8)*32,48,32]);
  assert.deepEqual(single.pixels,expected.subarray(i*48*32,(i+1)*48*32));assert.deepEqual(single.palette,sheet.palette);
  for(let y=0;y<32;y++)assert.deepEqual(single.pixels.subarray(y*48,(y+1)*48),sheet.pixels.subarray((frame.rect[1]+y)*384+frame.rect[0],(frame.rect[1]+y)*384+frame.rect[0]+48));
  for(let y=0;y<32;y++){assert.equal(single.pixels[y*48],0);assert.equal(single.pixels[y*48+47],0);}
  assert.ok(single.pixels.subarray(0,48).every(p=>!p));assert.ok(single.pixels.subarray(31*48).every(p=>!p));
  if(name==='death-empty')assert.ok(single.pixels.every(p=>!p));else assert.ok(single.pixels.some(Boolean));
 });
 for(const clip of Object.values(atlas.animations)){assert.ok(clip.fps>0);assert.ok(clip.frames.length);for(const name of clip.frames)assert.ok(atlas.frames[name]);}
 assert.equal(atlas.animations.death.loop,false);assert.equal(atlas.animations.death.frames.at(-1),'death-empty');
});
test('all 38 extracted poses are distinct; variants reuse geometry without duplicating invented animation',()=>{
 assert.equal(source.names.length,39);const frames=source.names.slice(0,38).map((_,i)=>expected.subarray(i*1536,(i+1)*1536).toString('base64'));
 assert.equal(new Set(frames).size,38);assert.equal(source.names.at(-1),'death-empty');
});
