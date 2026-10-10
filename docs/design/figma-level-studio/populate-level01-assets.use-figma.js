const page=await figma.getNodeByIdAsync('508:11825');if(!page||page.type!=='PAGE')throw Error('page');await figma.setCurrentPageAsync(page);
const assets=await figma.getNodeByIdAsync('880:79'),work=await figma.getNodeByIdAsync('880:78');
if(!assets||assets.type!=='FRAME'||!work||work.type!=='FRAME'||assets.parent.id!==work.id)throw Error('Level01 assets changed');
await figma.loadFontAsync({family:'Inter',style:'Regular'});
const made=[],changed=[],entries=[];
function note(n){made.push(n.id);if('children' in n)for(const c of n.children)note(c);}
function label(name,text,x,y){let t=assets.children.find(n=>n.type==='TEXT'&&n.name===name);if(t){changed.push(t.id);}else{t=figma.createText();assets.appendChild(t);made.push(t.id);t.name=name;}t.fontName={family:'Inter',style:'Regular'};t.fontSize=14;t.characters=text;t.x=x;t.y=y;t.fills=[{type:'SOLID',color:{r:.69,g:.8,b:.69}}];return t;}
const specs=[
['890:13530','ASSET · PHASE BEFORE_GROUND · Hollow Tree + Lantern',24,100],
['890:13532','ASSET · PHASE BEFORE_GROUND · Mossy Timber + Supports',430,100],
['890:13542','ASSET · PHASE AFTER_SOIL · Passage Roots + Lamps',620,100],
['890:13541','ASSET · PHASE AFTER_SOIL · Cave Window',620,245],
['890:13539','ASSET · PHASE BEFORE_GROUND · Native Forest Flowers',620,375]
];
for(const [id,name,x,y] of specs){const src=await figma.getNodeByIdAsync(id);if(!src||src.type!=='FRAME'||!src.children.length)throw Error('nativepart '+id);let part=assets.children.find(n=>n.type==='COMPONENT'&&n.name===name);if(!part){const minX=Math.min(...src.children.map(n=>n.x)),minY=Math.min(...src.children.map(n=>n.y));const maxX=Math.max(...src.children.map(n=>n.x+n.width)),maxY=Math.max(...src.children.map(n=>n.y+n.height));part=figma.createComponent();assets.appendChild(part);made.push(part.id);part.name=name;part.fills=[];part.clipsContent=false;part.resize(maxX-minX,maxY-minY);for(const n of src.children){const c=n.clone();part.appendChild(c);c.x=n.x-minX;c.y=n.y-minY;note(c);}part.description='Editable native 1:1 level art. Drag an instance into ART, move on whole pixels, preserve its size and phase. ROUTES provide its separate playable collisions.';}part.x=x;part.y=y;changed.push(part.id);label('LABEL · '+name,name.split(' · ').slice(2).join(' · '),x,y-24);entries.push({id:part.id,name:part.name,x,y,width:part.width,height:part.height,children:part.children.length});}
const title=await figma.getNodeByIdAsync('880:80'),help=await figma.getNodeByIdAsync('880:81');
if(!title||title.type!=='TEXT'||!help||help.type!=='TEXT')throw Error('assettexts');
title.fontName={family:'Inter',style:'Regular'};title.fontSize=22;title.characters='LEVEL 01 · HOLLOW TREE ASSETS';title.x=24;title.y=20;
help.fontName={family:'Inter',style:'Regular'};help.fontSize=14;help.characters='Drag native art into ART. Use the gameplay palette below in ROUTES, POINTS and REGISTRATION.';help.x=24;help.y=54;changed.push(title.id,help.id);
label('LABEL · Gameplay Palette','GAMEPLAY PALETTE · native component instances',24,445);
const palette=[
['ledge:stone','382:7'],['ledge:branch','382:8'],['ledge:ruin','382:9'],['ledge:root','382:10'],
['block:stone','382:11'],['block:ruin','382:12'],['block:root','382:13'],['block:branch','382:14'],
['ladder','864:13989'],['pond:22','864:13990'],['reward','382:15'],['seed','382:16'],
['bonus','382:17'],['trial','382:18'],['puzzle','382:19'],['door','382:20'],
['dig','382:21'],['secret','382:22'],['start','382:23'],['designed','382:6'],
['replace-picture','864:13991'],['furnish-place','864:13992']
];
for(let i=0;i<palette.length;i++){const [tag,id]=palette[i],master=await figma.getNodeByIdAsync(id);if(!master||master.type!=='COMPONENT')throw Error('palette source '+id);const x=24+(i%6)*220,y=495+Math.floor(i/6)*98;label('LABEL · PALETTE '+tag,tag,x,y-22);let instance=assets.children.find(n=>n.type==='INSTANCE'&&n.name==='PALETTE · '+tag);if(!instance){instance=master.createInstance();assets.appendChild(instance);instance.name='PALETTE · '+tag;note(instance);}instance.x=x;instance.y=y;changed.push(instance.id);}
assets.resize(1400,900);work.resize(2052,900);changed.push(assets.id,work.id);
function ranges(ids){const groups=new Map();for(const id of Array.from(new Set(ids))){const m=/^(\d+):(\d+)$/.exec(id);if(!m){const key='literal';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(id);continue;}if(!groups.has(m[1]))groups.set(m[1],[]);groups.get(m[1]).push(Number(m[2]));}const out=[];for(const [prefix,values]of groups){if(prefix==='literal'){out.push({literalIds:values});continue;}values.sort((a,b)=>a-b);let start=values[0],end=start;for(let i=1;i<=values.length;i++){if(i<values.length&&values[i]===end+1){end=values[i];continue;}out.push({prefix,first:start,last:end,count:end-start+1});start=values[i];end=start;}}return out;}
const row=await figma.getNodeByIdAsync('887:13528');figma.viewport.scrollAndZoomIntoView([row]);
return {status:'Level01-native-art-components-and-gameplay-palette-ready',assetsId:assets.id,rowId:row.id,components:entries,paletteInstances:palette.length,createdNodeIdRanges:ranges(made),createdNodeCount:new Set(made).size,mutatedNodeIds:Array.from(new Set(changed)),allCreatedIdsEncoding:'Lossless inclusive ranges from actual returned node IDs; literal IDs preserved separately',sourceARTChanged:false,sourcePNGsChanged:false};
