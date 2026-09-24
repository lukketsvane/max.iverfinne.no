var secrets={world:0,seed:0,event:'',t:0},secretRun=null,secretClock=function(){return new Date();},secretOwnP=P,secretMeteors=[],secretMeteorT=0,secretChirpT=2,secretStill=0,secretClockT=0,secretOwlHour=false,secretOwlT=8,secretOwlEyes=0,secretToday='',secretTint=false,secretTaps=0,secretTapAt=-1e9,secretSkins=[];
var SECRET_WORDS={moon:'MOON',meteors:'METEORS',fog:'FOG',aurora:'AURORA',chorus:'CHORUS'};
function secretLogoTap(){
  var now=performance.now();secretTaps=now-secretTapAt<1500?secretTaps+1:1;secretTapAt=now;
  if(secretTaps<7)return false;
  secretTaps=0;secretTint=!secretTint;unlockAudio();chime(secretTint?[523,659,784,1047,1319,1568,2093]:[2093,1568,1319,1047],.05,.04);return true;
}
window.addEventListener('max-logo-tap',secretLogoTap);
function secretSkin(img){
  for(var i=0;i<secretSkins.length;i++)if(secretSkins[i][0]===img)return secretSkins[i][1];
  var c=document.createElement('canvas'),w=c.width=img.naturalWidth||img.width,h=c.height=img.naturalHeight||img.height,g=c.getContext('2d');
  g.imageSmoothingEnabled=false;g.drawImage(img,0,0);g.globalCompositeOperation='color';g.globalAlpha=.7;g.fillStyle='#8f86b4';g.fillRect(0,0,w,h);
  g.globalAlpha=1;g.globalCompositeOperation='destination-in';g.drawImage(img,0,0);
  secretSkins.push([img,c]);return c;
}
function drawGardenSecret(g,plants,W,G,t,locked){
  // Sligo's two cords join the list once Sligo is unlocked, but the secret stays about the garden's own plants.
  if(locked||!plants.length||!plants.every(function(p){return p.found||SLIGO_KINDS.indexOf(p.kind)>=0;}))return false;
  var str='GOODNIGHT, GARDEN',x0=Math.round(W/2-(str.length*6-1)/2),y=Math.round(G*.24);
  if(ready(BOSS_FONT)){g.globalAlpha=.5+.3*Math.sin(t*.9);for(var i=0;i<str.length;i++){var n=str.charCodeAt(i)-32;g.drawImage(BOSS_FONT,n%16*6,Math.floor(n/16)*8,5,7,x0+i*6,y,5,7);}g.globalAlpha=1;}
  return true;
}
function secretHash(seed,n){var h=Math.imul((seed|0)^Math.imul(n|0,0x9e3779b1),0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return (h>>>0)/4294967296;}
function secretEventFor(seed,w){
  var r=secretHash(seed,w);if(w<2)return '';
  if(w>=11&&w<=15)return r>.7?'aurora':'';
  return r<.05?'moon':r<.09?'meteors':r<.14&&w%5?'fog':r<.18?'chorus':'';
}
function secretSeedFor(run){
  if(Number.isFinite(run.seed))return run.seed|0;
  var s=String(run.recordId||Date.now()),h=0x811c9dc5;for(var i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0;
}
function rollSecrets(){
  var w=worldLevel(),r=function(n){return secretHash(secrets.seed,w*64+n);};
  secrets.world=w;secrets.event=secretEventFor(secrets.seed,w);secrets.t=0;
  secrets.starAt=w>1&&(secrets.event==='meteors'||r(1)<.12)?20+Math.round(r(2)*50):0;secrets.star=0;secrets.wished=0;
  secrets.spotX=Math.round(dryX(levelOriginX(w)+(r(3)<.5?-1:1)*(70+r(4)*130)));secrets.spotFound=0;secretStill=0;
  secrets.hogAt=r(5)<.3?30+Math.round(r(6)*40):0;secrets.hogId=0;secrets.hogX=0;secrets.hogT=0;secrets.hogOut=0;secrets.hogGift=0;
}
function secretEvent(){return secrets.world===worldLevel()?secrets.event:'';}
function updateSecrets(dt){
  if(!runActive||rogueRun.ended)return;
  secrets.t+=dt;updateSecretLocal(dt);
  if(coopGuest())return;
  if(secretRun!==rogueRun){secretRun=rogueRun;secrets.seed=secretSeedFor(rogueRun);secrets.world=0;}
  if(secrets.world!==worldLevel())rollSecrets();
  if(secrets.starAt&&!secrets.star&&secrets.t>=secrets.starAt)secrets.star=secrets.t;
  if(!secrets.spotFound){
    var gy=surfaceY(secrets.spotX),still=runPlayers().some(function(a){return Math.abs(a.p.x-secrets.spotX)<10&&a.p.grounded&&Math.abs(a.p.vx)<1&&Math.abs(a.p.y-gy)<8;});
    secretStill=still?secretStill+dt:0;
    if(secretStill>=3){secrets.spotFound=secrets.t;spawnLooseSeeds(secrets.spotX,gy-10,2,true);chime([784,988,1175,1568],.07,.035);}
  }
  if(secrets.hogAt&&!secrets.hogId&&secrets.t>=secrets.hogAt){
    var ok=gardenPlots.filter(function(p){return !p.dead&&p.growth>=.6&&p.moisture>=.3;}),pick=ok[Math.floor(secretHash(secrets.seed,secrets.world*64+7)*ok.length)];
    if(pick){secrets.hogId=pick.id;secrets.hogX=pick.x+6;secrets.hogT=20;}
  }
  if(secrets.hogT>0){
    var hp=gardenPlots.find(function(p){return p.id===secrets.hogId;});
    if(!hp||hp.dead||hp.moisture<.3){secrets.hogT=0;secrets.hogOut=secrets.t;}
    else if((secrets.hogT-=dt)<=0){secrets.hogT=0;secrets.hogOut=secrets.t;secrets.hogGift=1;spawnLooseSeeds(secrets.hogX,surfaceY(secrets.hogX)-4,2,true);socialTone('gift');}
  }
  if(secretEvent()==='fog')gardenPlots.forEach(function(p){if(!p.dead&&p.moisture<.3)p.moisture=.3;});
}
function updateSecretLocal(dt){
  if((secretClockT-=dt)<=0){var d=secretClock();secretClockT=5;secretOwlHour=d.getHours()===3;secretToday=secretDay(d);}
  if(secretOwlHour&&(secretOwlT-=dt)<=0){secretOwlT=60+Math.random()*40;secretOwlEyes=1.6;chime([349,294,294],.3,.03);}
  secretOwlEyes=Math.max(0,secretOwlEyes-dt);
  if(secretEvent()==='meteors'&&(secretMeteorT-=dt)<=0){secretMeteorT=.3+Math.random()*1.1;secretMeteors.push({x:IW*(.25+Math.random()*.9),y:safeTopArt()+Math.random()*IH*.22,l:.7,m:.7,v:70+Math.random()*50});}
  if(secretEvent()==='chorus'&&(secretChirpT-=dt)<=0){secretChirpT=secrets.t<30?1.4+Math.random()*2.2:10+Math.random()*10;chime([2349+Math.round(Math.random()*300),2794,2637],.07,.012);}
  for(var i=secretMeteors.length-1;i>=0;i--)if((secretMeteors[i].l-=dt)<=0)secretMeteors.splice(i,1);
}
function secretPop(want){if(secretEvent()==='chorus')want.tit=Math.max(want.tit,9);return want;}
function secretStarLive(slack){return secrets.star>0&&!secrets.wished&&secrets.world===worldLevel()&&secrets.t-secrets.star<2.2+(slack||0);}
function secretStarPos(){var k=clamp01((secrets.t-secrets.star)/2.2),v=secretHash(secrets.seed,secrets.world*64+4);return {x:Math.round(IW*(.92-.1*v-.5*k)),y:Math.round(safeTopArt()+16+IH*(.04+.03*v+.14*k))};}
function grantWish(a,slack){
  if(coopGuest()||!secretStarLive(slack))return false;
  secrets.wished=secrets.t;
  if(secretHash(secrets.seed,secrets.world*64+3)<.5)grantRogueLevel();else spawnLooseSeeds(a.x,a.y-24,3,true);
  chime([1047,1319,1568,2093],.06,.04);return true;
}
function catchWish(wx,wy){
  if(!secretStarLive())return false;
  var q=secretStarPos();if(Math.hypot(wx-camX-q.x,wy-camY-q.y)>18)return false;
  for(var i=0;i<10;i++)parts.push({x:wx,y:wy,vx:(Math.random()-.5)*30,vy:(Math.random()-.5)*30,l:.8,m:.8,c:'246,232,160'});
  if(!coopGuest())return grantWish(P);
  if(coopAction('wish')){secrets.wished=secrets.t;chime([1047,1319,1568,2093],.06,.04);}
  return true;
}
function secretSync(s){
  var next=coopPlain(s);next.event=Object.hasOwn(SECRET_WORDS,next.event)?next.event:'';
  if(!next.wished&&secrets.wished&&next.world===secrets.world&&next.star===secrets.star)next.wished=secrets.wished;
  if(next.wished&&!secrets.wished&&next.world===secrets.world)chime([1047,1319,1568,2093],.06,.04);
  if(next.spotFound&&!secrets.spotFound&&next.world===secrets.world)chime([784,988,1175,1568],.07,.035);
  if(next.hogGift&&!secrets.hogGift&&next.world===secrets.world)socialTone('gift');
  secrets=next;secretRun=rogueRun;
}
function drawSecretBanner(y){var e=secretEvent(),w=SECRET_WORDS[e];if(w)drawBossWord(w,20+String(worldLevel()).length*8+(w.length*6-1)/2,y+2,1);}
function drawSecretSky(t,hy){
  secretMeteors.forEach(function(m){
    var k=1-m.l/m.m,x=Math.round(m.x-k*m.v),y=Math.round(m.y+k*m.v*.45),a=Math.sin(k*Math.PI);
    for(var i=0;i<7;i++){ctx.fillStyle='rgba(220,230,255,'+(a*(i<2?.7:.3)).toFixed(3)+')';ctx.fillRect(x+i*2,y-i,2,1);}
  });
  if(secretStarLive()){
    var q=secretStarPos();
    for(var i=9;i>0;i--){ctx.fillStyle='rgba(246,232,190,'+(i<3?.5:.2)+')';ctx.fillRect(q.x+i*2,q.y-Math.round(i*.56),2,1);}
    ctx.fillStyle='#fffbe8';ctx.fillRect(q.x-1,q.y,3,1);ctx.fillRect(q.x,q.y-1,1,3);
  }
  if(secretEvent()==='aurora'){
    for(var sx=0;sx<IW;sx+=2){
      var u=(sx+camX*.05)*.018,top=Math.max(safeTopArt()+4,hy-178+Math.round(Math.sin(u+t*.25)*10+Math.sin(u*2.3-t*.4)*5));
      ctx.fillStyle='rgba(96,168,140,0.12)';ctx.fillRect(sx,top,2,18+Math.round(8*Math.sin(u*1.7+t*.6)));
      ctx.fillStyle='rgba(122,104,168,0.1)';ctx.fillRect(sx,top-6,2,6);
    }
  }
  if(secretEvent()!=='moon')return;
  var span=IW+900,mx=(IW*.72-camX*.012)%span,my=Math.max(12,hy-196);if(mx<-60)mx+=span;
  disc(mx,my,8,'#eef1ea');
  ctx.fillStyle='rgba(170,178,184,0.4)';ctx.fillRect((mx-3)|0,(my-2)|0,2,1);
}
function plantGold(p){return !!(p&&p.id&&secretHash(secrets.seed,p.id*977+13)<1/300);}
function goldHarvest(p){if(!plantGold(p))return false;spawnLooseSeeds(p.x,surfaceY(p.x)-2,2,true);chime([1319,1568,2093],.05,.035);return true;}
function secretDay(d){var m=d.getMonth()+1,n=d.getDate();return m===12&&n>=24&&n<=26?'christmas':m===10&&n===31?'halloween':m===6&&n===23?'sankthans':m===5&&n===17?'may17':'';}
var SECRET_FLAG=['RWBWRRR','WWBWWWW','BBBBBBB','WWBWWWW','RWBWRRR'],SECRET_FLAG_INK={R:'#ba2a36',W:'#f2eee4',B:'#1f3f8a'};
function drawSecretDay(t){
  var day=secretToday,n=0;if(!day)return 0;var o=levelOriginX(worldLevel());
  if(day==='may17')gardenPlots.forEach(function(p){
    if(p.dead||p.growth<.3||n>=12)return;n++;
    var sx=Math.round(p.x-camX),top=Math.round(surfaceY(p.x)-plantHeight(p)-camY)-2,wave=((t*3+p.id)|0)&1;
    ctx.fillStyle='#3a3226';ctx.fillRect(sx,top-6,1,6);
    for(var r=0;r<5;r++)for(var c=0;c<7;c++){ctx.fillStyle=SECRET_FLAG_INK[SECRET_FLAG[r][c]];ctx.fillRect(sx+1+c,top-6+r+(c>3?wave:0),1,1);}
  });
  if(day==='halloween')[-56,56].forEach(function(dx,i){
    var x=dryX(o+dx),pr=PA.pumpkin[((t*2+i)|0)%PA.pumpkin.length];n++;
    if(plantAtlasReady)ctx.drawImage(pr.img,0,0,pr[2],pr[3],Math.round(x-camX)-(pr[2]>>1),Math.round(surfaceY(x)-camY)-pr[3]+2,pr[2],pr[3]);
  });
  if(day==='sankthans'){
    var fx=dryX(o-70),bx=Math.round(fx-camX),by=Math.round(surfaceY(fx)-camY),fr=GM.fire[0];n++;
    if(gardenReady)gRect(fr,bx-(fr[2]>>1),by-fr[3]+2,((t*8)|0)&1);
    for(var k=0;k<7;k++){var q=(t*.7+h1(k*3.1))%1;ctx.fillStyle='rgba(255,196,110,'+(1-q).toFixed(2)+')';ctx.fillRect(bx+Math.round(Math.sin(t*2+k*1.7)*4+(h1(k)-.5)*10),by-16-Math.round(q*34),1,1);}
  }
  if(day==='christmas'){
    var p=exitStalk()||gardenPlots.filter(function(q){return !q.dead;}).sort(function(a,b){return plantHeight(b)-plantHeight(a);})[0];
    if(p){
      var cx=Math.round(p.x-camX),cy=Math.max(safeTopArt()+8,Math.round(surfaceY(p.x)-plantHeight(p)-camY)-4),tw=Math.sin(t*4)>0;n++;
      ctx.fillStyle=tw?'#fff4b0':'#f2d35a';ctx.fillRect(cx-2,cy,5,1);ctx.fillRect(cx,cy-2,1,5);ctx.fillRect(cx-1,cy-1,3,3);
      if(tw){ctx.fillStyle='rgba(255,244,176,0.5)';ctx.fillRect(cx-3,cy,1,1);ctx.fillRect(cx+3,cy,1,1);ctx.fillRect(cx,cy-3,1,1);ctx.fillRect(cx,cy+3,1,1);}
    }
  }
  return n;
}
function drawHedgehog(x,y,f,t){
  var px=function(dx,dy,w,col){ctx.fillStyle=col;ctx.fillRect(f<0?x+dx:x-dx-w+1,y+dy,w,1);},nose=(t*2.5|0)&1;
  px(-3,-4,6,'#5a4632');px(-4,-3,8,'#6d5539');px(-4,-2,8,'#6d5539');
  px(-2,-4,1,'#8a7050');px(1,-4,1,'#8a7050');px(-3,-3,1,'#8a7050');px(0,-3,1,'#8a7050');px(3,-3,1,'#8a7050');
  px(-6,-2,2,'#c9a57a');px(-7,-2-nose,1,'#1a1410');px(-5,-3,1,'#1a1410');px(-3,-1,1,'#3a2c20');px(2,-1,1,'#3a2c20');
}
function drawSecretGround(t){
  drawSecretDay(t);
  if(secrets.world===worldLevel()&&secrets.hogId){
    var away=secrets.hogT>0?0:secrets.t-secrets.hogOut,hx=secrets.hogX+away*14;
    if(away<3){ctx.globalAlpha=1-away/3;drawHedgehog(Math.round(hx-camX),Math.round(surfaceY(hx)-camY),away>0?1:-1,t);ctx.globalAlpha=1;}
  }
  if(secrets.world===worldLevel()&&secrets.spotX){
    var spx=Math.round(secrets.spotX-camX),spy=Math.round(surfaceY(secrets.spotX)-camY),age=secrets.t-secrets.spotFound,ph=(secrets.t+secrets.world*1.7)%5;
    if(!secrets.spotFound&&ph<.4){ctx.fillStyle='rgba(226,236,170,'+(1-ph/.4).toFixed(2)+')';ctx.fillRect(spx,spy-3-Math.round(ph*8),1,1);}
    if(secrets.spotFound&&age<5)for(var f=0;f<12;f++){
      var fa=t*3+f*.52,fk=clamp01(age/5);
      ctx.fillStyle='rgba(214,236,120,'+((1-fk)*(.5+.5*Math.sin(t*9+f))).toFixed(2)+')';ctx.fillRect(spx+Math.round(Math.cos(fa)*(4+f*.8)),spy-4-Math.round(f*2.4+fk*30+Math.sin(fa)*2),1,1);
    }
  }
  gardenPlots.forEach(function(p){
    if(p.dead||!plantGold(p))return;
    var sx=Math.round(p.x-camX),gy=Math.round(surfaceY(p.x)-camY);
    for(var k=0;k<3;k++){
      var ph=t*1.7+k*2.1,a=Math.sin(ph),n=Math.floor(ph/6.283)+k*13+p.id;if(a<.3)continue;
      ctx.fillStyle='rgba(255,226,120,'+a.toFixed(2)+')';ctx.fillRect(sx-5+Math.round(h1(n)*10),gy-Math.round(plantHeight(p)*h1(n*3.7)),1,1);
    }
  });
}
function drawSecretAir(t){
  if(secretToday==='christmas')for(var sn=0;sn<36;sn++){ctx.fillStyle='rgba(236,242,248,'+(.45+.4*h1(sn*1.3)).toFixed(2)+')';ctx.fillRect(imod(Math.round(h1(sn*7.1)*IW+Math.sin(t*.7+sn)*6-camX*.3),IW),imod(Math.round(h1(sn*3.3)*IH+t*(9+h1(sn)*7)),IH),1,1);}
  if(secretOwlEyes>.2&&(secretOwlEyes<1.35||secretOwlEyes>1.45)){var ex=Math.round(IW*.14),ey=Math.round(IH*.34);ctx.fillStyle='rgba(240,190,80,'+Math.min(1,secretOwlEyes).toFixed(2)+')';ctx.fillRect(ex,ey,1,1);ctx.fillRect(ex+3,ey,1,1);}
  if(secretEvent()==='fog'){
    ctx.fillStyle='rgba(150,162,172,0.06)';ctx.fillRect(0,0,IW,IH);
    for(var k=0;k<3;k++)for(var sx=-4;sx<IW+4;sx+=4){
      var n=Math.sin((sx+camX)*.021+t*(.3+k*.13)+k*2)+Math.sin((sx+camX)*.047-t*.2);
      ctx.fillStyle='rgba(176,188,196,'+(.08+.035*n).toFixed(3)+')';ctx.fillRect(sx,Math.round(surfAt(sx)-camY)-10-k*9-Math.round(n*2),4,8+k*2);
    }
  }
  if(secretEvent()!=='moon'||P.lampLit<.3||!gardenReady)return;
  var L=lanternPos();
  for(var i=0;i<3;i++){
    var a=t*(1.6+i*.4)+i*2.1,x=L.x+Math.cos(a)*(6+i*3),y=L.y+Math.sin(a*1.3)*(4+i),r=(i&1?GM.moth_grey:GM.moth_brown)[((t*14+i)|0)&1];
    gRect(r,Math.round(x-camX)-(r[2]>>1),Math.round(y-camY)-(r[3]>>1),Math.cos(a)>0);
  }
}
