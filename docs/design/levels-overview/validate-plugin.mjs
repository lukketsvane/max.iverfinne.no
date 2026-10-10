// Local VM validation with synthetic document geometry; never an authenticated Figma execution.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const base=fileURLToPath(new URL('.',import.meta.url));
const templatePath=path.join(base,'plugin/code.js');
const compiledScript=new vm.Script(fs.readFileSync(templatePath,'utf8'),{filename:'compiled-local-scene-importer.js'});
const captured=JSON.parse(JSON.parse(fs.readFileSync(path.join(base,'../figma-level-studio/actual-studio-native-verification.json'),'utf8')).content.find(item=>item.type==='text').text);
const bindings={file:captured.file,page:captured.page,master:captured.master,editor:captured.editor,rows:captured.rows.map(row=>({stage:row.stage,id:row.id,planes:Object.fromEntries(Object.entries(row.planes).map(([k,v])=>[k,v.id]))})).sort((a,b)=>a.stage-b.stage)};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const KEY='maxLevelSceneReference',OWNER='max-level-scene-reference/v1';
function fixture(configure){
 let counter=0,tracking=false,metrics={nodeCreates:0,imageCreates:0,fontLoads:0,setCurrentPage:0,existingNodeWrites:[]},all=new Map(),original=new Set(),failAppendStage=null,failed=false;
 class Node {
  constructor(type,id,name){this.id=id||`mock:${++counter}`;this.name=name||type;this.type=type;this.x=0;this.y=0;this.width=1000;this.height=800;this.rotation=0;this.visible=true;this.locked=false;this.clipsContent=false;this.layoutMode='NONE';this.layoutSizingHorizontal='FIXED';this.layoutSizingVertical='FIXED';this.fills=[];this.strokes=[];this.effects=[];this.opacity=1;this.parent=null;this.children=[];this.pluginData={};this.removed=false;if(type==='TEXT'){this.characters='';this.fontName={family:'Inter',style:'Regular'};this.fontSize=12;this.height=16;}
   const proxy=new Proxy(this,{set(t,k,v){if(tracking&&original.has(t.id)&&k!=='parent'&&k!=='selection')metrics.existingNodeWrites.push({id:t.id,key:k,value:typeof v==='string'?v:null});t[k]=v;return true;}});all.set(this.id,proxy);return proxy;
  }
  get relativeTransform(){return [[1,0,this.x],[0,1,this.y]];}
  get absoluteBoundingBox(){const p=this.parent?.absoluteBoundingBox||{x:0,y:0};return{x:p.x+this.x,y:p.y+this.y,width:this.width,height:this.height};}
  appendChild(node){if(tracking&&failAppendStage&&this.id===`assets:${failAppendStage}`&&!failed){failed=true;throw Error('Injected ASSETS append failure');}if(node.parent){const arr=node.parent.children,i=arr.indexOf(node);if(i>=0)arr.splice(i,1);}this.children.push(node);node.parent=this;}
  resize(w,h){this.width=w;this.height=h;}
  setPluginData(k,v){this.pluginData[k]=v;}
  getPluginData(k){return this.pluginData[k]||'';}
  setRangeHyperlink(start,end,value){this.hyperlink={start,end,value};}
  async loadAsync(){}
  remove(){if(this.parent){const arr=this.parent.children,i=arr.indexOf(this);if(i>=0)arr.splice(i,1);}this.parent=null;this.removed=true;}
 }
 const root=new Node('DOCUMENT','root','root'),page=new Node('PAGE',bindings.page,'Levels'),master=new Node('FRAME',bindings.master,'MASTER'),editor=new Node('FRAME',bindings.editor,'Editor');root.appendChild(page);page.appendChild(master);master.appendChild(editor);master.width=8000;master.height=22000;
 const rows=[];
 for(const expected of bindings.rows){const holder=new Node('FRAME',`holder:${expected.stage}`,`Workspace ${expected.stage}`);holder.y=expected.stage*1000;editor.appendChild(holder);const row=new Node('FRAME',expected.id,`level_${String(expected.stage).padStart(2,'0')}`);holder.appendChild(row);for(const [name,id]of Object.entries(expected.planes)){const plane=new Node('FRAME',id,name.toUpperCase());row.appendChild(plane);const sentinel=new Node('RECTANGLE',`sentinel:${expected.stage}:${name}`,'Immutable native content');sentinel.x=13;sentinel.y=19;sentinel.resize(200,80);sentinel.setPluginData('source','KEEP');plane.appendChild(sentinel);}
 const assets=new Node('FRAME',`assets:${expected.stage}`,'ASSETS');assets.x=1100;assets.resize(1400,1100);holder.appendChild(assets);const untouched=new Node('RECTANGLE',`asset-sentinel:${expected.stage}`,'Existing asset');untouched.x=950;untouched.y=650;untouched.resize(200,200);assets.appendChild(untouched);rows.push({node:row,assets,holder});}
 const figma={editorType:'figma',fileKey:bindings.file,root,currentPage:page,ui:{messages:[],postMessage(message){this.messages.push(message)}},viewport:{scrollAndZoomIntoView(){}},showUI(){},closePlugin(){},async getNodeByIdAsync(id){return all.get(id)||null},async loadFontAsync(){metrics.fontLoads++},createImage(bytes){metrics.imageCreates++;if(!Buffer.from(bytes).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid PNG');return{hash:hash(bytes)}},base64Decode(s){return Uint8Array.from(Buffer.from(s,'base64'))},async setCurrentPageAsync(p){metrics.setCurrentPage++;figma.currentPage=p},createPage(){metrics.nodeCreates++;const n=new Node('PAGE');root.appendChild(n);return n},createFrame(){metrics.nodeCreates++;const n=new Node('FRAME');figma.currentPage.appendChild(n);return n},createText(){metrics.nodeCreates++;const n=new Node('TEXT');figma.currentPage.appendChild(n);return n},createRectangle(){metrics.nodeCreates++;const n=new Node('RECTANGLE');figma.currentPage.appendChild(n);return n}};
 const refs=()=>rows.flatMap(row=>row.assets.children.filter(n=>n.name.startsWith('GeneratedSceneDesign'))).concat(page.children.filter(n=>n.name.startsWith('GeneratedSceneDesign')));
 const originalSnapshot=()=>JSON.stringify([...original].map(id=>{const n=all.get(id);return{id:n.id,name:n.name,type:n.type,x:n.x,y:n.y,width:n.width,height:n.height,rotation:n.rotation,visible:n.visible,locked:n.locked,layoutMode:n.layoutMode,layoutSizingHorizontal:n.layoutSizingHorizontal,layoutSizingVertical:n.layoutSizingVertical,characters:n.characters,fontName:n.fontName,fontSize:n.fontSize,fills:n.fills,strokes:n.strokes,effects:n.effects,opacity:n.opacity,pluginData:n.pluginData,removed:n.removed,parent:n.parent?.id,children:n.children.filter(c=>original.has(c.id)).map(c=>c.id)}}));
 const api={figma,rows,page,master,editor,all,metrics,refs,Node,setFailAppend(stage){failAppendStage=stage},snapshot:originalSnapshot};
 if(configure)configure(api);
 for(const id of all.keys())original.add(id);tracking=true;
 compiledScript.runInNewContext({figma,__html__:'',console,Uint8Array,Buffer,setTimeout,clearTimeout});
 api.invoke=async(type='import-references')=>{await figma.ui.onmessage({type});return figma.ui.messages.at(-1)};
 return api;
}
(async()=>{
 const results=[];const check=(name,pass,details)=>{results.push({name,pass,details});console.log(JSON.stringify(results.at(-1)));};
 {
 const f=fixture(),before=f.snapshot(),reply=await f.invoke();const initial=f.refs().map(n=>({id:n.id,parent:n.parent.id,name:n.name,pluginData:n.pluginData,children:n.children.map(c=>({id:c.id,name:c.name,characters:c.characters,fills:c.fills}))}));const creates=f.metrics.nodeCreates;const rerun=await f.invoke();const repeated=f.refs().map(n=>({id:n.id,parent:n.parent.id,name:n.name,pluginData:n.pluginData,children:n.children.map(c=>({id:c.id,name:c.name,characters:c.characters,fills:c.fills}))}));check('default imports 20 ASSETS references',reply.type==='complete'&&f.refs().length===20&&reply.receipt.rows.every(r=>r.placement==='ASSETS'),{reply:reply.type,referenceCount:f.refs().length,placements:reply.receipt?.rows.map(r=>r.placement),sourceUnchanged:before===f.snapshot(),originalNodeWrites:f.metrics.existingNodeWrites});check('rerun is idempotent',rerun.type==='complete'&&JSON.stringify(initial)===JSON.stringify(repeated)&&before===f.snapshot(),{reply:rerun.type,referencesUnchanged:JSON.stringify(initial)===JSON.stringify(repeated),transientNodesOnRerun:f.metrics.nodeCreates-creates,pagesRemaining:f.figma.root.children.length,sourceUnchanged:before===f.snapshot()});
 }
 for(const[name,configure]of[
 ['late malformed registration plane',f=>f.rows[19].node.children.find(n=>n.name==='REGISTRATION').id='wrong:registration'],
 ['late duplicate ASSETS',f=>f.rows[18].holder.appendChild(new f.Node('FRAME','duplicate:assets','ASSETS'))],
 ['late unowned reference conflict',f=>{const n=new f.Node('FRAME','unowned:ref','GeneratedSceneDesign · level_20 · Wrong');f.rows[19].assets.appendChild(n)}],
 ['wrong file',f=>f.figma.fileKey='wrong-file']]){const f=fixture(configure),before=f.snapshot(),reply=await f.invoke();check(name+' rejects before writes',reply.type==='error'&&f.metrics.nodeCreates===0&&f.metrics.imageCreates===0&&f.metrics.fontLoads===0&&before===f.snapshot(),{reply,message:reply.message,metrics:f.metrics,sourceUnchanged:before===f.snapshot()});}
 for(const[name,configure]of[
 ['small ASSETS',f=>f.rows[19].assets.resize(600,400)],
 ['full ASSETS',f=>{const n=new f.Node('RECTANGLE','fills:assets20','Occupied');n.resize(1400,1100);f.rows[19].assets.appendChild(n)}],
 ['auto-layout ASSETS',f=>f.rows[19].assets.layoutMode='VERTICAL'],
 ['HUG ASSETS',f=>f.rows[19].assets.layoutSizingHorizontal='HUG']]){const f=fixture(configure),before=f.snapshot(),reply=await f.invoke();const outside=f.page.children.filter(n=>n.name.startsWith('GeneratedSceneDesign'));const expectedX=Math.ceil(f.master.absoluteBoundingBox.x+f.master.absoluteBoundingBox.width+320),expectedY=Math.floor(f.rows[19].node.absoluteBoundingBox.y);const firstIDs=f.refs().map(n=>n.id);const rerun=await f.invoke();check(name+' fallback aligns to actual row and repeats safely',reply.type==='complete'&&reply.receipt.rows[19].placement==='aligned-reference'&&outside.length===1&&outside[0].x===expectedX&&outside[0].y===expectedY&&before===f.snapshot()&&rerun.type==='complete'&&JSON.stringify(firstIDs)===JSON.stringify(f.refs().map(n=>n.id)),{reply:reply.type,placement20:reply.receipt?.rows[19].placement,fallbackBounds:outside.map(n=>({x:n.x,y:n.y,width:n.width,height:n.height})),expectedX,expectedY,sourceUnchanged:before===f.snapshot(),repeatReferenceIDsUnchanged:JSON.stringify(firstIDs)===JSON.stringify(f.refs().map(n=>n.id))});}
 {
 const f=fixture(f=>{f.rows[0].node.children.find(n=>n.name==='TERRAIN').id='wrong:terrain';}),before=f.snapshot(),reply=await f.invoke();check('bound TERRAIN identity mismatch rejects before writes',reply.type==='error'&&f.metrics.nodeCreates===0&&f.metrics.imageCreates===0&&before===f.snapshot(),{reply:reply.type,message:reply.message,metrics:f.metrics,sourceUnchanged:before===f.snapshot(),expectedTerrainId:bindings.rows[0].planes.terrain});
 }
 {
 const f=fixture(f=>{f.rows[0].node.children.find(n=>n.name==='TERRAIN').remove();}),before=f.snapshot(),reply=await f.invoke();check('bound TERRAIN missing rejects before writes',reply.type==='error'&&f.metrics.nodeCreates===0&&f.metrics.imageCreates===0&&before===f.snapshot(),{reply:reply.type,message:reply.message,metrics:f.metrics,sourceUnchanged:before===f.snapshot(),expectedTerrainId:bindings.rows[0].planes.terrain});
 }
 {
 const f=fixture(f=>{f.rows[19].assets.remove();f.rows[18].holder.appendChild(f.rows[19].node);}),before=f.snapshot(),reply=await f.invoke();const sharedRefs=f.rows[18].assets.children.filter(n=>n.name.startsWith('GeneratedSceneDesign'));check('shared ASSETS across bound rows rejects before writes',reply.type==='error'&&f.metrics.nodeCreates===0&&f.metrics.imageCreates===0&&before===f.snapshot(),{reply:reply.type,message:reply.message,placements:reply.receipt?.rows.slice(18),sharedRefs:sharedRefs.map(n=>({id:n.id,name:n.name,x:n.x,y:n.y})),metrics:f.metrics,sourceUnchanged:before===f.snapshot()});
 }
 {
 const f=fixture(),before=f.snapshot();f.setFailAppend(13);const reply=await f.invoke();check('late application failure rolls back all additions',reply.type==='error'&&before===f.snapshot()&&f.refs().length===0&&f.figma.root.children.length===1,{reply:reply.type,message:reply.message,referenceCount:f.refs().length,pagesRemaining:f.figma.root.children.length,sourceUnchanged:before===f.snapshot()});
 }

 for(const[name,configure]of[
 ['missing final row',f=>f.rows[19].node.remove()],
 ['duplicate final row',f=>f.rows[19].holder.appendChild(new f.Node('FRAME','duplicate:row','level_20'))],
 ['missing file identity',f=>delete f.figma.fileKey],
 ['unowned comparison stack',f=>f.page.appendChild(new f.Node('FRAME','unowned:stack','MAX LEVEL STACK — SCENE STUDIES 20 → 01'))]
 ]){const f=fixture(configure),before=f.snapshot(),reply=await f.invoke(name.includes('stack')?'import-stack':'import-references');check(name+' refuses without document writes',reply.type==='error'&&f.metrics.nodeCreates===0&&before===f.snapshot(),{reply:reply.type,message:reply.message,sourceUnchanged:before===f.snapshot()});}
 {
 const f=fixture(),before=f.snapshot(),createImage=f.figma.createImage;let calls=0;
 f.figma.createImage=bytes=>createImage(++calls===13?Uint8Array.from([0,0,0]):bytes);
 const reply=await f.invoke();check('malformed decoded image refuses before document writes',reply.type==='error'&&f.metrics.nodeCreates===0&&f.refs().length===0&&before===f.snapshot(),{reply:reply.type,message:reply.message,sourceUnchanged:before===f.snapshot(),decodeCalls:calls});
 }
 {
 const f=fixture(f=>{for(const r of f.rows){r.assets.resize(200,100);r.holder.y=(20-r.node.name.slice(-2))*50;}const obstacle=new f.Node('FRAME','existing:far-content','Preserved distant page content');obstacle.x=15000;obstacle.resize(2500,1000);f.page.appendChild(obstacle);}),before=f.snapshot(),reply=await f.invoke();
 const boxes=f.refs().map(n=>n.absoluteBoundingBox);let overlaps=false;
 for(let i=0;i<boxes.length;i++)for(let j=0;j<i;j++){const a=boxes[i],b=boxes[j];if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)overlaps=true;}
 check('tight actual row spacing uses clear nonoverlapping fallback columns',reply.type==='complete'&&boxes.length===20&&boxes.every(b=>b.x>=17820)&&!overlaps&&before===f.snapshot(),{reply:reply.type,count:boxes.length,columns:[...new Set(boxes.map(b=>b.x))],overlaps,sourceUnchanged:before===f.snapshot()});
 }
 {
 const f=fixture(),before=f.snapshot(),reply=await f.invoke('import-stack');const id=reply.receipt?.stackId,stack=f.all.get(id),rows=stack?.children.filter(n=>/^LEVEL \d\d — /.test(n.name));const images=rows?.flatMap(row=>row.children.flatMap(n=>n.children.filter(c=>c.type==='RECTANGLE')));const creates=f.metrics.nodeCreates,repeat=await f.invoke('import-stack');
 check('comparison stack is 20→01, FIT, 1× native previews and idempotent',reply.type==='complete'&&rows.length===20&&rows[0].name.startsWith('LEVEL 20')&&rows[19].name.startsWith('LEVEL 01')&&images.length===40&&images.every(n=>n.fills[0].scaleMode==='FIT')&&images.filter(n=>n.name==='Native current capture').every(n=>n.width===334&&n.height===217)&&repeat.type==='complete'&&repeat.receipt.reused===true&&repeat.receipt.stackId===id&&f.metrics.nodeCreates===creates&&before===f.snapshot(),{reply:reply.type,top:rows?.[0].name,bottom:rows?.[19].name,reused:repeat.receipt?.reused,sourceUnchanged:before===f.snapshot()});
 }
 const report={kind:'local-vm-importer-validation',actualFigmaExecution:false,templatePath,templateSha256:hash(fs.readFileSync(templatePath)),results,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length};const destination=process.argv[2]||'/tmp/max-level-scene-plugin-validation.json';fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed,actualFigmaExecution:false,report:destination}));if(report.failed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
