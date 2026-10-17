'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { loadGame } = require('./game-harness.cjs');
const { sourceBinding } = require('../docs/design/master-levels/art/source-binding.cjs');
const root = path.resolve(__dirname, '..');
const classes = ['mech', 'runner', 'bulwark', 'herbalist', 'polge', 'sligo'];
const branches = [[258,222,44],[306,204,36],[346,186,42],[392,168,38],[432,150,44],[473,132,32]];
const roots = [[310,340,50],[278,322,58]];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
function fresh(classId = 'bulwark', seed = 1) {
  const h = loadGame({ __pictures: true, __randomSeed: 123 }), g = h.game;
  g.resetRogueRun('Connected Hollow Tree traversal', { classId });
  g.rogueRun.seed = seed; g.activeStageLayout = null; g.initRunStage();
  assert.equal(g.rogueRun.perks.stride, 0); assert.equal(g.rogueRun.perks.spring, 0);
  assert.equal(g.rogueRun.traits.feathers, 0);
  return { ...h, L: g.stageLayout(), inputs: [] };
}
function native(h, x, y, w, solid = false) {
  const p = h.L.platforms.find(p => p.x === h.L.origin + x - 320 && p.y === h.L.authoredSoilY + y - 280 && p.w === w && !!p.solid === solid);
  assert.ok(p, `registered native footing ${x},${y},${w}`);
  return p;
}
function supported(h, p, label) {
  const g = h.game;
  // The authored lower floor and terrain-void resolver have the same top. The
  // engine keeps platform=null on that equality, so independently require the
  // exact real solid support AND the matching authored floor resolver there.
  const actual = h.window.MaxStageLayout.at(h.L,g.P.x,g.P.y,1e-7);
  const resolvedFloor = p.solid && p.h===20 && g.P.platform==null && actual?.id===p.id && h.window.MaxLevels.floorAt(h.L,g.P.x,g.P.y,g.surfaceY)===p.y;
  assert.ok(g.P.grounded && (g.P.platform === p.id || resolvedFloor), `${label}: actual landing on ${p.id}, not merely grounded (${JSON.stringify({x:g.P.x,y:g.P.y,platform:g.P.platform,st:g.P.st})})`);
  assert.equal(g.P.y, p.y);
  assert.ok(h.window.MaxStageLayout.support(h.L, p.id, g.P.x));
  assert.equal(g.P.wet, false, label + ': dry');
  assert.equal(g.rogueRun.world, 1, label + ': exploration never advances the stage');
}
function start(h, p, x) {
  Object.assign(h.game.P, { x: x ?? p.x + p.w / 2, y: p.y, vx: 0, vy: 0, grounded: true, platform: p.id, coyote: .1, airJumpUsed: false, wet: false, st: 'free', ladderId: null, held: false });
  h.game.clearRunInput(); h.game.climb = null;
  supported(h, p, 'initial real departure');
}
function axis(h, direction) {
  if (direction > 0) { h.key('keyup','ArrowLeft'); h.key('keydown','ArrowRight'); }
  else if (direction < 0) { h.key('keyup','ArrowRight'); h.key('keydown','ArrowLeft'); }
  else { h.key('keyup','ArrowRight'); h.key('keyup','ArrowLeft'); }
}
function tick(h, hz, direction) {
  const g = h.game, before = { x:g.P.x, y:g.P.y };
  axis(h, direction); h.advance(1000 / hz); g.updatePlayer(1 / hz, g.readInput());
  assert.ok(Math.abs(g.P.x-before.x) < 3.5, 'actual walking input cannot relocate the actor');
  h.inputs.push({ axis: direction, up: g.heldUp, x:g.P.x, y:g.P.y, platform:g.P.platform, grounded:g.P.grounded });
}
function stop(h, hz) {
  h.key('keyup','ArrowUp'); axis(h, 0);
  for (let i=0; i<4; i++) tick(h,hz,0);
}
function walk(h, hz, x, support, label) {
  const tolerance = 1.6;
  for (let i=0; i<hz*8 && Math.abs(x-h.game.P.x)>tolerance; i++) {
    tick(h,hz,Math.sign(x-h.game.P.x)); supported(h,support,label);
  }
  assert.ok(Math.abs(x-h.game.P.x)<=tolerance, label + ': reached departure by walking');
  stop(h,hz); supported(h,support,label + ' stopped');
}
function jump(h, hz, from, target, label) {
  supported(h,from,label + ' departure');
  const contained = from.solid && target.x>=from.x && target.x+target.w<=from.x+from.w;
  const direction = Math.sign(target.x+target.w/2-(contained?h.game.P.x:from.x+from.w/2)) || 1;
  const launchX = contained ? Math.max(target.x+12,Math.min(target.x+target.w-12,h.game.P.x)) : direction>0 ? from.x+from.w-7 : from.x+7;
  walk(h,hz,launchX,from,label + ' approach');
  const landingX = direction>0 ? Math.max(target.x+12,Math.min(target.x+target.w-12,launchX+18)) : Math.min(target.x+target.w-12,Math.max(target.x+12,launchX-18));
  axis(h,direction); h.key('keydown','ArrowUp');
  let airborne = false;
  for (let i=0;i<hz*1.5;i++) {
    if(i/hz>=.17)h.key('keyup','ArrowUp');
    tick(h,hz,Math.abs(landingX-h.game.P.x)>1.3?Math.sign(landingX-h.game.P.x):0);
    airborne ||= !h.game.P.grounded;
    assert.notEqual(h.game.P.st,'ladder',label + ': jumping route does not silently use a ladder');
    if(airborne&&h.game.P.grounded) { supported(h,target,label); stop(h,hz); supported(h,target,label+' settled'); return; }
  }
  assert.fail(label + ': no real landing within the bounded ordinary jump');
}
function descend(h,hz,from,target,label) {
  supported(h,from,label+' departure'); h.key('keyup','ArrowUp');
  const direction = Math.sign(target.x+target.w/2-from.x-from.w/2) || -1;
  const destination = direction<0 ? Math.max(target.x+6,Math.min(from.x-8,target.x+target.w-8)) : Math.min(target.x+target.w-6,Math.max(from.x+from.w+8,target.x+8));
  let airborne=false;
  for(let i=0;i<hz*8;i++) {
    tick(h,hz,Math.abs(destination-h.game.P.x)>1.3?Math.sign(destination-h.game.P.x):0);
    airborne ||= !h.game.P.grounded;
    if(airborne&&h.game.P.grounded) { supported(h,target,label); stop(h,hz); supported(h,target,label+' settled'); return; }
  }
  assert.fail(label+': no connected walk-off landing');
}

test('actual MASTER branch geometry and native visual rims share exact source registration',()=>{
  const h=fresh(),g=h.game;
  for(const file of ['level-scenes-data.js','level-scenes.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),h.window);
  const data=h.window.MaxLevelData,scene=h.window.MaxLevelScenes.forLayout(h.L,g.surfaceY);
  assert.ok(scene,'normal Play selects actual source-bound scenery');
  assert.equal(scene.row.rowId,'941:2784');
  assert.equal(scene.row.editorId,'941:450');
  assert.equal(scene.row.registration.originX,320); assert.equal(scene.row.registration.soilY,280);
  assert.deepEqual(plain(sourceBinding(scene.row,data.gardens[1][0])),plain(scene.row.binding));
  assert.equal(h.window.MaxLevelScenes.inspect(h.L).mismatches.length,0);
  assert.equal(scene.row.ops.length,7077);
  // The editor's existing copy has different node IDs. Normalize only those
  // IDs: every original primitive's order, geometry, paint and crop is pinned.
  const originalPixels=scene.row.ops.slice(0,6965).map(op=>[op[0],op[1],...op.slice(3)]);
  assert.equal(sha(JSON.stringify(originalPixels)),'1e4c0af26fe5b94dd5aedac55cd8b5e0c9d38c56ff3101dcf1f231c437313fe3');
  assert.deepEqual(plain(scene.row.sourceImages),[{path:'assets/tiles-v1/sanctuary.png',imageHash:'8b0552caf2119b1ce407f92d45fc0c09128fccbf',width:128,height:75,sha256:'2dab27519a47db0d037ea89aa3a7b0aca12a96df2a4971b042e0708ebc6c21ef'}]);
  assert.equal(sha(fs.readFileSync(path.join(root,'assets/tiles-v1/sanctuary.png'))),scene.row.sourceImages[0].sha256);
  for(const [x,y,w] of branches.concat(roots)) {
    const p=native(h,x,y,w),entry=scene.row.ledger.find(q=>q.platformId===p.id);
    assert.deepEqual(plain(entry.nativeRect),{x,y,w,h:6});
    assert.ok(scene.row.ops.some(op=>op[3]===x&&op[4]===y&&op[5]===w&&op[6]===1&&op[7]==='#656850'),'native visible rim coincides with actual landing top');
  }
  const cache=h.L.spots.secret[0],rootStep=native(h,...roots[1]);
  assert.equal(cache.x,h.L.origin-14); assert.equal(cache.y,rootStep.y); assert.equal(cache.platformId,rootStep.id);
  assert.equal(g.waterAt(cache.x),null,'root cache has no water hazard');
  assert.equal(h.L.ladders.length,8,'all pre-existing authored ladders remain');
  const unchangedMarkers={reward:[{x:-170,rise:200}],seed:[{x:125,rise:200}],bonus:[{x:-205,rise:120}],trial:[{x:-165,rise:80},{x:215,rise:160}],puzzle:[{x:-95,rise:40}],door:[{x:150,rise:200}],dig:[{x:-20,rise:0}],start:[{x:0,rise:0}]};
  for(const [key,expected]of Object.entries(unchangedMarkers))assert.deepEqual(plain(data.gardens[1][0][key]),expected,key+' retains its original native source coordinates');
  for(const rect of [[90,160,95],[100,80,100],[105,200,110],[185,240,70],[420,80,100],[445,200,105],[490,120,100]])native(h,...rect);
  native(h,155,280,395,true); native(h,175,358,395,true);
});

test('canopy furnishing rejects an unreviewed source key or a mismatched native chamber',()=>{
  const h=fresh();
  function unfurnished(){const L=plain(h.L);delete L.hollowCanopy;L.platforms=L.platforms.filter(p=>!p.canopy);L.spots.secret=L.spots.secret.slice(0,1);return L;}
  for(const difference of [L=>{L.masterSceneSourceKey='a'.repeat(64);},L=>{L.designed=false;},L=>{L.replacePicture=false;},L=>{L.platforms.find(p=>p.x===L.origin+100&&p.y===L.authoredSoilY-200).x++;}]) {
    const L=unfurnished(),before=L.platforms.length;difference(L);h.window.MaxExpeditions.furnish(L,h.game.surfaceY,h.game.waterAt);
    assert.equal(L.hollowCanopy,undefined);assert.equal(L.platforms.length,before);
  }
});

for(const classId of classes)for(const hz of [30,60,120])test(`${classId} continuously climbs and returns along all six authored branches at ${hz} Hz`,()=>{
  const h=fresh(classId),path=[native(h,185,240,70),...branches.map(r=>native(h,...r)),native(h,490,120,100)];
  start(h,path[0]);
  for(let i=1;i<path.length;i++)jump(h,hz,path[i-1],path[i],`${classId} ${hz}Hz outward ${i}`);
  for(let i=path.length-1;i>0;i--)descend(h,hz,path[i],path[i-1],`${classId} ${hz}Hz return ${i}`);
  assert.ok(h.inputs.length>hz*5,'complete traversal is real input time, without between-hop resets');
});

for(const classId of classes)for(const hz of [30,60,120])test(`${classId} reaches the dry root cache and physically escapes at ${hz} Hz`,()=>{
  const h=fresh(classId),g=h.game,floor=native(h,175,358,395,true),low=native(h,...roots[0]),high=native(h,...roots[1]);
  start(h,floor,low.x+12);
  // The first step is directly over the broad real floor; no long launch run is needed.
  jump(h,hz,floor,low,`${classId} ${hz}Hz first root`);
  jump(h,hz,low,high,`${classId} ${hz}Hz upper root`);
  const cache=g.seedPickups.find(q=>q.id==='secret:1:0'); assert.ok(cache&&cache.hidden);
  const before=g.gardenSeeds;walk(h,hz,h.L.spots.secret[0].x,high,'real cache approach');
  g.updateSeedPickups(1/hz);assert.equal(g.seedCollected['secret:1:0'],1);assert.equal(g.gardenSeeds,before+cache.amount);
  descend(h,hz,high,low,`${classId} ${hz}Hz lower root return`);
  descend(h,hz,low,floor,`${classId} ${hz}Hz floor return`);
  const ladder=h.L.ladders.find(q=>q.x===h.L.origin+239),court=native(h,550,280,18);
  walk(h,hz,ladder.x,floor,'floor escape approach'); h.key('keydown','ArrowUp');
  let ladderFrames=0;
  for(let i=0;i<hz*4;i++) {tick(h,hz,0);if(g.P.st==='ladder')ladderFrames++;if(g.P.grounded&&g.P.platform===court.id)break;}
  h.key('keyup','ArrowUp');assert.ok(ladderFrames>0,'escape uses the actual authored ladder');supported(h,court,'returned to real dry court entrance');
  g.initRunStage();assert.equal(g.seedPickups.some(q=>q.id==='secret:1:0'),false,'cache stays collected through stage reinitialization');
});

test('Hollow Tree authoring leaves the complete other nineteen layouts unchanged',()=>{
  const snapshots=[];
  for(const seed of [1,2026,0xffffffff]) {
    const h=fresh('bulwark',seed),g=h.game;
    for(let stage=2;stage<=20;stage++){g.enterLevel(stage);const L=g.stageLayout();assert.equal(L.hollowCanopy,undefined);snapshots.push(plain(L));}
  }
  // Taken from authoritative main before this Garden-1-only Figma source edit.
  assert.equal(sha(JSON.stringify(snapshots)),'2b0a8cb4b9204cd21461f0a86e45ea463868d81decec75ffac3a725f2e940d84');
});
