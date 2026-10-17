import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {artProblems} from './figma-sync.mjs';
const require=createRequire(import.meta.url),{bindSceneSources}=require('../docs/design/master-levels/art/source-binding.cjs');
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const hash=(data,algorithm='sha256')=>createHash(algorithm).update(data).digest('hex');
export function compileLevelOne(capture,bytes){
 const c=capture,r=c.registration;
 if(c.file!=='TC0PHGMTCMR6im4hb3CSbF'||c.page!=='508:11825'||c.master!=='1228:21976'||c.row?.id!=='1228:29201'||!/^level_01 \/ Hollow Tree \/ 5 screens$/.test(c.row.name))throw Error('The current Figma level_01 is required; another numbered level cannot replace it.');
 if(c.row.width!==3555||c.row.height!==400||!r||r.width!==3555||r.height!==400||r.originX!==168||r.soilY!==350)throw Error('Level 1 native registration changed.');
 if(hash(bytes,'sha1')!==c.art.sha1||bytes.readUInt32BE(16)!==3555||bytes.readUInt32BE(20)!==400)throw Error('Current Level 1 artwork differs from its authenticated native export.');
 const problems=artProblems(c.art.path,bytes);if(problems.length)throw Error(problems.join('\n'));
 const garden={frame:'garden-01b',node:c.row.id,replacePicture:true,ledges:[],blocks:[],ladders:[],terrain:[],reward:[],seed:[],trial:[],bonus:[],puzzle:[],door:[],dig:[],secret:[],start:[]},ledger=[],ids=new Set();
 for(const n of c.nodes){
  if(ids.has(n.id)||![n.x,n.y,n.width,n.height].every(Number.isSafeInteger)||n.width<=0||n.height<=0||n.x<0||n.y<0||n.x+n.width>3555||n.y+n.height>400)throw Error('Invalid source node '+n.id);ids.add(n.id);
  const kind=n.name.split(' · ')[0].toLowerCase(),solid=kind==='solid',ledge=kind==='oneway'||n.name.startsWith('V03'),v={x:n.x-r.originX,rise:r.soilY-n.y,w:n.width,style:'root'};
  if(solid||ledge){
   const list=solid?garden.blocks:garden.ledges,index=list.length;if(solid)v.h=n.height;list.push(v);
   if(solid)garden.terrain.push({kind:'court',x:v.x,rise:v.rise,w:v.w,h:n.height});
   ledger.push({stage:1,frame:garden.frame,rowId:c.row.id,platformId:'1:'+(solid?'b':'d')+index,sourceNodeId:n.id,nativeRect:{x:n.x,y:n.y,w:n.width,h:n.height},compilerGeometry:{...v,solid},registration:{originX:r.originX,soilY:r.soilY}});
  }else if(['reward','seed','trial','bonus','puzzle','door','dig','secret','start'].includes(kind))garden[kind].push({x:n.x+Math.floor(n.width/2)-r.originX,rise:r.soilY-n.y-n.height});
  else throw Error('Unknown Level 1 source role '+n.name);
 }
 if(garden.start.length!==1||garden.door.length!==1||garden.seed.length!==3)throw Error('Current Level 1 must retain its start, exit and three authored seeds.');
 const supports=(x,y)=>garden.ledges.some(p=>x>=p.x&&x<=p.x+p.w&&p.rise===y)||garden.blocks.some(p=>x>=p.x&&x<=p.x+p.w&&p.rise===y);
 for(const n of c.ladders){
  if(ids.has(n.id)||![n.x,n.y,n.width,n.height].every(Number.isSafeInteger)||n.width!==14||n.height<=0)throw Error('Invalid native ladder '+n.id);ids.add(n.id);
  const x=n.x+7-r.originX,top=r.soilY-n.y,bottom=top-n.height;
  if(!supports(x,top)||!supports(x,bottom))throw Error('Visible ladder needs real upper and lower landings: '+n.artNode);
  garden.ladders.push({x,rise:top,w:n.width,h:n.height,art:true});
 }
 if(garden.ladders.length!==13)throw Error('All thirteen visible access ladders must be mapped.');
 const header=(id,name)=>[0,id,name,0,0,3555,400,1,'PASS_THROUGH',true,true];
 const artRow={schema:1,status:'joined-actual-document-native-art',page:c.page,masterId:c.master,stage:1,frame:garden.frame,rowId:c.row.id,planes:{art:header(c.art.nodeId,'ART'),registration:header(r.id,'REGISTRATION')},registration:{originId:r.originId,soilId:r.soilId,originX:r.originX,soilY:r.soilY},layers:[[0,'1412:21976','LAYER 000000 · PHASE BEFORE_GROUND · exact Level 01 export',0,0,3555,400,1,'PASS_THROUGH',true,true,'before-ground']],ops:[[0,1,c.art.productionNodeId,0,0,3555,400,c.art.path,c.art.sha1,3555,400,0,0,1,'PASS_THROUGH']],totalOperations:1,sourceDigest:hash(JSON.stringify(c))};
 return bindSceneSources({data:{gardens:{1:[garden]}},ledger},{status:'actual-master-native-art-export-for-isolated-preview',rows:[artRow]});
}
function readGlobal(file,key){const scope={};scope.window=scope;runInNewContext(readFileSync(join(root,file),'utf8'),scope);return scope[key];}
export function installLevelOne(capture,bytes){
 const compiled=compileLevelOne(capture,bytes),levels=readGlobal('levels-data.js','MaxLevelData'),scenes=readGlobal('level-scenes-data.js','MaxLevelScenesData');
 levels.gardens[1]=compiled.data.gardens[1];levels.source=levels.source||{};levels.source.currentLevelOne={file:capture.file,page:capture.page,master:capture.master,row:capture.row.id,capture:'docs/design/level-one-current/figma-capture.json'};
 scenes.rows=scenes.rows.filter(row=>row.stage!==1).concat(compiled.scenes.rows).sort((a,b)=>a.stage-b.stage);scenes.sourceDigest=hash(JSON.stringify(scenes.rows));
 require('../docs/design/master-levels/art/compile-runtime.cjs').activatePair(root,'window.MaxLevelData = '+JSON.stringify(levels)+';\n','window.MaxLevelScenesData = '+JSON.stringify(scenes)+';\n');
 return compiled;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const capture=JSON.parse(readFileSync(join(root,'docs/design/level-one-current/figma-capture.json')));const result=installLevelOne(capture,readFileSync(join(root,capture.art.path)));console.log(JSON.stringify({stage:1,row:capture.row.id,native:[3555,400],binding:result.bindings[0],ladders:result.data.gardens[1][0].ladders.length}));}
