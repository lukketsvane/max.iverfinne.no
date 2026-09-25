/* High Tide uses the garden's native plants, movement, controls and replication.
   All mutable race state belongs to the host; snapshots carry only plain scalars. */
var HIGH_TIDE={height:480,startHeight:24,reach:44,period:26,warning:3,surge:4,growth:10};
var tideLayoutKey='',tideCue='';
function highTideMode(){return !!rogueRun&&rogueRun.mode==='high-tide';}
function singleSeedMode(){return lastSeedMode()||highTideMode();}
function highTideProfile(){return {
  easy:{grace:14,speed:4.5,acceleration:.014,breath:3.2,growth:1.1},
  medium:{grace:10,speed:6.6,acceleration:.026,breath:2.6,growth:1},
  hard:{grace:8,speed:7.5,acceleration:.030,breath:2.3,growth:1},
  insane:{grace:6,speed:8.25,acceleration:.032,breath:2,growth:1}
}[rogueRun.difficulty]||{grace:10,speed:6.6,acceleration:.026,breath:2.6,growth:1};}
function resetHighTide(){
  if(!highTideMode())return;
  var base=Math.round(terrainY(0));
  rogueRun.survival={started:false,elapsed:0,base:base,root:0,waterY:base+30,height:0,best:0,dewMask:0,calm:0,phase:'ready',cycle:0,plantTime:0,escaped:''};
  rogueRun.vital={hp:100,air:highTideProfile().breath,shield:0,revive:0,hurt:0};
  gardenSeeds=1;seedPickups=[];runLoot=[];runEncounters=[];runHazards=[];runExpedition=null;stageWeather=null;
  gardenRaidActive=false;gardenRaidT=0;floatKrek=[];activeStageLayout=null;tideLayoutKey='';tideCue='';
}
function highTidePlant(){return gardenPlots.find(function(p){return p.tideVine&&!p.dead;})||null;}
function startHighTide(p){
  if(!highTideMode()||rogueRun.survival.started)return;
  var s=rogueRun.survival;s.started=true;s.root=p.x;s.plantId=p.id;s.height=HIGH_TIDE.startHeight;s.phase='grace';
  p.tideVine=true;p.tideHeight=s.height;p.growth=.1+s.height/HIGH_TIDE.height*(G_TOP-.1);p.moisture=1;p.health=1;p.stalk=false;
  gardenSeeds=0;runElapsed=0;recordGardenPlant(p);
  showRound('HIGH TIDE','Hold Tend to grow. Release to climb.',2600);
}
function highTidePods(){
  var s=rogueRun.survival;
  return [{x:s.root+48,y:s.base-128,bit:1},{x:s.root-48,y:s.base-272,bit:2},{x:s.root+48,y:s.base-400,bit:4}];
}
function highTideLayout(){
  var s=rogueRun.survival,key=rogueRun.seed+':'+s.root+':'+Math.floor(Math.max(0,s.height-8)/64);
  if(activeStageLayout&&activeStageLayout.tide&&key===tideLayoutKey)return activeStageLayout;
  tideLayoutKey=key;
  var L={stage:1,seed:rogueRun.seed,origin:0,theme:'canopy',kind:'canopy',tide:true,ground:{x0:-1000000,x1:1000000,y:s.base},platforms:[],routes:[],nodes:[],rewards:[],trials:[],bonuses:[],hazards:[],spots:{},blooms:[]};
  for(var h=64;h<s.height-7;h+=64)L.platforms.push({id:'tide-leaf-'+h,x:s.root-16,y:s.base-h,w:32,depth:4,route:1,style:'branch'});
  highTidePods().forEach(function(q,i){L.platforms.push({id:'tide-perch-'+i,x:q.x-16,y:q.y,w:32,depth:5,route:1,style:i===1?'root':'ruin'});});
  L.platforms.push({id:'tide-crown',x:s.root-26,y:s.base-HIGH_TIDE.height,w:52,depth:5,route:1,style:'branch'});
  activeStageLayout=L;return L;
}
function highTideHead(a){return a.p.y-((a.member?a.member.classId:rogueRun.classId)==='sligo'?Math.max(3,sligoHeight(a.p)):18);}
function highTideCarer(a){
  var s=rogueRun.survival,remote=a.member&&a.member.id!==coop.me;
  var held=remote?a.p.tideTend&&performance.now()-a.member.last<500:seedHeld();
  return !!(a.v.hp>0&&held&&(a.p.st==='climb'||a.p.grounded)&&Math.abs(a.p.x-s.root)<15&&
    Math.abs((s.base-s.height)-(a.p.y-8))<=HIGH_TIDE.reach&&highTideHead(a)<s.waterY);
}
function highTideAtSummit(a){
  var s=rogueRun.survival;
  return a.v.hp>0&&s.height>=HIGH_TIDE.height&&Math.abs(a.p.x-s.root)<=27&&
    a.p.y<=s.base-HIGH_TIDE.height+2&&a.p.y>=s.base-HIGH_TIDE.height-30&&
    (a.p.st==='climb'||a.p.grounded)&&highTideHead(a)<s.waterY;
}
function drownHighTide(a){
  a.v.hp=0;a.v.air=0;a.v.revive=0;a.p.vx=a.p.vy=0;a.p.st='rest';a.p.anim='rest';a.p.frame=0;
  if(a.member){a.member.braceUntil=a.member.tunUntil=0;a.member.reviveHeld=false;a.member.dodge=null;}
  if(!a.member||a.member.id===coop.me){task=holdWater=climb=warp=null;clearRunInput();P.st='rest';P.vx=P.vy=0;setAnim('rest');shake=Math.max(shake,2);}
}
function finishHighTide(won,ascender){
  if(rogueRun.ended||coopGuest())return;
  rogueRun.survival.escaped=won?(ascender||'solo'):'';
  if(coop)Object.values(coop.members).forEach(function(m){m.choices=[];m.owed=0;});
  rogueRun.ended=true;rogueRun.won=runWon=!!won;rogueRun.choice=null;runFinishT=0;
  clearRunInput();finalizeRogueRun(!!won);saveGarden();if(won)socialTone('gift');showRunResult();
}
function finalizeHighTide(won){
  gardenPlots.forEach(recordGardenPlant);rogueRun.finalized=true;
  if(!window.MaxRunRecords)return;
  var s=rogueRun.survival,saved=window.MaxRunRecords.save({id:rogueRun.recordId,mode:'high-tide',ownerId:rogueRun.ownerId,name:rogueRun.playerName,classId:rogueRun.classId,won:!!won,plants:rogueRun.garden,world:1,wave:0,seconds:s.elapsed,plantSeconds:s.plantTime,ascent:s.best,goal:HIGH_TIDE.height});
  rogueRun.recordId=saved.record.id;rogueRun.recordSaved=saved.persisted;
}
function updateHighTide(dt){
  if(!highTideMode()||coopGuest()||runIsPaused()||!runActive||!Number.isFinite(dt)||dt<=0)return;
  var s=rogueRun.survival,profile=highTideProfile(),plant=highTidePlant();
  if(!s.started)return;
  if(!plant){finishHighTide(false);return;}
  // Fixed-sized environmental steps preserve warnings, breathing and tide rates at low frame rates.
  for(var left=Math.min(dt,2);left>1e-8&&!rogueRun.ended;){
    var step=Math.min(left,.05);left-=step;
    s.elapsed+=step;s.plantTime+=step;runElapsed=s.elapsed;
    var since=Math.max(0,s.elapsed-profile.grace),phase=since%HIGH_TIDE.period;
    s.cycle=Math.floor(since/HIGH_TIDE.period);
    s.phase=s.elapsed<profile.grace?'grace':phase>=HIGH_TIDE.period-HIGH_TIDE.surge?'surge':phase>=HIGH_TIDE.period-HIGH_TIDE.surge-HIGH_TIDE.warning?'warning':'rise';
    s.calm=Math.max(0,s.calm-step);
    if(s.elapsed>profile.grace)s.waterY-=step*(profile.speed+Math.min(90,since)*profile.acceleration)*(s.phase==='surge'?1.65:1)*(s.calm>0?.45:1);
    var actors=seedActors(),carers=actors.filter(highTideCarer);
    if(carers.length)s.height=Math.min(HIGH_TIDE.height,s.height+step*HIGH_TIDE.growth*profile.growth*(1+Math.min(.24,(carers.length-1)*.12)));
    highTidePods().forEach(function(q){
      if(s.dewMask&q.bit)return;
      var taker=actors.find(function(a){return a.v.hp>0&&Math.hypot(a.p.x-q.x,a.p.y-8-(q.y-8))<13&&highTideHead(a)<s.waterY;});
      if(!taker)return;
      s.dewMask|=q.bit;s.height=Math.min(HIGH_TIDE.height,s.height+24);s.calm=Math.max(s.calm,3);
      taker.v.air=profile.breath;plant.pulse=1.5;
    });
    plant.tideHeight=s.height;plant.growth=.1+s.height/HIGH_TIDE.height*(G_TOP-.1);plant.stalk=s.height>=HIGH_TIDE.height;
    plant.moisture=plant.health=1;plant.age=s.elapsed;plant.pulse=Math.max(0,(plant.pulse||0)-step);recordGardenPlant(plant);
    actors.forEach(function(a){
      if(a.v.hp<=0)return;
      if(!Number.isFinite(a.v.air))a.v.air=profile.breath;
      if(highTideHead(a)>=s.waterY)a.v.air=Math.max(0,a.v.air-step);
      else a.v.air=Math.min(profile.breath,a.v.air+step*2.2);
      if(a.v.air<=1e-8){drownHighTide(a);return;}
      // Only a physically present climber/landing counts, never a grown plant alone.
      s.best=Math.max(s.best,Math.min(HIGH_TIDE.height,Math.max(0,s.base-a.p.y)));
    });
    if(s.waterY<=s.base-HIGH_TIDE.height||actors.every(function(a){return a.v.hp<=0;})){finishHighTide(false);return;}
    var winner=actors.find(highTideAtSummit);if(winner){finishHighTide(true,winner.id);return;}
  }
}
function updateHighTideClimb(dt,inp){
  var c=climb;if(!c){P.st='free';return;}
  var p=gardenPlots.find(function(q){return q.id===c.plantId;});
  if(!p||p.dead||seedDown()){dropClimb();return;}
  c.p=p;c.exit=false;c.t+=dt;c.boost=Math.max(0,c.boost-dt);c.gy=surfaceY(p.x);
  var tending=seedHeld();if(inp&&inp.axis)c.side=inp.axis;
  var want=tending?0:78+(c.boost>0?35:0);c.v=tending?0:approach(c.v,want,200*dt);
  P.y=Math.max(c.gy-p.tideHeight,Math.min(c.gy-1,P.y-c.v*dt*(.6+.4*Math.max(0,Math.sin(c.t*9)))));
  P.x=p.x+plantLean(p,c.gy-P.y+12,tSec)+c.side*3;P.face=-c.side;
  P.vx=P.vy=0;P.grounded=false;P.platform=null;P.coyote=0;jumpBuf=0;
  setAnim('climb');
  if(tending&&Math.random()<dt*12)parts.push({x:P.x,y:P.y-8,vx:P.face*4,vy:-12,l:.35,m:.35,c:'126,174,190'});
}
function placeHighTideMember(m){
  var s=rogueRun.survival,plant=highTidePlant();
  if(!s.started||!plant)return false;
  var h=Math.min(s.height-8,Math.max(0,s.base-P.y)),rung=Math.floor(h/64)*64;
  // Newcomers stand on a real grown branch, never on the now-submerged original soil.
  var y=s.base-rung;
  if(y-18>=s.waterY){rung=Math.floor(Math.max(0,s.height-8)/64)*64;y=s.base-rung;}
  m.avatar=Object.assign(coopAvatar(),{classId:m.classId,skin:m.skin,x:s.root,y:y,vx:0,vy:0,st:'free',anim:'idle',grounded:true,wet:false,tideTend:false});
  m.place=(m.place|0)+1;
  if(y-18>=s.waterY){seedVital(m).hp=0;seedVital(m).air=0;m.avatar.st=m.avatar.anim='rest';}
  relocateSligoMember(m);return true;
}
function highTideText(str,x,y){
  if(!ready(runPixelFont))return;
  for(var i=0;i<str.length;i++){var n=str.charCodeAt(i)-32;if(n>=0&&n<64)ctx.drawImage(runPixelFont,n%16*6,Math.floor(n/16)*8,5,7,Math.round(x+i*6),Math.round(y),5,7);}
}
function drawHighTideWorld(t){
  if(!highTideMode()||!runActive)return;
  var s=rogueRun.survival;
  highTidePods().forEach(function(q){if(s.dewMask&q.bit)return;var x=Math.round(q.x-camX),y=Math.round(q.y-camY-10);ctx.fillStyle='#b8e4dc';ctx.fillRect(x,y-3,1,2);ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#639aa7';ctx.fillRect(x-1,y+2,3,1);});
  var cx=Math.round(s.root-camX),cy=Math.round(s.base-HIGH_TIDE.height-camY-9);
  ctx.fillStyle='#e0d5a0';ctx.fillRect(cx-4,cy+3,9,2);ctx.fillRect(cx-4,cy-1,2,5);ctx.fillRect(cx-1,cy-3,3,7);ctx.fillRect(cx+3,cy-1,2,5);
  if(!s.started){ctx.fillStyle='#9fdbbf';ctx.fillRect(Math.round(-camX)-4,Math.round(s.base-camY)-1,9,1);}
}
function drawHighTideWater(t){
  if(!highTideMode()||!runActive)return;
  var s=rogueRun.survival,y=Math.round(s.waterY-camY),start=Math.max(0,y);
  if(y>IH)return;
  ctx.fillStyle='rgba(10,39,55,.75)';ctx.fillRect(0,start,IW,IH-start);
  ctx.fillStyle='rgba(52,105,120,.42)';ctx.fillRect(0,Math.max(0,y),IW,Math.max(0,Math.min(7,IH-y)));
  ctx.fillStyle=s.phase==='surge'?'#b2d5cf':'#699fac';
  if(y>=0){ctx.fillRect(0,y,IW,1);for(var x=0;x<IW;x+=16){var xx=x+Math.floor(t*9)%16;ctx.fillRect(xx,y+2,5,1);}}
}
function drawHighTideHud(){
  if(!highTideMode()||!runActive||rogueRun.ended)return;
  var s=rogueRun.survival,v=seedVital(),profile=highTideProfile(),top=safeTopArt()+3;
  var cue=s.cycle+':'+s.phase;if(cue!==tideCue){if(s.phase==='warning')chime([220,277,330],.12,.045);if(s.phase==='surge')chime([165,220],.08,.035);tideCue=cue;}
  var head=P.y-(rogueRun.classId==='sligo'?Math.max(3,sligoHeight(P)):18),gap=Math.round(s.waterY-head);
  highTideText('HIGH TIDE  '+Math.round(s.height/HIGH_TIDE.height*100)+'%',7,top);
  if(!s.started){highTideText('TEND TO PLANT',7,top+11);return;}
  highTideText(Math.floor(s.elapsed/60)+':'+String(Math.floor(s.elapsed%60)).padStart(2,'0')+'  WATER '+Math.max(0,gap),7,top+10);
  var line=v.hp<=0?'DROWNED - WATCH YOUR TEAM':s.phase==='warning'?'SURGE IN '+Math.ceil(HIGH_TIDE.period-HIGH_TIDE.surge-(Math.max(0,s.elapsed-profile.grace)%HIGH_TIDE.period)):s.phase==='surge'?'SURGE - KEEP CLIMBING':s.calm>0?'DEW - TIDE SLOWED':s.phase==='grace'?'TIDE IN '+Math.ceil(profile.grace-s.elapsed):'';
  if(line)highTideText(line,7,top+20);
  var hint=P.st==='climb'?(seedHeld()?'RELEASE TO CLIMB':'HOLD TEND TO GROW'):'UP BY STEM TO CLIMB';
  if(v.hp>0)highTideText(hint,7,IH-13);
  var bx=IW-8,by=top+3,bh=Math.min(75,IH-55);
  ctx.fillStyle='#1b3039';ctx.fillRect(bx-2,by-2,5,bh+4);ctx.fillStyle='#9fdbbf';ctx.fillRect(bx,by+bh-Math.round(bh*s.height/HIGH_TIDE.height),1,Math.round(bh*s.height/HIGH_TIDE.height));
  var wh=Math.round(bh*clamp01((s.base-s.waterY)/HIGH_TIDE.height));ctx.fillStyle='#73afbd';ctx.fillRect(bx-1,by+bh-wh,3,1);
  var ph=Math.round(bh*clamp01((s.base-P.y)/HIGH_TIDE.height));ctx.fillStyle='#efe1aa';ctx.fillRect(bx-2,by+bh-ph,5,1);
  if(v.hp>0&&Number.isFinite(v.air)&&v.air<profile.breath-.02){var x=Math.round(P.x-camX)-9,y=Math.round(P.y-camY)-29;ctx.fillStyle='#152028';ctx.fillRect(x-1,y-1,20,4);ctx.fillStyle=v.air<1?'#d78a77':'#a8dce2';ctx.fillRect(x,y,Math.round(18*v.air/profile.breath),2);}
}
