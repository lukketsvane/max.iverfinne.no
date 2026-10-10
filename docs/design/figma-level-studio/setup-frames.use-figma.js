// HISTORICAL: standalone drafts were superseded by authoritative MASTER rows.
throw new Error('Obsolete standalone setup blocked. Edit existing MASTER level rows through the Level Studio plugin.');
// The orchestrator prepends const input and const masterIds from the pinned setup files.
const page = await figma.getNodeByIdAsync('508:11825');
await figma.setCurrentPageAsync(page);
const occupied=page.findAllWithCriteria({types:['FRAME']}).filter(n=>input.gardens.some(g=>g.frame===n.name));
if(occupied.length)return {status:'existing-frames-inspect-before-update',frames:occupied.map(n=>({id:n.id,name:n.name})),createdNodeIds:[],mutatedNodeIds:[]};
await Promise.all(['Regular','Bold'].map(style=>figma.loadFontAsync({family:'Inter',style})));
const createdNodeIds=[],frames=[],referenceNodes=[],instanceSources=[];
const track=n=>{createdNodeIds.push(n.id);return n;};
const paint=hex=>[{type:'SOLID',color:{r:parseInt(hex.slice(0,2),16)/255,g:parseInt(hex.slice(2,4),16)/255,b:parseInt(hex.slice(4,6),16)/255}}];
const masters={};
for(const [tag,id]of Object.entries(masterIds)){const m=await figma.getNodeByIdAsync(id);if(!m||m.type!=='COMPONENT'||m.name!==tag)throw new Error('Missing exact compiler master '+tag);masters[tag]=m;}
function label(name,body,x,y,w,bold=false){const n=track(figma.createText());n.name=name;n.fontName={family:'Inter',style:bold?'Bold':'Regular'};n.fontSize=bold?19:12;n.textAutoResize='HEIGHT';n.resize(w,20);n.characters=body;n.fills=paint('dbe8db');page.appendChild(n);n.x=x;n.y=y;return n;}
for(const [i,g]of input.gardens.entries()){
  const x=6680,y=1190+i*560;
  label('Draft heading / '+g.frame,`${String(g.stage).padStart(2,'0')} · ${g.title} · editable draft`,x,y-60,640,true);
  label('Draft scope / '+g.frame,'Edit direct instances here. Locked soil and water show native terrain. No designed marker; export remains a draft.',x,y-30,640);
  const f=track(figma.createFrame());f.name=g.frame;f.resize(g.w,g.h);f.clipsContent=false;f.fills=paint('07171d');page.appendChild(f);f.x=x;f.y=y;
  if(g.terrainPath){const svg=track(figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${g.w}" height="${g.h}" viewBox="0 0 ${g.w} ${g.h}"><path d="${g.terrainPath}" fill="#172a28"/></svg>`));svg.name='REFERENCE / native terrain / not exported';f.appendChild(svg);svg.x=0;svg.y=0;svg.locked=true;for(const c of svg.findAll(()=>true))createdNodeIds.push(c.id);}
  for(const [j,p]of(g.water||[]).entries()){const r=track(figma.createRectangle());r.name='REFERENCE / native water '+j+' / not exported';f.appendChild(r);r.x=p.x;r.y=p.y;r.resize(p.w,p.h);r.fills=paint('18394a');r.opacity=.65;r.locked=true;}
  for(const item of g.instances){if(item.name==='designed')throw new Error('Starter must remain draft');const m=masters[item.name];if(!m)throw new Error('Unknown compiler tag '+item.name);const n=track(m.createInstance());f.appendChild(n);n.x=item.x;n.y=item.y;n.resize(item.w,item.h);if(n.name!==item.name)throw new Error('Instance name drift');instanceSources.push({id:n.id,frame:g.frame,tag:n.name,sourceId:item.sourceId||null});}
  const r=track(figma.createRectangle());r.name='REFERENCE / actual game capture / garden-'+String(g.stage).padStart(2,'0');r.resize(640,400);r.fills=paint('07171d');page.appendChild(r);r.x=x+740;r.y=y;r.locked=true;
  label('Capture heading / '+g.frame,'Actual game capture · visual reference',x+740,y-60,640,true);
  label('Capture scope / '+g.frame,'Rendered scenery is shown for direction. This image does not author terrain cavities, scenery or moving mechanics.',x+740,y-30,640);
  referenceNodes.push({stage:g.stage,id:r.id});
  frames.push({id:f.id,name:f.name,x:f.x,y:f.y,w:f.width,h:f.height,directInstanceCount:f.children.filter(n=>n.type==='INSTANCE').length,designed:false});
}
return {status:'created-drafts',pageId:page.id,createdNodeIds,mutatedNodeIds:[],frames,referenceNodes,instanceSources,geometryDigest:input.geometryDigest};
