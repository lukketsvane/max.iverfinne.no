/* Night Relay: a two-to-four gardener light heist, not a growing/raid mode.
   Only authenticated room members count. All objectives, heat, light and health
   are host-owned; guests send the same held Tend control as the local player. */
var NIGHT_RELAY={end:1140,reach:25,heat:22,light:150};
var RELAY_LOCKS=[
  {x:276,pad:174,ph:44,door:262,dh:0,name:'THE LOFT'},
  {x:608,pad:508,ph:66,door:592,dh:22,name:'THE CROSSING'},
  {x:940,pad:822,ph:0,door:924,dh:66,name:'THE BELFRY'}
];
var RELAY_LEDGES=[[64,22,38],[110,44,38],[152,44,46],[206,66,38],
  [370,22,40],[416,44,40],[462,66,40],[502,66,44],[560,22,34],
  [770,22,38],[816,44,38],[862,66,38],[904,66,48],[1068,22,58]];
var RELAY_WISPS=[[224,66],[436,44],[720,0],[882,66]];
var RELAY_BEAMS=[{x:352,w:22,offset:0},{x:458,w:24,offset:1.8},{x:686,w:28,offset:.7},{x:748,w:22,offset:2.4},{x:996,w:28,offset:1.3}];
function nightRelayMode(){return !!rogueRun&&rogueRun.mode==='night-relay';}
function relicRunMode(){return singleSeedMode()||nightRelayMode();}
function isolatedRelicMode(){return highTideMode()||nightRelayMode();}
function relayProfile(){return {easy:{drain:.55,heat:28,damage:10},medium:{drain:.8,heat:22,damage:16},hard:{drain:1,heat:19,damage:20},insane:{drain:1.2,heat:16,damage:24}}[rogueRun.difficulty];}
function resetNightRelay(){
  if(!nightRelayMode())return;
  rogueRun.survival={started:false,waiting:true,elapsed:0,base:Math.round(terrainY(0)),stage:0,carrier:'',lastCarrier:'',x:22,y:0,heat:0,energy:100,charge:0,exitCharge:0,passes:0,resets:0,wisps:0,passArmed:true,flash:0,reason:''};
  rogueRun.survival.y=rogueRun.survival.base;
  rogueRun.vital={hp:100,shield:0,revive:0,hurt:0};
  gardenSeeds=0;seedPickups=[];runLoot=[];runEncounters=[];runHazards=[];runExpedition=null;stageWeather=null;
  gardenRaidActive=false;gardenRaidT=0;floatKrek=[];activeStageLayout=null;
}
function nightRelayLayout(){
  var s=rogueRun.survival;
  if(activeStageLayout&&activeStageLayout.relay&&activeStageLayout.gate===s.stage&&activeStageLayout.ground.y===s.base)return activeStageLayout;
  var L={stage:1,seed:rogueRun.seed,origin:0,theme:'ruin',relay:true,gate:s.stage,ground:{x0:-100,x1:1240,y:s.base},platforms:[],routes:[],nodes:[],rewards:[],trials:[],bonuses:[],hazards:[],spots:{},blooms:[]};
  RELAY_LEDGES.forEach(function(p,i){L.platforms.push({id:'relay-'+i,x:p[0],y:s.base-p[1],w:p[2],depth:6,route:1,style:'ruin'});});
  activeStageLayout=L;return L;
}
function relayActors(){return seedActors().filter(function(a){return a.member&&(a.id===coop.me||performance.now()-a.member.last<1500);});}
function relayHeld(a){return a.v.hp>0&&(a.id===coop.me?!!(heldDown||heldSpace||swipeDown):!!a.p.relayTend&&performance.now()-a.member.last<500);}
function relayAt(a,x,h,r){return a.v.hp>0&&a.p.grounded&&Math.abs(a.p.x-x)<(r||17)&&Math.abs(a.p.y-(rogueRun.survival.base-h))<5;}
function relayCheckpoint(){var s=rogueRun.survival;return {x:s.stage?RELAY_LOCKS[s.stage-1].x+24:22,y:s.base};}
function relayConstrain(a){
  if(!nightRelayMode())return;
  var s=rogueRun.survival,limit=s.stage<3?RELAY_LOCKS[s.stage].x-5:NIGHT_RELAY.end;
  var x=Math.max(-35,Math.min(limit,a.x));if(a.x!==x){a.x=x;a.vx=0;}
}
function relayPlace(m){
  var q=relayCheckpoint();m.avatar=Object.assign(coopAvatar(),{classId:m.classId,skin:m.skin,x:q.x+(m.slot-1)*9,y:q.y,vx:0,vy:0,st:'free',anim:'idle',grounded:true,wet:false,relayTend:false});
  relayConstrain(m.avatar);m.place=(m.place|0)+1;relocateSligoMember(m);
}
function relayReturnSeed(penalty){
  var s=rogueRun.survival,q=relayCheckpoint();s.carrier='';s.x=q.x;s.y=q.y;s.heat=0;s.charge=0;s.passArmed=false;
  if(penalty){s.energy=Math.max(0,s.energy-16);s.resets++;s.flash=2;chime([330,220,165],.07,.04);}
}
function relayTake(a,pass){
  var s=rogueRun.survival;s.carrier=a.id;s.heat=0;s.passArmed=false;
  if(pass){s.passes++;chime([523,784],.06,.035);}
  if(!s.started){s.started=true;showRound('NIGHT RELAY','Carry the light. Leave no one behind.',2200);}
}
function relayBeam(b){
  var s=rogueRun.survival,t=(s.elapsed+b.offset)%4.6;
  return !s.started||s.waiting?0:t<2.5?0:t<3.3?1:2;
}
function finishNightRelay(won,reason){
  if(rogueRun.ended||coopGuest())return;
  var s=rogueRun.survival;s.reason=reason||'';
  if(coop)Object.values(coop.members).forEach(function(m){m.choices=[];m.owed=0;});
  rogueRun.ended=true;rogueRun.won=runWon=!!won;rogueRun.choice=null;clearRunInput();finalizeRogueRun(won);saveGarden();
  if(won)socialTone('gift');showRunResult();
}
function finalizeNightRelay(won){
  rogueRun.finalized=true;if(!window.MaxRunRecords)return;
  var s=rogueRun.survival,saved=window.MaxRunRecords.save({id:rogueRun.recordId,mode:'night-relay',ownerId:rogueRun.ownerId,name:rogueRun.playerName,classId:rogueRun.classId,won:!!won,plants:[],world:1,wave:s.stage,seconds:s.elapsed,passes:s.passes,resets:s.resets,light:s.energy,reason:s.reason});
  rogueRun.recordId=saved.record.id;rogueRun.recordSaved=saved.persisted;
}
function updateNightRelay(dt){
  if(!nightRelayMode()||coopGuest()||runIsPaused()||!runActive||rogueRun.ended||!Number.isFinite(dt)||dt<=0)return;
  var s=rogueRun.survival,actors=relayActors(),profile=relayProfile();
  seedActors().forEach(function(a){relayConstrain(a.p);});
  var carrier=actors.find(function(a){return a.id===s.carrier&&a.v.hp>0;});
  if(s.carrier&&!carrier)relayReturnSeed(false);
  s.waiting=actors.length<2;
  // A missing partner pauses the challenge, not the menu or networking. Clones,
  // stale avatars and a second tab of the same member never satisfy two players.
  if(s.waiting){s.charge=0;s.exitCharge=0;return;}
  dt=Math.min(dt,.1);s.flash=Math.max(0,s.flash-dt);
  var held=actors.filter(relayHeld);
  if(!held.length)s.passArmed=true;
  if(!s.carrier){
    var taker=held.find(function(a){return Math.hypot(a.p.x-s.x,a.p.y-s.y)<NIGHT_RELAY.reach;});
    if(taker&&s.passArmed){relayTake(taker,false);carrier=taker;}
  }else if(s.passArmed&&carrier&&relayHeld(carrier)){
    var receiver=held.find(function(a){return a.id!==carrier.id&&Math.hypot(a.p.x-carrier.p.x,a.p.y-carrier.p.y)<NIGHT_RELAY.reach;});
    if(receiver){relayTake(receiver,true);carrier=receiver;}
  }
  if(!s.started)return;
  s.elapsed+=dt;runElapsed=s.elapsed;s.energy=Math.max(0,s.energy-dt*profile.drain);
  if(carrier){s.x=carrier.p.x;s.y=carrier.p.y;s.heat+=dt;if(s.heat>=profile.heat){relayReturnSeed(true);carrier=null;}}
  actors.forEach(function(a){
    a.v.shield=Math.max(0,a.v.shield-dt);a.v.hurt=Math.max(0,a.v.hurt-dt);
    if(a.v.hp<=0){
      var helper=held.find(function(b){return b.id!==a.id&&Math.abs(b.p.vx)<8&&Math.hypot(b.p.x-a.p.x,b.p.y-a.p.y)<25;});
      a.v.revive=helper?Math.min(3,a.v.revive+dt):0;
      if(a.v.revive>=3){a.v.hp=55;a.v.shield=3;a.v.revive=0;a.p.st='free';a.p.anim='idle';}
      return;
    }
    if(Math.hypot(a.p.x-s.x,a.p.y-s.y)>NIGHT_RELAY.light)damageGardener(a.member,5); // soft separation pressure
    else if(a.v.hurt<=0)a.v.hp=Math.min(100,a.v.hp+dt*2);
    RELAY_BEAMS.forEach(function(b){if(relayBeam(b)===2&&Math.abs(a.p.x-b.x)<b.w/2+3&&a.p.y>s.base-14&&damageGardener(a.member,profile.damage))s.energy=Math.max(0,s.energy-3);});
  });
  if(actors.every(function(a){return a.v.hp<=0;})){finishNightRelay(false,'The team fell.');return;}
  RELAY_WISPS.forEach(function(w,i){if(s.wisps&(1<<i))return;var a=actors.find(function(a){return relayAt(a,w[0],w[1],12);});if(a){s.wisps|=1<<i;s.energy=Math.min(100,s.energy+22);a.v.hp=Math.min(100,a.v.hp+25);chime([659,880],.06,.03);}});
  if(s.energy<=0){finishNightRelay(false,'The light went out.');return;}
  if(!carrier||carrier.v.hp<=0){s.charge=0;s.exitCharge=0;return;}
  if(s.stage<3){
    var gate=RELAY_LOCKS[s.stage],operator=held.find(function(a){return a.id!==carrier.id&&relayAt(a,gate.pad,gate.ph);});
    var open=operator&&carrier.id!==s.lastCarrier&&relayAt(carrier,gate.door,gate.dh)&&relayHeld(carrier);
    s.charge=open?Math.min(1.4,s.charge+dt):Math.max(0,s.charge-dt*2);
    if(s.charge>=1.4){
      s.stage++;gardenWave=s.stage;s.lastCarrier=carrier.id;s.charge=0;s.heat=0;s.energy=Math.min(100,s.energy+25);s.flash=1.5;
      actors.forEach(function(a){if(a.v.hp>0)a.v.hp=Math.min(100,a.v.hp+35);});
      chime([392,523,659,784],.07,.045);showRound(s.stage===3?'THE WAY OUT':'LOCK '+s.stage+' / 3','Swap the seed before the next lock.',1800);
    }
  }else{
    var left=held.find(function(a){return relayAt(a,1032,0);}),right=held.find(function(a){return relayAt(a,1100,22);});
    var escaped=left&&right&&left.id!==right.id&&(left.id===carrier.id||right.id===carrier.id)&&actors.every(function(a){return a.v.hp>0&&a.p.x>=972;});
    s.exitCharge=escaped?Math.min(2,s.exitCharge+dt):Math.max(0,s.exitCharge-dt*2);
    if(s.exitCharge>=2)finishNightRelay(true,'Everyone made it home.');
  }
}
function relayRune(x,y,color,active){
  x=Math.round(x-camX);y=Math.round(y-camY);ctx.fillStyle='#151e29';ctx.fillRect(x-12,y-3,25,5);
  ctx.fillStyle=color;ctx.fillRect(x-10,y-2,21,1);ctx.fillRect(x-7,y,15,1);
  ctx.fillRect(x-2,y-7,5,3);ctx.fillRect(x,y-10,1,9);
  if(active){ctx.fillRect(x-13,y-5,1,5);ctx.fillRect(x+13,y-5,1,5);}
}
function drawRelayBackdrop(){
  if(!nightRelayMode())return;
  var s=rogueRun.survival;ctx.fillStyle='#080e18';ctx.fillRect(0,0,IW,IH);
  // Existing cavern and ruin tiles stay on their native pixel grid.
  drawCavernLayers(0,5,Math.round(s.base-camY)-146,0);
  for(var i=-1;i<14;i++){var x=Math.round(i*96-camX*.6),y=Math.round(s.base-camY);ctx.fillStyle='#16202b';ctx.fillRect(x,y-100,9,100);ctx.fillRect(x-3,y-103,15,5);ctx.fillStyle='#0e1722';ctx.fillRect(x+2,y-98,2,96);}
  var gy=Math.round(s.base-camY);ctx.fillStyle='#17242c';ctx.fillRect(0,gy,IW,Math.max(0,IH-gy));ctx.fillStyle='#50615e';ctx.fillRect(0,gy,IW,2);
  for(var x=-((Math.round(camX)%16+16)%16);x<IW;x+=16){ctx.fillStyle='#293b40';ctx.fillRect(x,gy+3,14,3);}
}
function drawNightRelay(t){
  if(!nightRelayMode()||!runActive)return;
  var s=rogueRun.survival,actors=seedActors();
  RELAY_LOCKS.forEach(function(g,i){
    var open=i<s.stage,x=Math.round(g.x-camX),y=Math.round(s.base-camY);
    ctx.fillStyle=open?'#30584e':'#5f6976';ctx.fillRect(x-3,y-112,6,112);ctx.fillStyle='#17232d';ctx.fillRect(x-1,y-109,2,109);
    if(!open){ctx.fillStyle=i===s.stage?'#e2b86d':'#626177';for(var h=8;h<104;h+=10)ctx.fillRect(x-3,y-h,6,2);}
    relayRune(g.pad,s.base-g.ph,open?'#72ae99':'#83bbd5',actors.some(function(a){return relayAt(a,g.pad,g.ph)&&a.p.relayTend;}));
    relayRune(g.door,s.base-g.dh,open?'#72ae99':'#e4bb77',false);
    if(i===s.stage&&s.charge>0){ctx.fillStyle='#e4d9a0';ctx.fillRect(x-8,y-120,Math.round(16*s.charge/1.4),2);}
  });
  RELAY_BEAMS.forEach(function(b){var state=relayBeam(b),x=Math.round(b.x-b.w/2-camX),y=Math.round(s.base-camY);ctx.fillStyle=state===2?'#f1a879':state===1?'#b66c68':'#464753';ctx.fillRect(x,y-1,b.w,2);if(state){for(var k=0;k<b.w;k+=4)ctx.fillRect(x+k,y-(state===2?13:3),2,state===2?12:2);}});
  RELAY_WISPS.forEach(function(w,i){if(s.wisps&(1<<i))return;var x=Math.round(w[0]-camX),y=Math.round(s.base-w[1]-camY-9)-Math.floor(Math.sin(t*3+i)*2);ctx.fillStyle='#91d0d6';ctx.fillRect(x-2,y,5,3);ctx.fillRect(x,y-2,1,7);ctx.fillStyle='#e6edc4';ctx.fillRect(x,y,1,1);});
  relayRune(1032,s.base,'#83bbd5',false);relayRune(1100,s.base-22,'#e4bb77',false);
  var x=Math.round(s.x-camX),y=Math.round(s.y-camY)-(s.carrier?27:9),hot=s.heat>relayProfile().heat*.72;
  ctx.fillStyle=hot?'#e28b68':'#f0d997';ctx.fillRect(x-2,y-3,5,7);ctx.fillRect(x-4,y-1,9,3);ctx.fillStyle='#fff3c9';ctx.fillRect(x-1,y-1,3,3);
  if(s.carrier){ctx.fillStyle='#1d2830';ctx.fillRect(x-10,y-8,20,2);ctx.fillStyle=hot?'#e28b68':'#94bac7';ctx.fillRect(x-10,y-8,Math.round(20*s.heat/relayProfile().heat),2);}
  actors.forEach(function(a){if(a.v.hp>=99)return;var x=Math.round(a.p.x-camX)-9,y=Math.round(a.p.y-camY)-38;ctx.fillStyle='#14212b';ctx.fillRect(x-1,y-1,20,4);ctx.fillStyle=a.v.hp?'#8eb4ac':'#dcad81';ctx.fillRect(x,y,Math.round(18*(a.v.hp?a.v.hp/100:a.v.revive/3)),2);});
  if(s.exitCharge>0){ctx.fillStyle='#e4d9a0';ctx.fillRect(Math.round(1020-camX),Math.round(s.base-7-camY),Math.round(90*s.exitCharge/2),2);}
}
function drawRelayDarkness(){
  if(!nightRelayMode()||!runActive)return;
  var s=rogueRun.survival,cx=s.x-camX,cy=s.y-camY-16;
  // Stepped translucent rings, not a black blindfold: the route always reads.
  for(var y=0;y<IH;y+=12)for(var x=0;x<IW;x+=12){var d=Math.hypot(x+6-cx,y+6-cy);if(d<65)continue;ctx.fillStyle=d>160?'rgba(3,7,16,.46)':d>110?'rgba(3,7,16,.26)':'rgba(3,7,16,.12)';ctx.fillRect(x,y,12,12);}
}
function drawNightRelayHud(){
  if(!nightRelayMode()||!runActive||rogueRun.ended)return;
  var s=rogueRun.survival,y=safeTopArt()+3,id=coop&&coop.me,v=seedVital(),hint;
  highTideText('NIGHT RELAY',7,y);highTideText(s.stage+'/3',IW-25,y);
  hint=s.waiting?'WAITING FOR A PARTNER':!s.started?'TEND BESIDE THE LIGHT':v.hp<=0?'DOWN - PARTNER CAN REVIVE':s.flash>1.5?'TOO HOT - LIGHT RETURNED':s.stage===3?'BOTH EXIT RUNES - HOLD TEND':s.carrier===s.lastCarrier&&s.lastCarrier?'SWAP THE LIGHT':s.heat>relayProfile().heat*.72?'TOO HOT - BOTH HOLD TEND':s.carrier===id?'GOLD RUNE - HOLD TEND':s.carrier?'BLUE RUNE - HOLD TEND':'TEND TO PICK UP LIGHT';
  var maxChars=Math.max(10,Math.floor((IW-14)/6)),lines=[''];
  hint.split(' ').forEach(function(word){var i=lines.length-1;if(lines[i].length+word.length+1>maxChars)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;});
  lines.forEach(function(line,i){highTideText(line,7,y+18+i*9);});
  var w=IW-14;ctx.fillStyle='#27313c';ctx.fillRect(7,y+10,w,2);ctx.fillStyle=s.energy<25?'#e39877':'#e9cb86';ctx.fillRect(7,y+10,Math.round(w*s.energy/100),2);
  if(s.stage<3){var g=RELAY_LOCKS[s.stage],target=s.carrier===id?g.door:g.pad,dx=target-P.x;if(Math.abs(dx)>IW*.38)highTideText(dx>0?'>':'<',dx>0?IW-12:5,Math.round(IH*.5));}
}
