const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');

function ready(){const h=loadGame();h.game.resetRogueRun('test',{classId:'polge',skinId:'polge'});h.game.floatKrek=[];h.game.runHazards=[];return h;}
function target(g){const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x+12,y:g.P.y-12,hp:30,maxHp:30,scout:false,raid:true});g.floatKrek.push(k);return k;}

test('C and touch Clinch use the same close attack while Space keeps tending',()=>{
 for(const touch of [false,true]){const h=ready(),g=h.game,k=target(g);g.updatePolgeControls();assert.equal(h.elements.get('polgeControls').hidden,false);
  if(touch)h.elements.get('polgeClinch').listeners.click[0]();else h.key('keydown','c');
  assert.ok(k.hp<30);assert.equal(g.fighterState().clinchCool,4);assert.equal(g.bombs.length,0);assert.equal(g.classShots.length,0);
  h.key('keydown',' ');assert.equal(g.heldSpace,true);h.key('keyup',' ');assert.equal(g.heldSpace,false);
  g.P.secondaryCool=4;g.resetRogueRun('again',{classId:'polge'});assert.equal(g.P.secondaryCool,0);
 }
});

test('Pølge slip remains steerable, travels at most 24px and cannot cross solid rock at supported rates',()=>{
 for(const hz of [30,60,120])for(const wall of [false,true]){const {game:g}=ready(),start=g.P.x,L=g.stageLayout();
  if(wall)L.platforms.push({id:'slip-wall',x:start+14,y:g.P.y-40,w:12,h:48,solid:true});
  g.requestDodge(1);let distance=0,last=g.P.x;
  for(let i=0;i<Math.ceil(.22*hz);i++){g.updatePlayer(1/hz,{axis:0,top:62});g.updateClassCombat(1/hz);distance+=Math.abs(g.P.x-last);last=g.P.x;}
  assert.ok(distance<=24.01,`${hz}Hz distance ${distance}`);if(wall)assert.ok(g.P.x<start+14);
  assert.equal(g.fighterState().counter,0);assert.ok(g.P.dodgeCool>3);
 }
 const {game:g}=ready();g.requestDodge(1);g.updatePlayer(.06,{axis:1,top:62});const before=g.P.x;g.updatePlayer(.06,{axis:-1,top:62});assert.ok(g.P.x<before);
});

test('both controller layouts expose Clinch without consuming jump, tending or Special',()=>{
 for(const single of [false,true]){const h=ready(),g=h.game,k=target(g);h.document.querySelectorAll=()=>[];
  const gp={id:single?'Joy-Con (L) Gamepad':'Xbox Wireless Controller',mapping:'standard',connected:true,index:0,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};
  h.window.navigator={getGamepads:()=>[gp]};g.pollPads();gp.buttons[8]={pressed:true,value:1};g.pollPads();assert.ok(k.hp<30);assert.equal(g.heldSpace,false);assert.equal(g.jumpBuf,0);
  gp.buttons[8]={pressed:false,value:0};g.pollPads();gp.buttons[1]={pressed:true,value:1};g.pollPads();assert.equal(g.heldSpace,true);
 }
});
