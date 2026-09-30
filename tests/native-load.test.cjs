const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

test('a mobile decode rejection waits for actual pixels, and a missing image still rejects',async()=>{
 const {loadAtlas}=await import(pathToFileURL(path.join(__dirname,'../assets/native-atlas.mjs')));
 const original={Image:global.Image,document:global.document,fetch:global.fetch};
 try{
  global.document={baseURI:'https://game.example/'};
  global.fetch=async()=>({ok:true,json:async()=>({sheets:{main:{image:'sprites.png'}}})});
  global.Image=class {
   constructor(){this.complete=false;this.naturalWidth=0;}
   set src(value){this.url=value;queueMicrotask(()=>{this.complete=true;this.naturalWidth=32;this.onload?.();});}
   async decode(){throw Error('Mobile decoder rejected');}
  };
  const atlas=await loadAtlas('atlas.json');assert.equal(atlas.images.main.naturalWidth,32);
  global.Image=class {
   constructor(){this.complete=true;this.naturalWidth=0;}
   set src(value){queueMicrotask(()=>this.onerror?.());}
   async decode(){throw Error('Missing PNG');}
  };
  await assert.rejects(loadAtlas('missing.json'),/Missing PNG/);
 }finally{Object.assign(global,original);}
});
