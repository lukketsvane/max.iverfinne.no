const {test}=require('node:test');
const assert=require('node:assert/strict');
const expeditions=require('../stage-expeditions.js');
const {launch}=require('./platform-sweep.cjs');

test('district pacing preserves guardian shelves and authors distinct broad destinations without extra detour ledges',()=>{
  const patterns={switch:[0,1],spine:[0,1,2,3,2,1],arch:[0,1,2,1],braid:[0,1,0,1,2,3,2,1]};
  const lengths=new Map();
  for(let seed=1;seed<=24;seed++)for(let stage=1;stage<=20;stage++){
    const make=()=>expeditions.furnish({stage,seed,origin:0,platforms:[],routes:[]},()=>0);
    const L=make(),E=L.expedition,by=new Map(L.platforms.map(p=>[p.id,p]));
    assert.deepEqual(L,make(),`garden ${stage}, seed ${seed}: deterministic composition`);
    assert.equal(E.nodes.length,3);assert.equal(E.sections.length,2);assert.notEqual(E.sections[0].id,E.sections[1].id);
    assert.deepEqual(E.path.slice(0,7).map(id=>{const p=by.get(id);return [p.lane,p.y,p.w,p.section];}),
      Array.from({length:7},(_,i)=>[patterns[E.shape][i%patterns[E.shape].length],-(i+1)*16,36,'approach']));
    for(const section of E.sections){
      assert.ok(by.get(section.to).w>=64);assert.equal(section.landing.platformId,section.to);
      assert.equal(section.beats.at(-1).kind,'rest');assert.equal(section.beats.length,section.platformIds.length);
    }
    assert.deepEqual(E.rooms.map(r=>r.kind).sort(),['gallery','needle','shelter']);
    for(const room of E.rooms){
      assert.deepEqual(room.outbound,[room.from,room.platformId,room.secret.platformId]);
      assert.deepEqual(room.return,room.outbound.slice().reverse());assert.equal(room.returnAnchor.platformId,room.from);
      assert.ok(room.outbound.every(id=>by.has(id)));assert.ok(room.bounds.w>80);assert.ok(room.name);
    }
    assert.equal(L.platforms.filter(p=>/^exp:\d+:(room|nook)/.test(p.id)).length,6);
    if(E.circuit){
      assert.equal(new Set(E.circuit.choices.map(q=>q.item)).size,2);
      assert.ok(E.circuit.choices.every(q=>q.item!==E.item));
      assert.ok(E.circuit.outbound.concat(E.circuit.return).every(id=>by.has(id)));
    }
    if(!lengths.has(stage))lengths.set(stage,[]);lengths.get(stage).push(E.path.length);
  }
  const average=stages=>stages.flatMap(stage=>lengths.get(stage)).reduce((sum,n,_,all)=>sum+n/all.length,0);
  assert.ok(average([1,2,3,4,5])+3<average([11,12,13,14,15]),'early optional climbs have fewer repeated transit hops');
});

function cross(g,a,b,hz){
  const direction=Math.sign(b.x+b.w/2-a.x-a.w/2),start={x:a.w?(direction>0?a.x+a.w-3:a.x+3):a.x,
    y:a.y,grounded:true,platform:a.id||null,vx:0,vy:0,coyote:.1,airJumpUsed:false,wet:false,st:'free',dodgeT:0,pounce:0,held:false,brace:0};
  const reset=()=>{Object.assign(g.P,start);g.jumpBuf=0;g.climb=null;g.heldUp=false;};
  // A broad upper terrace can be walked off onto an overlapping lower ledge.
  // Exercise the real descent instead of requiring a jump straight back onto itself.
  if(b.y>=a.y){
    reset();
    for(let tick=0;tick<hz*2;tick++){
      const distance=b.x+b.w/2-g.P.x;
      g.updatePlayer(1/hz,{axis:Math.abs(distance)>1?Math.sign(distance):0,top:48});
      if(g.P.grounded&&g.P.platform===b.id)return true;
    }
  }
  for(const target of [b,{...b,x:b.x+b.w/2-3,w:6}]){reset();if(launch(g,target,hz))return true;}
  return false;
}

for(const [seed,hz]of [[1,30],[260926,60],[2654435761,120]])test(`walking Cairn reaches and returns from every district cache, terrace and circuit at ${hz} Hz, seed ${seed}`,()=>{
  const g=require('./game-harness.cjs').loadGame({__pictures:true}).game;
  for(let stage=1;stage<=20;stage++){
    g.resetRogueRun('QA',{classId:'bulwark'});g.rogueRun.seed=seed;g.activeStageLayout=null;
    if(stage>1)g.enterLevel(stage);else g.initRunStage();
    g.rogueRun.traits={feathers:0,dew:0,embers:0};g.rogueRun.perks.spring=g.rogueRun.perks.stride=0;
    const L=g.stageLayout(),E=L.expedition,by=new Map(L.platforms.map(p=>[p.id,p]));
    assert.ok(cross(g,{...E.start,w:0},by.get(E.path[0]),hz),`garden ${stage}: soil to approach`);
    const paths=[['ascent',E.path],...E.rooms.map((room,i)=>['cache '+i,room.outbound])];
    if(E.circuit){
      paths.push(['circuit outward',E.circuit.outbound],['circuit return',E.circuit.return]);
      paths.push(['circuit flank',[E.circuit.arena.floorId,...E.circuit.arena.perchIds]]);
    }
    for(const [name,ids]of paths)for(const sequence of [ids,ids.slice().reverse()])for(let i=1;i<sequence.length;i++){
      const a=by.get(sequence[i-1]),b=by.get(sequence[i]);
      assert.ok(cross(g,a,b,hz),`garden ${stage}, ${name}: ${a.id} → ${b.id}`);
    }
  }
});

test('the garden 8 review circuit still fits broad district terraces and remains reversible',()=>{
  const g=require('./game-harness.cjs').loadGame({__pictures:true}).game;
  g.resetRogueRun('QA',{classId:'bulwark'});g.rogueRun.seed=73;g.activeStageLayout=null;g.enterLevel(8);
  const L=g.stageLayout(),C=L.expedition.circuit,by=new Map(L.platforms.map(p=>[p.id,p]));
  assert.ok(C,'the canonical circuit review scene contains its challenge');
  assert.equal(C.family,'bell');assert.equal(C.fork,'exp:8:12');assert.equal(C.rejoin,'exp:8:18');
  assert.ok(by.get(C.fork).w>=64);assert.ok(by.get(C.rejoin).w>=64);
  for(const path of [C.outbound,C.return,[C.arena.floorId,...C.arena.perchIds]])for(const ids of [path,path.slice().reverse()]){
    for(let i=1;i<ids.length;i++)assert.ok(cross(g,by.get(ids[i-1]),by.get(ids[i]),60),`${ids[i-1]} → ${ids[i]}`);
  }
});
