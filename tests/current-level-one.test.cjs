const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {loadGame}=require('./game-harness.cjs'),root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p))),capture=read('docs/design/level-one-current/figma-capture.json');
function current(classId='bulwark'){
 const h=loadGame({__pictures:true,__scenes:true}),g=h.game;h.window.Path2D=class{rect(){}};
 for(const file of ['level-scenes-data.js','level-scenes.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),h.window);
 g.resetRogueRun('Current Figma level 1',{classId});return {...h,L:g.stageLayout()};
}
test('current Figma level_01 compiles only into stage one with exact registered graphics and colliders',async()=>{
 const {compileLevelOne}=await import('../scripts/current-level-one.mjs'),bytes=fs.readFileSync(path.join(root,capture.art.path)),result=compileLevelOne(capture,bytes),h=current(),g=h.game,view=h.window.MaxLevelScenes.forLayout(h.L,g.surfaceY);
 assert.equal(g.rogueRun.world,1);assert.equal(view.row.rowId,'1228:29201');assert.equal(view.row.masterId,'1228:21976');assert.deepEqual([view.bounds.w,view.bounds.h],[3555,400]);
 assert.equal(result.scenes.rows[0].binding.sourceDigest,view.row.binding.sourceDigest);assert.equal(result.data.gardens[1][0].seed.length,3);assert.equal(h.L.ladders.length,13);assert.ok(h.L.ladders.every(l=>l.art===true),'existing ladder artwork is not drawn a second time');
 const check=h.window.MaxLevelScenes.inspect(h.L,g.surfaceY);assert.equal(check.registeredPlatforms,185);assert.equal(check.mismatches.length,0);
 const alternate=structuredClone(capture);alternate.row.name='level_02 / Hollow Tree / 5 screens';assert.throws(()=>compileLevelOne(alternate,bytes),/level_01/);
 const changed=Buffer.from(bytes);changed[changed.length-1]^=1;assert.throws(()=>compileLevelOne(capture,changed),/authenticated native export/);
});
test('all six characters start at the actual level-one START marker on its registered landing',()=>{
 for(const classId of ['mech','runner','bulwark','herbalist','sligo','polge']){
  const h=current(classId),g=h.game,start=h.L.spots.start[0];assert.equal(g.rogueRun.world,1);assert.equal(g.rogueRun.classId,classId);
  assert.equal(g.P.x,start.x);assert.equal(g.P.y,start.y);assert.equal(g.P.platform,start.platformId);assert.ok(g.P.grounded);assert.equal(g.P.y,h.L.authoredSoilY-36);
 }
});
test('normal movement can descend to the floor and climb the first actual visible ladder back to the opening landing',()=>{
 const h=current(),g=h.game,startY=g.P.y;
 for(let n=0;n<145;n++)g.updatePlayer(1/60,{axis:-1,top:48});
 for(let n=0;n<45;n++)g.updatePlayer(1/60,{axis:0,top:48});
 assert.ok(g.P.y>startY+30,'ordinary movement reaches the lower floor');
 const ladder=h.L.ladders[0];let climbing=false;g.heldUp=true;
 for(let n=0;n<400;n++){g.updatePlayer(1/60,{axis:Math.abs(g.P.x-ladder.x)<1.5?0:Math.sign(ladder.x-g.P.x),top:48});climbing ||=g.P.st==='ladder';if(climbing&&g.P.grounded)break;}
 g.heldUp=false;assert.ok(climbing,'actual up input acquires the visible ladder');assert.ok(g.P.grounded);assert.equal(g.P.y,startY);assert.equal(g.rogueRun.world,1);
});
test('the current level-one production PNG is the exact Figma image at native dimensions',()=>{
 const b=fs.readFileSync(path.join(root,capture.art.path)),manifest=read('assets/figma-manifest.json'),entry=manifest.production.find(a=>a.path===capture.art.path);
 assert.ok(entry);assert.equal(entry.nodeId,'1412:21977');assert.equal(entry.sha1,capture.art.sha1);assert.equal(crypto.createHash('sha1').update(b).digest('hex'),capture.art.sha1);assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],[3555,400]);
});
