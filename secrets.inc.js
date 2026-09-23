var secrets={world:0,seed:0,event:'',t:0},secretRun=null,secretClock=function(){return new Date();},secretOwnP=P,secretMeteors=[],secretMeteorT=0,secretChirpT=2;
var SECRET_WORDS={moon:'MOON',meteors:'METEORS',fog:'FOG',aurora:'AURORA',chorus:'CHORUS'};
function secretHash(seed,n){var h=Math.imul((seed|0)^Math.imul(n|0,0x9e3779b1),0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return (h>>>0)/4294967296;}
function secretEventFor(seed,w){
  var r=secretHash(seed,w);if(w<2)return '';
  if(w>=11&&w<=15&&r>.7)return 'aurora';
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
}
function secretEvent(){return secrets.world===worldLevel()?secrets.event:'';}
function updateSecrets(dt){
  if(!runActive||rogueRun.ended)return;
  secrets.t+=dt;updateSecretLocal(dt);
  if(coopGuest())return;
  if(secretRun!==rogueRun){secretRun=rogueRun;secrets.seed=secretSeedFor(rogueRun);secrets.world=0;}
  if(secrets.world!==worldLevel())rollSecrets();
  if(secrets.starAt&&!secrets.star&&secrets.t>=secrets.starAt)secrets.star=secrets.t;
  if(secretEvent()==='fog')gardenPlots.forEach(function(p){if(!p.dead&&p.moisture<.3)p.moisture=.3;});
}
function updateSecretLocal(dt){
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
  if(next.wished&&!secrets.wished&&next.world===secrets.world)chime([1047,1319,1568,2093],.06,.04);
  secrets=next;secretRun=rogueRun;
}
function drawSecretBanner(y){var e=secretEvent(),w=SECRET_WORDS[e];if(w)drawBossWord(w,20+String(worldLevel()).length*8+(w.length*6-1)/2,y+2,1);}
function drawSecretSky(t,hy){
  secretMeteors.forEach(function(m){
    var k=1-m.l/m.m,x=Math.round(m.x-k*m.v),y=Math.round(m.y+k*m.v*.45),a=Math.sin(k*Math.PI);
    for(var i=0;i<7;i++){ctx.fillStyle='rgba(220,230,255,'+(a*(1-i/7)*.8).toFixed(3)+')';ctx.fillRect(x+i*2,y-i,2,1);}
  });
  if(secretStarLive()){
    var q=secretStarPos();
    for(var i=9;i>0;i--){ctx.fillStyle='rgba(246,232,190,'+(.55-i*.055).toFixed(3)+')';ctx.fillRect(q.x+i*2,q.y-Math.round(i*.56),2,1);}
    ctx.globalCompositeOperation='lighter';disc(q.x,q.y,3,'rgba(246,232,190,0.25)');ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#fffbe8';ctx.fillRect(q.x-1,q.y,3,1);ctx.fillRect(q.x,q.y-1,1,3);
  }
  if(secretEvent()==='chorus')for(var b=0;b<6;b++){ctx.fillStyle='rgba(236,164,128,'+(.012*(b+1)*clamp01(secrets.t/20)).toFixed(3)+')';ctx.fillRect(0,hy-170+b*16,IW,16);}
  if(secretEvent()==='aurora'){
    ctx.globalCompositeOperation='lighter';
    for(var sx=0;sx<IW;sx+=2){
      var u=(sx+camX*.05)*.018,top=Math.max(safeTopArt()+4,hy-178+Math.round(Math.sin(u+t*.25)*10+Math.sin(u*2.3-t*.4)*5)),a=.05+.035*Math.sin(u*3.1+t*.8);
      ctx.fillStyle='rgba(90,230,170,'+a.toFixed(3)+')';ctx.fillRect(sx,top,2,18+Math.round(8*Math.sin(u*1.7+t*.6)));
      ctx.fillStyle='rgba(150,110,230,'+(a*.6).toFixed(3)+')';ctx.fillRect(sx,top-6,2,6);
    }
    ctx.globalCompositeOperation='source-over';
  }
  if(secretEvent()!=='moon')return;
  var span=IW+900,mx=(IW*.72-camX*.012)%span,my=Math.max(12,hy-196);if(mx<-60)mx+=span;
  disc(mx,my,20,'rgba(223,230,234,0.035)');disc(mx,my,13,'rgba(223,230,234,0.05)');disc(mx,my,8,'#eef1ea');
  ctx.fillStyle='rgba(170,178,184,0.4)';ctx.fillRect((mx-3)|0,(my-2)|0,2,1);
}
function plantGold(p){return !!(p&&p.id&&secretHash(secrets.seed,p.id*977+13)<1/300);}
function goldHarvest(p){if(!plantGold(p))return false;spawnLooseSeeds(p.x,surfaceY(p.x)-2,2,true);chime([1319,1568,2093],.05,.035);return true;}
function drawSecretGround(t){
  var moon=secretEvent()==='moon';
  gardenPlots.forEach(function(p,i){
    if(p.dead)return;
    var sx=Math.round(p.x-camX),gy=Math.round(surfaceY(p.x)-camY),gold=plantGold(p);
    if(!moon&&!gold)return;
    ctx.globalCompositeOperation='lighter';
    if(moon&&p.growth>.2)disc(sx,gy-4,7,'rgba(150,190,230,'+(.035+.02*Math.sin(t*1.3+i)).toFixed(3)+')');
    if(gold)disc(sx,gy-3,5,'rgba(240,200,90,0.09)');
    ctx.globalCompositeOperation='source-over';
    if(gold)for(var k=0;k<3;k++){
      var ph=t*1.7+k*2.1,a=Math.sin(ph),n=Math.floor(ph/6.283)+k*13+p.id;if(a<.3)continue;
      ctx.fillStyle='rgba(255,226,120,'+a.toFixed(2)+')';ctx.fillRect(sx-5+Math.round(h1(n)*10),gy-Math.round(plantHeight(p)*h1(n*3.7)),1,1);
    }
  });
}
function drawSecretAir(t){
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
