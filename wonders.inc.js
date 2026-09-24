var WONDERS={lights:'Firefly order',plates:'Twin plates',perch:'High lantern',crack:'Cracked stone',rune:'Rune plot',dig:'Buried relic',stars:'Three stars',bells:'Bell stones',echo:'Echo stone',well:'Moon well',crown:'Crown relic',clover:'Four-leaf clover',
  trader:'Trader rover',fledgling:'Lost fledgling',bee:'Hurt bee',ghost:'Rival gardener',beetle:'Sleeping beetle',statue:'Riddle statue',flock:'Storm flock',robot:'Broken robot',
  shovel:'Old shovel',grove:'Secret garden',vault:'Seed vault',meadow:'Moonlit meadow',cavern:'Root cavern',rush:'Boss-rush door'};
var WONDER_PUZZLES=['lights','plates','perch','crack','rune','dig','stars','bells','echo'],WONDER_MEETS=['trader','fledgling','bee','ghost','beetle','statue','flock','robot'],WONDER_LEVELS=['grove','vault','meadow','cavern','rush'];
var wonders={world:0,seed:0,t:0,fc:0,last:'',next:'',special:''},wonderRun=null,wonderLand=[],wonderHold={};
var WONDER_INK={s:'#3d4552',S:'#5b6472',m:'#4f6b3a',M:'#6f8a4a',b:'#cfc6a8',k:'#1c1a22',y:'#d9c27a',w:'#5a4632',g:'#34472e',G:'#4d6640',e:'#d8b24a',r:'#8a8f98',R:'#555a63',v:'#6d7690'};
var WONDER_ART={
  stone:['.sss.','sSSSs'],lit:['.yyy.','sSSSs'],plate:['sSSSSSs'],down:['sssssss'],
  lantern:['.sss.','.kyk.','.kyk.','.sss.','..s..'],dark:['.sss.','.kkk.','.kkk.','.sss.','..s..'],
  crack:['.SSs.','SskSs','sSkSs','ssSss'],rune:['.w.','wbw','.w.','.w.'],mound:['..www..','.wwwww.','wwwwwww'],
  tablet:['.sss.','sbSbs','sSbSs','sbSSs','sssss'],bell:['.S.','SsS','sss'],drum:['.SSS.','SkSkS','sssss'],
  well:['s.....s','sS...Ss','sssssss','sSbbbSs','sssssss'],crown:['y.y.y','yyyyy'],clover:['M.M','.m.','M.M','.m.'],
  rover:['...rr....','.rrRRrr..','rRRbbRRrr','rRRRRRRRr','.k.k.k.k.'],fledgling:['.k.','bSb','.S.'],bee:['e.e','kek','.k.'],
  beetle:['...gggg...','.gGGGGgg..','gGGgggGGgk','gggggggggk','.k.k..k.k.'],statue:['.sss.','sbskS','.sSs.','.sSs.','sssss'],
  robot:['.rrr.','rkRkr','rRRRr','R.r.R','k...k'],gate:['..sss..','.sSkSs.','sSkkkSs','sSkkkSs','sSkkkSs','sSkkkSs','sSkkkSs','sssssss'],
  ghost:['.vv.','vvvv','.vv.','vvvv','v..v','v..v'],flag:['yyy','y..','y..','s..','s..','s..'],nest:['w.w.w','.www.'],
  shovel:['...w','..w.','.w..','SS..','SS..'],cache:['wwww','wyyw','wwww'],
  seed:['m'],drop:['.v.','vvv','.v.'],sprout:['M.M','.m.','.m.'],bar:['bbb']
};
function wonderDraw(name,x,y,f){
  var rows=WONDER_ART[name],h=rows.length,w=rows[0].length,ox=Math.round(x-camX)-(w>>1),oy=Math.round(y-camY)-h;
  for(var r=0;r<h;r++)for(var c=0;c<w;c++){var ch=rows[r][f<0?w-1-c:c];if(ch==='.')continue;ctx.fillStyle=WONDER_INK[ch];ctx.fillRect(ox+c,oy+r,1,1);}
}
function wonderRoll(n){return secretHash(wonders.seed,wonders.world*131+n);}
function wonderGround(n,spread){var w=worldLevel(),side=wonderRoll(n)<.5?-1:1;return Math.round(dryX(levelOriginX(w)+side*(50+wonderRoll(n+1)*(spread||150))));}
function wonderPerch(k){
  var l=typeof stageLayout==='function'?stageLayout():null,ps=l&&l.platforms?l.platforms.filter(function(p){return !p.place;}).sort(function(a,b){return a.y-b.y;}):[];
  var p=ps[Math.min(k,ps.length-1)];return p?{x:p.x+Math.floor(p.w/2),y:p.y}:null;
}
function wonderOn(x,y,r){return runPlayers().some(function(a){return Math.abs(a.p.x-x)<(r||8)&&Math.abs(a.p.y-y)<7&&Math.abs(a.p.vy||0)<30;});}
function wonderStill(x,y,r){return runPlayers().some(function(a){return Math.abs(a.p.x-x)<(r||8)&&Math.abs(a.p.y-y)<7&&Math.abs(a.p.vx||0)<1&&Math.abs(a.p.vy||0)<30;});}
function markWonder(id){
  if(!Object.hasOwn(WONDERS,id))return;var m=rogueMeta.wonders||(rogueMeta.wonders={});m[id]=(m[id]|0)+1;
  try{localStorage.setItem('max-fuglesprenger-meta-v1',JSON.stringify(rogueMeta));}catch(e){}
}
function wonderLog(){var m=rogueMeta.wonders||{};return Object.keys(WONDERS).map(function(id){return {id:id,name:WONDERS[id],found:(m[id]|0)>0};});}
function foundWonder(id,x,y,seeds,levels){
  wonders.last=id;wonders.fc++;markWonder(id);(rogueRun.found||(rogueRun.found=[])).push(id);
  if(seeds)spawnLooseSeeds(x,y-10,seeds,true);
  for(var i=0;i<(levels|0);i++)grantRogueLevel();
  gardenAction(250,12,WONDERS[id].toUpperCase());chime([784,988,1319,1568],.07,.04);
}
function rollWonders(){
  var w=worldLevel(),boss=w%5===0;
  wonders.world=w;wonders.t=0;wonderLand=[];wonderHold={};
  wonders.special=wonders.next||'';wonders.next='';
  wonders.pz='';wonders.pzs=0;wonders.pzt=0;wonders.pzd=0;
  var ultra=wonderRoll(1);
  if(w>1&&!boss){
    if(ultra<1/50)wonders.pz='well';else if(ultra<1/50+1/80)wonders.pz='crown';else if(ultra<1/50+1/80+1/120)wonders.pz='clover';
    else if(wonderRoll(2)<.7)wonders.pz=WONDER_PUZZLES[Math.floor(wonderRoll(3)*WONDER_PUZZLES.length)];
  }
  var perch=wonderPerch(0);
  wonders.pzx=wonderGround(4);wonders.pzy=surfaceY(wonders.pzx);
  if(wonders.pz==='perch'){if(perch){wonders.pzx=perch.x;wonders.pzy=perch.y;}else wonders.pz='dig';}
  wonders.pzo=Math.floor(wonderRoll(6)*6);wonders.pzq=['bomb','plant','still'][Math.floor(wonderRoll(7)*3)];
  wonders.en='';wonders.ens=0;wonders.ent=0;wonders.end=0;
  if(w>1&&!boss&&wonderRoll(8)<.45)wonders.en=WONDER_MEETS[Math.floor(wonderRoll(9)*WONDER_MEETS.length)];
  wonders.enx=wonderGround(10,190);if(Math.abs(wonders.enx-wonders.pzx)<60)wonders.enx=Math.round(dryX(wonders.pzx+(wonders.enx<wonders.pzx?-70:70)));
  wonders.eny=surfaceY(wonders.enx);wonders.enh=wonders.enx;wonders.ena=20+Math.round(wonderRoll(11)*40);
  wonders.enf=Math.round(dryX(wonders.enx+(wonderRoll(12)<.5?-1:1)*170));wonders.enq=['bomb','plant','still'][Math.floor(wonderRoll(13)*3)];
  wonders.gate='';wonders.gt=0;var gp=wonderPerch(1)||perch;
  if(gp&&w>=2&&w<=18&&!boss&&!wonders.special&&wonderRoll(14)<.2){
    var pool=WONDER_LEVELS.filter(function(id){return id!=='rush'||w%5===2||w%5===3;});
    wonders.gate=pool[Math.floor(wonderRoll(15)*pool.length)];wonders.gx=gp.x;wonders.gy=gp.y;
  }
  wonders.rush=0;wonders.spt=0;wonders.bc=0;wonders.b1=wonderGround(80,200);wonders.b2=wonderGround(82,200);
  wonders.sh=!rogueRun.shovel&&!coop&&ownClass().id==='bulwark'&&w>=2&&!boss&&(wonderRoll(84)<.35||w===12)?wonderGround(85,120):0;
  if(wonders.special)startSpecial(wonders.special);
}
function startSpecial(id){
  var l=typeof stageLayout==='function'?stageLayout():null,spots=l?(l.rewards||[]).concat(l.bonuses||[]):[];
  foundWonder(id,P.x,P.y,0,0);
  if(id==='grove')spots.forEach(function(s){spawnLooseSeeds(s.x,s.y-8,2,true);});
  if(id==='vault'){runEncounters.forEach(function(e){e.type='cache';e.cost=0;});spots.forEach(function(s,i){dropRunItem(i%2?'dew':'embers',s.x,s.y-12);});}
  if(id==='meadow'){secrets.event='moon';secrets.starAt=secrets.t+8;secrets.star=0;secrets.wished=0;}
  if(id==='cavern')spots.forEach(function(s){dropRunItem('dew',s.x,s.y-12);spawnLooseSeeds(s.x,s.y-8,1,true);});
  if(id==='rush'){var w=worldLevel(),k=makeStageBoss(w<10?5:w<15?10:15);if(k){floatKrek.push(k);wonders.rush=1;}}
}
function updateWonders(dt){
  if(!runActive||rogueRun.ended||coopGuest())return;
  if(wonderRun!==rogueRun){wonderRun=rogueRun;wonders.seed=secretSeedFor(rogueRun)^0x5bd1e995;wonders.world=0;wonders.next='';wonders.special='';}
  if(wonders.world!==worldLevel())rollWonders();
  wonders.t+=dt;var sy=wonders.pzy;wonders.hop=0;runPlayers().forEach(function(a,i){var on=Math.abs(a.p.x-wonders.pzx)<6&&Math.abs(a.p.y-sy)<4;if(on&&wonderLand[i])wonders.hop=1;wonderLand[i]=a.p.y<sy-10?true:on?false:wonderLand[i];});
  updatePuzzle(dt);updateMeeting(dt);updateSpecial(dt);
  if(wonders.sh&&!rogueRun.shovel&&ownClass().id==='bulwark'&&Math.abs(P.x-wonders.sh)<8&&Math.abs(P.y-surfaceY(wonders.sh))<6){rogueRun.shovel=true;foundWonder('shovel',P.x,P.y,0,0);wonders.sh=0;}
  if(wonders.gate&&!wonders.next){
    wonderHold.gate=wonderStill(wonders.gx,wonders.gy,7)?(wonderHold.gate||0)+dt:0;
    if(wonderHold.gate>=1.5){wonders.next=wonders.gate;wonders.gt=wonders.t;chime([392,523,659,784],.12,.05);gardenAction(150,8,'A DOOR OPENS');}
  }
}
function wonderDone(seeds,levels){wonders.pzd=Math.max(.01,wonders.t);foundWonder(wonders.pz,wonders.pzx,wonders.pzy,seeds,levels);}
function updatePuzzle(dt){
  var z=wonders.pz,x=wonders.pzx,y=wonders.pzy;if(!z||wonders.pzd)return;
  if(z==='lights'){
    var order=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]][wonders.pzo],on=[-26,0,26].findIndex(function(o){return wonderOn(x+o,surfaceY(x+o),5);});
    if(on>=0&&on!==wonders.pzl){if(on===order[wonders.pzs])wonders.pzs++;else if(order.indexOf(on)>=wonders.pzs)wonders.pzs=on===order[0]?1:0;}
    wonders.pzl=on;if(wonders.pzs>=3)wonderDone(3,0);
  }else if(z==='plates'){
    var a=wonderOn(x-40,surfaceY(x-40),5),b=wonderOn(x+40,surfaceY(x+40),5);
    if(a&&b)wonderDone(3,1);
    else if(a||b){var side=a?1:2;if(wonders.pzt>0&&wonders.pzs&&wonders.pzs!==side)wonderDone(3,1);else{wonders.pzs=side;wonders.pzt=4;}}
    else if((wonders.pzt-=dt)<=0)wonders.pzs=0;
  }else if(z==='perch'||z==='dig'||z==='well'||z==='crown'){
    wonderHold.pz=(z==='perch'?wonderOn(x,y,6):wonderStill(x,y,6))?(wonderHold.pz||0)+dt:0;
    if(wonderHold.pz>={perch:2,dig:3,well:3,crown:4}[z])wonderDone(z==='well'?4:z==='crown'?6:2,z==='well'?3:z==='crown'?2:(wonderRoll(20)<.35?1:0));
  }else if(z==='rune'){
    if(gardenPlots.some(function(p){return !p.dead&&Math.abs(p.x-x)<10&&p.growth>=.5;}))wonderDone(3,1);
  }else if(z==='stars'){
    if(wonders.pzt>0){wonders.pzt-=dt;if(wonders.pzt<=0)wonders.pzs=0;}
    else if(wonderOn(x,y,20))wonders.pzt=10;
  }else if(z==='bells'){
    if(wonders.pzt>0&&(wonders.pzt-=dt)<=0)wonders.pzs=0;
  }else if(z==='echo'){
    if(wonders.hop){wonders.pzs=wonders.pzt>0?wonders.pzs+1:1;wonders.pzt=5;chime([392+wonders.pzs*131],.1,.04);}
    if(wonders.pzt>0&&(wonders.pzt-=dt)<=0)wonders.pzs=0;
    if(wonders.pzs>=3)wonderDone(3,0);
  }
}
function wonderStarPos(i){return {x:Math.round(IW*(.18+.64*wonderRoll(30+i))),y:Math.round(safeTopArt()+14+IH*.16*wonderRoll(40+i))};}
function wonderTapIndex(wx,wy){
  var sx=wx-camX,sy=wy-camY;
  if(wonders.pz==='stars'&&!wonders.pzd&&wonders.pzt>0)for(var i=0;i<3;i++){var q=wonderStarPos(i);if(!(wonders.pzs&1<<i)&&Math.hypot(sx-q.x,sy-q.y)<14)return i;}
  if(wonders.pz==='clover'&&!wonders.pzd&&Math.hypot(wx-wonders.pzx,wy-wonders.pzy+2)<10)return 9;
  return -1;
}
function wonderTap(wx,wy){
  if(!runActive||wonders.world!==worldLevel())return false;
  var i=wonderTapIndex(wx,wy);if(i<0)return false;
  if(coopGuest()){coopAction('wonder',{k:i});return true;}
  return wonderTapHost(i);
}
function wonderTapHost(i){
  if(wonders.pz==='clover'&&i===9&&!wonders.pzd){wonderDone(7,1);return true;}
  if(wonders.pz!=='stars'||wonders.pzd||wonders.pzt<=0||!(i>=0&&i<3)||wonders.pzs&1<<i)return false;
  wonders.pzs|=1<<i;chime([1047+i*262],.08,.03);if(wonders.pzs===7)wonderDone(3,1);return true;
}
function wonderBlast(x,y){
  if(coopGuest()||!runActive||wonders.world!==worldLevel())return;
  var z=wonders.pz,px=wonders.pzx;
  if(z==='crack'&&!wonders.pzd&&Math.abs(x-px)<18&&Math.abs(y-wonders.pzy)<24)wonderDone(4,0);
  if(z==='bells'&&!wonders.pzd)[-30,0,30].forEach(function(o,i){if(Math.abs(x-px-o)<14&&Math.abs(y-surfaceY(px+o))<24&&!(wonders.pzs&1<<i)){wonders.pzs|=1<<i;wonders.pzt=12;chime([523+i*196],.2,.04);}});
  if(z==='bells'&&wonders.pzs===7&&!wonders.pzd)wonderDone(3,1);
  if(wonders.en==='beetle'&&!wonders.end&&!wonders.ens&&Math.abs(x-wonders.enx)<45)wakeBeetle();
  if(wonders.en==='statue'&&!wonders.end&&wonders.enq==='bomb'&&Math.abs(x-wonders.enx)<24)meetDone(2,1);
}
function meetDone(seeds,levels){wonders.end=Math.max(.01,wonders.t);foundWonder(wonders.en,wonders.enx,wonders.eny,seeds,levels);}
function wakeBeetle(){
  wonders.ens=2;wonders.end=Math.max(.01,wonders.t);markWonder('beetle');chime([196,165,131],.12,.05);
  for(var i=0;i<2&&floatKrek.length<MAX_ACTIVE_ENEMIES;i++){var k=makeKrek(i?1:-1,true);safeEnemyPosition(k,wonders.enx+(i?20:-20),wonders.eny-24);floatKrek.push(k);}
}
function updateMeeting(dt){
  var e=wonders.en,x=wonders.enx;if(!e||wonders.end||wonders.t<(e==='flock'?wonders.ena:0))return;
  if(e==='trader'){
    wonderHold.en=wonderStill(x,wonders.eny,12)&&gardenSeeds>=3?(wonderHold.en||0)+dt:0;
    if(wonderHold.en>=1.5){gardenSeeds-=3;updateGardenHud();meetDone(0,1);}
  }else if(e==='fledgling'){
    var near=null,nd=14;runPlayers().forEach(function(a){var d=Math.abs(a.p.x-x);if(d<nd&&Math.abs(a.p.y-wonders.eny)<30){near=a;nd=d;}});
    if(near||wonders.ens){wonders.ens=1;var t=null,td=1e9;runPlayers().forEach(function(a){var d=Math.abs(a.p.x-x);if(d<td){td=d;t=a;}});if(t&&td>8)x+=Math.sign(t.p.x-x)*Math.min(td-8,60*dt);}
    wonders.enx=Math.round(x*10)/10;wonders.eny=surfaceY(x);if(Math.abs(x-wonders.enf)<10)meetDone(3,0);
  }else if(e==='bee'||e==='robot'){
    wonderHold.en=wonderStill(x,wonders.eny,12)?(wonderHold.en||0)+dt:0;
    if(wonderHold.en>=(e==='bee'?2:3)){
      gardenPlots.forEach(function(p){if(p.dead)return;if(e==='bee'&&Math.abs(p.x-x)<90){p.growth+=.25;p.health=clamp01(p.health+.2);p.pulse=1;}if(e==='robot')p.moisture=1;});
      meetDone(e==='bee'?1:2,0);
    }
  }else if(e==='ghost'){
    if(!wonders.ens&&wonderOn(x,wonders.eny,16))wonders.ens=1;
    if(wonders.ens===1){
      var dir=Math.sign(wonders.enf-x);x+=dir*64*dt;wonders.enx=Math.round(x*10)/10;wonders.eny=surfaceY(x);
      if(wonderOn(wonders.enf,surfaceY(wonders.enf),8))meetDone(2,1);
      else if(Math.abs(x-wonders.enf)<4){wonders.ens=3;wonders.end=Math.max(.01,wonders.t);markWonder('ghost');}
    }
  }else if(e==='beetle'){
    var fast=(WALK_V+RUN_V)/2,loud=runPlayers().some(function(a){return Math.abs(a.p.x-x)<50&&Math.abs(a.p.vx||0)>fast;});
    if(loud)wakeBeetle();
    else{var cx=x+(wonders.enf>x?18:-18);wonderHold.en=wonderOn(cx,surfaceY(cx),6)?(wonderHold.en||0)+dt:0;if(wonderHold.en>=1)meetDone(4,0);}
  }else if(e==='statue'){
    if(wonders.enq==='plant'&&gardenPlots.some(function(p){return !p.dead&&Math.abs(p.x-x)<20&&p.age<wonders.t;}))meetDone(2,1);
    if(wonders.enq==='still'){wonderHold.en=wonderStill(x,wonders.eny,10)?(wonderHold.en||0)+dt:0;if(wonderHold.en>=4)meetDone(2,1);}
  }else if(e==='flock'){
    for(var i=0;i<6;i++){var fx=dryX(P.x-90+i*36);spawnLooseSeeds(fx,surfaceY(fx)-60,1,true);}
    meetDone(0,0);
  }
}
function updateSpecial(dt){
  var s=wonders.special;if(!s)return;
  if(s==='grove')gardenPlots.forEach(function(p){if(!p.dead&&p.moisture<.5)p.moisture=.5;});
  if(s==='meadow'&&secrets.wished&&secrets.t-secrets.wished>6){secrets.wished=0;secrets.star=0;secrets.starAt=secrets.t+18;}
  if(s==='cavern'&&(wonders.spt-=dt)<=0){
    wonders.spt=10;var live=gardenPlots.filter(function(p){return !p.dead;}),p=live[Math.floor(wonderRoll(60+Math.floor(wonders.t))*live.length)];
    if(p&&rogueRun.clearedWorld!==worldLevel())addRunHazard('root',p.x,14,1.2,.35,p.x,surfaceY(p.x)-30,surfaceY(p.x));
  }
  if(s==='rush'&&wonders.rush===1&&!liveBoss()){wonders.rush=2;foundWonder('rush',P.x,P.y,4,2);}
}
function wonderSync(s){
  var next=coopPlain(s);
  if(next.fc>(wonders.fc|0)&&next.world===worldLevel()){markWonder(next.last);chime([784,988,1319,1568],.07,.04);}
  wonders=next;wonderRun=rogueRun;
}
function drawWonders(t){
  drawTunnels();
  if(wonders.world!==worldLevel())return;
  var z=wonders.pz,x=wonders.pzx,y=wonders.pzy,done=!!wonders.pzd,blink=(t*2|0)&1;
  if(z==='lights'){var order=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]][wonders.pzo],show=Math.floor(t%6/1.2);[-26,0,26].forEach(function(o,i){var lit=done||order.indexOf(i)<wonders.pzs||(show<3&&order[show]===i);wonderDraw(lit?'lit':'stone',x+o,surfaceY(x+o));});}
  if(z==='plates')[-40,40].forEach(function(o,i){wonderDraw(done||wonders.pzs===i+1?'down':'plate',x+o,surfaceY(x+o));});
  if(z==='perch')wonderDraw(done?'lantern':'dark',x,y);
  if(z==='crack'&&!done)wonderDraw('crack',x,y);
  if(z==='rune')wonderDraw('rune',x,y);
  if((z==='dig'||z==='crown')&&!done)wonderDraw('mound',x,y);
  if(z==='crown'&&done&&wonders.t-wonders.pzd<4)wonderDraw('crown',x,y-4);
  if(z==='well')wonderDraw('well',x,y);
  if(z==='clover'&&!done)wonderDraw('clover',x,y);
  if(z==='stars'){wonderDraw('tablet',x,y);if(!done&&wonders.pzt>0)for(var i=0;i<3;i++)if(!(wonders.pzs&1<<i)&&((t*3+i)|0)%4){var q=wonderStarPos(i);ctx.fillStyle='#e8dca0';ctx.fillRect(q.x,q.y,1,1);ctx.fillRect(q.x-1,q.y,1,1);ctx.fillRect(q.x+1,q.y,1,1);ctx.fillRect(q.x,q.y-1,1,1);ctx.fillRect(q.x,q.y+1,1,1);}}
  if(z==='bells')[-30,0,30].forEach(function(o,i){wonderDraw('bell',x+o,surfaceY(x+o)-((wonders.pzs&1<<i)&&blink?1:0));});
  if(z==='echo')wonderDraw('drum',x,y);
  var e=wonders.en,ex=wonders.enx,ey=wonders.eny;
  if(e&&(wonders.t>=(e==='flock'?wonders.ena:0))){
    var gone=wonders.end&&wonders.t-wonders.end>3;
    if(e==='trader'&&!gone){wonderDraw('rover',ex,ey,1);if(!wonders.end)for(var s=0;s<3;s++)wonderDraw('seed',ex-2+s*2,ey-8);}
    if(e==='fledgling'){wonderDraw('nest',wonders.enf,surfaceY(wonders.enf));if(!gone)wonderDraw('fledgling',ex,ey-(blink&&wonders.ens?1:0));}
    if(e==='bee'&&!gone)wonderDraw('bee',ex,ey-(wonders.end?Math.min(40,(wonders.t-wonders.end)*20):0));
    if(e==='ghost'&&wonders.ens!==3&&!gone){ctx.globalAlpha=.55;wonderDraw('ghost',ex,ey,Math.sign(wonders.enf-ex));ctx.globalAlpha=1;wonderDraw('flag',wonders.enf,surfaceY(wonders.enf));}
    if(e==='beetle'&&wonders.ens!==2){wonderDraw('beetle',ex,ey,wonders.enf>ex?-1:1);if(!wonders.end){var cx=ex+(wonders.enf>ex?18:-18);wonderDraw('mound',cx,surfaceY(cx));}}
    if(e==='statue'){wonderDraw('statue',ex,ey);if(!wonders.end&&blink)wonderDraw(wonders.enq==='bomb'?'drop':wonders.enq==='plant'?'sprout':'bar',ex,ey-8);}
    if(e==='robot')wonderDraw('robot',ex,ey,wonders.end?1:-1);
    if(e==='flock'&&wonders.t-wonders.ena<4)for(var b=0;b<7;b++){var bx=P.x-120+b*14+(wonders.t-wonders.ena)*70,by=surfaceY(P.x)-90-(b%3)*6;ctx.fillStyle='#1c1a22';ctx.fillRect(Math.round(bx-camX),Math.round(by-camY),1,1);ctx.fillRect(Math.round(bx-camX)-1,Math.round(by-camY)-1,1,1);ctx.fillRect(Math.round(bx-camX)+1,Math.round(by-camY)-1,1,1);}
  }
  if(wonders.gate&&!wonders.next){var near=Math.abs(P.x-wonders.gx)<60;if(near||blink)wonderDraw('gate',wonders.gx,wonders.gy);}
}
var tunnels={w:0,s:[]};
function canBurrow(){return !!(rogueRun.shovel&&!coop&&P.st==='free'&&P.grounded&&!P.wet&&!P.platform&&!climb&&!warp&&Math.abs(P.y-surfaceY(P.x))<=4&&!waterAt(P.x)&&!parryable(P.x,P.y)&&!floatKrek.some(function(k){return k.hp>0&&Math.abs(k.x-P.x)<40&&Math.abs(k.y-P.y)<40;}));}
function startBurrow(){
  P.st='burrow';P.vx=P.vy=0;P.y=surfaceY(P.x)+12;P.brace=0;burrowCarve();setAnim('idle');chime([131,98],.08,.05);
  for(var i=0;i<14;i++)parts.push({x:P.x+(Math.random()-.5)*10,y:surfaceY(P.x)-1,vx:(Math.random()-.5)*50,vy:-20-Math.random()*40,l:.6,m:.6,c:'90,70,50'});
  return true;
}
function burrowCarve(){
  if(tunnels.w!==worldLevel())tunnels={w:worldLevel(),s:[]};
  var x=Math.round(P.x),last=tunnels.s[tunnels.s.length-1];
  if(last&&x>=last[0]-3&&x<=last[1]+3){last[0]=Math.min(last[0],x-5);last[1]=Math.max(last[1],x+5);}else if(tunnels.s.length<40)tunnels.s.push([x-5,x+5]);
}
function updateBurrow(dt,inp){
  P.vx=(inp.axis||0)*WALK_V*.8;var nx=P.x+P.vx*dt;if(!waterAt(nx))P.x=nx;else P.vx=0;
  if(P.vx)P.face=P.vx>0?1:-1;P.y=surfaceY(P.x)+12;P.vy=0;P.grounded=true;P.platform=null;burrowCarve();
  var a=P.vx?'run':'idle';if(P.anim!==a)setAnim(a);
  [wonders.b1,wonders.b2].forEach(function(bx,i){if(bx&&!(wonders.bc&1<<i)&&Math.abs(P.x-bx)<5){wonders.bc|=1<<i;spawnLooseSeeds(bx,surfaceY(bx)-8,3,true);chime([659,784,988],.06,.035);}});
  if(jumpBuf>0){jumpBuf=0;burrowErupt();}
}
function burrowErupt(){
  P.st='free';P.y=surfaceY(P.x);P.vy=JUMP_V*1.15;P.grounded=false;setAnim('rise');
  floatKrek.forEach(function(k){if(k.hp>0&&Math.abs(k.x-P.x)<28&&k.y>P.y-60)damagePest(k,2,P.x);});
  for(var i=0;i<20;i++)parts.push({x:P.x+(Math.random()-.5)*12,y:P.y-2,vx:(Math.random()-.5)*60,vy:-30-Math.random()*50,l:.7,m:.7,c:'90,70,50'});
  shake=Math.min(3,shake+1.5);chime([196,262],.05,.06);
}
function drawTunnels(){
  if(tunnels.w===worldLevel())tunnels.s.forEach(function(s){for(var x=s[0];x<=s[1];x++){var sx=Math.round(x-camX);if(sx<-1||sx>IW)continue;ctx.fillStyle='#16110d';ctx.fillRect(sx,Math.round(surfaceY(x)+3-camY),1,11);}});
  if(wonders.world!==worldLevel())return;
  if(P.st==='burrow'||tunnels.w===worldLevel())[wonders.b1,wonders.b2].forEach(function(bx,i){if(bx&&!(wonders.bc&1<<i)&&(P.st==='burrow'&&Math.abs(P.x-bx)<50))wonderDraw('cache',bx,surfaceY(bx)+12);});
  if(wonders.sh&&!rogueRun.shovel)wonderDraw('shovel',wonders.sh,surfaceY(wonders.sh)+1);
}
function drawWonderAir(){
  if(wonders.world!==worldLevel()||wonders.special!=='cavern')return;
  var cx=Math.round(P.x-camX),cy=Math.round(P.y-12-camY),R=48;ctx.fillStyle='rgba(8,8,14,0.62)';
  for(var y=0;y<IH;y+=2){var d=Math.abs(y-cy),hw=d<R?Math.round(Math.sqrt(R*R-d*d)):0;if(!hw){ctx.fillRect(0,y,IW,2);continue;}ctx.fillRect(0,y,Math.max(0,cx-hw),2);ctx.fillRect(cx+hw,y,IW,2);}
}
