'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const dir=path.join(__dirname,'../docs/asset-review/raider-drone-v1');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'atlas.json')));
const report=JSON.parse(fs.readFileSync(path.join(dir,'validation.json')));
// Decode the committed indexed PNGs (8-bit indices) with all five PNG filters.
function decode(name){
 const b=fs.readFileSync(path.join(dir,name));assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 let w,h,palette,alpha=Buffer.alloc(256,255),idat=[];
 for(let p=8;p<b.length;){const n=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8),data=b.subarray(p+8,p+8+n);p+=n+12;
  if(t==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],3);assert.equal(data[12],0);}
  if(t==='PLTE')palette=data;if(t==='tRNS')data.copy(alpha);if(t==='IDAT')idat.push(data);
 }
 const raw=zlib.inflateSync(Buffer.concat(idat));assert.equal(raw.length,(w+1)*h);
 const pixels=Buffer.alloc(w*h),rgba=Buffer.alloc(w*h*4);
 const paeth=(a,b,c)=>{let p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<h;y++){const filter=raw[y*(w+1)];assert.ok(filter<=4);
  for(let x=0;x<w;x++){const i=y*w+x,a=x?pixels[i-1]:0,b=y?pixels[i-w]:0,c=x&&y?pixels[i-w-1]:0;
   pixels[i]=(raw[y*(w+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;
   const k=pixels[i];for(let j=0;j<3;j++)rgba[4*i+j]=palette[3*k+j];rgba[4*i+3]=alpha[k];
  }
 }return{w,h,rgba,file:b};
}
const sheets=Object.fromEntries(Object.entries(manifest.sheets).map(([k,v])=>[k,decode(v.image)]));
for(const [key,s] of Object.entries(sheets))test(`${key}: exact native size, binary alpha and native palette`,()=>{
 assert.deepEqual([s.w,s.h],[512,64]);const allowed=new Set(manifest.palette.map(c=>c.slice(1).toLowerCase()));
 for(let i=0;i<s.rgba.length;i+=4){const a=s.rgba[i+3];assert.ok(a===0||a===255);const rgb=s.rgba.subarray(i,i+3).toString('hex');assert.ok(a?allowed.has(rgb):rgb==='000000');}
 assert.equal(crypto.createHash('sha256').update(s.file).digest('hex'),report.sha256[manifest.sheets[key].image]);
});
test('32 distinct isolated poses, fixed core and no clipped frame edges',()=>{
 assert.equal(Object.keys(manifest.frames).length,32);const unique=new Set();
 for(const f of Object.values(manifest.frames)){
  const[x,y,w,h]=f.rect;assert.deepEqual([w,h],[64,64]);assert.deepEqual(f.anchor,[32,32]);
  assert.ok(x>=0&&x+w<=512&&y>=0&&y+h<=64);const b=Buffer.alloc(w*h*4);
  for(let row=0;row<h;row++)sheets[f.sheet].rgba.copy(b,row*w*4,((y+row)*512+x)*4,((y+row)*512+x+w)*4);
  assert.equal(b[(32*64+32)*4+3],255);
  for(let n=0;n<64;n++)for(const i of[n,63*64+n,n*64,n*64+63])assert.equal(b[i*4+3],0);
  unique.add(crypto.createHash('sha256').update(b).digest('hex'));
 }assert.equal(unique.size,32);
});
test('payload split reassembles the exact complete sprite, with no overlap',()=>{
 const a=sheets.airframe.rgba,p=sheets.payloadFx.rgba,full=sheets.drone2.rgba;
 for(let i=0;i<a.length;i+=4){assert.ok(!(a[i+3]&&p[i+3]));assert.deepEqual((p[i+3]?p:a).subarray(i,i+4),full.subarray(i,i+4));}
});
test('all eight clips and crop origins resolve without false resurrection',()=>{
 assert.equal(Object.keys(manifest.animations).length,8);
 for(const c of Object.values(manifest.animations)){assert.ok(c.fps>0&&c.frames.length);for(const id of c.frames)assert.ok(manifest.frames[id]);}
 assert.equal(manifest.animations.death.loop,false);assert.deepEqual(manifest.animations.death.frames,['pose_26','pose_27','pose_28']);
 for(const f of Object.values(manifest.frames)){assert.deepEqual(f.trimmed.anchor,f.anchor.map((v,i)=>v-f.trimmed.offset[i]));for(const n of f.sockets.claw)assert.ok(Number.isInteger(n)&&n>=0&&n<64);}
});
test('current native atlas adapter draws 1:1, snaps anchors, mirrors, and holds death',async()=>{
 const{drawAtlas,sampleFrame}=await import('../assets/native-atlas.mjs');
 const calls=[];const ctx={save(){},restore(){},translate(...v){calls.push(['translate',...v]);},scale(...v){calls.push(['scale',...v]);},drawImage(...v){calls.push(['drawImage',...v]);}};
 const a={manifest,images:{drone0:'PNG',drone1:'PNG',drone2:'PNG',drone3:'PNG'}};
 for(const clip of Object.keys(manifest.animations))for(const facing of[-1,1]){
  calls.length=0;drawAtlas(ctx,a,clip,0.2,100.25,71.7,{facing});
  const draw=calls.find(c=>c[0]==='drawImage');assert.deepEqual(draw.slice(4,6),[64,64]);assert.deepEqual(draw.slice(-4),[-32,-32,64,64]);
  assert.deepEqual(calls[0],['translate',100,72]);assert.equal(ctx.imageSmoothingEnabled,false);
 }
 assert.equal(sampleFrame(manifest,'death',999),manifest.frames.pose_28);
 assert.equal(sampleFrame(manifest,'idle',1),manifest.frames.pose_00);
});
