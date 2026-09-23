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

test('each active boon is one tiny HUD icon with its rank as stacks, eight per row, without counting Mech’s starter rover',()=>{
  const g=loadGame().game;g.resetRogueRun('test',{classId:'mech'});
  assert.deepEqual(JSON.parse(JSON.stringify(g.runHudBoons())),[]);
  g.rogueRun.perks.robot=3; // two earned Companion ranks beyond the starter rover
  g.rogueRun.perks.growth=5;
  g.rogueRun.perks.bark=4;
  const boons=JSON.parse(JSON.stringify(g.runHudBoons()));
  assert.deepEqual(boons,[{id:'growth',count:5},{id:'robot',count:2},{id:'bark',count:4}]);
  const first=g.runHudIconPosition(0),eighth=g.runHudIconPosition(7),ninth=g.runHudIconPosition(8);
  assert.equal(first.y,3,'first boon row aligns with the top tally/pause row');
  assert.equal(first.y,eighth.y);
  assert.equal(ninth.x,first.x);
  assert.ok(ninth.y>first.y);
  assert.ok(eighth.x-first.x>=7*9,'room for the stack dots beside each icon');
  g.drawTinyBoon('growth',first.x,first.y,5);
});

test('non-Mech characters show every collected boon once with its rank and never inherit the rover baseline',()=>{
  const g=loadGame().game;g.resetRogueRun('test',{classId:'runner'});
  g.rogueRun.perks.stride=3;g.rogueRun.perks.spring=2;g.rogueRun.perks.tender=1;
  assert.deepEqual(JSON.parse(JSON.stringify(g.runHudBoons())),[{id:'tender',count:1},{id:'stride',count:3},{id:'spring',count:2}]);
  assert.equal(g.rogueRun.perks.robot,0);
});
