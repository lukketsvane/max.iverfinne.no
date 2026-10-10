// Read-only capture. Load c10/figma-use before each authenticated use_figma call.
// Execute with fileKey TC0PHGMTCMR6im4hb3CSbF, link_id link_6aa94745e2b8819195041de9eb20fd15,
// skillNames resource:figma-use. Save each result as capture-part-<index>.json.
// Start at index 0; repeat sequentially through chunkCount - 1. No Figma mutations.
if(figma.fileKey&&figma.fileKey!=='TC0PHGMTCMR6im4hb3CSbF')throw Error('Unexpected file');
const page=await figma.getNodeByIdAsync('10:2');if(!page||page.type!=='PAGE')throw Error('Missing page');
await figma.setCurrentPageAsync(page);
const sectionIds=['451:2','451:3','451:4','451:5','451:6','451:7'],rows=[],paintAudit=[],registrationIssues=[];let unitTransforms=0;
function read(n){
 if('relativeTransform'in n){const t=n.relativeTransform;if(t[0][0]===1&&t[0][1]===0&&t[1][0]===0&&t[1][1]===1)unitTransforms++;else registrationIssues.push([n.id,t]);}
 let hashes=[];if('fills' in n&&Array.isArray(n.fills)){
 hashes=n.fills.filter(p=>p.type==='IMAGE').map(p=>p.imageHash);
 if(n.type==='RECTANGLE'&&/^assets\/.+\.png$/.test(n.name))paintAudit.push([n.id,n.fills.map(p=>[p.type,p.visible??true,p.opacity??1,p.type==='IMAGE'?p.scaleMode:null,p.type==='IMAGE'&&p.imageTransform?p.imageTransform:null,p.type==='IMAGE'&&p.filters?Object.fromEntries(Object.entries(p.filters).filter(([k,v])=>v!==0)):null,p.blendMode??'NORMAL'])]);
 }
 rows.push([n.id,n.parent?.id,n.type,n.name,'x' in n?n.x:0,'y' in n?n.y:0,'width' in n?n.width:0,'height' in n?n.height:0,hashes]);
 if('children'in n)for(const c of n.children)read(c);
}
for(const id of sectionIds){const n=page.children.find(n=>n.id===id);if(!n||n.type!=='SECTION')throw Error('Missing section '+id);read(n);}
function rule(n){const o={id:n.id,name:n.name,type:n.type};for(const k of ['x','y','width','height'])if(k in n)o[k]=n[k];if(n.type==='TEXT')o.characters=n.characters;if('children'in n)o.children=n.children.map(rule);return o;}
const rules=[];for(const id of ['396:3','396:12','396:19','396:25']){const n=await figma.getNodeByIdAsync(id);if(!n)throw Error('Missing rule '+id);rules.push(rule(n));}
const payload={format:'max-authenticated-production-capture/v2',fileKey:figma.fileKey||'TC0PHGMTCMR6im4hb3CSbF',page:{id:page.id,name:page.name,type:page.type},sectionIds,rowFields:['id','parentId','type','name','x','y','width','height','imageHashes'],rows,paintAudit,registrationAudit:{unitTransforms,registrationIssues},rules,scope:'Configured production sections and workbench rules only; unfinished ART 887:13531 excluded.',readOnly:true};
const input=JSON.stringify(payload).replace(/[^\x00-\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
let fingerprint=2166136261;for(let i=0;i<input.length;i++)fingerprint=Math.imul(fingerprint^input.charCodeAt(i),16777619)>>>0;
const dict=new Map();for(let i=0;i<256;i++)dict.set(String.fromCharCode(i),i);let next=256,w='',codes=[];
for(const c of input){const wc=w+c;if(dict.has(wc))w=wc;else{codes.push(dict.get(w));if(next>=65535)throw Error('Dictionary too large');dict.set(wc,next++);w=c;}}if(w)codes.push(dict.get(w));
const bytes=new Uint8Array(codes.length*2);for(let i=0;i<codes.length;i++){bytes[i*2]=codes[i]&255;bytes[i*2+1]=codes[i]>>>8;}const encoded=figma.base64Encode(bytes);

const index=0,size=14000;
return {capturedAt:new Date().toISOString(),encoding:'lzw-u16le-base64',fingerprint:fingerprint.toString(16).padStart(8,'0'),inputLength:input.length,encodedLength:encoded.length,index,chunkSize:size,chunkCount:Math.ceil(encoded.length/size),nodeCount:rows.length,pngCount:rows.filter(r=>r[2]==='RECTANGLE'&&/^assets\/.+\.png$/.test(r[3])).length,data:encoded.slice(index*size,(index+1)*size)};
