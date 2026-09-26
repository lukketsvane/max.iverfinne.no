'use strict';
// Mechanical contact animation of authored native frames. No art is redrawn.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),pack=path.join(root,'assets/garden-guardians-v1');
const ids=JSON.parse(fs.readFileSync(path.join(pack,'manifest.json'))).assets.map(a=>a.id);
const phases=['idle','move','windup','attack','recover','vulnerable','hurt','death'];
async function run(){
 const sources=await Promise.all(ids.map(async id=>({atlas:JSON.parse(fs.readFileSync(path.join(pack,'native',id+'.json'))),raw:await sharp(path.join(pack,'native',id+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true})})));
 const w=4*48,h=4*44,scale=4,frames=[];
 for(const phase of phases)for(let step=0;step<4;step++){
  const pixels=Buffer.alloc(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;pixels[i]=0x1d;pixels[i+1]=0x2b;pixels[i+2]=0x34;pixels[i+3]=255;}
  sources.forEach(({atlas,raw},i)=>{
   const clip=atlas.animations[phase],frame=atlas.frames[clip.frames[Math.min(step,clip.frames.length-1)]],[sx,sy]=frame.rect;
   const dx=i%4*48+8,dy=Math.floor(i/4)*44+6;
   for(let y=0;y<32;y++)for(let x=0;x<32;x++){const p=((sy+y)*raw.info.width+sx+x)*4;if(raw.data[p+3])raw.data.copy(pixels,((dy+y)*w+dx+x)*4,p,p+4);}
  });
  frames.push(await sharp(pixels,{raw:{width:w,height:h,channels:4}}).resize(w*scale,h*scale,{kernel:'nearest'}).raw().toBuffer());
 }
 const dest=path.join(root,'docs/asset-review/guardian-motion');fs.mkdirSync(dest,{recursive:true});
 await sharp(Buffer.concat(frames),{raw:{width:w*scale,height:h*scale*frames.length,channels:4,pageHeight:h*scale}}).gif({loop:0,delay:200,dither:0,effort:7}).toFile(path.join(dest,'guardians-animated.gif'));
 console.log('Exported 16 guardians, eight actions, four authored frames per action.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
