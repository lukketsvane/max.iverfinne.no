const {test}=require('node:test');
const assert=require('node:assert/strict');
const builds=require('../build-paths.js');
const {loadGame}=require('./game-harness.cjs');

test('real opening offers vary with the run seed and repeat for the same run',()=>{
  const g=loadGame().game;g.resetRogueRun('seeded',{classId:'runner'});
  const signatures=new Set();
  for(let seed=1;seed<=32;seed++){
    g.rogueRun.seed=seed;
    const offer=g.perkChoices().map(q=>q.id).join(',');
    assert.equal(g.perkChoices().map(q=>q.id).join(','),offer);
    signatures.add(offer);
  }
  assert.ok(signatures.size>4,'fresh runs open different class directions');
});

function ranks(values){return Object.assign(builds.empty(),values);}

test('a chosen build always has a next step while two slots remain open to other paths',()=>{
  for(const [classId,values,next] of [
    ['herbalist',{growth:1},['growth','regen']],
    ['runner',{needle:1},['fletching']],
    ['bulwark',{shield:1},['bark']],
    ['mech',{robot:1,blast:1},['blast','cadence']],
    ['sligo',{stride:2},['stride']],
    ['polge',{raincoat:1},['splinters']]
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
    [{growth:1},'bloom','herbalist'],[{blast:1},'chain','mech'],
    [{shield:1},'evergreen','bulwark'],[{robot:3,fleet:1,sentry:1},'recycle','mech'],
    [{needle:1},'crosswind','runner'],[{tailwind:1},'updraft','runner'],
    [{fault:1},'aftershock','bulwark'],[{bedrock:1},'sanctuary','bulwark'],
    [{ferment:1},'outbreak','herbalist'],[{symbiosis:1},'symphony','herbalist'],
    [{splinters:1},'haymaker','polge'],[{varnish:1},'secondwind','polge']
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
  assert.deepEqual(builds.unlocks(p,'blast','mech').map(q=>q.id),['chain']);
  assert.deepEqual(builds.unlocks(ranks({blast:0,cadence:1}),'blast','mech'),[]);
  assert.deepEqual(builds.unlocks(p,'blast','runner'),[],'Kestrel cannot unlock bomb upgrades from legacy ranks');
  assert.deepEqual(builds.unlocks(ranks({needle:1}),'fletching','runner').map(q=>q.id),['crosswind']);
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
    for(const q of builds.catalogue(classId,mode)){
      assert.ok(seen.has(q.id),`${mode} ${classId}: ${q.id} is reachable`);
      assert.ok(Object.keys(q.needs||{}).every(id=>!forbidden[mode].includes(id)),`${q.id} has no dead prerequisite`);
    }
  }
});

test('each replacement class opens with multiple native directions and seed-dependent alternatives',()=>{
  for(const classId of ['runner','bulwark','herbalist','polge']){
    const starts=new Set(),pairings=new Set(),general=new Set();
    for(let seed=1;seed<=120;seed++){
      const offer=builds.choices(builds.empty(),2,seed,classId);
      assert.equal(offer.length,3);
      assert.equal(offer[0].classId,classId,'first pick introduces the selected character');
      assert.equal(offer[1].classId,classId,'second pick shows a different native direction');
      assert.equal(new Set(offer.map(q=>q.path)).size,3);
      assert.ok(offer.every(q=>!q.needs),'signatures stay locked at the start');
      starts.add(offer[0].id);pairings.add(offer.slice(0,2).map(q=>q.id).join(':'));general.add(offer[2].id);
      assert.deepEqual(offer,builds.choices(builds.empty(),2,seed,classId));
    }
    assert.equal(starts.size,3,'all three class directions can lead an offer');
    assert.equal(pairings.size,6,'each direction can be paired with either alternative');
    assert.ok(general.size>=8,'the opening is not a fixed three-card kit');
  }
});

test('class branches have reachable signatures, valid prerequisites and no leaked native attacks',()=>{
  const classIds=['mech','runner','bulwark','herbalist','polge','sligo'];
  for(const classId of ['runner','bulwark','herbalist','polge']){
    const kit=builds.perks.filter(q=>q.classId===classId),base=kit.filter(q=>!q.needs),signatures=kit.filter(q=>q.needs);
    assert.equal(base.length,3);assert.equal(signatures.length,2);
    assert.equal(new Set(base.map(q=>q.path)).size,3,'three native directions');
    for(const q of kit){
      for(const other of classIds.filter(id=>id!==classId)){
        assert.equal(builds.clean({[q.id]:99},other)[q.id],0,'foreign ranks cannot ride in snapshots');
        assert.equal(builds.available({[q.id]:0,...q.needs},q.id,other),false);
      }
      for(const mode of [undefined,'last-seed','high-tide']){
        assert.ok(builds.catalogue(classId,mode).some(p=>p.id===q.id));
        if(q.needs){
          assert.equal(builds.available(builds.empty(),q,classId,mode),false);
          const p=ranks(q.needs);
          assert.equal(builds.available(p,q,classId,mode),true);
          for(const [id,count] of Object.entries(q.needs)){
            assert.ok(count<=builds.max(id));
            assert.ok(builds.catalogue(classId,mode).some(p=>p.id===id),'no mode-disabled prerequisite');
            const missing={...p,[id]:count-1};
            assert.equal(builds.available(missing,q,classId,mode),false);
            assert.ok(builds.unlocks(missing,id,classId,mode).some(p=>p.id===q.id));
          }
        }
      }
    }
  }
});

test('bomb-only perks remain exclusive to bomb and flesh users in every mode',()=>{
  const bombIds=['blast','chain','wild','glue'];
  for(const mode of [undefined,'last-seed','high-tide'])for(const classId of ['runner','bulwark','herbalist','polge']){
    const stale=ranks({blast:5,chain:1,wild:3,glue:3,cadence:1});
    for(const id of bombIds){
      assert.equal(builds.clean(stale,classId)[id],0);
      assert.equal(builds.available(stale,id,classId,mode),false);
      assert.equal(builds.catalogue(classId,mode).some(q=>q.id===id),false);
    }
    for(let seed=0;seed<30;seed++)assert.ok(builds.choices(stale,8,seed,classId,mode).every(q=>!bombIds.includes(q.id)));
  }
  for(const classId of ['mech','sligo'])for(const id of bombIds)assert.equal(builds.available(ranks({blast:2,cadence:1}),id,classId),true);
  for(const id of ['varnish','splinters','raincoat'])assert.doesNotMatch(builds.perks.find(q=>q.id===id).desc,/stand-in|bomb|burst/i);
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
