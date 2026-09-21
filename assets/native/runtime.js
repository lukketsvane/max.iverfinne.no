/* Native 1x asset loader. Coordinates are ART pixels after subtracting camX/Y.
   No canvas resizing, no simulation, no globals modified, no per-sprite scale. */
(function(root){
'use strict';
const validNumber=n=>typeof n==='number'&&Number.isFinite(n);
function loadImage(url){return new Promise((resolve,reject)=>{const im=new Image();im.crossOrigin="anonymous";im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Cannot load sprite sheet: '+url));im.src=url;});}
class NativeSprites{
 constructor(){this.sheets={};this.ready=false;}
 async load(base='assets/native/'){
  const names=['rover','water-fx','props','ui'];
  const loaded=await Promise.all(names.map(async name=>{
   const response=await fetch(base+name+'.json');if(!response.ok)throw new Error('Missing sprite metadata: '+name);
   const meta=await response.json();const image=await loadImage(base+name+'.png');
   if(image.naturalWidth!==meta.meta.size.w||image.naturalHeight!==meta.meta.size.h)throw new Error('Atlas dimensions disagree: '+name);
   for(const f of Object.values(meta.frames)){
    const r=f.frame;
    if(![r.x,r.y,r.w,r.h,f.anchor.x,f.anchor.y].every(Number.isInteger)||r.x<0||r.y<0||r.w<1||r.h<1||r.x+r.w>image.naturalWidth||r.y+r.h>image.naturalHeight)throw new Error('Invalid native frame: '+name);
   }
   return [name,{meta,image}];
  }));
  this.sheets=Object.fromEntries(loaded);this.ready=true;return this;
 }
 frame(sheet,animation,seconds){
  if(!this.ready)throw new Error('Await NativeSprites.load() before drawing');
  const s=this.sheets[sheet];if(!s)throw new Error('Unknown atlas: '+sheet);
  const a=s.meta.animations[animation];
  if(!a){if(s.meta.frames[animation])return s.meta.frames[animation];throw new Error('Unknown animation or frame: '+animation);}
  if(!validNumber(seconds)||seconds<0)throw new Error('Animation seconds must be finite and non-negative');
  let n=Math.floor(seconds*1000/a.frameDurationMs);
  n=a.loop?n%a.frames.length:Math.min(n,a.frames.length-1);
  return s.meta.frames[a.frames[n]];
 }
 drawFrame(ctx,sheet,f,x,y,flip=false,anchor=f.anchor){
  if(!validNumber(x)||!validNumber(y))throw new Error('Draw coordinates must be finite');
  const s=this.sheets[sheet],r=f.frame;
  const dx=Math.round(x)-anchor.x,dy=Math.round(y)-anchor.y;
  ctx.save();ctx.imageSmoothingEnabled=false;
  if(flip){ctx.translate(dx+r.w,dy);ctx.scale(-1,1);ctx.drawImage(s.image,r.x,r.y,r.w,r.h,0,0,r.w,r.h);}
  else ctx.drawImage(s.image,r.x,r.y,r.w,r.h,dx,dy,r.w,r.h);
  ctx.restore();
  return {x:dx,y:dy,w:r.w,h:r.h};
 }
 drawRover(ctx,{x,y,animation='idle',seconds=0,facing=-1}){
  if(facing!==-1&&facing!==1)throw new Error('facing must be -1 (left) or 1 (right)');
  const f=this.frame('rover',animation,seconds),flip=facing===1;
  const r=this.drawFrame(ctx,'rover',f,x,y,flip);
  return {emitter:{x:r.x+(flip?f.frame.w-1-f.emitter.x:f.emitter.x),y:r.y+f.emitter.y},rect:r};
 }
 drawSpray(ctx,emitter,seconds,facing=-1){
  const f=this.frame('water-fx','spray',seconds),flip=facing===1;
  this.drawFrame(ctx,'water-fx',f,emitter.x,emitter.y,flip,{x:flip?1:14,y:0});
 }
 drawProp(ctx,name,x,y){this.drawFrame(ctx,'props',this.frame('props',name,0),x,y);}
}
root.MaxNativeSprites=NativeSprites;
if(typeof module!=='undefined'&&module.exports)module.exports=NativeSprites;
})(typeof window==='undefined'?globalThis:window);
