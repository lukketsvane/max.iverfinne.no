const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function padded() {
  const h = loadGame(), g = h.game, state = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  h.window.navigator = { getGamepads: () => [null, state] };
  g.resetRogueRun('test', { classId: 'mech' });
  const press = (i, on = true) => { state.buttons[i] = { pressed: on, value: on ? 1 : 0 }; g.pollPads(); };
  return { h, g, state, press };
}

test('a standard controller (8BitDo in X-input mode) moves, runs, jumps and dodges Max', () => {
  const { g, state, press } = padded();
  state.axes[0] = .95; g.pollPads(); assert.equal(g.readInput().axis, 1); assert.equal(g.readInput().top, 88, 'full tilt runs');
  state.axes[0] = .6; g.pollPads(); assert.ok(g.readInput().top < 60, 'a gentle push walks');
  state.axes[0] = 0; g.pollPads(); assert.equal(g.readInput().axis, 0);
  press(14); assert.equal(g.heldL, true); press(14, false); assert.equal(g.heldL, false);
  press(5); assert.equal(g.heldRun, true); press(5, false); assert.equal(g.heldRun, false);
  g.jumpBuf = 0; press(0); assert.ok(g.jumpBuf > 0); assert.equal(g.heldUp, true);
  g.jumpBuf = 0; g.pollPads(); assert.equal(g.jumpBuf, 0, 'holding the button jumps once'); press(0, false); assert.equal(g.heldUp, false);
  g.dodgeBuf = 0; press(1); assert.equal(g.dodgeBuf,0); assert.equal(g.heldSpace,true); press(1,false); press(11); assert.ok(g.dodgeBuf > 0); press(11,false);
  press(3); assert.equal(g.heldSpace, true); assert.equal(g.gardenPress, true); press(3, false); assert.equal(g.heldSpace, false);
});

test('the keyboard keeps working next to a connected controller', () => {
  const { g } = padded();
  g.heldR = true; g.pollPads(); assert.equal(g.heldR, true, 'an idle stick never releases a held key');
});

test('Joy-Con B plus down plants without a dodge or jump, for either face-button mapping', () => {
  for(const button of [0,1]){
    const {g,state}=padded();g.gardenPlots=[];g.gardenSeeds=3;g.P.vx=0;
    const x=g.P.x;
    state.buttons[button]={pressed:true,value:1};state.axes[1]=.5;g.pollPads();
    assert.equal(g.dodgeBuf,0);assert.equal(g.jumpBuf,0);
    for(let i=0;i<180;i++)g.updatePlayer(1/60,g.readInput());
    assert.equal(g.P.x,x);assert.equal(g.P.dodgeT,0);assert.ok(g.gardenPlots.length>0);
  }
});

test('disconnect releases controller movement and cancels a held throw without firing', () => {
  const {h,g,press}=padded();press(14);press(5);press(7);
  assert.ok(g.charge);const before=g.bombs.length;
  h.window.navigator.getGamepads=()=>[];g.pollPads();
  assert.equal(g.heldL,false);assert.equal(g.heldRun,false);assert.equal(g.padAx,0);
  assert.equal(g.charge,null);assert.equal(g.bombs.length,before);
});

test('an active Joy-Con is selected even when an idle controller occupies the first slot', () => {
  const {h,g,state}=padded();
  const idle={index:0,buttons:Array.from({length:17},()=>({value:0})),axes:[0,0,0,0]};
  state.index=1;state.axes[0]=.3;h.window.navigator.getGamepads=()=>[idle,state];g.pollPads();
  assert.equal(g.readInput().axis,1);
});

test('controller menu navigation follows the grid, repeats and keeps held confirm out of gameplay', () => {
  const {h,g,state,press}=padded(),doc=h.document;
  const positions=[[0,0],[100,0],[0,100],[100,100]];
  const buttons=positions.map(([left,top])=>({disabled:false,offsetParent:{},closest(){return null;},getBoundingClientRect(){return {left,top,width:80,height:40};},focus(){doc.activeElement=this;},classList:{add(){},remove(){}},scrollIntoView(){},click(){g.runActive=true;}}));
  doc.querySelectorAll=selector=>selector.includes('role="dialog"')?[]:buttons;
  g.runActive=false;doc.activeElement=buttons[0];
  state.axes[0]=.4;g.pollPads();assert.equal(doc.activeElement,buttons[1]);
  state.axes[0]=0;state.axes[1]=.4;g.pollPads();assert.equal(doc.activeElement,buttons[3],'down stays in the same column');
  h.advance(310);g.pollPads();assert.equal(doc.activeElement,buttons[0],'held direction repeats and wraps');
  state.axes[1]=0;g.pollPads();press(0);assert.equal(g.runActive,true);
  g.jumpBuf=0;g.pollPads();assert.equal(g.jumpBuf,0,'confirm held over menu close never jumps');
  press(0,false);press(0);assert.ok(g.jumpBuf>0,'release rearms jump');
});

test('a desktop with a mouse sees a taller, wider garden; a phone keeps its chunky framing', () => {
  const { loadGame } = require('./game-harness.cjs');
  const h = loadGame(), g = h.game;
  Object.assign(h.window, { innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1, matchMedia: q => ({ matches: q.includes('pointer:fine') }) });
  g.resize(); assert.equal(g.SCALE, 4); assert.ok(g.IH >= 220 && g.IW >= 350, g.IW + 'x' + g.IH);
  Object.assign(h.window, { innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, matchMedia: () => ({ matches: false }) });
  g.resize(); assert.equal(g.SCALE, 8); assert.ok(g.IW < 150);
});
