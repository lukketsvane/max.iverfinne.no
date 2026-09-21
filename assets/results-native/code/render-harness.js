(async function(){
'use strict';
var status=document.getElementById('status'),download=document.getElementById('download');
function canvas(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function png(c){return new Promise(function(resolve){c.toBlob(async function(b){resolve(new Uint8Array(await b.arrayBuffer()));},'image/png');});}
function harden(c){var x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height);for(var i=0;i<d.data.length;i+=4){d.data[i+3]=d.data[i+3]>=128?255:0;if(!d.data[i+3])d.data[i]=d.data[i+1]=d.data[i+2]=0;}x.putImageData(d,0,0);}
function records(n,offset){return Array.from({length:n},function(_,i){return {id:i+1,kind:(i+(offset||0))%9,seed:Math.round(79+i*23.7+(offset||0)*7),growth:1.05+(i%6)*.22,stalk:false};});}
function addFrame(ctx,c,x,y){ctx.drawImage(c,x,y);}
var atlas=new Image();atlas.src='../sprites/plant-atlas-native.png';await atlas.decode();
var native=MaxPlantNative.create(atlas);
function draw(c,p){native.drawPlant(c,p,0);}
var files=[],meta={version:1,scale:1,alpha:'binary',sheets:{},samples:{}};
async function add(name,c){harden(c);files.push({name:name,bytes:await png(c)});}

// The actual game plant renderer, at the existing result size and grounding point.
var stages=[.06,.3,.65,1.3,2.3],plants=canvas(9*64,5*96),pc=plants.getContext('2d');
meta.sheets['plants-growth.png']={width:576,height:480,cell:[64,96],columns:9,rows:5,anchor:[32,77],frames:[]};
for(var r=0;r<5;r++)for(var k=0;k<9;k++){
  var p={id:k+1,kind:k,seed:101+k*31,growth:stages[r],stalk:false},c=canvas(64,96);c.getContext('2d').translate(0,12);draw(c,p);c.getContext('2d').setTransform(1,0,0,1,0,0);harden(c);addFrame(pc,c,k*64,r*96);
  meta.sheets['plants-growth.png'].frames.push({name:'plant-'+k+'-stage-'+r,frame:{x:k*64,y:r*96,w:64,h:96},anchor:[32,77],record:p});
}
await add('sprites/plants-growth.png',plants);

var counts=[1,3,6,9,12,18,24],samples=counts.map(function(n,i){var a=records(n,i);meta.samples['bundle-'+n]=a;return a;});
var mixed=records(12,3);mixed.forEach(function(p,i){p.growth=[.06,.3,.65,1.3,2.3][i%5];});samples.push(mixed);meta.samples['mixed-growth']=mixed;
var still=canvas(384,192),sc=still.getContext('2d');
meta.sheets['bouquets-static.png']={width:384,height:192,cell:[96,96],columns:4,rows:2,anchor:[48,91],frames:[]};
for(var n=0;n<samples.length;n++){
 var c=canvas(96,96),res=MaxBouquet.render(c,samples[n],{drawPlant:draw}),name=n<7?'bundle-'+counts[n]:'mixed-growth';
 addFrame(sc,c,(n%4)*96,Math.floor(n/4)*96);
 meta.sheets['bouquets-static.png'].frames.push({name:name,frame:{x:(n%4)*96,y:Math.floor(n/4)*96,w:96,h:96},anchor:[48,91],result:res});
}
await add('sprites/bouquets-static.png',still);

var sway=canvas(768,384),sw=sway.getContext('2d'),swayNames=['bundle-3','bundle-6','bundle-12','bundle-24'];
meta.sheets['bouquets-sway.png']={width:768,height:384,cell:[96,96],columns:8,rows:4,anchor:[48,91],durationMs:120,loop:true,frames:[]};
for(var r=0;r<4;r++)for(var f=0;f<8;f++){
 var c=canvas(96,96);MaxBouquet.render(c,meta.samples[swayNames[r]],{drawPlant:draw,frame:f});addFrame(sw,c,f*96,r*96);
 meta.sheets['bouquets-sway.png'].frames.push({name:swayNames[r]+'-sway-'+f,frame:{x:f*96,y:r*96,w:96,h:96},anchor:[48,91],durationMs:120});
}
await add('sprites/bouquets-sway.png',sway);

var reveal=canvas(768,96),rv=reveal.getContext('2d'),steps=[0,1,2,4,6,8,10,12];
meta.sheets['bouquet-reveal.png']={width:768,height:96,cell:[96,96],columns:8,rows:1,anchor:[48,91],durationMs:120,loop:false,frames:[]};
for(var f=0;f<8;f++){
 var c=canvas(96,96);MaxBouquet.render(c,meta.samples['bundle-12'].slice(0,steps[f]),{drawPlant:draw});addFrame(rv,c,f*96,0);
 meta.sheets['bouquet-reveal.png'].frames.push({name:'reveal-'+f,frame:{x:f*96,y:0,w:96,h:96},anchor:[48,91],plants:steps[f],durationMs:120});
}
await add('sprites/bouquet-reveal.png',reveal);

// Exercise real variable run sizes, including overflow and a zero-plant round.
var checks=[0,1,24,25,73].map(function(n){
 var rec=records(n),groups=MaxBouquet.chunks(rec),seen=[];
 groups.forEach(function(_,i){var c=canvas(96,96),r=MaxBouquet.render(c,rec,{drawPlant:draw,bundle:i});seen=seen.concat(r.visibleIds);});
 return {plants:n,bundles:groups.length,rendered:seen.length,unique:new Set(seen).size,pass:seen.length===n&&new Set(seen).size===n};
});
if(checks.some(function(c){return !c.pass;}))throw new Error('Plant retention check failed');
meta.checks=checks;meta.samples['overflow-73']=records(73);
files.push({name:'metadata/rendered.json',bytes:new TextEncoder().encode(JSON.stringify(meta,null,2))});
document.getElementById('gallery').append(plants,still,sway,reveal);
status.textContent='Ready: 45 plant states, 8 bouquets, 32 sway frames, 8 reveal frames. All five retention checks passed.';

// Small dependency-free ZIP writer (stored entries, CRC-32), for exact PNG export.
function crc32(bytes){var c=-1;for(var i=0;i<bytes.length;i++){c^=bytes[i];for(var b=0;b<8;b++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^-1)>>>0;}
function header(len){var b=new Uint8Array(len);return {b:b,v:new DataView(b.buffer)};}
function zip(items){var out=[],central=[],offset=0,centralSize=0;
 items.forEach(function(file){var n=new TextEncoder().encode(file.name),size=file.bytes.length,crc=crc32(file.bytes),h=header(30+n.length),v=h.v;
 v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,size,true);v.setUint32(22,size,true);v.setUint16(26,n.length,true);h.b.set(n,30);out.push(h.b,file.bytes);
 var d=header(46+n.length),w=d.v;w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,crc,true);w.setUint32(20,size,true);w.setUint32(24,size,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);d.b.set(n,46);central.push(d.b);centralSize+=d.b.length;offset+=h.b.length+size;
 });
 var end=header(22);end.v.setUint32(0,0x06054b50,true);end.v.setUint16(8,items.length,true);end.v.setUint16(10,items.length,true);end.v.setUint32(12,centralSize,true);end.v.setUint32(16,offset,true);
 return new Blob(out.concat(central,[end.b]),{type:'application/zip'});
}
download.href=URL.createObjectURL(zip(files));download.download='MAX-native-rendered.zip';download.hidden=false;
}()).catch(function(e){document.getElementById('status').textContent='ERROR: '+e.message;console.error(e);});
