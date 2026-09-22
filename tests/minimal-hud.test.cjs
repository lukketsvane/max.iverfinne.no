'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');

test('garden stage is rendered as compact tally groups centered around a bounded 1–20 count',()=>{
  const g=loadGame().game;
  for(const [level,count,groups] of [[1,1,[1]],[5,5,[5]],[6,6,[5,1]],[10,10,[5,5]],[17,17,[5,5,5,2]],[20,20,[5,5,5,5]],[99,20,[5,5,5,5]]]){
    const layout=g.levelTallyLayout(level);
    assert.equal(layout.count,count);
    assert.deepEqual(Array.from(layout.groups,x=>x.count),groups);
    assert.ok(layout.width>0&&layout.width<60);
  }
});

test('active boon ranks become tiny HUD icons, ten per row, without counting Mech’s starter rover',()=>{
  const g=loadGame().game;g.resetRogueRun('test',{classId:'mech'});
  assert.deepEqual(Array.from(g.runHudBoons()),[]);
  g.rogueRun.perks.robot=3; // two earned Companion ranks beyond the starter rover
  g.rogueRun.perks.growth=5;
  g.rogueRun.perks.bark=4;
  const boons=Array.from(g.runHudBoons());
  assert.equal(boons.filter(x=>x==='robot').length,2);
  assert.equal(boons.filter(x=>x==='growth').length,5);
  assert.equal(boons.filter(x=>x==='bark').length,4);
  assert.equal(boons.length,11);
  const first=g.runHudIconPosition(0),tenth=g.runHudIconPosition(9),eleventh=g.runHudIconPosition(10);
  assert.equal(first.y,tenth.y);
  assert.equal(eleventh.x,first.x);
  assert.equal(eleventh.y,first.y+7);
  assert.ok(tenth.x>first.x);
});

test('non-Mech characters show every collected boon rank and never inherit the rover baseline',()=>{
  const g=loadGame().game;g.resetRogueRun('test',{classId:'runner'});
  g.rogueRun.perks.stride=3;g.rogueRun.perks.spring=2;g.rogueRun.perks.tender=1;
  assert.deepEqual(Array.from(g.runHudBoons()),['tender','stride','stride','stride','spring','spring']);
  assert.equal(g.rogueRun.perks.robot,0);
});
