import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {artProblems} from './figma-sync.mjs';
const require=createRequire(import.meta.url);
const {bindSceneSources}=require('../docs/design/master-levels/art/source-binding.cjs');
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const directory=join(root,'docs/design/figma-import-01-09');
const hash=(data,algorithm='sha256')=>createHash(algorithm).update(data).digest('hex');
const expected={1:['1228:29201','Hollow Tree',168],2:['1228:30814','Railway Ruins',194],4:['1228:32376','Mossback Sanctuary',210],6:['1228:33596','Cairn Terraces',168]};
const production={1:['1412:21976','1412:21977'],2:['1442:21979','1432:21977'],4:['1442:21980','1432:21978'],6:['1442:21981','1432:21979']};
export function loadWideCaptures(){
 const first=JSON.parse(readFileSync(join(root,'docs/design/level-one-current/figma-capture.json')));
 const result=[{...first,stage:1}];
 const metadata=JSON.parse(readFileSync(join(directory,'wide-source.json')));
 for(const entry of metadata.rows){
  const csv=readFileSync(join(directory,entry.csv),'utf8').trim().split('\n').slice(1).join('\n');
  let sum=2166136261;for(let i=0;i<csv.length;i++)sum=Math.imul(sum^csv.charCodeAt(i),16777619)>>>0;
  assert.equal(sum.toString(16).padStart(8,'0'),entry.fnv1a32);assert.equal(csv.length,entry.recordCharacters);
  const records=csv.split('\n').map(line=>{const[id,kind,...v]=line.split(',');const[x,y,width,height]=v.map(Number);return{id:metadata.idPrefix+id,kind,x,y,width,height};});
  assert.equal(records.length,entry.records);
  result.push({...entry,file:metadata.file,page:metadata.page,master:metadata.master,capturedAt:metadata.capturedAt,registrationCapturedAt:metadata.registrationCapturedAt,nodes:records.filter(n=>n.kind!=='ladder'),ladders:records.filter(n=>n.kind==='ladder')});
 }
 return result;
}
export function compileWideLevel(c,bytes){
 const [rowId,title,origin]=expected[c.stage]||[];
 assert.equal(c.file,'TC0PHGMTCMR6im4hb3CSbF');assert.equal(c.page,'508:11825');assert.equal(c.master,'1228:21976');assert.equal(c.row.id,rowId);
 assert.equal(c.row.name,`level_${String(c.stage).padStart(2,'0')} / ${title} / 5 screens`);
 const r=c.registration;
 assert.deepEqual([c.row.width,c.row.height,r.width,r.height,r.originX,r.soilY],[3555,400,3555,400,origin,350]);
 assert.equal(hash(bytes,'sha1'),c.art.sha1);assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[3555,400]);
 assert.deepEqual(artProblems(c.art.path,bytes),[]);
 const garden={frame:`garden-${String(c.stage).padStart(2,'0')}b`,node:c.row.id,replacePicture:true,ledges:[],blocks:[],ladders:[],terrain:[],reward:[],seed:[],trial:[],bonus:[],puzzle:[],door:[],dig:[],secret:[],start:[]};
 const ledger=[],ids=new Set();
 const validate=n=>{assert.ok(!ids.has(n.id),'Duplicate '+n.id);ids.add(n.id);assert.ok([n.x,n.y,n.width,n.height].every(Number.isSafeInteger),'Non-native '+n.id);assert.ok(n.x>=0&&n.y>=0&&n.width>0&&n.height>0&&n.x+n.width<=3555&&n.y+n.height<=400,'Out of bounds '+n.id);};
 for(const n of c.nodes){
  validate(n);
  const kind=n.kind||(n.name.startsWith('V03')?'oneway':n.name.split(' · ')[0].toLowerCase());
  const solid=kind==='solid',v={x:n.x-r.originX,rise:r.soilY-n.y,w:n.width,style:c.stage===2?'stone':'root'};
  if(solid||kind==='oneway'){
   const list=solid?garden.blocks:garden.ledges,index=list.length;if(solid)v.h=n.height;list.push(v);
   if(solid)garden.terrain.push({kind:'court',x:v.x,rise:v.rise,w:v.w,h:n.height});
   ledger.push({stage:c.stage,frame:garden.frame,rowId:c.row.id,platformId:c.stage+':'+(solid?'b':'d')+index,sourceNodeId:n.id,nativeRect:{x:n.x,y:n.y,w:n.width,h:n.height},compilerGeometry:{...v,solid},registration:{originX:r.originX,soilY:r.soilY}});
  }else{
   assert.ok(['reward','seed','trial','bonus','puzzle','door','dig','secret','start'].includes(kind),'Unknown role '+kind);
   garden[kind].push({x:n.x+Math.floor(n.width/2)-r.originX,rise:r.soilY-n.y-n.height});
  }
 }
 assert.deepEqual([garden.start.length,garden.door.length,garden.seed.length],[1,1,3]);
 const surfaces=[...garden.blocks,...garden.ledges];
 const supports=(x,rise)=>surfaces.some(p=>x>=p.x&&x<=p.x+p.w&&p.rise===rise);
 for(const role of ['reward','seed','trial','bonus','puzzle','door','dig','secret','start'])for(const p of garden[role])assert.ok(supports(p.x,p.rise),`Unsupported ${c.stage} ${role}`);
 for(const n of c.ladders){
  validate(n);assert.equal(n.width,14);
  const x=n.x+7-r.originX,top=r.soilY-n.y,bottom=top-n.height;
  assert.ok(supports(x,top)&&supports(x,bottom),'Ladder needs upper and lower landings: '+n.id);
  garden.ladders.push({x,rise:top,w:14,h:n.height,art:true});
 }
 const [groupId,productionNodeId]=production[c.stage];
 const header=(id,name)=>[0,id,name,0,0,3555,400,1,'PASS_THROUGH',true,true];
 const artRow={schema:1,status:'joined-actual-document-native-art',page:c.page,masterId:c.master,stage:c.stage,frame:garden.frame,rowId:c.row.id,planes:{art:header(c.art.nodeId,'ART'),registration:header(r.id,'REGISTRATION')},registration:{originId:r.originId,soilId:r.soilId,originX:r.originX,soilY:r.soilY},layers:[[0,groupId,`LAYER 000000 · PHASE BEFORE_GROUND · exact Level ${c.stage} export`,0,0,3555,400,1,'PASS_THROUGH',true,true,'before-ground']],ops:[[0,1,productionNodeId,0,0,3555,400,c.art.path,c.art.sha1,3555,400,0,0,1,'PASS_THROUGH']],totalOperations:1,sourceDigest:hash(JSON.stringify(c))};
 return bindSceneSources({data:{gardens:{[c.stage]:[garden]}},ledger},{status:'actual-master-native-art-export-for-isolated-preview',rows:[artRow]});
}
function readGlobal(file,key){const scope={};scope.window=scope;runInNewContext(readFileSync(join(root,file),'utf8'),scope);return scope[key];}
export function installWideLevels(){
 const captures=loadWideCaptures();assert.deepEqual(captures.map(c=>c.stage),[1,2,4,6]);
 const compiled=captures.map(c=>compileWideLevel(c,readFileSync(join(root,c.art.path))));
 const levels=readGlobal('levels-data.js','MaxLevelData'),scenes=readGlobal('level-scenes-data.js','MaxLevelScenesData');
 for(let i=0;i<captures.length;i++)levels.gardens[captures[i].stage]=compiled[i].data.gardens[captures[i].stage];
 levels.source=levels.source||{};levels.source.approvedWideLevels={file:captures[0].file,page:captures[0].page,master:captures[0].master,stages:captures.map(c=>c.stage),capture:'docs/design/figma-import-01-09/wide-source.json',levelOneCapture:'docs/design/level-one-current/figma-capture.json'};
 scenes.rows=scenes.rows.filter(row=>!captures.some(c=>c.stage===row.stage)).concat(compiled.flatMap(c=>c.scenes.rows)).sort((a,b)=>a.stage-b.stage);
 scenes.sourceDigest=hash(JSON.stringify(scenes.rows));
 require('../docs/design/master-levels/art/compile-runtime.cjs').activatePair(root,'window.MaxLevelData = '+JSON.stringify(levels)+';\n','window.MaxLevelScenesData = '+JSON.stringify(scenes)+';\n');
 return compiled;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const results=installWideLevels();console.log(JSON.stringify(results.map(c=>({stage:c.bindings[0].stage,surfaces:c.ledger?.length,bindings:c.bindings}))));}
