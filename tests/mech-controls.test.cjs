const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
function ready(){const h=loadGame(),g=h.game;g.resetRogueRun('test',{classId:'mech',skinId:'tide'});g.floatKrek=[];g.runHazards=[];g.gardenPlots=[plot({id:1,x:g.P.x+24,health:.7,moisture:.4})];Object.assign(g.ensureCompanion().state,{x:g.P.x,state:'idle',water:1});return h;}
function input(h,key,id,touch){if(touch)h.elements.get(id).listeners.click[0]();else h.key('keydown',key);}

test('Max keyboard and touch expose independent Fan, Rover and Overload without consuming Tend',()=>{
 for(const touch of [false,true]){
  const h=ready(),g=h.game;g.engineerState().charge=1;g.updatePolgeControls();g.updateMechControls();assert.equal(h.elements.get('mechControls').hidden,false);assert.equal(h.elements.get('polgeControls').hidden,true);
  input(h,'c','mechFan',touch);assert.equal(g.engineerState().charge,0);assert.equal(g.engineerState().fanBeats,3);assert.equal(g.P.secondaryCool,6);assert.equal(g.P.skillCool,0);
  g.updateMechCombat(.82);input(h,'v','mechUtility',touch);assert.ok(g.companion.state.dispatchT>0);assert.equal(g.engineerState().utilityCool,8);assert.equal(g.P.skillCool,0);
  g.engineerState().charge=3;input(h,'e','mechSpecial',touch);assert.equal(g.engineerState().charge,0);assert.equal(g.engineerState().overloadWindup,.4);assert.equal(g.P.skillCool,18);
  h.key('keydown',' ');assert.equal(g.heldSpace,true);h.key('keyup',' ');assert.equal(g.heldSpace,false);
  g.resetRogueRun('again',{classId:'mech'});assert.equal(g.P.utilityCool,0);assert.equal(g.P.secondaryCool,0);assert.equal(g.P.skillCool,0);assert.equal(g.engineerState().charge,0);
 }
});

test('the planted overload anticipation blocks movement, jump, dodge, tending and bombs, then releases once',()=>{
 for(const hz of [30,60,120]){
  const h=ready(),g=h.game,q=g.engineerState(),x=g.P.x,y=g.P.y;q.charge=3;h.key('keydown','e');
  h.key('keydown','ArrowRight');g.doJump(true);g.requestDodge(1);assert.equal(g.crouchGardenAction(),false);assert.equal(g.throwBomb({x:x+20,y:y-12},0),false);
  for(let i=0;i<Math.round(.4*hz);i++){g.updatePlayer(1/hz,{axis:1,top:62});g.updateMechCombat(1/hz);}
  assert.equal(g.P.x,x);assert.equal(g.P.y,y);assert.equal(g.P.dodgeT,0);assert.equal(g.jumpBuf,0);assert.equal(g.bombs.length,0);
  assert.equal(g.booms.filter(b=>b.strike==='overload').length,1);assert.equal(q.overloadWindup,0);assert.ok(q.specialCool>17.5);
  g.updatePlayer(.1,{axis:1,top:62});assert.ok(g.P.x>x);g.updateMechCombat(.1);assert.equal(g.booms.filter(b=>b.strike==='overload').length,1);
 }
});

test('both controller layouts trigger all Max slots and retain universal dodge and Tend',()=>{
 for(const single of [false,true]){
  const h=ready(),g=h.game;h.document.querySelectorAll=()=>[];
  const gp={id:single?'Joy-Con (L) Gamepad':'Xbox Wireless Controller',mapping:'standard',connected:true,index:0,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};h.window.navigator={getGamepads:()=>[gp]};g.pollPads();
  function hit(n){gp.buttons[n]={pressed:true,value:1};g.pollPads();gp.buttons[n]={pressed:false,value:0};g.pollPads();}
  g.engineerState().charge=1;hit(8);assert.equal(g.engineerState().charge,0);assert.equal(g.engineerState().fanBeats,3);assert.equal(g.heldSpace,false);assert.equal(g.jumpBuf,0);
  g.updateMechCombat(.82);hit(single?10:6);assert.equal(g.engineerState().utilityCool,8);assert.ok(g.companion.state.dispatchT>0);assert.equal(g.lampToggle,false);
  g.engineerState().charge=3;hit(single?3:4);assert.equal(g.engineerState().overloadWindup,.4);assert.equal(g.P.skillCool,18);
  g.updateMechCombat(.4);hit(single?4:11);g.updatePlayer(.02,{axis:0,top:62});assert.ok(g.P.dodgeT>0);
  gp.buttons[1]={pressed:true,value:1};g.pollPads();assert.equal(g.heldSpace,true);
 }
});

test('Tend plus Fan refills on either controller without spending Circuit or starting gardening',()=>{
 for(const single of [false,true]){
  const h=ready(),g=h.game;h.document.querySelectorAll=()=>[];
  const gp={id:single?'Joy-Con (L) Gamepad':'Xbox Wireless Controller',mapping:'standard',connected:true,index:0,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};h.window.navigator={getGamepads:()=>[gp]};g.pollPads();
  g.gardenPlots=[];g.engineerState().charge=1;g.companion.state.water=0;
  gp.buttons[1]={pressed:true,value:1};gp.buttons[8]={pressed:true,value:1};g.pollPads();
  assert.equal(g.companion.state.refill,2);assert.equal(g.engineerState().charge,1);assert.equal(g.engineerState().fanT,0);
  assert.equal(g.heldSpace,false);assert.equal(g.heldDown,false);assert.equal(g.gardenPress,false);assert.equal(g.task,null);
  for(let i=0;i<40;i++){g.pollPads();g.updateCompanion(.05);}
  assert.ok(g.companion.state.refill<1e-8);assert.equal(g.companion.state.water,.6);
  gp.buttons[8]={pressed:false,value:0};g.pollPads();assert.equal(g.heldSpace,true,'releasing the chord restores ordinary Tend');
 }
});
