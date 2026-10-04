const {test}=require('node:test');
const assert=require('node:assert/strict');
const builds=require('../build-paths.js');
const classes=require('../max-classes.js');
const ranks=value=>Object.assign(builds.empty(),value);

test('each class discovers a canonical signature and exact remaining ranks from an early prerequisite',()=>{
 const cases=[
  ['mech','robot','fleet',[]],
  ['runner','tailwind','updraft',[['tailwind','Ring tempo',1],['spring','Spring step',1]]],
  ['bulwark','fault','aftershock',[['fault','Fault line',1],['counter','Reprisal',1]]],
  ['herbalist','symbiosis','symphony',[['symbiosis','Symbiosis',1],['regen','Sap',1]]],
  ['polge','splinters','haymaker',[['splinters','Heavy hands',1],['raincoat','Ringcraft',1]]],
  ['sligo','blast','chain',[['blast','Big blast',1],['cadence','Quick hands',1]]]
 ];
 for(const [classId,id,target,missing] of cases){
  const p=classes.perks(classId),before=JSON.stringify(p),progress=builds.signatureProgress(p,id,classId,'garden');
  assert.equal(progress.perk,builds.perks.find(q=>q.id===target),classId);
  assert.deepEqual(progress.missing,missing.map(([id,name,ranks])=>({id,name,ranks})),classId);
  assert.equal(progress.remaining,missing.reduce((n,need)=>n+need[2],0),classId);
  assert.equal(JSON.stringify(p),before,'a preview neither spends the offered rank nor mutates the build');
 }
});

test('prospective progress follows an actual seeded continuation pick through the final unlock',()=>{
 const p=ranks({tailwind:1}),first=builds.choices(p,3,17,'runner','garden')[0];
 assert.ok(['tailwind','spring'].includes(first.id));
 const preview=builds.signatureProgress(p,first.id,'runner','garden');
 assert.equal(preview.perk.id,'updraft');assert.equal(preview.remaining,1);
 p[first.id]++;
 const next=builds.choices(p,4,17,'runner','garden')[0];
 assert.equal(next.id,preview.missing[0].id,'the remaining named prerequisite is the next build card');
 const unlock=builds.signatureProgress(p,next.id,'runner','garden');
 assert.equal(unlock.perk.id,'updraft');assert.deepEqual(unlock.missing,[]);assert.equal(unlock.remaining,0);
 assert.ok(builds.unlocks(p,next.id,'runner','garden').includes(unlock.perk));
 p[next.id]++;
 assert.equal(builds.choices(p,5,17,'runner','garden')[0],unlock.perk,'the unlocked signature becomes the actual continuation');
});

test('class-specific targets precede generic ones even when the generic signature is closer',()=>{
 const p=ranks({growth:2});
 assert.deepEqual(builds.unlocks(p,'regen','herbalist','garden').map(q=>q.id),['bloom']);
 const progress=builds.signatureProgress(p,'regen','herbalist','garden');
 assert.equal(progress.perk.id,'symphony');
 assert.deepEqual(progress.missing,[{id:'symbiosis',name:'Symbiosis',ranks:2}]);assert.equal(progress.remaining,2);
});

test('same-priority targets prefer fewer missing ranks with canonical catalogue order breaking ties',()=>{
 const p=ranks({robot:1});
 const first=builds.signatureProgress(p,'robot','mech','garden');
 assert.equal(first.perk.id,'fleet','Robot crew and Guard bot tie at the immediately unlocked rank');
 assert.equal(first.remaining,0);
 p.robot=2;
 const next=builds.signatureProgress(p,'robot','mech','garden');
 assert.equal(next.perk.id,'recycle','a satisfied crew prerequisite cannot advertise more progress');
 assert.deepEqual(next.missing,[{id:'yield',name:'Seed rain',ranks:1}]);assert.equal(next.remaining,1);
});

test('disabled modes, foreign classes and unavailable selected ranks never promise signature progress',()=>{
 for(const [p,id,classId,mode] of [
  [ranks({}),'growth','runner','last-seed'],
  [ranks({}),'yield','mech','last-seed'],
  [ranks({robot:2}),'robot','mech','high-tide'],
  [ranks({}),'needle','mech','garden'],
  [ranks({}),'outbreak','herbalist','garden'],
  [ranks({tailwind:3}),'tailwind','runner','garden'],
  [ranks({}),'unknown','runner','garden']
 ])assert.equal(builds.signatureProgress(p,id,classId,mode),null,`${classId}/${mode}/${id}`);
 for(const mode of ['garden','last-seed','high-tide']){
  const progress=builds.signatureProgress(ranks({}),'symbiosis','herbalist',mode);
  assert.equal(progress.perk.id,'symphony');
  assert.ok(progress.missing.every(need=>builds.catalogue('herbalist',mode).some(q=>q.id===need.id)));
 }
});

test('owned signatures and prerequisite ranks already satisfied before a pick produce no hint',()=>{
 assert.equal(builds.signatureProgress(ranks({crosswind:1}),'needle','runner','garden'),null);
 assert.equal(builds.signatureProgress(ranks({tailwind:2}),'tailwind','runner','garden'),null);
 assert.equal(builds.signatureProgress(ranks({}),'water','runner','garden'),null);
});

test('forged card metadata and malformed ranks cannot replace canonical names, targets or requirements',()=>{
 const p={tailwind:-10,spring:999,colony:3},offered={id:'tailwind',name:'Forged mutation',needs:{unknown:99}},before=JSON.stringify({p,offered});
 const progress=builds.signatureProgress(p,offered,'runner','garden');
 assert.equal(progress.perk,builds.perks.find(q=>q.id==='updraft'));
 assert.deepEqual(progress.missing,[{id:'tailwind',name:'Ring tempo',ranks:1}]);assert.equal(progress.remaining,1);
 assert.equal(JSON.stringify({p,offered}),before);
 for(const invalid of [undefined,null,{},123,{id:123},{id:'toString'}])assert.equal(builds.signatureProgress(p,invalid,'runner','garden'),null);
});

test('progress inspection never changes seeded offers, redraws or canonical catalogue definitions',()=>{
 const definitions=JSON.stringify(builds.perks);
 for(const {id:classId} of classes.all)for(const mode of ['garden','last-seed','high-tide']){
  const p=classes.perks(classId),before=JSON.stringify(p),offer=builds.choices(p,2,31,classId,mode),redraw=builds.redraw(p,offer,2,31,classId,mode);
  for(const q of offer)builds.signatureProgress(p,q.id,classId,mode);
  assert.deepEqual(builds.choices(p,2,31,classId,mode),offer);
  assert.deepEqual(builds.redraw(p,offer,2,31,classId,mode),redraw);
  assert.equal(JSON.stringify(p),before);
 }
 assert.equal(JSON.stringify(builds.perks),definitions);
});
