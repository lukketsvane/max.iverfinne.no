var secrets={world:0,seed:0,event:'',t:0},secretRun=null,secretClock=function(){return new Date();},secretOwnP=P;
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
function rollSecrets(){var w=worldLevel();secrets.world=w;secrets.event=secretEventFor(secrets.seed,w);secrets.t=0;}
function secretEvent(){return secrets.world===worldLevel()?secrets.event:'';}
function updateSecrets(dt){
  if(!runActive||rogueRun.ended)return;
  secrets.t+=dt;
  if(coopGuest())return;
  if(secretRun!==rogueRun){secretRun=rogueRun;secrets.seed=secretSeedFor(rogueRun);secrets.world=0;}
  if(secrets.world!==worldLevel())rollSecrets();
}
function secretSync(s){
  var next=coopPlain(s);next.event=Object.hasOwn(SECRET_WORDS,next.event)?next.event:'';
  secrets=next;secretRun=rogueRun;
}
function drawSecretBanner(y){var e=secretEvent(),w=SECRET_WORDS[e];if(w)drawBossWord(w,20+String(worldLevel()).length*8+(w.length*6-1)/2,y+2,1);}
function drawSecretSky(t,hy){
  if(secretEvent()!=='moon')return;
  var span=IW+900,mx=(IW*.72-camX*.012)%span,my=Math.max(12,hy-196);if(mx<-60)mx+=span;
  disc(mx,my,20,'rgba(223,230,234,0.035)');disc(mx,my,13,'rgba(223,230,234,0.05)');disc(mx,my,8,'#eef1ea');
  ctx.fillStyle='rgba(170,178,184,0.4)';ctx.fillRect((mx-3)|0,(my-2)|0,2,1);
}
function drawSecretGround(t){
  if(secretEvent()!=='moon')return;
  ctx.globalCompositeOperation='lighter';
  gardenPlots.forEach(function(p,i){if(!p.dead&&p.growth>.2)disc(Math.round(p.x-camX),Math.round(surfaceY(p.x)-camY)-4,7,'rgba(150,190,230,'+(.035+.02*Math.sin(t*1.3+i)).toFixed(3)+')');});
  ctx.globalCompositeOperation='source-over';
}
function drawSecretAir(t){
  if(secretEvent()!=='moon'||P.lampLit<.3||!gardenReady)return;
  var L=lanternPos();
  for(var i=0;i<3;i++){
    var a=t*(1.6+i*.4)+i*2.1,x=L.x+Math.cos(a)*(6+i*3),y=L.y+Math.sin(a*1.3)*(4+i),r=(i&1?GM.moth_grey:GM.moth_brown)[((t*14+i)|0)&1];
    gRect(r,Math.round(x-camX)-(r[2]>>1),Math.round(y-camY)-(r[3]>>1),Math.cos(a)>0);
  }
}
