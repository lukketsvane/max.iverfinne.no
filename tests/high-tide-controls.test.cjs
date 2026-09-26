const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
test('keyboard Tend starts the motherplant; release and jump climbs while growth continues',()=>{
 const h=loadGame(),g=h.game;g.resetRogueRun('KEYBOARD',{mode:'high-tide'});
 h.key('keydown','ArrowDown');for(let i=0;i<10;i++)h.tick(50);h.key('keyup','ArrowDown');
 assert.equal(g.rogueRun.survival.started,true);assert.equal(g.gardenPlots.length,1);
 const start=g.P.y;h.key('keydown','ArrowUp');h.key('keyup','ArrowUp');
 for(let i=0;i<140;i++)h.tick(50);
 assert.ok(g.rogueRun.survival.height>60);assert.ok(g.P.y<start-30);assert.equal(g.runWon,false);
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
