import { pixelText } from './pixel-text.mjs';
import { RELICS, relicRecord } from './relics.mjs';
import { TOWERS, TD_WAVES, createTowerGame, towerStats, towerUpgradeCost, buildable, buildTower, upgradeTower, sellTower, startWave, stepTower } from './relic-tower.mjs';
import { createMinosGame, routeMinos, dashMinos, pulseMinos, stepMinos } from './relic-minos.mjs';

const TILE=12,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const timeText=n=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
function element(tag,cls){const e=document.createElement(tag);if(cls)e.className=cls;return e;}
function label(el,text,scale=2){el.replaceChildren();pixelText(el,text,scale,1);}
function button(name,action,cls=''){const b=element('button',cls);b.type='button';b.setAttribute('aria-label',name);b.addEventListener('click',action);return b;}

export function mountRelicGame({id,parent=document.body,owner,storage=window.localStorage,onExit,onSound,seed,skin='mech'}={}){
  const relic=RELICS.find(r=>r.id===id);if(!relic)throw new Error('Unknown relic');
  const root=element('section','max-relic-game');root.dataset.relic=id;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',relic.name);
  const abort=new AbortController(),signal=abort.signal;
  const head=element('header','relic-head'),title=element('h2'),readout=element('p','relic-readout');label(title,relic.name,2);
  const back=button('Return to garden',close,'relic-icon');label(back,'<',3);
  const pause=button('Pause',togglePause,'relic-icon');label(pause,'II',2);head.append(back,title,readout,pause);
  const viewport=element('div','relic-viewport'),canvas=element('canvas','relic-canvas');canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',id==='bastion'?'Defence field. Select a flower, then an empty tile.':'Labyrinth. Drag to move. Find three seals and reach the door.');viewport.append(canvas);
  const dock=element('footer','relic-dock'),hint=element('p','relic-hint');hint.setAttribute('role','status');hint.textContent=id==='bastion'?'Choose a flower. Tap the soil.':'Drag to move · find three seals';
  const panel=element('div','relic-panel');panel.hidden=true;panel.setAttribute('aria-live','polite');
  root.append(head,viewport,hint,dock,panel);parent.append(root);
  const g=canvas.getContext('2d');let s,newSeed=seed,paused=false,disposed=false,raf=0,last=0,acc=0,selectedType='thorn',selectedTower=null,pointer=null,
    keys=new Set(),view={x:0,y:0,transpose:false},padBefore={},hud='',shown='',resultRecorded=false,mapOpen=false,cursor={x:7,y:4,visible:false},navAt=0,navDir='';
  const towerButtons=new Map();let waveButton,speedButton,upgradeButton,sellButton,dashButton,pulseButton,mapButton;
  function sound(kind){onSound?.(kind);}
  function fresh(){
    s=id==='bastion'?createTowerGame():createMinosGame(newSeed===undefined?(Math.random()*4294967296)>>>0:newSeed);
    newSeed=undefined;selectedTower=null;paused=false;resultRecorded=false;last=acc=0;hud=shown='';keys.clear();pointer=null;padBefore={};mapOpen=false;panel.hidden=true;pause.disabled=false;
    pause.setAttribute('aria-label','Pause');label(pause,'II',2);resize();renderDock();canvas.focus({preventScroll:true});
  }
  function close(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);abort.abort();observer?.disconnect();keys.clear();pointer=null;root.remove();onExit?.();}
  function clearInput(){keys.clear();pointer=null;padBefore={};}
  function togglePause(){if(s.result)return;paused=!paused;clearInput();last=acc=0;pause.setAttribute('aria-label',paused?'Resume':'Pause');label(pause,paused?'>':'II',2);if(paused)showPanel('PAUSED',true);else panel.hidden=true;sound('call');}
  function showPanel(text,isPause=false){
    panel.replaceChildren();const card=element('div','relic-result'),h=element('h3');label(h,text,3);card.append(h);
    const stats=element('p');stats.textContent=id==='bastion'?s.wave+' / '+TD_WAVES+' · '+timeText(s.time):s.collected+' / 3 · '+timeText(s.time);card.append(stats);
    const again=button(isPause?'Resume':'Play again',isPause?togglePause:()=>{fresh();sound('gift');});label(again,isPause?'RESUME':'AGAIN',2);
    const garden=button('Return to garden',close);label(garden,'GARDEN',2);card.append(again,garden);panel.append(card);panel.hidden=false;again.focus({preventScroll:true});
  }
  function resize(){
    const box=viewport.getBoundingClientRect(),w=Math.max(100,box.width||window.innerWidth),h=Math.max(100,box.height||window.innerHeight-180),dpr=window.devicePixelRatio||1;
    view.transpose=id==='bastion'&&w>h*1.3;
    const nw=id==='bastion'?(view.transpose?s.height:s.width)*TILE:Math.max(120,Math.round(w/3)),nh=id==='bastion'?(view.transpose?s.width:s.height)*TILE:Math.max(144,Math.round(h/3));
    const scale=Math.max(1,Math.floor(Math.min(w*dpr/nw,h*dpr/nh)));
    canvas.width=nw;canvas.height=nh;canvas.style.width=nw*scale/dpr+'px';canvas.style.height=nh*scale/dpr+'px';g.imageSmoothingEnabled=false;
  }
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>s&&resize()):null;observer?.observe(viewport);
  window.addEventListener('resize',()=>s&&resize(),{signal});
  function makeFlower(type){const spec=TOWERS[type],b=button(spec.name+' · '+spec.cost+' seeds',()=>{selectedType=type;selectedTower=null;renderDock();sound('call');},'relic-flower');b.dataset.tower=type;
    const icon=element('canvas');icon.width=icon.height=20;drawTower(icon.getContext('2d'),{type,level:1},10,15,0);const text=element('span');text.textContent=spec.name+' '+spec.cost;b.append(icon,text);return b;}
  function renderDock(){
    dock.replaceChildren();towerButtons.clear();
    if(id==='bastion'){
      const flowers=element('div','relic-flowers');for(const type of Object.keys(TOWERS)){const b=makeFlower(type);flowers.append(b);towerButtons.set(type,b);}
      const actions=element('div','relic-actions');
      waveButton=button('Start next wave',()=>{if(startWave(s)){selectedTower=null;sound('raid');renderDock();}});label(waveButton,'WAVE',2);
      speedButton=button('Double speed',()=>{s.speed=s.speed===1?2:1;speedButton.setAttribute('aria-pressed',String(s.speed===2));label(speedButton,s.speed+'X',2);});label(speedButton,s.speed+'X',2);speedButton.setAttribute('aria-pressed',String(s.speed===2));
      upgradeButton=button('Upgrade tower',()=>{if(upgradeTower(s,selectedTower)){sound('gift');renderDock();}});
      sellButton=button('Sell tower',()=>{if(sellTower(s,selectedTower)){selectedTower=null;sound('call');renderDock();}});label(sellButton,'SELL',2);
      actions.append(waveButton,speedButton,upgradeButton,sellButton);dock.append(flowers,actions);
    }else{
      mapButton=button('Map',()=>{mapOpen=!mapOpen;mapButton.setAttribute('aria-pressed',String(mapOpen));});label(mapButton,'MAP',2);
      dashButton=button('Dash',()=>{if(dashMinos(s))sound('call');updateHud();});label(dashButton,'DASH',2);
      pulseButton=button('Stun pulse',()=>{if(pulseMinos(s))sound('gift');updateHud();});label(pulseButton,'PULSE',2);
      dock.append(mapButton,dashButton,pulseButton);
    }updateHud();
  }
  function updateHud(){
    const text=id==='bastion'?'♥ '+s.hearts+'   ✦ '+s.seeds+'   '+s.wave+'/'+TD_WAVES:'◇ '+s.collected+'/3   '+timeText(s.time);
    if(text!==hud){readout.textContent=text;readout.setAttribute('aria-label',id==='bastion'?s.hearts+' heart, '+s.seeds+' seeds, wave '+s.wave+' of '+TD_WAVES:s.collected+' of 3 seals, '+timeText(s.time));hud=text;}
    if(id==='bastion'){
      const t=s.towers.find(t=>t.id===selectedTower),cost=t&&towerUpgradeCost(t);
      for(const [type,b] of towerButtons){b.disabled=s.seeds<TOWERS[type].cost||paused||!!s.result;b.setAttribute('aria-pressed',String(type===selectedType&&!t));}
      waveButton.hidden=!!t;speedButton.hidden=!!t;waveButton.disabled=s.phase!=='build'||paused||!!s.result;
      upgradeButton.hidden=sellButton.hidden=!t;upgradeButton.disabled=!cost||s.seeds<cost||paused;sellButton.disabled=paused;
      if(t){const str=cost?'+ '+cost:'MAX';if(upgradeButton.dataset.cost!==str){label(upgradeButton,str,2);upgradeButton.dataset.cost=str;}upgradeButton.setAttribute('aria-label',cost?'Upgrade '+TOWERS[t.type].name+' for '+cost+' seeds':'Fully upgraded');}
      const msg=t?TOWERS[t.type].name+' · '+t.level+'/3':s.phase==='build'?(s.wave?'Wave cleared. Grow. Upgrade.':'Choose a flower. Tap the soil.'):'Guard the heart.';
      if(msg!==shown){hint.textContent=msg;shown=msg;}
    }else{
      dashButton.disabled=s.dashCool>0||paused||!!s.result;pulseButton.disabled=s.pulseCool>0||paused||!!s.result;
      dashButton.style.setProperty('--ready',String(1-s.dashCool/3));pulseButton.style.setProperty('--ready',String(1-s.pulseCool/10));
      const distance=Math.hypot(s.hunter.x-s.player.x,s.hunter.y-s.player.y),msg=s.collected===3?'The door is open.':s.hunter.warning>0?'MOVE.':s.grace>0?'Drag to move · find three seals':distance<5?'It is close.':'Three seals. One way out.';
      if(msg!==shown){hint.textContent=msg;shown=msg;}root.dataset.danger=String(!s.grace&&distance<5);
    }
  }
  function coords(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
  function towerTap(x,y){
    let tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);if(view.transpose)[tx,ty]=[ty,tx];
    const t=s.towers.find(t=>t.x===tx&&t.y===ty);if(t){selectedTower=t.id;sound('call');}
    else if(buildTower(s,selectedType,tx,ty)){selectedTower=null;sound('plant');}
    else selectedTower=null;renderDock();
  }
  function cursorMove(dx,dy){if(view.transpose)[dx,dy]=[dy,dx];cursor.x=clamp(cursor.x+dx,0,s.width-1);cursor.y=clamp(cursor.y+dy,0,s.height-1);cursor.visible=true;}
  function cursorTap(){const x=(cursor.x+.5)*TILE,y=(cursor.y+.5)*TILE;towerTap(view.transpose?y:x,view.transpose?x:y);}
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();if(paused||s.result||pointer)return;canvas.focus({preventScroll:true});const p=coords(e);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,start:p,dx:0,dy:0,moved:false};canvas.setPointerCapture?.(e.pointerId);},{signal});
  canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.moved||=Math.hypot(dx,dy)>7;pointer.dx=clamp(dx/28,-1,1);pointer.dy=clamp(dy/28,-1,1);},{signal});
  const release=e=>{if(!pointer||pointer.id!==e.pointerId)return;const p=pointer;pointer=null;if(e.type!=='pointerup'||paused||s.result||p.moved)return;
    if(id==='bastion')towerTap(p.start.x,p.start.y);else if(!mapOpen)routeMinos(s,(p.start.x+view.x)/TILE,(p.start.y+view.y)/TILE);
  };
  canvas.addEventListener('pointerup',release,{signal});canvas.addEventListener('pointercancel',release,{signal});canvas.addEventListener('lostpointercapture',()=>{pointer=null;},{signal});
  root.addEventListener('keydown',e=>{
    e.stopPropagation();if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Escape'].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.repeat)return;
    if(e.key==='Escape'){togglePause();return;}if(paused||s.result)return;
    if(id==='bastion'){
      if(e.key===' '){startWave(s);renderDock();}
      if(['1','2','3'].includes(e.key)){selectedType=Object.keys(TOWERS)[+e.key-1];selectedTower=null;renderDock();}
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(direction)cursorMove(...direction);
      if(e.key==='Enter'&&e.target===canvas){e.preventDefault();cursor.visible=true;cursorTap();}
      if(e.key.toLowerCase()==='u'&&selectedTower){upgradeTower(s,selectedTower);renderDock();}
    }else{if(e.key===' '||e.key==='Shift')dashMinos(s);if(e.key.toLowerCase()==='e')pulseMinos(s);if(e.key.toLowerCase()==='m')mapOpen=!mapOpen;}
  },{signal});
  root.addEventListener('keyup',e=>{e.stopPropagation();keys.delete(e.key.toLowerCase());},{signal});
  // A suspended phone cannot be caught while its app is hidden; held inputs never survive it.
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(!paused&&!s.result)togglePause();}last=acc=0;},{signal});
  window.addEventListener('blur',()=>{clearInput();if(!paused&&!s.result)togglePause();},{signal});
  root.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const items=[...(panel.hidden?root:panel).querySelectorAll('button:not([disabled]),canvas')].filter(e=>!e.hidden&&!e.closest('[hidden]'));const i=items.indexOf(document.activeElement);if((e.shiftKey&&i<=0)||(!e.shiftKey&&i===items.length-1)){e.preventDefault();items[e.shiftKey?items.length-1:0]?.focus();}},{signal});
  function controller(){const p=Array.from(navigator.getGamepads?.()||[]).find(Boolean);if(!p){padBefore={};return{x:0,y:0};}const pressed=i=>!!p.buttons[i]?.pressed;const just=i=>pressed(i)&&!padBefore[i];
    const move={x:Math.abs(p.axes[0]||0)>.16?p.axes[0]:(pressed(15)?1:0)-(pressed(14)?1:0),y:Math.abs(p.axes[1]||0)>.16?p.axes[1]:(pressed(13)?1:0)-(pressed(12)?1:0)};
    if(s.result||paused){if(just(0)){if(paused)togglePause();else fresh();}else if(just(1))close();else if(just(9))togglePause();}
    else if(just(9))togglePause();
    else if(id==='minos'){if(just(0))dashMinos(s);if(just(2))pulseMinos(s);if(just(3))mapOpen=!mapOpen;}
    else{
      const dx=Math.abs(move.x)>.35?Math.sign(move.x):0,dy=Math.abs(move.y)>.35?Math.sign(move.y):0,dir=dx+','+dy,now=performance.now();
      if((dx||dy)&&(dir!==navDir||now>navAt)){cursorMove(dx,dy);navAt=now+(dir===navDir?140:300);}navDir=dir;
      if(just(0)){cursor.visible=true;cursorTap();}
      if(just(4)||just(5)){const types=Object.keys(TOWERS);selectedType=types[(types.indexOf(selectedType)+(just(5)?1:2))%3];selectedTower=null;renderDock();}
      if(just(2)){startWave(s);renderDock();}if(just(3)&&selectedTower){upgradeTower(s,selectedTower);renderDock();}
    }
    padBefore=Object.fromEntries(p.buttons.map((_,i)=>[i,pressed(i)]));return move;
  }
  function frame(now){
    if(disposed)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;const pad=controller();
    if(!paused&&!s.result){acc+=dt*(id==='bastion'?s.speed:1);while(acc>=1/60){
      if(id==='bastion')stepTower(s,1/60);else stepMinos(s,1/60,{x:(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+(pointer?.dx||0)+pad.x,y:(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+(pointer?.dy||0)+pad.y});acc-=1/60;
    }}
    if(s.result&&!resultRecorded){resultRecorded=true;relicRecord(storage,owner,id,s);sound(s.result==='won'?'gift':'call');showPanel(s.result==='won'?(id==='bastion'?'HELD':'ESCAPED'):(id==='bastion'?'OVERRUN':'CAUGHT'));pause.disabled=true;}
    if(disposed)return;
    if(id==='bastion')drawDefence(g,s,view,selectedType,selectedTower,cursor);else drawMaze(g,s,view,skin,mapOpen);
    updateHud();raf=requestAnimationFrame(frame);
  }
  fresh();raf=requestAnimationFrame(frame);
  // Kept by the caller, never attached to window. Fixtures/tests can inspect their own instance.
  return{close,get state(){return s;},element:root};
}

function rect(g,x,y,w,h,color){g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function line(g,x,y,tx,ty,color){const n=Math.max(Math.abs(tx-x),Math.abs(ty-y));for(let i=0;i<=n;i++)rect(g,x+(tx-x)*i/(n||1),y+(ty-y)*i/(n||1),1,1,color);}
function drawTower(g,t,x,y,time){
  const spec=TOWERS[t.type];rect(g,x-4,y,9,3,'#243a37');rect(g,x-2,y+2,5,2,'#6c7f5a');rect(g,x,y-6,1,8,'#799869');
  rect(g,x-3,y-2,3,1,'#9cb272');rect(g,x+1,y-4,3,1,'#729d72');
  const bob=Math.round(Math.sin(time*2+t.x)*.6)||0;y+=bob;
  if(t.type==='thorn'){rect(g,x-3,y-9,7,3,'#b89a67');rect(g,x-2,y-10,5,5,spec.color);rect(g,x,y-8,1,1,'#fff1c2');}
  if(t.type==='frost'){rect(g,x-4,y-7,9,1,spec.color);rect(g,x-2,y-9,5,5,spec.color);rect(g,x,y-11,1,9,'#d5f4ed');rect(g,x-1,y-8,3,3,'#709baa');}
  if(t.type==='ember'){rect(g,x-3,y-9,7,5,'#aa5760');rect(g,x-2,y-10,5,6,spec.color);rect(g,x,y-12,1,6,'#f5d79a');rect(g,x-1,y-8,3,2,'#f2c384');}
  for(let i=0;i<t.level;i++)rect(g,x-2+i*2,y+4,1,1,'#d5e4af');
}
function drawDefence(g,s,v,type,selected,cursor){
  const pos=(x,y)=>v.transpose?{x:y*TILE+6,y:x*TILE+6}:{x:x*TILE+6,y:y*TILE+6};
  rect(g,0,0,g.canvas.width,g.canvas.height,'#172c2a');
  for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++){
    const p=pos(x,y),k=(x*67+y*31)%17;rect(g,p.x-6,p.y-6,12,12,k<5?'#1b302e':'#1b332e');
    if(k%3===0){rect(g,p.x+k%5-3,p.y+2,1,2,'#365444');rect(g,p.x-3,p.y-2,1,1,'#41533c');}
    if(buildable(s,x,y)&&!s.towers.length)rect(g,p.x,p.y,1,1,'#58705a');
  }
  s.path.forEach((p,i)=>{const q=pos(p.x,p.y);rect(g,q.x-6,q.y-6,12,12,'#485247');rect(g,q.x-5,q.y-5,9,4,i%3?'#626755':'#5b6454');rect(g,q.x-4,q.y,10,5,'#555e4c');rect(g,q.x+4,q.y-4,1,2,'#839076');});
  const start=pos(s.path[0].x,s.path[0].y),end=pos(s.path.at(-1).x,s.path.at(-1).y);
  rect(g,start.x-4,start.y-4,9,9,'#19272a');rect(g,start.x-2,start.y-2,5,5,'#a77a76');
  const beat=Math.sin(s.time*3)>0?1:0;rect(g,end.x-4-beat,end.y-3,9+beat*2,5,'#668f7b');rect(g,end.x-3,end.y-5,3,8,'#b8dfb0');rect(g,end.x+1,end.y-5,3,8,'#b8dfb0');rect(g,end.x-2,end.y+2,5,2,'#cddd9e');rect(g,end.x,end.y+4,1,1,'#cddd9e');
  const tower=s.towers.find(t=>t.id===selected);
  if(tower){const p=pos(tower.x,tower.y),r=towerStats(tower).range*TILE;for(let a=0;a<6.28;a+=.07)rect(g,p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,1,1,'#a6c5a2');rect(g,p.x-6,p.y-6,12,1,'#cfdbab');}
  for(const t of s.towers){const p=pos(t.x,t.y);drawTower(g,t,p.x,p.y+2,s.time);}
  for(const e of s.enemies){const p=pos(e.x,e.y),large=e.type==='brute'||e.type==='crown',r=large?5:3,bob=Math.sin(s.time*12+e.id)>0?1:0,color=e.slow>0?'#8ab7c8':e.type==='shell'?'#90977e':e.type==='runner'?'#cf998b':large?'#9f6e7d':'#b6c0a6';
    rect(g,p.x-r-1,p.y+3,2*r+2,2,'#26352d');rect(g,p.x-r,p.y-r,2*r+1,2*r,color);rect(g,p.x-r-1,p.y+1+bob,2,3,color);rect(g,p.x+r,p.y+2-bob,2,3,color);
    rect(g,p.x-1,p.y-2,1,1,'#251e29');rect(g,p.x+2,p.y-2,1,1,'#251e29');
    if(e.type==='shell')rect(g,p.x-2,p.y-4,5,2,'#d4d5a5');
    if(e.type==='crown'){for(let i=-4;i<=4;i+=4)rect(g,p.x+i,p.y-8,2,4,'#e3ce86');rect(g,p.x-4,p.y-5,10,1,'#e3ce86');}
    if(e.hp<e.maxHp){rect(g,p.x-r,p.y-r-3,r*2+1,1,'#2d2933');rect(g,p.x-r,p.y-r-3,(r*2+1)*e.hp/e.maxHp,1,'#e4b893');}
  }
  for(const shot of s.shots){const a=pos(shot.x,shot.y),b=pos(shot.tx,shot.ty);line(g,a.x,a.y-6,b.x,b.y-2,TOWERS[shot.type].color);if(shot.type==='ember'){rect(g,b.x-3,b.y-3,7,1,'#efc88a');rect(g,b.x,b.y-6,1,7,'#efc88a');}}
  if(cursor.visible){const p=pos(cursor.x,cursor.y),ink=buildable(s,cursor.x,cursor.y)||s.towers.some(t=>t.x===cursor.x&&t.y===cursor.y)?'#d8e4b8':'#ba7d76';for(const dx of [-1,1])for(const dy of [-1,1]){rect(g,p.x+dx*5-(dx>0?2:0),p.y+dy*5,3,1,ink);rect(g,p.x+dx*5,p.y+dy*5-(dy>0?2:0),1,3,ink);}}
}
function drawCat(g,x,y,time,skin){
  const color=skin==='sligo'?'#dd9eab':skin==='runner'?'#b1bf8d':skin==='bulwark'?'#cfa885':skin==='herbalist'?'#bab0cd':'#bcc6b3',step=Math.sin(time*15)>0?1:0;
  rect(g,x-3,y+3,7,2,'#172329');rect(g,x-3,y-3,7,7,color);rect(g,x-3,y-5,2,3,color);rect(g,x+2,y-5,2,3,color);
  rect(g,x-1,y-1,1,1,'#1e252c');rect(g,x+2,y-1,1,1,'#1e252c');rect(g,x,y+1,1,1,'#9f707b');rect(g,x-2,y+4,2,1+step,color);rect(g,x+1,y+4,2,2-step,color);
}
function drawHunter(g,h,x,y,time){
  const color=h.stun>0?'#767e80':h.warning>0?'#d5b88c':'#93685e',step=Math.sin(time*10)>0?1:0;
  rect(g,x-6,y+5,13,2,'#171c26');rect(g,x-4,y-6,9,12,color);rect(g,x-6,y-4,2,7,color);rect(g,x+5,y-4,2,7,color);
  rect(g,x-7,y-10,2,6,'#cdbb98');rect(g,x+6,y-10,2,6,'#cdbb98');rect(g,x-6,y-6,4,2,'#cdbb98');rect(g,x+3,y-6,4,2,'#cdbb98');
  rect(g,x-2,y-3,2,1,'#f2bf89');rect(g,x+2,y-3,2,1,'#f2bf89');rect(g,x-2,y,6,3,'#59494a');rect(g,x-3,y+6,3,2+step,color);rect(g,x+2,y+6,3,3-step,color);
  if(h.warning>0){rect(g,x,y-17,2,4,'#efc896');rect(g,x,y-12,2,1,'#efc896');}
}
function drawMaze(g,s,v,skin,map){
  const W=g.canvas.width,H=g.canvas.height;rect(g,0,0,W,H,'#101922');
  if(map){
    const scale=Math.max(2,Math.floor(Math.min(W,H)/(s.width+4))),ox=Math.floor((W-s.width*scale)/2),oy=Math.floor((H-s.height*scale)/2);
    for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++){const k=y*s.width+x;if(s.seen[k])rect(g,ox+x*scale,oy+y*scale,scale-1,scale-1,s.cells[k]?'#384049':'#778072');}
    for(const seal of s.seals)if(!seal.taken)rect(g,ox+Math.floor(seal.x)*scale,oy+Math.floor(seal.y)*scale,scale,scale,'#dec895');
    rect(g,ox+s.exit%s.width*scale,oy+Math.floor(s.exit/s.width)*scale,scale,scale,s.collected===3?'#acdbba':'#997965');
    rect(g,ox+Math.floor(s.player.x)*scale,oy+Math.floor(s.player.y)*scale,scale,scale,'#e7ead1');return;
  }
  v.x=Math.round(clamp(s.player.x*TILE-W/2,0,Math.max(0,s.width*TILE-W)));v.y=Math.round(clamp(s.player.y*TILE-H/2,0,Math.max(0,s.height*TILE-H)));
  for(let y=Math.max(0,Math.floor(v.y/TILE));y<Math.min(s.height,(v.y+H)/TILE);y++)for(let x=Math.max(0,Math.floor(v.x/TILE));x<Math.min(s.width,(v.x+W)/TILE);x++){
    const k=y*s.width+x;if(!s.seen[k])continue;const px=x*TILE-v.x,py=y*TILE-v.y,near=Math.hypot(x+.5-s.player.x,y+.5-s.player.y)<4.6;
    if(s.cells[k]){rect(g,px,py,12,12,near?'#3e454a':'#232e37');rect(g,px+1,py,10,2,near?'#758079':'#39484a');rect(g,px+1,py+4,6,3,near?'#56615e':'#303c40');rect(g,px+8,py+6,3,5,near?'#4a5554':'#2a343c');if((x*7+y*3)%11===0)rect(g,px+2,py+9,3,2,'#52695a');}
    else{rect(g,px,py,12,12,near?'#303c3b':'#1d2a30');rect(g,px+1,py+1,10,10,near?'#374240':'#233037');if((x+y)%4===0)rect(g,px+2,py+7,3,1,'#4a544b');}
  }
  // Ariadne's thread records the route walked and unwinds when the player backtracks.
  for(let i=1;i<s.thread.length;i++){const a=s.thread[i-1],b=s.thread[i];line(g,(a%s.width+.5)*TILE-v.x,(Math.floor(a/s.width)+.5)*TILE-v.y,(b%s.width+.5)*TILE-v.x,(Math.floor(b/s.width)+.5)*TILE-v.y,'#887255');}
  for(const seal of s.seals){if(seal.taken||!s.seen[seal.cell])continue;const x=seal.x*TILE-v.x,y=seal.y*TILE-v.y+Math.round(Math.sin(s.time*2));rect(g,x-2,y-3,5,7,'#d6b884');rect(g,x-3,y-1,7,3,'#d6b884');rect(g,x-1,y-1,3,3,'#f3e9bd');}
  const ex=(s.exit%s.width+.5)*TILE-v.x,ey=(Math.floor(s.exit/s.width)+.5)*TILE-v.y;
  if(s.seen[s.exit]){rect(g,ex-5,ey-6,10,12,'#777d6c');rect(g,ex-3,ey-4,6,10,s.collected===3?'#b7ddbf':'#1a2529');for(let i=0;i<3;i++)rect(g,ex-3+i*3,ey-7,2,2,i<s.collected?'#e8d19c':'#565347');}
  const hx=s.hunter.x*TILE-v.x,hy=s.hunter.y*TILE-v.y,px=s.player.x*TILE-v.x,py=s.player.y*TILE-v.y;
  const hCell=Math.floor(s.hunter.y)*s.width+Math.floor(s.hunter.x);
  if(s.seen[hCell]&&Math.hypot(s.hunter.x-s.player.x,s.hunter.y-s.player.y)<6.5)drawHunter(g,s.hunter,hx,hy,s.time);
  if(s.pulse>0){const radius=(.65-s.pulse)*80;for(let a=0;a<6.28;a+=.08)rect(g,px+Math.cos(a)*radius,py+Math.sin(a)*radius,1,1,'#add4ca');}
  drawCat(g,px,py,s.steps,skin);
  // A small compass points at the nearest seal, then the exit. It gives direction, not a route through walls.
  const targets=s.seals.filter(q=>!q.taken),goal=targets.sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0]||{x:s.exit%s.width+.5,y:Math.floor(s.exit/s.width)+.5};
  const angle=Math.atan2(goal.y-s.player.y,goal.x-s.player.x),cx=W-12,cy=12;rect(g,cx-1,cy-1,3,3,'#6b7568');line(g,cx,cy,cx+Math.cos(angle)*6,cy+Math.sin(angle)*6,'#e6c990');
}
