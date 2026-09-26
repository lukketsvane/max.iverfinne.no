const {test}=require('node:test');
const assert=require('node:assert/strict');
const builds=require('../build-paths.js');
const {loadGame}=require('./game-harness.cjs');

function ranks(values){return Object.assign(builds.empty(),values);}

test('a chosen build always has a next step while two slots remain open to other paths',()=>{
  for(const [classId,values,next] of [
    ['herbalist',{growth:1},['growth','regen']],
    ['runner',{blast:1},['blast','cadence']],
    ['bulwark',{shield:1},['bark']],
    ['mech',{robot:1,blast:1},['blast','cadence']],
    ['sligo',{stride:2},['stride']],
    ['polge',{raincoat:1},['raincoat']]
  ]){
    const p=ranks(values),before=JSON.stringify(p),variety=new Set();
    for(let seed=0;seed<100;seed++){
      const offer=builds.choices(p,seed+2,seed,classId);
      assert.ok(next.includes(offer[0].id),`${classId}: ${offer.map(q=>q.id)}`);
      assert.equal(offer.length,3);
      assert.equal(new Set(offer.map(q=>q.id)).size,3);
      assert.ok(offer.slice(1).every(q=>q.path!==offer[0].path),'two alternatives outside the continued path');
      offer.slice(1).forEach(q=>variety.add(q.id));
      assert.deepEqual(offer,builds.choices(p,seed+2,seed,classId),'same saved build produces the same offer');
    }
    assert.equal(JSON.stringify(p),before,'rolling never mutates ranks');
    assert.ok(variety.size>=10,`${classId} still sees a broad alternative pool`);
  }
});

test('picking the offered build continuation reaches signatures without waiting for lucky rerolls',()=>{
  for(const [values,signature,classId] of [
    [{growth:1},'bloom','herbalist'],[{blast:1},'chain','runner'],
    [{shield:1},'evergreen','bulwark'],[{robot:3,fleet:1,sentry:1},'recycle','mech']
  ]){
    for(let seed=0;seed<40;seed++){
      const p=ranks(values);
      for(let picks=0;p[signature]===0&&picks<3;picks++){
        const offer=builds.choices(p,2+picks,seed,classId),pick=offer[0];
        assert.ok(builds.available(p,pick,classId));p[pick.id]++;
      }
      assert.equal(p[signature],1,`${classId} reaches ${signature} in three choices or fewer`);
    }
  }
});

test('freshly unlocked signatures take priority, then disappear at maximum rank',()=>{
  const p=ranks({growth:2,regen:1,blast:2,cadence:1,shield:1,bark:1});
  const seen=new Set();
  for(let seed=0;seed<100;seed++){
    const offer=builds.choices(p,8,seed,'sligo');
    assert.ok(['bloom','chain','evergreen'].includes(offer[0].id));seen.add(offer[0].id);
  }
  assert.equal(seen.size,3,'all unlocked signatures can be reached');
  Object.assign(p,{bloom:1,chain:1,evergreen:1});
  for(let seed=0;seed<100;seed++)assert.ok(builds.choices(p,9,seed,'sligo').every(q=>!seen.has(q.id)));
});

test('an unlock hint names only a signature that the next rank actually enables',()=>{
  const p=ranks({blast:1,cadence:1}),before=JSON.stringify(p);
  assert.deepEqual(builds.unlocks(p,'blast','runner').map(q=>q.id),['chain']);
  assert.deepEqual(builds.unlocks(ranks({blast:0,cadence:1}),'blast','runner'),[]);
  assert.deepEqual(builds.unlocks(ranks({robot:1}),'robot','mech').map(q=>q.id),['fleet','sentry']);
  assert.deepEqual(builds.unlocks(ranks({robot:1}),'robot','herbalist'),[]);
  assert.deepEqual(builds.unlocks(ranks({growth:1,regen:1}),'growth','runner','high-tide'),[]);
  assert.deepEqual(builds.unlocks(p,'unknown','runner'),[]);
  assert.equal(JSON.stringify(p),before);
});

test('survival modes never offer harvest or seed upgrades that their rules disable',()=>{
  const forbidden={
    'last-seed':['yield','bloom','spread','magnet','luck','recycle','bounty'],
    'high-tide':['yield','bloom','spread','magnet','luck','recycle','bounty','robot','fleet','sentry','dew','evergreen','bramble']
  };
  for(const mode of Object.keys(forbidden))for(const classId of ['mech','runner','bulwark','herbalist','polge','sligo']){
    const p=ranks(classId==='mech'?{robot:1}:{}),seen=new Set();
    for(let level=1;level<130;level++){
      const offer=builds.choices(p,level,13,classId,mode);
      if(!offer.length)break;
      assert.ok(offer.every(q=>!forbidden[mode].includes(q.id)),`${mode}, ${classId}`);
      assert.ok(offer.every(q=>!q.classId||q.classId===classId));
      const pick=offer[0];seen.add(pick.id);p[pick.id]++;
    }
    for(const q of builds.perks.filter(q=>(!q.classId||q.classId===classId)&&!forbidden[mode].includes(q.id))){
      assert.ok(seen.has(q.id),`${mode} ${classId}: ${q.id} is reachable`);
      assert.ok(Object.keys(q.needs||{}).every(id=>!forbidden[mode].includes(id)),`${q.id} has no dead prerequisite`);
    }
  }
});

test('the real Last Seed offer applies the seedless catalogue for host and guest ranks',()=>{
  const g=loadGame().game;g.resetRogueRun('test',{classId:'mech',mode:'last-seed'});
  const forbidden=['yield','bloom','spread','magnet','luck','recycle','bounty'];
  for(let level=1;level<40;level++){
    g.rogueRun.level=level;
    for(const classId of ['mech','runner','herbalist','sligo']){
      const offer=g.perkChoices(ranks({growth:2,regen:1,robot:3}),level,classId);
      assert.ok(offer.every(q=>!forbidden.includes(q.id)),`${classId}: ${offer.map(q=>q.id)}`);
    }
  }
});
