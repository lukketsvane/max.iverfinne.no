const {test}=require('node:test');
const assert=require('node:assert/strict');
const districts=require('../stage-expeditions.js');
const movement=require('../stage-layout.js');
const seedAt=i=>Math.imul(i+1,2654435761)>>>0;
function make(stage,seed){return districts.furnish({stage,seed,origin:0,platforms:[]},()=>0,()=>false);}
function gap(a,b){return Math.max(0,b.x-a.x-a.w,a.x-b.x-b.w);}
function reachable(a,b,label){
  const rise=a.y-b.y;
  assert.ok(rise<=19&&gap(a,b)<=movement.reach(0,rise)-movement.move.margin,label);
}

test('500 seeds compose authored district phrases with reachable main and reversible cache routes',()=>{
  const pairs=new Set(),rewards=new Set(),roomKinds=new Set();
  for(let i=0;i<500;i++)for(let stage=1;stage<=20;stage++){
    const L=make(stage,seedAt(i)),E=L.expedition,byId=new Map(L.platforms.map(p=>[p.id,p]));
    const label=`garden ${stage} seed ${seedAt(i)}`;
    assert.equal(E.sections.length,2,label);
    assert.notEqual(E.sections[0].id,E.sections[1].id,label+' has distinct phrases');
    pairs.add(E.sections.map(s=>s.id).join('/'));rewards.add(E.item);
    assert.equal(E.nodes.length,3);assert.equal(E.rooms.length,3);
    assert.ok(E.start.y-E.summit.y>=287,label+' preserves a full optional ascent');
    let previous={x:E.start.x,w:0,y:E.start.y};
    for(const id of E.path){
      const p=byId.get(id);assert.ok(p,label+' actual standing support');
      assert.ok([p.x,p.y,p.w].every(Number.isInteger));
      reachable(previous,p,label+' '+previous.id+' -> '+id);previous=p;
    }
    for(const n of E.nodes){const p=byId.get(n.platformId);assert.ok(p.w>=36);assert.equal(n.x,p.x+p.w/2);assert.equal(n.y,p.y);}
    for(const r of E.rooms){
      roomKinds.add(r.kind);
      const a=byId.get(r.from),b=byId.get(r.platformId),c=byId.get(r.secret.platformId);
      for(const [from,to] of [[a,b],[b,c],[c,b],[b,a]])reachable(from,to,label+' cache return');
      assert.ok(c.x+c.w<a.x||c.x>a.x+a.w,label+' a separate exploration branch');
    }
    assert.equal(new Set(L.platforms.map(p=>p.id)).size,L.platforms.length);
  }
  assert.equal(pairs.size,20,'every ordered pair of distinct authored phrases appears');
  assert.deepEqual([...rewards].sort(),['dew','embers','feathers']);
  assert.deepEqual([...roomKinds].sort(),['gallery','needle','shelter']);
});

test('district choices are fully seeded and produce actual traversal variation between runs',()=>{
  const random=Math.random,signatures=new Set();
  Math.random=()=>{throw Error('layout randomness must use the run seed');};
  try{
    for(let i=0;i<40;i++){
      const seed=seedAt(i),a=make(8,seed),b=make(8,seed);
      assert.deepEqual(a,b);
      signatures.add(JSON.stringify(a.platforms.map(p=>[p.x,p.y,p.w])));
      const before=JSON.stringify(a);districts.furnish(a,()=>0,()=>false);assert.equal(JSON.stringify(a),before);
    }
  }finally{Math.random=random;}
  assert.ok(signatures.size>=20,`${signatures.size} traversal layouts across 40 seeds`);
});

test('district furnishing preserves authored picture and route geometry and the first seven shrine approach steps',()=>{
  const patterns={switch:[0,1],spine:[0,1,2,3,2,1],arch:[0,1,2,1],braid:[0,1,0,1,2,3,2,1]};
  for(let stage=1;stage<=20;stage++){
    const original={id:'painted',x:40,y:-60,w:80,art:true},L={stage,seed:73,origin:0,picture:'preserved',platforms:[original]},json=JSON.stringify(original);
    districts.furnish(L,()=>0,()=>false);
    assert.equal(JSON.stringify(original),json);assert.equal(L.platforms[0],original);
    const E=L.expedition,pattern=patterns[districts.stages[stage-1][1]];
    for(let i=0;i<7;i++){
      const p=L.platforms.find(p=>p.id===E.path[i]);
      assert.equal(p.x+p.w/2,E.start.x+E.side*pattern[i%pattern.length]*44);
      assert.equal(p.y,E.start.y-16-i*16);assert.equal(p.w,36);
    }
  }
});
