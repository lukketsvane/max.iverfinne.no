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
