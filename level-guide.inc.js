// Local wayfinding reads the shared world; it never changes progression or reveals a hidden shrine.
function guideLines(text,width){
  var limit=Math.max(1,Math.floor((width-8)/6)),lines=[],line='';
  String(text).toUpperCase().split(/\s+/).forEach(function(word){
    while(word.length>limit){if(line){lines.push(line);line='';}lines.push(word.slice(0,limit));word=word.slice(limit);}
    if(!word)return;
    if(line&&line.length+word.length+1>limit){lines.push(line);line='';}
    line+=(line?' ':'')+word;
  });
  if(line)lines.push(line);return lines;
}
var guideLabelQueue=[],guideCollecting=false;
function beginGuideLabels(){guideLabelQueue=[];guideCollecting=true;}
function flushGuideLabels(){
  guideCollecting=false;
  var labels=guideLabelQueue;guideLabelQueue=[];
  labels.forEach(function(q){drawGuideLabel(q.text,q.cx,q.y,q.ink);});
}
function drawGuideLabel(text,cx,y,ink){
  var lines=guideLines(text,IW-8),width=lines.reduce(function(w,line){return Math.max(w,line.length*6-1);},0);
  cx=Math.round(Math.max(width/2+4,Math.min(IW-width/2-4,cx)));y=Math.round(y);
  var bounds={x:Math.round(cx-width/2)-3,y:y-2,w:width+6,h:lines.length*9+2};
  if(guideCollecting){guideLabelQueue.push({text:text,cx:cx,y:y,ink:ink});return bounds;}
  ctx.fillStyle='rgba(5,12,15,.86)';ctx.fillRect(Math.round(cx-width/2)-3,y-2,width+6,lines.length*9+2);
  lines.forEach(function(line,i){drawBossWord(line,cx,y+i*9,1);});
  if(ink){ctx.fillStyle=ink;ctx.fillRect(bounds.x,bounds.y+bounds.h-1,bounds.w,1);}
  return bounds;
}
function drawGuideStack(texts,cx,bottom){
  var total=texts.reduce(function(h,text){return h+guideLines(text,IW-8).length*9+4;},0),cursor=bottom-total;
  return texts.map(function(text){var bounds=drawGuideLabel(text,cx,cursor+2);cursor+=bounds.h+2;return bounds;});
}
function levelGuideObjective(){
  if(!runActive||rogueRun.ended||relicRunMode())return null;
  var world=worldLevel(),exit=exitStalk();
  if(rogueRun.clearedWorld===world)return {id:'exit',text:climb&&climb.exit?'KEEP CLIMBING UP':'CLIMB THE LIVING EXIT',ink:'#ddd7a0',target:exit?{x:exit.x,y:surfaceY(exit.x)}:null,label:'EXIT'};
  var e=bossEvent;if(!e||e.stage!==world)return null;
  if(e.status==='active'){
    var boss=floatKrek.find(function(k){return k.bossId==='hollow-crown'&&k.guardianStage===world&&k.hp>0;}),text='DEFEAT THE GUARDIAN',target={x:e.courtX,y:e.courtY},label='GUARDIAN';
    if(boss){
      var phase=boss.crownStage||boss.phase||1,nodes=(boss.nodes||[]).filter(function(n){return n.hp>0;});
      text=phase===2?'BREAK THE CROWN SEALS':phase===3?'JUMP WAVES / DODGE PILLARS':phase===4&&nodes.length?'SHATTER CORES TO WEAKEN CROWN':phase===4?'FINISH THE HOLLOW CROWN':'DEFEAT THE HOLLOW CROWN';
      if(phase===2&&nodes.length){nodes.sort(function(a,b){return Math.abs(a.x-P.x)-Math.abs(b.x-P.x);});target={x:nodes[0].x,y:nodes[0].y};label='SEAL';}
      else target={x:boss.x,y:boss.y};
    }
    return {id:'fight',text:text,ink:'#dfba73',target:target,label:label};
  }
  var found=guardianView.key===rogueRun.seed+':'+e.stage+':'+e.siteId&&guardianView.found;
  if(!found)return {id:'discover',text:'EXPLORE FOR THE AMBER SHRINE',ink:'#dfba73',target:null};
  if(!guardianGardenPlant())return {id:'plant',text:'GROW A PLANT IN ITS COURT',ink:'#a7c68c',target:{x:e.courtX,y:e.courtY},label:'COURT'};
  if(runEncounters.some(function(q){return q.active&&!q.done;}))return {id:'trial',text:'FINISH OR LEAVE YOUR TRIAL',ink:'#a0c9c5',target:null};
  return {id:'summon',text:'TEND THE AMBER SHRINE',ink:'#dfba73',target:{x:e.x,y:e.y},label:'SHRINE'};
}
function drawGuideTarget(q,top){
  if(!q.target||q.id==='exit')return; // The existing exit arrow follows the physical stalk.
  var sx=q.target.x-camX,sy=q.target.y-camY;
  if(sx>=7&&sx<=IW-7&&sy>=top&&sy<=IH-20)return;
  var x=Math.round(Math.max(5,Math.min(IW-10,sx))),y=Math.round(Math.max(top+12,Math.min(IH-28,sy-12)));
  var dir=sx<7?'left':sx>IW-7?'right':sy<top?'up':'down';
  drawArrow(x,y,dir,q.ink);
  if(IW>=180)drawGuideLabel(q.label,x+2,dir==='up'?y+9:y-11,q.ink);
}
function drawRouteGuides(){
  if(!runActive||rogueRun.ended||relicRunMode())return;
  var L=stageLayout();
  (L.routes||[]).forEach(function(route){
    if(!route.role)return;
    var q=route.start,x=Math.round(q.x-camX),y=Math.round(q.y-camY);
    if(x<8||x>IW-8||y<18||y>IH+12)return;
    rect(x,y-12,1,12,'#566c60');rect(x-3,y-12,7,3,'#a0b594');
    if(Math.abs(P.x-q.x)<42&&Math.abs(P.y-q.y)<28)drawGuideLabel(route.role+' ROUTE',x,y-30,'#b7c6a2');
  });
  var E=L.expedition;if(!E)return;
  E.rooms.forEach(function(room,i){
    var q=room.branch;if(!q)return;
    var x=Math.round(q.x-camX),y=Math.round(q.y-camY);
    if(x<4||x>IW-8||y<10||y>IH+8)return;
    var taken=!!seedCollected['exp-cache:'+worldLevel()+':'+i];
    rect(x,y-9,1,9,'#526a61');drawArrow(x-2,y-13,room.secret.x>q.x?'right':'left',taken?'#647967':'#a9c996');
    if(!taken&&Math.abs(P.x-q.x)<24&&Math.abs(P.y-q.y)<12)drawGuideLabel('SEED CACHE',x,y-27,'#b7c6a2');
  });
}
function drawLevelGuide(boonCount){
  var q=levelGuideObjective();if(!q||warp)return;
  var rows=Math.ceil(boonCount/8),top=safeTopArt()+15+Math.max(0,rows-1)*11;
  // Arrival titles get one brief line of their own before the persistent task takes over.
  if(worldBanner>0)return;
  var bounds=drawGuideLabel(q.text,IW/2,top,q.ink);
  drawGuideTarget(q,bounds.y+bounds.h+2);
}
