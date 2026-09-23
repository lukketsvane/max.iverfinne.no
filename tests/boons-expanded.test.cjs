const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const builds=require('../build-paths.js');
const {loadGame,plot}=require('./game-harness.cjs');
const root=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/figma-manifest.json'),'utf8'));

test('every boon has its own native 9x9 symbol in the Figma production set',()=>{
  for(const p of builds.perks){
    const file='assets/boon-symbols-v1/'+p.id+'.png',b=fs.readFileSync(path.join(root,file));
    assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],[9,9],file);
    assert.ok(manifest.production.some(e=>e.path===file),file);
  }
});

test('Morning dew keeps a dry plant wetter than it would be',()=>{
  const run=dew=>{const g=loadGame().game;g.resetRogueRun();g.rogueRun.perks.dew=dew;const p=plot({x:0,moisture:.1,health:.8});g.gardenPlots=[p];for(let i=0;i<60;i++)g.updateGarden(1/6);return p.moisture;};
  assert.ok(run(3)>run(0)+.1);
});

test('Bramble cuts a biting pest and Evergreen saves one dying plant per garden',()=>{
  const g=loadGame().game;g.resetRogueRun();g.rogueRun.perks.bramble=2;g.rogueRun.perks.evergreen=1;
  const p=plot({x:0,health:.005}),k={kind:0,queen:false,elite:false};g.gardenPlots=[p];
  g.biteGarden(k,p,0);
  assert.ok(k.burn>0&&k.burnRate>=.6,'thorns set the pest bleeding');
  assert.ok(!p.dead&&p.health>=.3,'the first fall is caught');
  p.health=.005;g.biteGarden(k,p,0);
  assert.equal(p.dead,8,'only once per garden');
});

test('Sap burst glues every pest a blast reaches',()=>{
  const g=loadGame().game;g.resetRogueRun();
  const pest=Object.assign(g.makeKrek(1,false,0),{x:40,hp:50,maxHp:50});pest.y=g.surfaceY(40)-18;g.floatKrek=[pest];
  g.explode(pest.x,pest.y,false,{glue:2});
  assert.equal(pest.glue,1);
});
