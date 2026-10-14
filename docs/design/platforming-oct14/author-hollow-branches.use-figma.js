// Author the next playable Hollow Tree pass in the existing MASTER, not a fork.
// Execute with the authenticated Figma connector. No PNG master is modified.
const page = await figma.getNodeByIdAsync('508:11825');
await figma.setCurrentPageAsync(page);
const row = await figma.getNodeByIdAsync('941:2784');
if (!row || row.name !== 'level_01') throw new Error('Current Hollow Tree row is missing.');
const art = row.children.find(n => n.name === 'ART');
const routes = row.children.find(n => n.name === 'ROUTES');
const registration = row.children.find(n => n.name === 'REGISTRATION');
const secret = await figma.getNodeByIdAsync('941:9813');
const prototype = await figma.getNodeByIdAsync('941:9781');
if (!art || !routes || !registration || !secret || !prototype) throw new Error('Required native source planes are missing.');
if (art.x !== registration.x || art.width !== registration.width || art.height !== registration.height || ![0, registration.y].includes(art.y)) throw new Error('Native source bounds changed; inspect before editing.');
const createdNodeIds = [], mutatedNodeIds = [];
// The previous layout pass moved only gameplay planes below the row header.
// Correct the artwork plane registration without changing any local art pixel.
if (art.y !== registration.y) { art.y = registration.y; mutatedNodeIds.push(art.id); }
const steps = [
  { x:258,y:222,w:44,phase:'BEFORE_GROUND',label:'branch-run:0' },
  { x:306,y:204,w:36,phase:'BEFORE_GROUND',label:'branch-run:1' },
  { x:346,y:186,w:42,phase:'BEFORE_GROUND',label:'branch-run:2' },
  { x:392,y:168,w:38,phase:'BEFORE_GROUND',label:'branch-run:3' },
  { x:432,y:150,w:44,phase:'BEFORE_GROUND',label:'branch-run:4' },
  { x:473,y:132,w:32,phase:'BEFORE_GROUND',label:'branch-run:5' },
  { x:310,y:340,w:50,phase:'AFTER_SOIL',label:'inner-root:0' },
  { x:278,y:322,w:58,phase:'AFTER_SOIL',label:'inner-root:1' }
];
const parts = new Map();
for (const phase of ['BEFORE_GROUND','AFTER_SOIL']) {
  const name = `LAYER ${phase==='BEFORE_GROUND'?'000022':'000023'} · PHASE ${phase} · hollow:jumping-boughs`;
  let part = art.children.find(n => n.name === name);
  if (!part) {
    part = figma.createFrame(); art.appendChild(part);
    part.name=name; part.resize(640,400); part.x=0; part.y=0;
    part.fills=[]; part.strokes=[]; part.clipsContent=false;
    part.blendMode='PASS_THROUGH'; createdNodeIds.push(part.id);
  }
  parts.set(phase,part);
}
function pixel(part,name,x,y,w,h,hex) {
  const rgb=hex.match(/[a-f0-9]{2}/g).map(v=>parseInt(v,16)/255);
  let n=part.children.find(c=>c.name===name);
  if (n) {
    if (n.type!=='RECTANGLE'||n.x!==x||n.y!==y||n.width!==w||n.height!==h) throw new Error('Existing authored pixel changed: '+name);
    return;
  }
  n=figma.createRectangle(); part.appendChild(n); n.name=name;
  n.resize(w,h); n.x=x; n.y=y; n.fills=[{type:'SOLID',color:{r:rgb[0],g:rgb[1],b:rgb[2]}}];
  n.strokes=[]; createdNodeIds.push(n.id);
}
steps.forEach((s,i)=>{
  const name=`ROUTE ${String(23+i).padStart(6,'0')} · hollow:${s.label} · one-way:branch`;
  let n=routes.children.find(c=>c.name===name);
  if (n) {
    if(n.x!==s.x||n.y!==s.y||n.width!==s.w||n.height!==6)throw new Error('Existing jump route changed: '+name);
  } else {
    n=prototype.clone(); routes.appendChild(n); n.name=name; n.resize(s.w,6); n.x=s.x;n.y=s.y;createdNodeIds.push(n.id);
  }
  const p=parts.get(s.phase), prefix=`hollow:${s.label}`;
  pixel(p,prefix+':shadow',s.x,s.y+1,s.w,5,'192d2e');
  pixel(p,prefix+':wood',s.x+2,s.y+1,s.w-4,3,'4c5141');
  pixel(p,prefix+':rim',s.x,s.y,s.w,1,'656850');
  for(let j=3;j<s.w-3;j+=9){
    pixel(p,prefix+':moss:'+j,s.x+j,s.y,3,1,'526a45');
    pixel(p,prefix+':grain:'+j,s.x+j,s.y+3,2,1,'2c3835');
  }
  pixel(p,prefix+':root:0',s.x+4,s.y+6,1,4,'29332d');
  pixel(p,prefix+':root:1',s.x+s.w-7,s.y+6,1,7,'254035');
});
// A real supported cache gives the lower gallery an exploration destination.
if(secret.x!==303||secret.y!==315){secret.x=303;secret.y=315;mutatedNodeIds.push(secret.id);}
return {createdNodeIds,mutatedNodeIds,rowId:row.id,artPlaneY:art.y,routeCount:routes.children.length,
  steps:steps.map(s=>({label:s.label,x:s.x,y:s.y,w:s.w,h:6})),secret:{id:secret.id,x:secret.x,y:secret.y},
  preserved:'Existing artwork, ladders, planting court, required trials, reward, seed, pond, underground exit and physical ascent'};
