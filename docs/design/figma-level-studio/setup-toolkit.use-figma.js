// Run with the Figma editing tool after inspecting the configured page.
const page = await figma.getNodeByIdAsync('508:11825');
if (!page || page.type !== 'PAGE') throw new Error('Configured level page missing');
await figma.setCurrentPageAsync(page);
const existing = page.children.find(n => n.name === 'MAX / LEVEL AUTHORING / Quick start');
if (existing) return {status:'already-created-inspect-before-update',rootId:existing.id,createdNodeIds:[],mutatedNodeIds:[]};
await Promise.all(['Regular','Bold'].map(style => figma.loadFontAsync({family:'Inter',style})));
const createdNodeIds = [], variableIds = [];
const track = n => { createdNodeIds.push(n.id); return n; };
const paint = hex => ({type:'SOLID',color:{r:parseInt(hex.slice(0,2),16)/255,g:parseInt(hex.slice(2,4),16)/255,b:parseInt(hex.slice(4,6),16)/255}});
async function createVariableCollection(name, modeNames) {
  const collection = figma.variables.createVariableCollection(name);
  collection.renameMode(collection.modes[0].modeId,modeNames[0]);
  return {collection,modeIds:{[modeNames[0]]:collection.modes[0].modeId}};
}
const collections = await figma.variables.getLocalVariableCollectionsAsync();
let collection = collections.find(c => c.name === 'MAX / Level authoring');
if (!collection) collection = (await createVariableCollection('MAX / Level authoring',['Default'])).collection;
const allVars = await figma.variables.getLocalVariablesAsync('COLOR'), roles = {};
for (const [key,hex] of Object.entries({water:'284c63',timber:'aa825d',marker:'c1ff89'})) {
  let primitive = allVars.find(v=>v.variableCollectionId===collection.id&&v.name===`primitive/${key}`);
  if(!primitive){primitive=figma.variables.createVariable(`primitive/${key}`,collection,'COLOR');primitive.scopes=[];primitive.setValueForMode(collection.defaultModeId,{...paint(hex).color,a:1});primitive.setVariableCodeSyntax('WEB',`var(--studio-primitive-${key})`);variableIds.push(primitive.id);}
  let role = allVars.find(v=>v.variableCollectionId===collection.id&&v.name===`color/${key}`);
  if(!role){role=figma.variables.createVariable(`color/${key}`,collection,'COLOR');role.scopes=['FRAME_FILL','SHAPE_FILL'];role.setValueForMode(collection.defaultModeId,{type:'VARIABLE_ALIAS',id:primitive.id});role.setVariableCodeSyntax('WEB',`var(--studio-color-${key})`);variableIds.push(role.id);}
  roles[key]=role;
}
const masterIds = {origin:'382:4',soil:'382:5',designed:'382:6','ledge:stone':'382:7','ledge:branch':'382:8','ledge:ruin':'382:9','ledge:root':'382:10','block:stone':'382:11','block:ruin':'382:12','block:root':'382:13','block:branch':'382:14',reward:'382:15',seed:'382:16',bonus:'382:17',trial:'382:18',puzzle:'382:19',door:'382:20',dig:'382:21',secret:'382:22',start:'382:23'};
const masters = {};
for(const [tag,id] of Object.entries(masterIds)){const n=await figma.getNodeByIdAsync(id);if(!n||n.type!=='COMPONENT'||n.name!==tag)throw new Error(`Missing exact master ${tag}`);masters[tag]=n;}
const added = [['ladder',14,60,'timber','Climbable geometry. Width and height are native integer pixels. Connect both ends to dry ground or a walkable surface.'],['pond:20',94,24,'water','Native authored water. Even width is wet span; height is depth; top is water level; 20px banks extend outside each side. Keep full banks clear of other ponds.'],['replace-picture',7,7,'marker','Explicit replacement of picture gardens 1 or 2 when this variant also contains designed. Export eligibility does not publish a deployment.'],['furnish-place',7,7,'marker','Request the existing native place furnishing. Keep off a snapshot that already copies furnished place geometry.']];
for(const [i,[tag,w,h,role,description]] of added.entries()){
  let n=page.findAllWithCriteria({types:['COMPONENT']}).find(n=>n.name===tag);
  if(!n){n=track(figma.createComponent());n.name=tag;n.resize(w,h);n.description=description+' Direct child of garden-NN; 1 Figma pixel = 1 game pixel.';n.fills=[figma.variables.setBoundVariableForPaint(paint(role==='water'?'284c63':role==='timber'?'aa825d':'c1ff89'),'color',roles[role])];page.appendChild(n);n.x=7840;n.y=100+i*100;}
  masters[tag]=n;masterIds[tag]=n.id;
}
function column(name,width,parent){const n=track(figma.createAutoLayout('VERTICAL'));n.name=name;n.resize(width,100);n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='FIXED';n.itemSpacing=12;n.fills=[];if(parent)parent.appendChild(n);return n;}
function text(parent,name,body,size=14,bold=false,width=984){const n=track(figma.createText());n.name=name;n.fontName={family:'Inter',style:bold?'Bold':'Regular'};n.fontSize=size;n.lineHeight={unit:'PIXELS',value:Math.ceil(size*1.5)};n.textAutoResize='HEIGHT';n.resize(width,Math.ceil(size*1.5));n.characters=body;n.fills=[paint('dbe8db')];parent.appendChild(n);return n;}
const root=column('MAX / LEVEL AUTHORING / Quick start',1040);page.appendChild(root);root.x=6680;root.y=100;root.paddingTop=28;root.paddingBottom=28;root.paddingLeft=28;root.paddingRight=28;root.itemSpacing=18;root.fills=[paint('0c1c23')];
text(root,'Heading','MAX · Build a level',30,true);
text(root,'Native scale','1 Figma px = 1 game px. Edit the garden frames below. All pieces are instances placed directly in their frame.',15);
text(root,'Workflow','1  Duplicate a garden draft or create one with the local Level Studio panel.\n2  Place surfaces, ladders, native ponds and objective markers. Keep whole pixels.\n3  Validate and download the page JSON. Make a frame export eligible with designed when reviewing it.\n4  Compile to a separate candidate, play the actual game, then release after checks.',14);
text(root,'Draft status','The two starter frames begin as drafts. designed enables export; it does not deploy. replace-picture explicitly replaces the existing first or second picture garden.',13);
text(root,'Supported scope','Works: platforms, solid blocks, ladders, native ponds and objective markers. Custom terrain cavities, scenery shapes and moving mechanisms still need runtime integration. Game captures beside the drafts are visual references.',13);
text(root,'Review command','npm run figma:levels -- --from <downloaded-page.json> --out /tmp/max-level-review.js',12);
const kit=column('MAX / LEVEL AUTHORING / Compiler toolkit',1040);page.appendChild(kit);kit.x=6680;kit.y=100+root.height+32;kit.paddingTop=24;kit.paddingBottom=24;kit.paddingLeft=24;kit.paddingRight=24;kit.itemSpacing=16;kit.fills=[paint('0c1c23')];
text(kit,'Toolkit heading','Reusable geometry · copy an instance into a garden',20,true,992);
const tags=Object.keys(masterIds);
for(let i=0;i<tags.length;i+=6){const row=track(figma.createAutoLayout('HORIZONTAL'));row.name='Tag row '+(i/6+1);row.itemSpacing=12;row.fills=[];kit.appendChild(row);
  for(const tag of tags.slice(i,i+6)){const card=column('Tag / '+tag,154,row);card.paddingTop=10;card.paddingBottom=10;card.paddingLeft=10;card.paddingRight=10;card.fills=[paint('142b31')];card.itemSpacing=8;text(card,'Name',tag,11,true,134);const n=track(masters[tag].createInstance());card.appendChild(n);text(card,'Bounds',`${Math.round(n.width)} × ${Math.round(n.height)} native px`,9,false,134);}
}
await root.screenshot({scale:1});
return {status:'created',pageId:page.id,rootId:root.id,toolkitId:kit.id,masterIds,createdNodeIds,collectionId:collection.id,variableIds,componentCount:tags.length,rootBounds:{x:root.x,y:root.y,w:root.width,h:root.height},toolkitBounds:{x:kit.x,y:kit.y,w:kit.width,h:kit.height}};
