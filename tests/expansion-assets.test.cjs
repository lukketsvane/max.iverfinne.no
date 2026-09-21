'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const crypto=require('node:crypto'),assert=require('node:assert/strict'),test=require('node:test');
const root=path.join(__dirname,'../assets/expansion');
const api=require(path.join(root,'sprites.js'));
const manifest=api.expand(JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')));
const checksums=JSON.parse(fs.readFileSync(path.join(root,'checksums.json'),'utf8'));
// The delivered files are deterministic indexed PNGs: 8 bits, filter 0,
// standard PLTE/tRNS, no interlace or colour profiles. No npm dependency.
function png(name){
 const b=fs.readFileSync(path.join(root,name));assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 let w,h,depth,type,palette,alpha,parts=[];
 for(let at=8;at<b.length;){const n=b.readUInt32BE(at),t=b.toString('ascii',at+4,at+8),d=b.subarray(at+8,at+8+n);assert.ok(at+n+12<=b.length);
  if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);depth=d[8];type=d[9];assert.equal(d[12],0);}
  if(t==='PLTE')palette=d;if(t==='tRNS')alpha=d;if(t==='IDAT')parts.push(d);at+=n+12;
 }
 assert.equal(depth,8);assert.equal(type,3);assert.ok(palette&&alpha);assert.equal(alpha.length,palette.length/3);assert.equal(alpha[0],0);
 for(let i=1;i<alpha.length;i++)assert.equal(alpha[i],255);assert.deepEqual([...palette.subarray(0,3)],[0,0,0]);
 const raw=zlib.inflateSync(Buffer.concat(parts));assert.equal(raw.length,(w+1)*h);
 const data=new Uint8Array(w*h);for(let y=0;y<h;y++){assert.equal(raw[y*(w+1)],0);data.set(raw.subarray(y*(w+1)+1,(y+1)*(w+1)),y*w);}
 for(const i of data)assert.ok(i<alpha.length);
 return {w,h,data,palette,alpha,b};
}
function imageMap(){return Object.fromEntries(Object.entries(manifest.sheets).map(([n,s])=>[n,{width:s.size[0],height:s.size[1]}]));}
function mockContext(){const calls=[];return {calls,imageSmoothingEnabled:true,save(){calls.push(['save']);},restore(){calls.push(['restore']);},translate(...a){calls.push(['translate',...a]);},scale(...a){calls.push(['scale',...a]);},drawImage(...a){calls.push(['drawImage',...a]);}};}
test('delivery contains nine sheets and 432 registered states/frames',()=>{assert.equal(manifest.pixelScale,1);assert.equal(Object.keys(manifest.sheets).length,9);assert.equal(Object.values(manifest.sheets).reduce((n,s)=>n+s.count,0),432);});
for(const [name,s] of Object.entries(manifest.sheets))test(name+': binary alpha, exact hash, aligned grid, bounds and sockets',()=>{
 const p=png(s.file);assert.deepEqual([p.w,p.h],s.size);assert.equal(crypto.createHash('sha256').update(p.b).digest('hex'),checksums[s.file]);
 assert.deepEqual([s.columns*s.cell[0],s.rows*s.cell[1]],s.size);assert.equal(s.count,s.columns*s.rows);
 assert.ok(s.origin.every(Number.isInteger));assert.ok(s.origin[0]>=0&&s.origin[0]<s.cell[0]);assert.ok(s.origin[1]>=0&&s.origin[1]<s.cell[1]);
 const used=new Set();for(const cl of Object.values(s.clips)){assert.ok(cl.frames.length);for(const i of cl.frames){assert.ok(Number.isInteger(i)&&i>=0&&i<s.count);used.add(i);}assert.equal(typeof cl.loop,'boolean');assert.ok(cl.kind==='state'||cl.fps>0);if(cl.kind==='state')assert.equal(cl.fps,0);}
 assert.equal(used.size,s.count);
 for(let i=0;i<s.count;i++){const [cw,ch]=s.cell,ox=i%s.columns*cw,oy=Math.floor(i/s.columns)*ch;let minX=cw,minY=ch,maxX=-1,maxY=-1;
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(p.data[(oy+y)*p.w+ox+x]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  if(name==='watering_robot')assert.equal(maxY,s.origin[1]-1);
  if(name==='watering_robot'||name==='plant_thief_drone')assert.ok(maxX>=minX && maxY>=minY);
 }
 for(const coords of Object.values(s.sockets||{})){assert.equal(coords.length,s.count);for(const xy of coords)assert.ok(xy.length===2&&xy.every(Number.isInteger));}
});
test('exact 8 by 8 actor grids, not an illustrated or labelled board',()=>{for(const name of ['watering_robot','plant_thief_drone']){const s=manifest.sheets[name];assert.deepEqual(s.size,[512,512]);assert.deepEqual(s.cell,[64,64]);assert.equal(s.count,64);}});
test('draws at 1x with integer world-minus-camera coordinates',()=>{const pack=api.create(manifest,imageMap()),ctx=mockContext();pack.drawFrame(ctx,'watering_robot',5,17.2,55.9,{x:1.8,y:2.1});const d=ctx.calls.find(c=>c[0]==='drawImage');assert.deepEqual(d.slice(2),[320,0,64,64,-32,-56,64,64]);assert.deepEqual(ctx.calls.find(c=>c[0]==='translate'),['translate',15,54]);assert.equal(ctx.imageSmoothingEnabled,false);});
test('mirror keeps same origin, no per-frame bbox recentring',()=>{const pack=api.create(manifest,imageMap()),ctx=mockContext();pack.drawFrame(ctx,'watering_robot',5,17,55,{},-1);assert.deepEqual(ctx.calls.find(c=>c[0]==='translate'),['translate',17,55]);assert.deepEqual(ctx.calls.find(c=>c[0]==='scale'),['scale',-1,1]);assert.deepEqual(ctx.calls.find(c=>c[0]==='drawImage').slice(6),[-32,-56,64,64]);});
test('loops wrap; one-shots hold their final frame; states never auto-cycle',()=>{const p=api.create(manifest,imageMap());assert.equal(p.sample('watering_robot','idle',8/6).index,0);assert.equal(p.sample('watering_robot','deploy_arm',999).index,23);assert.equal(p.sample('watering_robot','deploy_arm',999).complete,true);assert.equal(p.sample('plant_growth','bell',999,4).index,4);assert.throws(()=>p.sample('plant_growth','bell',0,8),RangeError);});
test('watering animation and water layer select matching local frames',()=>{const p=api.create(manifest,imageMap());for(let i=0;i<8;i++){const c=mockContext();p.drawRobot(c,'water',(i+.01)/10,0,0);const d=c.calls.filter(v=>v[0]==='drawImage');assert.equal(d.length,2);assert.deepEqual(d[0].slice(2,6),[i*64,192,64,64]);assert.deepEqual(d[1].slice(2,6),[i*64,0,64,64]);}});
test('carried plant grip meets moving claw in either direction',()=>{const p=api.create(manifest,imageMap());for(const face of [1,-1])for(let i=0;i<8;i++){const c=mockContext(),t=(i+.01)/14;const f=p.drawDrone(c,'carry_flight',t,80.4,45.6,{x:5,y:1},face,5);const target=p.socket('plant_thief_drone',f.index,'claw',80.4,45.6,{x:5,y:1},face);const tr=c.calls.find(v=>v[0]==='translate');const s=manifest.sheets.plant_cargo,g=s.sockets.grip[5];assert.deepEqual({x:tr[1]+face*(g[0]-s.origin[0]),y:tr[2]+g[1]-s.origin[1]},target);}});
test('bad names, coordinates, directions, frames and image sizes are rejected',()=>{const p=api.create(manifest,imageMap());assert.throws(()=>p.rectangle('no',0));assert.throws(()=>p.rectangle('watering_robot',64));assert.throws(()=>p.rectangle('watering_robot',.5));assert.throws(()=>p.drawFrame(mockContext(),'watering_robot',0,NaN,0));assert.throws(()=>p.drawFrame(mockContext(),'watering_robot',0,0,0,{},0));const images=imageMap();images.watering_robot.width=2048;assert.throws(()=>api.create(manifest,images));});

test('cargo grip sockets touch opaque stem pixels instead of floating above plants',()=>{const s=manifest.sheets.plant_cargo,p=png(s.file);for(let i=0;i<s.count;i++){const [x,y]=s.sockets.grip[i],ox=i%s.columns*s.cell[0],oy=Math.floor(i/s.columns)*s.cell[1];assert.notEqual(p.data[(oy+y)*p.w+ox+x],0);}});
