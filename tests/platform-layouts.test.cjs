const {test}=require('node:test');
const assert=require('node:assert/strict');
const layouts=require('../stage-layout.js');
const {loadGame}=require('./game-harness.cjs');

const terrains=[
  ()=>0,
  x=>Math.sin(x/55)*18+Math.cos(x/22)*6,
  x=>26*Math.exp(-(((x-110)/42)**2))-29*Math.exp(-(((x+140)/38)**2)),
];
function path(layout,route){return route.platformIds.map(id=>layout.platforms.find(p=>p.id===id));}
function gap(a,b){return Math.max(b.x-a.x-a.w,a.x-b.x-b.w);}

test('layout generation never consumes random state across varied terrain and origins',()=>{
  const random=Math.random;
  Math.random=()=>{throw Error('Shared collision geometry must not consume random state');};
  try{
    for(const ground of terrains)for(const origin of [0,-1300,2120])for(let stage=1;stage<=20;stage++){
      assert.deepEqual(layouts.create(stage,origin,ground,()=>false),layouts.create(stage,origin,ground,()=>false));
    }
  }finally{Math.random=random;}
});

test('every core ledge clears the complete terrain footprint and keeps real gaps on synthetic and actual gardens',()=>{
  function check(layout,ground){
    for(const route of layout.routes){
      const platforms=path(layout,route);let jumps=0;
      for(let i=0;i<platforms.length;i++){
        const p=platforms[i];
        for(let x=p.x;x<=p.x+p.w;x++)assert.ok(ground(x)-p.y>=6,layout.id+' '+p.id+' cannot intersect soil between sampled endpoints');
        if(i){
          assert.ok(platforms[i-1].y-p.y<=19,'terrain avoidance never creates a taller required jump');
          if(gap(platforms[i-1],p)>layouts.foot*2)jumps++;
        }
      }
      assert.ok(jumps>=3,layout.id+' requires several jumps across unsupported gaps on each route');
    }
  }
  for(const ground of terrains)for(const origin of [0,-1300,2120])for(let stage=1;stage<=20;stage++)check(layouts.create(stage,origin,ground,()=>false),ground);
  const {game:g}=loadGame();g.resetRogueRun();
  for(let stage=1;stage<=20;stage++){if(stage>1)g.enterLevel(stage);check(g.stageLayout(),g.surfaceY);}
});

test('later versions preserve each route family while narrowing shelves and increasing selected gaps',()=>{
  for(let stage=1;stage<=5;stage++){
    const early=layouts.create(stage,0,terrains[0],()=>false),late=layouts.create(stage+10,0,terrains[0],()=>false);
    assert.equal(early.theme,late.theme);
    for(let side=0;side<2;side++){
      const before=path(early,early.routes[side]),after=path(late,late.routes[side]);
      const average=arr=>arr.reduce((total,p)=>total+p.w,0)/arr.length;
      assert.ok(average(after)<average(before),'later shelves require more precise landing');
      assert.ok(after.length>=before.length,'narrowing does not shorten exploration');
      assert.ok(gap(after[0],after[1])>gap(before[0],before[1]));
      assert.ok(gap(before[0],before[1])>layouts.foot*2,'even the first garden has an actual air gap');
    }
  }
});
