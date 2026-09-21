'use strict';
/* MAX native sprite authoring. No dependencies, image resampling, fonts or AI
 * image processing. New artwork is plotted on the final integer pixel grid.
 * Plant segments and reference sprites come from this repository's own PNGs.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const out = path.join(root, 'assets', 'native');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const palette = {
  o:'#0e111b', d:'#151926', n:'#1b1f2e', s:'#242a3e', v:'#38475f',
  m:'#5e6781', l:'#b2af99', w:'#ffffff',
  t:'#1e4852', u:'#315f6a', a:'#4a868d', c:'#58b1cc', b:'#3b77dc',
  f:'#5d93d5', g:'#0e1e1d', h:'#183427', j:'#274628', k:'#3b5a2e',
  e:'#54755a', q:'#80993f', r:'#a3bf59',
  z:'#261e18', x:'#3b2d21', y:'#6a5a44', p:'#7e7347',
  A:'#f5d25a', B:'#d9b350', M:'#9f469a', P:'#dba995'
};
const rgba = Object.fromEntries(Object.entries(palette).map(([k,h]) => [k,[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16),255]]));
function surface(w,h){ return {w,h,data:Buffer.alloc(w*h*4)}; }
function px(s,x,y,c){ x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=s.w||y>=s.h){if(typeof c==='string'||c[3])throw Error('Clipped visible pixel '+x+','+y+' in '+s.w+'x'+s.h);return;}
 const cc=typeof c==='string'?rgba[c]:c;if(!cc)throw Error('Unknown palette token '+c);for(let i=0;i<4;i++)s.data[(y*s.w+x)*4+i]=cc[i]; }
function rect(s,x,y,w,h,c){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)px(s,xx,yy,c);}
function line(s,x0,y0,x1,y1,c){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
 const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let er=dx+dy;
 for(;;){px(s,x0,y0,c);if(x0===x1&&y0===y1)break;const e=er*2;if(e>=dy){er+=dy;x0+=sx;}if(e<=dx){er+=dx;y0+=sy;}}}
function stamp(s,x,y,rows){for(let j=0;j<rows.length;j++)for(let i=0;i<rows[j].length;i++)if(rows[j][i]!=='.'&&rows[j][i]!==' ')px(s,x+i,y+j,rows[j][i]);}
function paste(dst,src,x,y){for(let j=0;j<src.h;j++)for(let i=0;i<src.w;i++){const k=(j*src.w+i)*4;if(src.data[k+3]>=128)px(dst,x+i,y+j,[src.data[k],src.data[k+1],src.data[k+2],255]);}}
function crop(src,x,y,w,h){const d=surface(w,h);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=((y+j)*src.w+x+i)*4;for(let c=0;c<4;c++)d.data[(j*w+i)*4+c]=src.data[k+c];}return d;}
function flip(src,ox){const s=surface(src.w,src.h);for(let y=0;y<src.h;y++)for(let x=0;x<src.w;x++){const k=(y*src.w+x)*4;if(src.data[k+3])px(s,2*ox-x,y,[...src.data.subarray(k,k+4)]);}return s;}
function tight(s){let x0=s.w,y0=s.h,x1=-1,y1=-1;for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++)if(s.data[(y*s.w+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return x1<0?{x:0,y:0,w:0,h:0}:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};}
let crcTable;
function crc32(b){if(!crcTable)crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([len,name,data,crc]);}
function png(s){const ih=Buffer.alloc(13);ih.writeUInt32BE(s.w,0);ih.writeUInt32BE(s.h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc(s.h*(s.w*4+1));for(let y=0;y<s.h;y++)s.data.copy(raw,y*(s.w*4+1)+1,y*s.w*4,(y+1)*s.w*4);return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function decode(b){let at=8,w,h,ct,depth,parts=[];while(at<b.length){const n=b.readUInt32BE(at),ty=b.toString('ascii',at+4,at+8),d=b.subarray(at+8,at+8+n);if(ty==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);depth=d[8];ct=d[9];if(d[12])throw Error('Interlaced source not supported');}if(ty==='IDAT')parts.push(d);at+=n+12;}
 if(depth!==8||![2,6].includes(ct))throw Error('Expected RGB/RGBA 8-bit source');const bpp=ct===6?4:3,stride=w*bpp,raw=zlib.inflateSync(Buffer.concat(parts)),un=Buffer.alloc(h*stride);let pos=0;
 function paeth(a,b,c){const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;}
 for(let y=0;y<h;y++){const f=raw[pos++];if(f>4)throw Error('PNG filter');for(let x=0;x<stride;x++){const l=x>=bpp?un[y*stride+x-bpp]:0,u=y?un[(y-1)*stride+x]:0,ul=y&&x>=bpp?un[(y-1)*stride+x-bpp]:0;un[y*stride+x]=(raw[pos++]+[0,l,u,Math.floor((l+u)/2),paeth(l,u,ul)][f])&255;}}
 const s=surface(w,h);for(let i=0;i<w*h;i++){s.data[i*4]=un[i*bpp];s.data[i*4+1]=un[i*bpp+1];s.data[i*4+2]=un[i*bpp+2];s.data[i*4+3]=bpp===4?un[i*bpp+3]:255;}return s;}
function embedded(name){const m=html.match(new RegExp('var '+name+'\\s*=\\s*"data:image/png;base64,([^"\\n]+)"'));if(!m)throw Error('Missing original '+name);return Buffer.from(m[1],'base64');}
const originalPlant=embedded('PLANT_ATLAS_SRC'), plant=decode(originalPlant), crow=decode(embedded('CROW_SRC'));
const PA=JSON.parse(html.match(/var PA = (.*?);/)[1]);
function seg(dst,r,cx,by,mirror=false){let a=crop(plant,...r);if(mirror){const f=surface(a.w,a.h);for(let y=0;y<a.h;y++)for(let x=0;x<a.w;x++){const i=(y*a.w+x)*4;px(f,a.w-1-x,y,[...a.data.subarray(i,i+4)]);}a=f;}paste(dst,a,cx-(r[2]>>1),by-r[3]);}
function leaf(s,x,y,dir=1,lit='e'){line(s,x,y,x+dir*4,y-2,'g');line(s,x+dir,y-1,x+dir*4,y-2,'j');px(s,x+dir*3,y-2,lit);}
function sprout(s,x,base,h=10,flower=false){line(s,x,base,x,base-h,'h');for(let i=3;i<h;i+=5){leaf(s,x,base-i,i%2?-1:1);}if(flower)stamp(s,x-2,base-h-2,['..b..','.bfb.','bfwfb','.bfb.','..b..']);}
function wheel(s,cx,cy,phase){stamp(s,cx-3,cy-3,['..ooo..','.osvso.','osndnso','ovdodvo','osndnso','.osvso.','..ooo..']);const a=[[0,-2],[2,0],[0,2],[-2,0]][phase&3];px(s,cx+a[0],cy+a[1],'m');px(s,cx,cy,'m');}
function tank(s,x,y,level,phase){stamp(s,x,y,['..llll..','.ommmmo.','omllllmo','omttttmo','omttttmo','omttttmo','omttttmo','omttttmo','omttttmo','omttttmo','.ommmmo.','..oooo..']);const h=Math.max(0,Math.min(7,level));if(h){rect(s,x+2,y+10-h,4,h,'u');rect(s,x+2,y+10-h,2,h,'a');line(s,x+2,y+10-h,x+5,y+10-h,'c');if((phase&3)===1&&h>1)px(s,x+5,y+9-h,'a');if((phase&3)===3&&h>1)px(s,x+2,y+9-h,'c');}line(s,x+2,y+3,x+2,y+6,'l');}
const robotStates=[['idle',6,true],['drive',12,true],['deploy',10,false],['water',12,true],['retract',10,false],['empty',5,true],['refill',8,false],['sleep',6,false]];
function robot(state,f){const s=surface(64,48);let t=state==='deploy'?f/7:state==='retract'?1-f/7:['water','empty'].includes(state)?1:0;
 // Body location never follows the animation's changing visible bounding box.
 const water=state==='empty'?0:state==='refill'?Math.round(f):7;
 tank(s,23,19,water,f);rect(s,22,31,20,2,'o');rect(s,23,31,18,1,'m');
 stamp(s,18,32,['..llllllllllllllllllllll..','ommmmmmmmmmmmmmmmmmmmmmmmo','ovllllllmmmmmmmmmmmmlllmo','ovllllllmmmmmmmmmmmmlooAo','ovmmmmmmmmmmmmmmmmmmmmmmo','.ossssssssssssssssssssso.','..oooooooooooooooooooo..']);
 rect(s,36,33,5,3,'o');rect(s,37,34,2,1,state==='sleep'&&f>3?'s':'a');px(s,40,34,'m');
 if(state==='empty'&&(f&3)<2)px(s,44,35,'A');else px(s,44,35,state==='sleep'?'s':'B');
 line(s,24,38,41,38,'s');wheel(s,23,40,state==='drive'?f:f>>2);wheel(s,40,40,state==='drive'?f+1:1);
 const shoulder={x:36,y:32},elbow={x:Math.round(36+6*t),y:Math.round(25-7*t)},nozzle={x:Math.round(38+16*t),y:Math.round(25-2*t)};
 line(s,shoulder.x,shoulder.y,elbow.x,elbow.y,'o');line(s,shoulder.x+1,shoulder.y,elbow.x+1,elbow.y,'m');line(s,elbow.x,elbow.y,nozzle.x,nozzle.y,'o');line(s,elbow.x,elbow.y-1,nozzle.x,nozzle.y-1,'l');
 stamp(s,elbow.x-1,elbow.y-1,['oso','sms','oso']);stamp(s,nozzle.x-1,nozzle.y-1,['voo','mmv','.om']);
 if(state==='sleep'&&f>4){rect(s,37,34,2,1,'s');rect(s,43,35,2,1,'s');}
 return {s,sockets:{ground:{x:32,y:44},nozzle:{x:nozzle.x+1,y:nozzle.y+2},tank:{x:27,y:19}},collision:{x:18,y:19,w:28,h:25}};
}
const droneStates=[['hover',12,true],['approach',12,true],['brake',12,false],['lower_claw',10,false],['grip',10,false],['lift',12,false],['carry',14,true],['release',10,false]];
function drone(state,f){const s=surface(64,48),bank=state==='approach'?2:state==='brake'?Math.round(2*(1-f/7)):state==='carry'?1:0;
 // Integer shear is hand-rastered about one unchanged body pivot; no smooth rotation.
 const body=surface(64,48);
 line(body,21,10,30,13,'s');line(body,34,13,43,10,'s');line(body,22,9,30,12,'v');line(body,34,12,42,9,'v');
 stamp(body,28,9,['..ooooooo..','.ossssssso.','osvmmmvvvso','ovsssssssvo','.odddAdddo.','..odAAlDo..'.replace('D','d'),'...ooooo...']);
 for(const x of [21,43]){rect(body,x-1,8,3,4,'o');px(body,x,9,'m');}
 for(const x of [21,43]){const wide=(f&1)?3:4;line(body,x-wide,7,x+wide,7,'d');line(body,x-wide+1,7,x+wide-1,7,(f&1)?'s':'v');px(body,x+(f%4)-2,6,'m');}
 for(let y=0;y<body.h;y++)for(let x=0;x<body.w;x++){const k=(y*body.w+x)*4;if(body.data[k+3])px(s,x,y+Math.round((x-32)*bank/14),[...body.data.subarray(k,k+4)]);}
 let length=3;if(state==='lower_claw')length=3+Math.round(f*19/7);if(state==='grip')length=22;if(state==='lift')length=22-Math.round(f*12/7);if(state==='carry')length=10;if(state==='release')length=10+Math.round(Math.min(f,4)*3/4);
 const clawY=17+length,open=state==='grip'?Math.round(3*(1-f/7)):state==='release'?Math.round(3*Math.min(f,4)/4):['lift','carry'].includes(state)?0:3;
 line(s,32,16,32,clawY-2,'y');px(s,32,16,'m');const gap=1+open;
 line(s,32,clawY-2,32-gap,clawY,'v');line(s,32,clawY-2,32+gap,clawY,'v');line(s,32-gap,clawY,32-gap,clawY+2,'l');line(s,32+gap,clawY,32+gap,clawY+2,'l');px(s,33-gap,clawY+3,'m');px(s,31+gap,clawY+3,'m');
 return {s,sockets:{body:{x:32,y:12},claw:{x:32,y:clawY+2}},collision:{x:17,y:6,w:31,h:11},...(state==='grip'&&f===6?{event:'attach_cargo'}:{}),...(state==='release'&&f===4?{event:'detach_cargo'}:{})};
}
function waterFX(state,f){const s=surface(64,48),r=robot('water',f),n=r.sockets.nozzle;const names=['spray','arc','drips','splash','refill_stream','leak','ripples','bubbles'];let event={x:32,y:44};
 if(state==='spray'||state==='arc'){event=n;for(let i=0;i<15;i++){const t=((i*5+f*3)%48)/48;const x=n.x+t*6-(state==='spray'?i%3:0),y=n.y+2+t*14+t*t*3;px(s,x,y,i%3?'a':'c');if(i%4===0)px(s,x,y+1,'u');}}
 if(state==='drips'||state==='leak'){for(let i=0;i<4;i++){const y=23+(f*3+i*7)%20;px(s,32+i*3,y,'a');if(i===0)px(s,32,y-1,'c');}}
 if(state==='splash'){for(let i=0;i<8;i++){const dx=(i-3.5)*f*.65,dy=-Math.abs((7-f)*Math.sin(i+1)*1.5);px(s,32+dx,41+dy,'a');}line(s,30-f,44,34+f,44,'u');}
 if(state==='refill_stream'){for(let i=0;i<7;i++){const y=7+(i*4+f)%12;px(s,27,y,i%2?'a':'c');}event={x:27,y:19};}
 if(state==='ripples'){const rx=2+f,ry=1+Math.floor(f/3);for(let i=0;i<20;i++){const a=i*Math.PI/10;px(s,32+Math.round(Math.cos(a)*rx),42+Math.round(Math.sin(a)*ry),'u');}}
 if(state==='bubbles'){for(let i=0;i<3;i++){const x=27+i*5,y=40-((f*2+i*5)%20);stamp(s,x,y,['.a.','a.c','.u.']);}}
 return {s,sockets:{emitter:event}};
}
const stems=[['#062128','#294321','#3b5a2e'],['#1b171d','#242a17','#2f3718'],['#0e1e1d','#183427','#274628'],['#0e1e1d','#262938','#38475f'],['#142722','#405054','#5e6781'],['#171b0f','#2e361c','#585633'],['#0a2628','#1e4852','#315f6a'],['#261e18','#3b2d21','#504e2a']].map(a=>a.map(h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16),255]));
const families=['bell','branch','vine','spray','arch','fork','starburst','cluster'];
function grownPlant(fi,f,cargo=false){const s=surface(64,cargo?64:96),x=32,gy=cargo?48:84,fam=PA.fam[fi],h=cargo?18+f*5:[0,7,13,21,29,38,46,65][f];
 if(!cargo&&f===0){seg(s,PA.seeds[fi],x,gy);return{s,sockets:{ground:{x,y:gy}}};}
 for(let y=gy;y>=gy-h;y--){px(s,x,y,stems[fi][1]);px(s,x+1,y,stems[fi][0]);}
 for(let j=0,yb=gy+1;yb>=gy-h+5;j++){const r=fam.s[(j+fi)%fam.s.length];if(j&&yb-r[3]<gy-h)break;seg(s,r,x,yb,!!(j&1));yb-=r[3]+(fi===4?3:0);}
 if(fam.f.length&&(cargo||f>=3)){const r=fam.f[f%fam.f.length];seg(s,r,x,gy-h+Math.min(3,r[3]-2));}else rect(s,x,gy-h-1,2,2,stems[fi][2]);
 if(cargo){stamp(s,x-4,gy,['xyyypyyx','xyxypyxx','.xyyyxx.','..xyxx..','...xx...']);line(s,x-3,gy+3,x-4,gy+6,'y');line(s,x+2,gy+3,x+3,gy+7,'x');}
 else {const r=PA.roots[fi%PA.roots.length];paste(s,crop(plant,...r),x-(r[2]>>1),gy+2);}
 return {s,sockets:{ground:{x,y:gy},grip:{x,y:gy-h-4}}};
}
function crate(s,x,y,w=18,h=13,type='seed'){rect(s,x,y,w,h,'o');rect(s,x+1,y+1,w-2,h-2,type==='seed'?'y':'s');line(s,x+2,y+2,x+w-3,y+2,type==='seed'?'p':'m');line(s,x+2,y+h-4,x+w-3,y+h-4,type==='seed'?'x':'v');line(s,x+3,y+3,x+3,y+h-2,'o');line(s,x+w-4,y+3,x+w-4,y+h-2,'o');if(type==='seed')sprout(s,x+(w>>1),y+h-4,5);if(type==='battery'){rect(s,x+7,y+4,4,h-7,'o');for(let k=0;k<3;k++)rect(s,x+8,y+h-5-k*2,2,1,'q');}if(type==='repair'){line(s,x+7,y+h-4,x+11,y+4,'l');px(s,x+11,y+3,'m');}}
function post(s,x,base,h=24){rect(s,x-1,base-h,4,h,'o');rect(s,x,base-h+1,2,h-2,'y');line(s,x,base-h+2,x,base-2,'p');}
const props=['refill_pump','reservoir','hose_reel','nozzle_stand','charging_dock','battery_crate','repair_crate','water_tank','spare_wheel','arm_module','lantern','signpost','planter','compost_bin','fence_post','trellis','storage_chest','seed_box','mug','campfire','garden_door','garden_terminal','beacon','cabinet','hanging_planter','grass_edge','soil_edge','stone_edge','puddle_edge','short_fence','long_fence','bouquet_tie'];
function prop(name,f=0){const s=surface(64,64),base=56,x=32;
 if(name==='water_tank')tank(s,28,44,7,f);
 else if(name==='spare_wheel')wheel(s,32,52,f);
 else if(name==='battery_crate'||name==='repair_crate'||name==='storage_chest'||name==='seed_box')crate(s,23,43,18,13,name==='battery_crate'?'battery':name==='repair_crate'?'repair':name==='seed_box'?'seed':'metal');
 else if(name==='refill_pump'){post(s,31,base,31);crate(s,25,33,14,14,'metal');stamp(s,29,37,['..c..','.cac.','.aaa.','..u..']);tank(s,28,25,7,f);line(s,38,35,42,37,'v');line(s,42,37,43,51,'u');line(s,43,51,47,53,'a');rect(s,24,54,17,2,'m');}
 else if(name==='reservoir'){crate(s,18,40,28,16,'metal');rect(s,21,43,22,6,'u');rect(s,21,42,22,2,'a');line(s,22,42,42,42,'c');leaf(s,20,41,-1);}
 else if(name==='hose_reel'){post(s,32,base,28);for(let i=0;i<28;i++){let a=i*Math.PI/14;px(s,30+Math.round(Math.cos(a)*6),39+Math.round(Math.sin(a)*10),'u');px(s,29+Math.round(Math.cos(a)*6),39+Math.round(Math.sin(a)*10),'a');}line(s,35,31,38,30,'v');}
 else if(name==='nozzle_stand'){post(s,32,base,27);line(s,32,30,42,30,'v');line(s,32,29,42,29,'m');rect(s,41,30,2,3,'v');if(f%2)px(s,42,35,'c');}
 else if(name==='charging_dock'){crate(s,18,50,28,6,'metal');rect(s,19,44,3,7,'s');rect(s,19,43,3,2,'m');rect(s,42,44,3,7,'s');rect(s,42,43,3,2,'m');line(s,24,53,39,53,'v');rect(s,21,50,2,2,f&1?'q':'r');}
 else if(name==='arm_module'){rect(s,27,53,12,3,'s');line(s,31,52,26,44,'o');line(s,32,52,27,44,'m');line(s,27,44,36,35,'l');line(s,28,44,37,35,'v');line(s,37,35,43,39,'m');line(s,43,39,41,43,'v');line(s,43,39,46,42,'v');}
 else if(name==='lantern'){stamp(s,28,41,['..oo..','.omm o'.replace(' ',''),'ommmmo','osllso','oABBAo','oABBAo','oABBAo','oABBAo','osllso','ommmmo','.oooo.']);}
 else if(name==='signpost'){post(s,32,base,28);stamp(s,24,32,['yyyyyyyyyy..','ypppppppppy.','yxxxxxxxxxyy','yyyyyyyyyyy.']);rect(s,21,40,12,4,'y');line(s,22,40,32,40,'p');leaf(s,32,49,1);}
 else if(name==='planter'){crate(s,19,45,26,11,'seed');sprout(s,25,44,12,true);sprout(s,39,44,9,false);}
 else if(name==='compost_bin'){crate(s,21,37,22,19,'seed');stamp(s,23,33,['....xx........','...xyyx..xx...','.xxyppyxxxyxx.','xyyyyxyyyyyyyx']);}
 else if(name==='fence_post'){post(s,32,base,24);leaf(s,31,52,-1);}
 else if(name==='trellis'){post(s,20,base,49);post(s,43,base,49);for(let yy=12;yy<54;yy+=12){line(s,20,yy,44,yy,'x');line(s,20,yy-1,44,yy-1,'y');}for(let y=50;y>8;y-=5){leaf(s,21,y,1,'e');leaf(s,43,y,-1,'q');}}
 else if(name==='mug'){stamp(s,28,48,['llllll...','lmmmmlooo','lmlmml..o','lmmjmlo.o','lmmmml..o','lmmmmlooo','.llll....']);}
 else if(name==='campfire'){stamp(s,25,49,['...xxxx....','..xyyxxx...','.xyypyyxx..','xxvsvssvxxx','svvmmvmmvvs','.ooooooo...']);for(let y=40;y<51;y++){const w=1+Math.floor((y-40)/3);rect(s,31-w,y,2*w+1,1,'y');rect(s,32-Math.floor(w/2),y,Math.max(1,w),1,y>46?'A':'B');}px(s,33,39,'B');}
 else if(name==='garden_door'){post(s,20,base,36);post(s,44,base,36);rect(s,21,20,24,4,'s');line(s,22,20,43,20,'m');line(s,25,23,40,23,'v');leaf(s,20,50,1);}
 else if(name==='garden_terminal'){post(s,32,base,28);crate(s,23,26,20,18,'metal');rect(s,25,29,16,11,'d');sprout(s,33,39,8,false);}
 else if(name==='beacon'){post(s,32,base,33);stamp(s,29,24,['ommmo','ovlvo','ovAvo','ovAvo','ovBvo','ommmo']);}
 else if(name==='cabinet'){crate(s,22,27,21,29,'metal');line(s,32,32,32,51,'o');rect(s,30,39,1,3,'l');}
 else if(name==='hanging_planter'){line(s,32,20,25,38,'m');line(s,32,20,39,38,'v');crate(s,24,39,16,7,'seed');for(let i=0;i<3;i++){sprout(s,27+i*5,38,6+i%2*3,false);line(s,27+i*3,44,27+i*3,53,'h');leaf(s,27+i*3,50,i%2?-1:1);}}
 else if(name==='grass_edge'){for(let i=0;i<14;i++){const xx=17+i*2;line(s,xx,55,xx+(i%3)-1,53-i%5,'j');if(i%3===0)px(s,xx,52-i%5,'q');}}
 else if(name==='soil_edge'){for(let i=0;i<16;i++)rect(s,16+i*2,53-i%3,2,3+i%3,i%2?'x':'y');}
 else if(name==='stone_edge'){for(let i=0;i<4;i++)stamp(s,17+i*8,51-i%2,['..vv...','.vmmv..','vvsssv.','osssso.']);}
 else if(name==='puddle_edge'){line(s,17,54,47,54,'u');line(s,20,53,43,53,'a');line(s,30,55,44,55,'t');line(s,22,52,28,52,'c');}
 else if(name==='short_fence'||name==='long_fence'){const hw=name==='short_fence'?10:20;post(s,x-hw,base,18);post(s,x+hw,base,18);line(s,x-hw,43,x,46,'y');line(s,x,46,x+hw,43,'y');}
 else if(name==='bouquet_tie'){line(s,24,50,40,52,'p');line(s,25,52,39,50,'y');stamp(s,29,51,['p..p','.pp.','.pp.','p..p']);}
 return{s,sockets:{ground:{x:32,y:56}}};
}
const fauna=['ant','bee','firefly','butterfly','worm','beetle','snail','pillbug'];
function critter(kind,f){const s=surface(16,16),phase=f%4;
 if(kind==='ant'){stamp(s,3,9,['.o..o.o.','oooooooo','.o..o.o.']);for(let i=0;i<3;i++)px(s,4+i*2+(phase&1),12,'o');}
 if(kind==='bee'){stamp(s,4,8,['.ooooo.','oBAoBAo','.ooooo.']);if(phase%2){stamp(s,3,5,['cc...cc','.aa.aa.','..a.a..']);}else{line(s,2,8,5,8,'a');line(s,9,8,13,8,'c');}}
 if(kind==='firefly'){stamp(s,4,8,['.oooo.','onBAno','.oooo.']);if(phase%2){stamp(s,3,6,['aa....aa','.aa..aa.']);}else line(s,2,8,12,8,'v');px(s,7,10,f<4?'A':'q');}
 if(kind==='butterfly'){stamp(s,7,6,['o','o','o','o','o']);if(phase%2){stamp(s,2,5,['ff...ff','bff.ffb','.bb.bb.','..f.f..']);}else{stamp(s,5,4,['f.f','b.b','f.f','b.b']);}}
 if(kind==='worm'){for(let i=0;i<9;i++){const yy=11-Math.round((Math.sin(i*.8+f*.7)+1)*1.5);px(s,3+i,yy,'y');px(s,3+i,yy+1,'P');}}
 if(kind==='beetle'){stamp(s,4,8,['..jj..','.jqqj.','ojkkjo','ojkkjo','.jjjj.']);px(s,3+(phase&1),12,'o');px(s,10-(phase&1),12,'o');}
 if(kind==='snail'){stamp(s,3,7,['..yyy...','.yppy...','ypxyy...','ypyyx...','.xxxjjo.','..jjjjj.']);px(s,11,10,'q');px(s,12,9,'j');}
 if(kind==='pillbug'){stamp(s,3,8,['..vvvv..','.vmvmvv.','ovsvsvvo','ovsvsvvo','.oooooo.']);px(s,4+(phase&1),13,'d');px(s,9-(phase&1),13,'d');}
 return{s,sockets:{ground:{x:8,y:14}}};
}
const iconNames=['battery','water','seed','plant','crow','drone','warning','storage','repair','map','journal','pause','settings','continue','save','trash'];
function icon(name){const s=surface(16,16);
 if(name==='battery'){stamp(s,2,4,['.lllllllll.','lovvvvvvvlm','lorqrqrqrlm','lorqrqrqrlm','lorqrqrqrlm','.lllllllll.']);}
 if(name==='water')stamp(s,5,2,['...c...','..aca..','..aaa..','.aauaa.','aauuuaa','aauuuaa','.uuuuu.','..uuu..']);
 if(name==='seed')stamp(s,5,5,['...p.','..py.','.pyxy','pyxyx','pyyyx','.xxx.']);
 if(name==='plant')sprout(s,8,13,8,false);
 if(name==='crow'){paste(s,crop(crow,4,3,12,11),2,2);}
 if(name==='drone'){line(s,2,5,13,5,'v');rect(s,1,4,4,1,'m');rect(s,11,4,4,1,'m');stamp(s,6,5,['sss','oAo','.o.']);}
 if(name==='warning'){for(let y=3;y<13;y++){let hw=Math.floor((y-2)/2);rect(s,8-hw,y,hw*2+1,1,'B');}line(s,8,6,8,9,'o');px(s,8,11,'o');}
 if(name==='storage')crate(s,2,5,12,9,'metal');
 if(name==='repair'){line(s,4,13,11,5,'m');line(s,5,13,12,5,'l');stamp(s,9,2,['l..l','l..l','.ll.']);}
 if(name==='map'){stamp(s,2,4,['eeppjjllpp','eerrjjllpp','eerrjjllpp','eeppjjllpp','eeppjjllpp','eeppjjllpp','eeppjjllpp','eeppjjllpp']);px(s,10,7,'A');}
 if(name==='journal'){rect(s,4,2,9,12,'o');rect(s,5,3,7,10,'y');line(s,6,3,6,12,'p');rect(s,8,4,3,3,'B');}
 if(name==='pause'){rect(s,4,4,3,9,'l');rect(s,10,4,3,9,'l');}
 if(name==='settings'){stamp(s,3,3,['...mm...','m.mmmm.m','.mmoomm.','mmoddomm','mmoddomm','.mmoomm.','m.mmmm.m','...mm...']);}
 if(name==='continue'){for(let x=4;x<12;x++)rect(s,x,4+Math.floor((x-4)/2),1,9-2*Math.floor((x-4)/2),'l');}
 if(name==='save'){rect(s,3,3,10,11,'v');rect(s,5,3,6,4,'m');rect(s,5,10,6,3,'l');rect(s,9,4,1,2,'d');}
 if(name==='trash'){rect(s,4,5,9,8,'v');rect(s,3,3,11,2,'m');rect(s,7,2,3,1,'l');for(let x=6;x<12;x+=2)line(s,x,6,x,11,'l');}
 return{s,sockets:{center:{x:8,y:8}}};
}
const fxNames=['soil_burst','growth_spark','pickup','alert','leaf_fall','hit','success','empty_water'];
function fx(name,f){const s=surface(32,32);if(name==='soil_burst'){for(let i=0;i<9;i++){const dx=Math.round(Math.cos(i*2.4)*(2+f)),dy=Math.round(Math.sin(i*2.4)*(2+f)/2+f*f*.12);rect(s,16+dx,21+dy,1+i%2,1+i%2,i%2?'x':'y');}}
 if(['growth_spark','pickup','success'].includes(name)){for(let i=0;i<4;i++){let xx=16+Math.round(Math.sin(i*2.1+f*.3)*(3+f)),yy=16+Math.round(Math.cos(i*2.1+f*.3)*(3+f));px(s,xx,yy,name==='success'?'r':'A');if(f<5){px(s,xx-1,yy,name==='success'?'e':'p');px(s,xx+1,yy,name==='success'?'e':'p');px(s,xx,yy-1,name==='success'?'e':'p');}}}
 if(name==='alert'){line(s,16,7,16,13,'B');px(s,16,16,'A');if(f<4){px(s,12,9-f,'p');px(s,20,9-f,'p');}}
 if(name==='leaf_fall'){for(let i=0;i<3;i++)leaf(s,12+i*4+(f%3),7+i*3+f*2,i%2?-1:1,'q');}
 if(name==='hit'){line(s,16-f,16-f,16+f,16+f,'p');line(s,16-f,16+f,16+f,16-f,'y');}
 if(name==='empty_water'){stamp(s,14,7,['..u..','.utu.','utt tu'.replace(' ',''),'.uuu.']);line(s,12+f%2,18,20+f%2,10,'m');}
 return{s,sockets:{origin:{x:16,y:24}}};
}
function json(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(obj,null,2)+'\n');}
function save(file,s){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,png(s));}
const manifest={schema:'max-native-assets/1',source:{repository:'lukketsvane/max.iverfinne.no',indexSha256:crypto.createHash('sha256').update(html).digest('hex'),plantAtlasSha256:crypto.createHash('sha256').update(originalPlant).digest('hex')},pixelPolicy:{nativeScale:1,alpha:'0 or 255',filter:'nearest',drawCoordinates:'integer',rotation:'none',trim:false},palette,sheets:{}};
function makeSheet(name,w,h,origin,rows,fn,options={}){const cols=8,atlas=surface(cols*w,rows.length*h),frames={},animations={},list=[];
 rows.forEach((row,r)=>{const [state,fps,loop]=typeof row==='string'?[row,0,false]:row;animations[state]={frames:[],fps,loop};for(let f=0;f<cols;f++){const result=fn(state,f,r),s=result.s;if(s.w!==w||s.h!==h)throw Error(name+' size');const id=state+'_'+String(f).padStart(2,'0'),frame={x:f*w,y:r*h,w,h},entry={frame,sourceSize:{w,h},spriteSourceSize:{x:0,y:0,w,h},rotated:false,trimmed:false,origin:{...origin},bounds:tight(s),sockets:result.sockets||{},...(result.collision?{collision:result.collision}:{}),...(result.event?{event:result.event}:{})};frames[id]=entry;animations[state].frames.push(id);list.push({id,s,entry});paste(atlas,s,frame.x,frame.y);save(path.join(out,'frames',name,id+'.png'),s);}
 });const meta={schema:'max-native-assets/1',image:name+'.png',size:{w:atlas.w,h:atlas.h},cell:{w,h},columns:8,rows:rows.length,origin,frames,animations,...options};
 save(path.join(out,name+'.png'),atlas);json(path.join(out,name+'.json'),meta);manifest.sheets[name]={image:name+'.png',metadata:name+'.json',cell:{w,h},size:meta.size,origin,frames:list.length,animations:Object.keys(animations),uniqueFrames:new Set(list.map(x=>crypto.createHash('sha256').update(x.s.data).digest('hex'))).size};return{atlas,meta,list};}
fs.mkdirSync(out,{recursive:true});
const rob=makeSheet('watering-robot',64,48,{x:32,y:44},robotStates,robot,{facing:'right'});
makeSheet('watering-robot-left',64,48,{x:32,y:44},robotStates,(st,f)=>{let r=robot(st,f);r.s=flip(r.s,32);for(const p of Object.values(r.sockets))p.x=64-p.x;r.collision.x=64-r.collision.x-r.collision.w+1;return r;},{facing:'left'});
const dro=makeSheet('plant-thief-drone',64,48,{x:32,y:12},droneStates,drone);
const water=makeSheet('water-fx',64,48,{x:32,y:44},['spray','arc','drips','splash','refill_stream','leak','ripples','bubbles'].map(n=>[n,12,true]),waterFX,{layer:'Draw spray over watering-robot at the same ground origin; nozzle socket is matched.'});
makeSheet('water-fx-left',64,48,{x:32,y:44},['spray','arc','drips','splash','refill_stream','leak','ripples','bubbles'].map(n=>[n,12,true]),(st,f)=>{const r=waterFX(st,f);r.s=flip(r.s,32);for(const p of Object.values(r.sockets))p.x=64-p.x;return r;},{facing:'left'});
makeSheet('plant-growth',64,96,{x:32,y:84},families,(st,f,fi)=>grownPlant(fi,f),{sequenceType:'growth states, not a time loop',source:'Original PA.fam segments, unchanged RGB and native dimensions. Four nearly invisible source-alpha pixels are excluded from binary export.'});
makeSheet('plant-cargo',64,64,{x:32,y:48},families,(st,f,fi)=>{const r=grownPlant(fi,f%2,true);if(f>=2&&f<6)px(r.s,27+f,56+(f-2),'y');return r;},{sequenceType:'Two native plant sizes with soil-shake states; attach grip socket to drone claw socket'});
makeSheet('garden-props',64,64,{x:32,y:56},['stations_a','stations_b','garden_objects','structures'],(_st,f,r)=>prop(props[r*8+f]),{spriteNames:props});
makeSheet('tiny-fauna',16,16,{x:8,y:14},fauna.map(n=>[n,8,true]),critter);
makeSheet('ui-icons',16,16,{x:8,y:8},['status','actions'],(_st,f,r)=>icon(iconNames[r*8+f]),{spriteNames:iconNames,sequenceType:'icons, not an animation'});
makeSheet('interaction-fx',32,32,{x:16,y:24},fxNames.map(n=>[n,10,false]),fx);
makeSheet('crow-original',20,16,{x:10,y:12},['idle','walk','run','peck','takeoff','flap','flight','landing'],(_st,f,r)=>({s:crop(crow,f*20,r*16,20,16)}),{source:'Lossless native crow sheet from CROW_SRC; existing game animation timing remains CSEQ, not these descriptive row names.'});
// A ready-composited theft demonstration, but reusable cargo is also exported separately.
makeSheet('drone-with-cargo',64,96,{x:32,y:12},droneStates,(st,f)=>{const dr=drone(st,f),s=surface(64,96),hold=['lift','carry'].includes(st)||(st==='grip'&&f>=6)||(st==='release'&&f<4);if(hold){const p=grownPlant(5,0,true),a=p.sockets.grip,b=dr.sockets.claw;paste(s,p.s,b.x-a.x,b.y-a.y);}paste(s,dr.s,0,0);return{s,sockets:dr.sockets,...(st==='release'&&f===4?{event:'detach_cargo'}:{}),...(st==='grip'&&f===6?{event:'attach_cargo'}:{})};});
// Legacy 2048 contract: pad native frames, NEVER enlarge the visible artwork.
for(const name of ['watering-robot','plant-thief-drone']){const meta=JSON.parse(fs.readFileSync(path.join(out,name+'.json'))),img=decode(fs.readFileSync(path.join(out,name+'.png'))),dst=surface(2048,2048);for(const e of Object.values(meta.frames)){const c=e.frame.x/64,r=e.frame.y/48;paste(dst,crop(img,e.frame.x,e.frame.y,64,48),c*256+96,r*256+80);}save(path.join(out,'contract-2048',name+'.png'),dst);json(path.join(out,'contract-2048',name+'.json'),{columns:8,rows:8,cell:{w:256,h:256},image:name+'.png',origin:{x:meta.origin.x+96,y:meta.origin.y+80},nativeArtworkOffset:{x:96,y:80},note:'Padding only. Prefer compact production sheet.'});}
// Source reference crops retain their original pixel data; these are NOT new assets.
fs.mkdirSync(path.join(out,'reference'),{recursive:true});fs.writeFileSync(path.join(out,'reference','plant-atlas-original.png'),originalPlant);fs.writeFileSync(path.join(out,'reference','crow-original.png'),embedded('CROW_SRC'));save(path.join(out,'reference','max-idle.png'),crop(decode(embedded('SHEET_SRC')),0,0,32,32));
const lineup=surface(384,104);let xx=12;const refs=[['crow',crop(crow,0,0,20,16),{x:10,y:14}],['Max',crop(decode(embedded('SHEET_SRC')),0,0,32,32),{x:16,y:32}],['robot',robot('idle',0).s,{x:32,y:44}],['drone',drone('hover',0).s,{x:32,y:27}],['pumpkin',crop(plant,...PA.pumpkin[0]),{x:14,y:27}],['bell',grownPlant(0,6).s,{x:32,y:84}],['fork',grownPlant(5,6).s,{x:32,y:84}]];const layout=[];for(const [name,s,o] of refs){xx+=22;paste(lineup,s,xx-o.x,84-o.y);layout.push({name,x:xx,groundY:84,artBounds:tight(s)});xx+=23;}save(path.join(out,'relative-scale-1x.png'),lineup);json(path.join(out,'relative-scale-1x.json'),{image:'relative-scale-1x.png',scale:1,layout});
json(path.join(out,'manifest.json'),manifest);
// Exhaustive byte-level output checks. No assertion about game balance or taste.
const result={source:manifest.source,checks:[],sheets:{},totalFrames:0};for(const [name,info] of Object.entries(manifest.sheets)){const s=decode(fs.readFileSync(path.join(out,info.image))),m=JSON.parse(fs.readFileSync(path.join(out,info.metadata)));if(s.w!==info.size.w||s.h!==info.size.h)throw Error('Dimensions '+name);let opaque=0;for(let i=0;i<s.data.length;i+=4){const a=s.data[i+3];if(a!==0&&a!==255)throw Error('Nonbinary alpha '+name);if(a===0&&(s.data[i]||s.data[i+1]||s.data[i+2]))throw Error('Hidden RGB '+name);if(a)opaque++;}for(const [id,e] of Object.entries(m.frames)){const got=crop(s,e.frame.x,e.frame.y,e.frame.w,e.frame.h),single=decode(fs.readFileSync(path.join(out,'frames',name,id+'.png')));if(!got.data.equals(single.data))throw Error('Atlas mismatch '+name+'/'+id);if(e.origin.x!==m.origin.x||e.origin.y!==m.origin.y)throw Error('Origin drift');}result.totalFrames+=info.frames;result.sheets[name]={frames:info.frames,uniqueFrames:info.uniqueFrames,opaquePixels:opaque,sha256:crypto.createHash('sha256').update(png(s)).digest('hex')};}
result.checks=['Exact grid dimensions','Binary alpha','Transparent RGB zero','Every individual frame equals its atlas crop','One fixed origin per animation sheet','Native source crow pixels preserved','No image resampling in exporter'];json(path.join(out,'validation.json'),result);
console.log(`Built ${Object.keys(manifest.sheets).length} native sheets and ${result.totalFrames} frames in assets/native/`);
module.exports={decode,png,surface,tight};
