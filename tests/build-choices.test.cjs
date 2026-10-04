const {test}=require('node:test');
const assert=require('node:assert/strict');
const builds=require('../build-paths.js');
const classes=require('../max-classes.js');
const ids=cards=>cards.map(q=>q.id);
const classIds=classes.all.map(q=>q.id);
const modes=['garden','last-seed','high-tide'];
function saturated(classId='mech',mode='garden'){
 const p=builds.empty();
 for(const q of builds.catalogue(classId,mode))p[q.id]=builds.max(q.id);
 return p;
}

test('every class can redraw two fresh alternatives while retaining its exact offered first card in all modes',()=>{
 for(const classId of classIds)for(const mode of modes)for(let seed=0;seed<32;seed++){
  const p=classes.perks(classId),offered=builds.choices(p,2,seed,classId,mode),before=JSON.stringify({p,offered});
  const next=builds.redraw(p,offered,2,seed,classId,mode);
  assert.equal(next.length,3,`${classId}/${mode}/${seed}`);
  assert.equal(next[0],offered[0]);
  assert.equal(new Set(ids(next)).size,3);
  assert.ok(next.slice(1).every(q=>!ids(offered).includes(q.id)),'both exploration cards are new when the pool permits');
  assert.ok(next.every(q=>builds.available(p,q,classId,mode)));
  assert.ok(next.every(q=>builds.catalogue(classId,mode).includes(q)));
  assert.equal(JSON.stringify({p,offered}),before,'redraw does not spend a boon or mutate the current offer');
 }
});

test('redraw preserves an invested continuation and an unlocked class signature without drawing locked upgrades',()=>{
 const signatures={mech:{robot:3,yield:1},runner:{needle:1,fletching:1},bulwark:{fault:2,counter:1},herbalist:{colony:1,ferment:2},polge:{splinters:2,raincoat:1},sligo:{blast:2,cadence:1}};
 for(const classId of classIds){
  const p=Object.assign(classes.perks(classId),signatures[classId]),offered=builds.choices(p,6,91,classId,'garden');
  assert.ok(offered[0].needs,`${classId} opens its unlocked signature`);
  const next=builds.redraw(p,ids(offered),6,91,classId,'garden');
  assert.equal(next[0],offered[0]);
  assert.ok(next.every(q=>builds.available(p,q,classId,'garden')));
  const invested=classes.perks(classId);invested.water=1;
  const continuation=builds.choices(invested,3,17,classId,'garden');
  assert.equal(continuation[0].id,'water');
  assert.equal(builds.redraw(invested,continuation,3,17,classId,'garden')[0],continuation[0]);
 }
});

test('a sparse redraw uses every new alternative before retaining an old card and rejects an exhausted offer',()=>{
 const p=saturated();for(const id of ['growth','water','regen','tender'])p[id]=0;
 const offered=['growth','water','regen'];
 const next=builds.redraw(p,offered,40,17,'mech','garden');
 assert.equal(next[0].id,'growth');assert.equal(next.length,3);
 assert.ok(ids(next).includes('tender'));
 assert.equal(next.slice(1).filter(q=>offered.includes(q.id)).length,1);
 p.tender=builds.max('tender');
 assert.deepEqual(builds.redraw(p,offered,40,17,'mech','garden'),[],'swapping two old alternatives would not be a new offer');
 p.regen=builds.max('regen');p.tender=0;
 assert.deepEqual(ids(builds.redraw(p,['growth','water'],40,17,'mech','garden')),['growth','tender'],'a two-card offer can redraw its one alternate');
});

test('redraw keeps three paths whenever a fresh eligible card from each alternate path exists',()=>{
 const p=saturated();for(const id of ['growth','water','regen','tender','shield','bark','cadence','dash'])p[id]=0;
 for(let seed=0;seed<32;seed++){
  const next=builds.redraw(p,['growth','water','regen'],40,seed,'mech','garden');
  assert.equal(new Set(next.map(q=>q.path)).size,3);
 }
});

test('redraw is reproducible across object and ID offers, varies by seed, and normalizes forged card metadata',()=>{
 const p=classes.perks('herbalist'),offered=builds.choices(p,3,17,'herbalist','garden');
 const one=builds.redraw(p,offered,3,17,'herbalist','garden');
 assert.deepEqual(ids(one),ids(builds.redraw(p,ids(offered),3,17,'herbalist','garden')));
 assert.deepEqual(ids(one),ids(builds.redraw(p,offered.map(q=>({id:q.id,path:99,name:'forged',needs:{}})),3,17,'herbalist','garden')));
 const variants=new Set();for(let seed=0;seed<32;seed++)variants.add(ids(builds.redraw(p,offered,3,seed,'herbalist','garden')).join(','));
 assert.ok(variants.size>8,'run salt creates meaningfully different alternate draws');
 assert.equal(one[0],offered[0],'canonical first-card metadata is preserved');
});

test('invalid, duplicate, unavailable, wrong-class and disabled-mode offered cards cannot redraw',()=>{
 const p=builds.empty(),valid=['growth','water','regen'];
 for(const offered of [null,{},[],new Array(2),['growth',,'water'],['growth'],[...valid,'tender'],['growth','growth','water'],['missing','water','regen'],[123,'water'],[null,'water'],[{id:123},'water'],['growth','outbreak','regen'],['growth','needle','regen']]){
  assert.deepEqual(builds.redraw(p,offered,2,17,'mech','garden'),[],JSON.stringify(offered));
 }
 p.growth=builds.max('growth');assert.deepEqual(builds.redraw(p,valid,2,17,'mech','garden'),[]);
 assert.deepEqual(builds.redraw(builds.empty(),['growth','yield','regen'],2,17,'mech','last-seed'),[]);
 assert.deepEqual(builds.redraw(builds.empty(),['growth','magnet','regen'],2,17,'mech','high-tide'),[]);
});
