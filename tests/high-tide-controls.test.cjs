const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
test('keyboard Tend plants the seed and grow/release climbs to the crown through the full game frame',()=>{
 const h=loadGame(),g=h.game;
 g.resetRogueRun('KEYBOARD',{mode:'high-tide'});
 let pumping=true,held=false;
 h.key('keydown','ArrowDown');
 for(let i=0;i<1800&&!g.rogueRun.ended;i++){
  if(g.gardenPlots.length){
   g.rogueRun.survival.enemyMask=255;g.rogueRun.survival.enemyClock=1e9;
   h.key('keyup','ArrowDown');
   if(g.P.st!=='climb'&&i%5===0){
    h.key('keyup',' ');held=false;h.key('keydown','ArrowUp');h.key('keyup','ArrowUp');
   }
   if(g.P.st==='climb'){
    const s=g.rogueRun.survival,gap=s.height-(s.base-g.P.y);
    if(gap>39||s.height>=480)pumping=false;else if(gap<3)pumping=true;
    if(pumping!==held){h.key(pumping?'keydown':'keyup',' ');held=pumping;}
   }
  }
  h.tick(50);
 }
 const s=g.rogueRun.survival;
 assert.equal(s.started,true,'Down must plant through the native action, not a test shortcut');
 assert.equal(g.runWon,true,JSON.stringify({s,motion:g.P.st,y:g.P.y,space:g.heldSpace,down:g.heldDown}));
 assert.ok(s.best>=478);assert.equal(g.gardenPlots.length,1);
});

test('touching and holding your character starts High Tide without a downward drag',()=>{
 const h=loadGame(),g=h.game;
 g.resetRogueRun('TOUCH',{mode:'high-tide'});
 g.camX=g.P.x-g.IW/2;g.camY=g.P.y-g.IH/2;
 const sx=(g.P.x-g.camX)*960/g.IW,sy=(g.P.y-8-g.camY)*540/g.IH;
 h.pointer('pointerdown',sx,sy);
 assert.equal(g.swipeDown,true,'High Tide touch on the player should arm Tend immediately');
 h.tick(50);
 assert.equal(g.gardenPlots.length,1,'holding the player should plant the one seed');
 assert.equal(g.rogueRun.survival.started,true,'planting should start the tide');
 h.pointer('pointerup',sx,sy);
 assert.equal(g.swipeDown,false,'releasing should release Tend for climbing');
});
test('a tiny co-op Sligo marker hugs the body and adds a visible foot anchor',()=>{
 const h=loadGame(),g=h.game,calls=[];
 g.camX=0;g.camY=0;g.ctx.fillRect=(...args)=>calls.push(args);
 const p={x:10,y:100,skin:'sligo',sligoMass:.25};
 assert.equal(g.sligoHeight(p),6);
 g.coopMarker(p,2,false);
 assert.deepEqual(calls[0],[9,89,3,1]);
 assert.ok(calls.some(q=>q[0]===8&&q[1]===101&&q[2]===5&&q[3]===1),'tiny Sligo needs a team-colour anchor at its feet');
});
