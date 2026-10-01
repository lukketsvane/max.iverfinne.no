const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const sites=require('../guardian-sites.js');

const seedCount=Math.max(1,Number(process.env.MAX_GUARDIAN_SITE_SEEDS)||6);
const fixedSeeds=[260926,1,333496470,952940765,24,1143566682];
const seedAt=i=>fixedSeeds[i]??Math.imul(i+1,2654435761)>>>0;

function inspect(g,L,label,stats){
  const picks=L.guardianSites;
  assert.equal(picks.length,3,label);assert.equal(new Set(picks.map(s=>s.id)).size,3,label);
  for(const s of picks){
    assert.ok(!s.unverified,`${label} ${s.id}: every production site is verified`);
    assert.ok(s.name&&Number.isFinite(s.x)&&Number.isFinite(s.y),label);
    assert.ok(Math.abs(s.x-L.origin)+Math.abs(s.y-g.surfaceY(L.origin))>=160,`${label} ${s.id}: explore away from entrance`);
    assert.ok(s.courtRight-s.courtLeft>=100,`${label} ${s.id}: room to fight`);
    assert.ok(Math.abs(s.courtX-s.x)<=60,`${label} ${s.id}: court belongs to its shrine`);
    assert.equal(s.courtY,g.surfaceY(s.courtX),`${label} ${s.id}: court is plantable soil`);
    assert.ok(!g.waterAt(s.courtX),`${label} ${s.id}: plant on dry soil`);
    for(let x=s.courtX-50;x<=s.courtX+50;x+=4){
      assert.ok(!g.waterAt(x),`${label} ${s.id}: dry combat width`);
      const y=g.surfaceY(x);
      assert.ok(!L.platforms.some(p=>p.solid&&x+5>p.x&&x-5<p.x+p.w&&p.y<y-5&&p.y+p.h>y-32),`${label} ${s.id}: 32px of clear soil headroom`);
    }
    if(s.platformId){
      const p=L.platforms.find(p=>p.id===s.platformId);assert.ok(p,`${label} support exists`);
      assert.equal(s.y,p.y,`${label} altar rests on actual support`);
      assert.ok(p.w>=32&&s.x>=p.x+12&&s.x<=p.x+p.w-12,`${label} raised shrine fits its rest ledge`);
      stats.raised++;if(p.expedition)stats.earlyExpedition++;
    }else assert.equal(s.y,g.surfaceY(s.x),`${label} soil shrine rests on actual soil`);
    if(s.landmark==='Outer district court')stats.districtFallback++;
    stats.maxDistance=Math.max(stats.maxDistance,Math.abs(s.x-L.origin));
    stats.courts++;
  }
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok(Math.abs(picks[i].x-picks[j].x)+Math.abs(picks[i].y-picks[j].y)>=100,`${label}: genuinely separate destinations`);
  for(const s of picks)assert.ok(!L.trials.some(t=>Math.abs(s.x-t.x)<16&&Math.abs(s.y-t.y)<6),`${label}: mandatory and optional shrines do not overlap`);
}

test('every map has three distinct authored shrine destinations with a nearby dry court',()=>{
  const g=loadGame({__pictures:true}).game;g.resetRogueRun('site geometry',{classId:'bulwark'});
  const stats={courts:0,raised:0,earlyExpedition:0,districtFallback:0,maxDistance:0};
  for(let stage=1;stage<=20;stage++){
    const raisedBefore=stats.raised;
    for(let i=0;i<seedCount;i++){
      g.rogueRun.seed=seedAt(i);g.rogueRun.world=stage;g.activeStageLayout=null;
      const L=g.stageLayout(),label=`garden ${stage}, seed ${seedAt(i)}`;
      inspect(g,L,label,stats);
      const before=JSON.stringify(L.guardianSites);sites.furnish(L,g.surfaceY,g.waterAt);
      assert.equal(JSON.stringify(L.guardianSites),before,`${label}: repeated furnishing is stable`);
    }
    assert.ok(stats.raised>raisedBefore,`garden ${stage} offers elevated approaches across its seeds`);
  }
  console.log('Guardian site geometry',JSON.stringify({seedsPerStage:seedCount,...stats}));
});

test('legacy generated opening maps also receive three safe destinations without an entry failure',()=>{
  const g=loadGame({__pictures:false}).game;g.resetRogueRun('generated sites',{classId:'bulwark'});
  const stats={courts:0,raised:0,earlyExpedition:0,districtFallback:0,maxDistance:0};
  for(const seed of [2674373398,1781785167,3841847615,892039897,4215416948,1143566682])for(const stage of [1,2]){
    g.rogueRun.seed=seed;g.rogueRun.world=stage;g.activeStageLayout=null;
    inspect(g,g.stageLayout(),`generated ${stage}, seed ${seed}`,stats);
  }
});

test('recorded designed gardens keep their authored trials while gaining distinct guardian sites',async()=>{
  const {gardenOf}=await import('../scripts/figma-levels.mjs');
  const {tree}=await import('../scripts/figma-mcp.mjs');
  const frames=tree(require('./fixtures/figma-levels.json').metadata).children;
  const stats={courts:0,raised:0,earlyExpedition:0,districtFallback:0,maxDistance:0};
  for(const stage of [1,5]){
    const frame=frames.find(f=>f.name===`garden-${String(stage).padStart(2,'0')}`);
    const data={gardens:{[stage]:[gardenOf(frame).garden]}};
    for(const seed of [1,24,260926,333496470]){
      const h=loadGame(),g=h.game;h.window.MaxLevelData=data;
      g.resetRogueRun('designed sites',{classId:'bulwark'});g.rogueRun.seed=seed;g.rogueRun.world=stage;g.activeStageLayout=null;
      const L=g.stageLayout(),authored=require('../levels.js').build(data.gardens[stage][0],stage,g.levelOriginX(stage),g.surfaceY,g.waterAt,seed);
      assert.equal(L.designed,true);assert.deepEqual(Array.from(L.trials,t=>[t.x,t.y]),authored.trials.map(t=>[t.x,t.y]));
      inspect(g,L,`designed ${stage}, seed ${seed}`,stats);
    }
  }
});
