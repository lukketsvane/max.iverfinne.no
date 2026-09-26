'use strict';
// Mechanical source registration/atlas packing. Creature designs come from
// image_gen; no generated pixel artwork is replaced with programmatic shapes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.join(__dirname,'..'),pack=path.join(root,'assets/garden-guardians-v1');
const inputs=JSON.parse(fs.readFileSync(path.join(pack,'prompts.json'))).assets;
const base=['10171c','1d2b34','2b4645','3d5146','536448','605047','82725b','b5b190','d7d4b1','493650','847088','547580','98b0b0','663d35','95523c'];
const amber=['795526','ab7833','d4a64e','f1cd79'],cyan=['4b8e92','77bbb9'];
const states=['idle','move','windup','attack','recover','vulnerable','hurt','death'];
function palette(state){return base.concat(state===2?amber:state===5?cyan:[]).map(s=>[parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4),16)]);}
function bounds(bytes,w=32,h=32){let x0=w,y0=h,x1=0,y1=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(bytes[(y*w+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}return x1?[x0,y0,x1,y1]:null;}
async function run(){
 fs.mkdirSync(path.join(pack,'source'),{recursive:true});fs.mkdirSync(path.join(pack,'native'),{recursive:true});
 const manifest=[];const previews=[];const pins=[];const provenance=[];
 for(const input of inputs){
  const sourcePath=path.join(pack,'source',input.id+'.png');
  if(process.argv.includes('--import')){
   const master=fs.readFileSync(input.source),raw=await sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const gridW=raw.info.width/4,gridH=raw.info.height/2;
   const cells=[];let maxW=0,maxH=0;
   for(let i=0;i<8;i++){const left=Math.round(i%4*gridW),top=Math.round(Math.floor(i/4)*gridH),cw=Math.round((i%4+1)*gridW)-left,ch=Math.round((Math.floor(i/4)+1)*gridH)-top;const b=await sharp(master).extract({left,top,width:cw,height:ch}).ensureAlpha().raw().toBuffer();const box=bounds(b,cw,ch);if(!box)throw Error('Missing pose');cells.push({b,box,cw,ch});maxW=Math.max(maxW,box[2]-box[0]);maxH=Math.max(maxH,box[3]-box[1]);}
   const scale=Math.min(28/maxW,29/maxH),native=Buffer.alloc(256*32*4);
   for(let i=0;i<8;i++){
    const {b,box,cw,ch}=cells[i],width=Math.max(1,Math.round((box[2]-box[0])*scale)),height=Math.max(1,Math.round((box[3]-box[1])*scale));
    const pose=await sharp(b,{raw:{width:cw,height:ch,channels:4}}).extract({left:box[0],top:box[1],width:box[2]-box[0],height:box[3]-box[1]}).resize(width,height,{kernel:'nearest'}).raw().toBuffer();
    const colors=palette(i),left=16-Math.ceil(width/2),top=32-height;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const a=(y*width+x)*4;if(pose[a+3]<128)continue;let color=colors[0],distance=Infinity;for(const c of colors){const d=c.reduce((s,v,j)=>s+(v-pose[a+j])**2,0);if(d<distance){distance=d;color=c;}}const q=((top+y)*256+i*32+left+x)*4;native[q]=color[0];native[q+1]=color[1];native[q+2]=color[2];native[q+3]=255;}
   }
   await sharp(native,{raw:{width:256,height:32,channels:4}}).png().toFile(sourcePath);
   provenance.push({id:input.id,masterSHA256:crypto.createHash('sha256').update(master).digest('hex'),masterSize:[raw.info.width,raw.info.height],uniformScale:scale});
  }
  const source=await sharp(sourcePath).ensureAlpha().raw().toBuffer();const out=Buffer.alloc(256*256*4),frames=[];
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
   let pose=row;if(row===0)pose=col===3||col===4?1:0;if(row===1)pose=col%4<2?0:1;
   if(row===2&&col<2)pose=0;if(row===4&&col>5)pose=0;
   const tile=Buffer.alloc(32*32*4);
   if(!(row===7&&col===7))for(let y=0;y<32;y++)source.copy(tile,y*32*4,(y*256+pose*32)*4,(y*256+pose*32+32)*4);
   for(let y=0;y<32;y++)tile.copy(out,((row*32+y)*256+col*32)*4,y*32*4,(y+1)*32*4);
   frames.push({sheet:'sprites',rect:[col*32,row*32,32,32],anchor:[16,31],opaqueBounds:bounds(tile)});
  }
  const png=await sharp(out,{raw:{width:256,height:256,channels:4}}).png().toBuffer(),file='assets/garden-guardians-v1/native/'+input.id+'.png';
  fs.writeFileSync(path.join(root,file),png);
  const data={schema:'max-native-atlas/v1',id:input.id,kind:'boss',cell:[32,32],anchor:[16,31],facing:'right',palette:base.concat(amber,cyan).map(s=>'#'+s),sheets:{sprites:{image:input.id+'.png',size:[256,256]}},frames,animations:Object.fromEntries(states.map((name,i)=>[name,{frames:Array.from({length:8},(_,j)=>i*8+j),fps:8,loop:['idle','move','vulnerable'].includes(name)}]))};
  fs.writeFileSync(path.join(pack,'native',input.id+'.json'),JSON.stringify(data,null,2)+'\n');manifest.push({id:input.id,manifest:'native/'+input.id+'.json'});
  pins.push({path:file,sha1:crypto.createHash('sha1').update(png).digest('hex'),width:256,height:256,note:'Native PNG verified byte-for-byte in current Figma production group 366:2 on 2026-09-26; legacy Draft 0:1 / source section 52:2 absent. See garden-guardians-v1/figma.json; pending global manifest reconciliation.'});
  previews.push({input:await sharp(sourcePath).extract({left:0,top:0,width:32,height:32}).png().toBuffer(),left:manifest.length*40-36,top:8});
 }
 fs.writeFileSync(path.join(pack,'manifest.json'),JSON.stringify({schema:'max-native-pack/v1',id:'garden-guardians-v1',assets:manifest},null,2)+'\n');
 if(provenance.length)fs.writeFileSync(path.join(pack,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
 const pendingPath=path.join(root,'assets/figma-pending.json'),pending=JSON.parse(fs.readFileSync(pendingPath));pending.files=pending.files.filter(e=>!e.path.startsWith('assets/garden-guardians-v1/')).concat(pins);fs.writeFileSync(pendingPath,JSON.stringify(pending,null,1)+'\n');
 const contact=await sharp({create:{width:inputs.length*40+8,height:44,channels:4,background:'#52646a'}}).composite(previews).png().toBuffer();
 await sharp(contact).resize((inputs.length*40+8)*4,176,{kernel:'nearest'}).png().toFile(path.join(pack,'contact-4x.png'));
 console.log('Packed '+inputs.length+' native guardian atlases.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
