const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadGame}=require('./game-harness.cjs');
const root=path.join(__dirname,'..');
const plain=v=>JSON.parse(JSON.stringify(v));
function game(){const h=loadGame({__pictures:true,__scenes:true,__randomSeed:123});h.window.Path2D=class{rect(){}};for(const f of ['level-scenes-data.js','level-scenes.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),h.window);h.game.resetRogueRun('WIDE FIGMA',{classId:'bulwark'});return h;}
test('all four approved Figma rows compile exactly into the installed native sources',async()=>{
 const {loadWideCaptures,compileWideLevel}=await import('../scripts/current-wide-levels.mjs');const h=game();
 for(const c of loadWideCaptures()){const bytes=fs.readFileSync(path.join(root,c.art.path)),compiled=compileWideLevel(c,bytes);assert.deepEqual(plain(h.window.MaxLevelData.gardens[c.stage]),plain(compiled.data.gardens[c.stage]));assert.deepEqual(plain(h.window.MaxLevelScenesData.rows.find(r=>r.stage===c.stage)),plain(compiled.scenes.rows[0]));const bad=structuredClone(c);bad.nodes[0].x+=.5;assert.throws(()=>compileWideLevel(bad,bytes),/Non-native/);}
});
test('wide levels register all drawn collision surfaces and keep native export paths distinct',()=>{
 const h=game(),g=h.game,rows={1:'1228:29201',2:'1228:30814',4:'1228:32376',6:'1228:33596'};
 for(const [stage,id]of Object.entries(rows)){g.rogueRun.world=Number(stage);g.activeStageLayout=null;const L=g.stageLayout(),v=h.window.MaxLevelScenes.forLayout(L,g.surfaceY),a=h.window.MaxLevelScenes.inspect(L,g.surfaceY);assert.equal(v.row.rowId,id);assert.deepEqual([v.bounds.w,v.bounds.h],[3555,400]);assert.deepEqual(plain(a.mismatches),[]);assert.ok(a.registeredPlatforms>140);assert.ok(L.ladders.every(q=>q.art===true));assert.ok(L.spots.start.length===1);}
});
test('a new run starts on the actual first Figma ledge, not below its painted floor',()=>{
 for(const classId of ['mech','runner','bulwark','herbalist','polge']){const h=game(),g=h.game;g.resetRogueRun('WIDE START',{classId});const start=g.stageLayout().spots.start[0];assert.equal(g.P.x,start.x);assert.equal(g.P.y,start.y);assert.equal(g.P.platform,start.platformId);assert.equal(g.P.grounded,true);assert.equal(g.cairnRootedGround(g.P),true);}
});
