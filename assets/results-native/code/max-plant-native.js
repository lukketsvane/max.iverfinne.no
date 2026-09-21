/* Source renderer copied from max.iverfinne.no at cca0f5c46ca2a2e55bdae52569984f44499d4b11.
 * Original drawing functions are unchanged. The wrapper freezes weather and uses
 * the same 64x80 / (32,65) result presentation as drawResultPlant in the game.
 */
(function(root){ 'use strict';
root.MaxPlantNative = {create: function(atlas){
var plantAtlas=atlas,plantAtlasReady=true,ctx,IH=80,ANCHOR=52;
var worldWeather={wind:0},climb=null;
var PA={"fam":[{"s":[[37,78,35,7],[433,78,35,7],[469,78,35,7],[1,86,35,7],[37,86,35,7],[73,86,35,7],[109,86,35,7],[145,86,35,7],[181,86,35,7],[73,78,35,7],[109,78,35,7],[145,78,35,7],[181,78,35,7],[217,78,35,7],[253,78,35,7],[289,78,35,7],[325,78,35,7],[361,78,35,7],[397,78,35,7]],"f":[[211,70,35,7],[247,70,35,7],[283,70,35,7],[319,70,35,7],[355,70,35,7],[391,70,35,7],[427,70,35,7],[463,70,35,7],[1,78,35,7]]},{"s":[[323,62,41,7],[365,62,41,7],[407,62,41,7],[449,62,41,7],[1,70,41,7],[43,70,41,7],[85,70,41,7],[127,70,41,7],[169,70,41,7],[448,41,41,9],[359,52,41,8]],"f":[[275,52,41,8],[217,29,41,10],[317,52,41,8]]},{"s":[[1,62,45,7],[47,62,45,7],[93,62,45,7],[139,62,45,7],[185,62,45,7],[231,62,45,7],[277,62,45,7]],"f":[[417,52,45,7],[463,52,45,7]]},{"s":[[186,41,29,10],[216,41,29,10],[246,41,29,10],[276,41,29,10],[306,41,29,10],[336,41,29,10],[366,41,29,10],[396,41,29,10]],"f":[[126,41,29,10],[156,41,29,10]]},{"s":[[281,1,39,12],[321,1,39,12],[361,1,39,12],[121,1,39,13],[401,1,39,12]],"f":[[161,1,39,12],[201,1,39,12],[241,1,39,12]]},{"s":[[441,1,41,11],[1,29,41,11],[301,29,41,10],[43,29,41,11],[343,29,41,10],[85,52,41,9],[127,52,41,9],[385,29,41,10],[169,52,41,9],[43,52,41,9]],"f":[[1,52,41,9],[259,29,41,10]]},{"s":[[235,52,19,9],[211,52,23,9],[426,41,21,10],[255,52,19,9],[205,110,21,7],[401,52,15,8],[181,110,23,7]],"f":[[427,29,41,10],[469,29,41,10],[1,41,41,10],[43,41,41,10],[85,41,40,10]]},{"s":[[151,29,21,11],[173,29,21,11],[195,29,21,11]],"f":[[85,29,21,11],[107,29,21,11],[129,29,21,11]]}],"roots":[[217,86,35,7],[433,86,35,7],[469,86,35,7],[1,94,35,7],[37,94,35,7],[73,94,35,7],[109,94,35,7],[145,94,35,7],[181,94,35,7],[253,86,35,7],[289,86,35,7],[325,86,35,7],[361,86,35,7],[397,86,35,7]],"seeds":[[217,94,35,7],[109,102,35,7],[433,102,35,7],[469,102,35,7],[1,110,35,7],[37,110,35,7],[73,110,35,7],[109,110,35,7],[145,110,35,7],[253,94,35,7],[289,94,35,7],[325,94,35,7],[361,94,35,7],[397,94,35,7],[433,94,35,7],[469,94,35,7],[1,102,35,7],[37,102,35,7],[73,102,35,7],[145,102,35,7],[181,102,35,7],[217,102,35,7],[253,102,35,7],[289,102,35,7],[325,102,35,7],[361,102,35,7],[397,102,35,7]],"icons":[[227,110,5,4],[293,110,5,4],[347,110,5,4],[353,110,5,4],[359,110,5,4],[365,110,5,4],[371,110,5,4],[377,110,5,4],[383,110,5,4],[233,110,5,4],[239,110,5,4],[245,110,5,4],[251,110,5,4],[257,110,5,4],[263,110,5,4],[269,110,5,4],[275,110,5,4],[281,110,5,4],[287,110,5,4],[299,110,5,4],[305,110,5,4],[311,110,5,4],[317,110,5,4],[323,110,5,4],[329,110,5,4],[335,110,5,4],[341,110,5,4]],"pumpkin":[[1,1,29,27],[31,1,29,27],[61,1,29,27],[91,1,29,27]],"count":171};
var GARDEN_FIG_FORMS=[
  {fi:0,off:0},{fi:0,off:7},{fi:1,off:1},{fi:2,off:2},{fi:3,off:3},
  {fi:4,off:4},{fi:5,off:5},{fi:6,off:6},{fi:7,off:7}
];
var PLANT_STEM=[
  ['#062128','#294321','#3b5a2e'],['#1b171d','#242a17','#2f3718'],['#0e1e1d','#183427','#274628'],
  ['#0e1e1d','#262938','#38475f'],['#142722','#405054','#5e6781'],['#171b0f','#2e361c','#585633'],
  ['#0a2628','#1e4852','#315f6a'],['#261e18','#3b2d21','#504e2a']
];
var G_TOP=2.7,PLANT_MATURE_H=46;
function imod(n,m){ return ((n%m)+m)%m; }

function clamp01(v){ return v<0?0:(v>1?1:v); }

function h1(n) { var s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

function gardenFigForm(p){return GARDEN_FIG_FORMS[imod(p.kind|0,GARDEN_FIG_FORMS.length)];}

function drawRootAsset(r, sx, gy, flip) {
  if (!plantAtlasReady || !r) return;
  var w=r[2], h=r[3];
  ctx.save();
  ctx.translate(Math.round(sx), Math.round(gy+2));
  if (flip) ctx.scale(-1,1);
  ctx.globalAlpha=0.76;
  ctx.drawImage(plantAtlas,r[0],r[1],w,h,-(w>>1),0,w,h);
  ctx.restore(); ctx.globalAlpha=1;
}

function drawSeedAsset(r, sx, sy) {
  if (!plantAtlasReady || !r) return;
  ctx.drawImage(plantAtlas,r[0],r[1],r[2],r[3],Math.round(sx-r[2]/2),Math.round(sy),r[2],r[3]);
}

function figmaSeg(r, cx, yb, flip) {
  var dx = cx - (r[2] >> 1), dy = yb - r[3];
  if (flip) {
    ctx.save(); ctx.translate(dx + r[2], dy); ctx.scale(-1, 1);
    ctx.drawImage(plantAtlas, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
    ctx.restore();
  } else ctx.drawImage(plantAtlas, r[0], r[1], r[2], r[3], dx, dy, r[2], r[3]);
}

function plantTopH(){return Math.max(72,ANCHOR+10);}

function plantHeight(p){
  var g=Math.max(0,p.growth),top=plantTopH();
  if(p.stalk)return top;
  if(g<1)return Math.round(8+(PLANT_MATURE_H-8)*clamp01((g-.1)/.9));
  return Math.round(Math.min(top,PLANT_MATURE_H+(top-PLANT_MATURE_H)*clamp01((g-1)/(G_TOP-1))));
}

function plantLean(p,h,t){                                     // whole-pixel lean of the stem h px up
  var flip=((p.kind+(p.seed|0))&1)!==0,q=Math.min(1,h/52),phase=t*(.52+h1(p.seed)*.35)+p.seed*.07;
  var sway=Math.sin(phase+h*.012)*Math.min(2.6,1.15*q*q*(1+h/160));
  var wind=worldWeather.wind*.48*q,hit=p.hit*Math.sin(t*28)*2*q,wilt=(1-p.health)*2.4*q*(flip?-1:1);
  if(p.stalk){sway*=.55;wind*=.5;wilt*=.3;}
  return Math.round(sway+wind+hit+wilt);
}

function stemRuns(p,sx,gy,topY,t){                             // [x, top, height] runs of the stem line
  var runs=[],y0=Math.min(gy,IH+2),y1=Math.max(topY,-3),cx=null,start=y0,y;
  for(y=y0;y>=y1;y--){
    var x=sx+plantLean(p,gy-y,t);
    if(x!==cx){if(cx!==null)runs.push(cx,y+1,start-y);cx=x;start=y;}
  }
  if(cx!==null&&start>=y1)runs.push(cx,y1,start-y1+1);
  return runs;
}

function paintRuns(runs,dx,col){
  ctx.fillStyle=col;
  for(var i=0;i<runs.length;i+=3)ctx.fillRect(runs[i]+dx,runs[i+1],1,runs[i+2]);
}

function drawGrowingFigmaPlant(p,sx,gy,t,maxHeight){
  if(!plantAtlasReady)return;
  var form=gardenFigForm(p),fam=PA.fam[form.fi],g=Math.max(0,p.growth),flip=((p.kind+(p.seed|0))&1)!==0;
  if(g<.10){
    var sr=PA.seeds[imod((p.kind*3+(p.seed|0)),PA.seeds.length)];
    drawSeedAsset(sr,sx,gy-2);return;
  }
  var rr=PA.roots[imod(p.kind*2+(p.seed|0),PA.roots.length)];
  drawRootAsset(rr,sx,gy,flip);
  var stalk=!!p.stalk,H=Math.min(plantHeight(p),maxHeight||Infinity),topY=stalk?Math.min(gy-H,-4):gy-H,cols=PLANT_STEM[form.fi];
  var head=(!stalk&&fam.f.length&&g>.5)?fam.f[imod(Math.floor(g*2)+form.off,fam.f.length)]:null;

  // 1. the stem: one unbroken line from the soil to the top
  var runs=stemRuns(p,sx,gy,topY,t);
  if(stalk){
    var pulse=.5+.5*Math.sin(t*3.1+p.seed);
    ctx.globalCompositeOperation='lighter';
    for(var gi=0;gi<runs.length;gi+=3){ctx.fillStyle='rgba(206,226,150,'+(.05+.05*pulse).toFixed(3)+')';ctx.fillRect(runs[gi]-2,runs[gi+1],5,runs[gi+2]);}
    ctx.globalCompositeOperation='source-over';
    paintRuns(runs,-1,cols[2]);paintRuns(runs,0,cols[1]);paintRuns(runs,1,cols[0]);
    // a vine twisting round the stalk
    ctx.fillStyle=cols[2];
    var v0=Math.max(0,Math.ceil((gy-3-(IH+2))/4));
    for(var vy=gy-3-v0*4;vy>Math.max(topY,-4);vy-=4){
      var vh=gy-vy,vs=((vh/4)|0)%4,vx=sx+plantLean(p,vh,t)+(vs===0?-2:(vs===2?2:0));
      ctx.fillRect(vx,vy,1,2);
    }
  }else{
    paintRuns(runs,0,cols[1]);paintRuns(runs,1,cols[0]);
  }

  // 2. the Figma stem pieces, hung along the stem
  var limit=stalk?-16:topY+(head?Math.max(2,head[3]-5):1);
  var yb=gy+1,gap=form.fi===4?3:0,stemY=[],j=0;
  while(j<600){
    var r=fam.s[imod(j+form.off+(p.seed|0),fam.s.length)],top=yb-r[3];
    if(j>0&&top<limit)break;
    var mid=gy-(yb-r[3]*.5),lx=sx+plantLean(p,mid,t),fl=flip?!(j&1):!!(j&1);
    if(top<=IH+4&&yb>=-4){
      figmaSeg(r,lx,yb,fl);
      if(stalk&&fam.f.length&&j%5===3){
        var bl=fam.f[imod(j+form.off,fam.f.length)],bs=(j&2)?1:-1;
        figmaSeg(bl,lx+bs*6,yb-2,bs<0);
      }
    }
    stemY.push(yb-r[3]*.55);yb-=r[3]+gap;j++;
  }

  // 3. the flower head sits on the tip of the stem; a bud before it opens
  if(head)figmaSeg(head,sx+plantLean(p,H,t),topY+Math.min(3,head[3]-2),flip);
  else if(!stalk){ctx.fillStyle=cols[2];ctx.fillRect(sx+plantLean(p,H,t),topY-1,2,2);}

  // 4. ripe plants fill out with more blooms along the lower stem
  if(!stalk&&g>1.05&&fam.f.length&&stemY.length){
    var fullness=Math.min(6,1+Math.floor((g-1)*2.2)),span=Math.max(1,Math.floor(stemY.length*.8));
    for(var k=0;k<fullness;k++){
      var idx=Math.min(stemY.length-1,Math.floor((k+.5)/fullness*span)),br=fam.f[imod(k+form.off+(p.seed|0),fam.f.length)];
      var side=(k&1)?1:-1,by=Math.round(stemY[idx]),bx=sx+plantLean(p,gy-by,t)+side*(5+(k%3)*2);
      figmaSeg(br,bx,by,side<0);
    }
  }

  // 5. seed pods say "ripe" without any text
  if(g>=1&&p.health>.45){
    var pods=Math.min(3,1+Math.floor((g-1)/1.25));
    for(var z=0;z<pods;z++){
      var yy=gy-12-z*11,xx=sx+plantLean(p,12+z*11,t)+(z&1?5:-5);
      ctx.fillStyle=p.health>.78?'#d9c760':'#9d925b';
      ctx.fillRect(xx,yy,2,2);ctx.fillStyle='#5f633c';ctx.fillRect(xx+(z&1?-1:2),yy+1,1,1);
    }
  }

  // 6. a beanstalk calls: motes and chevrons of light run up it
  if(stalk){
    var climbing=climb&&climb.p===p,span2=Math.max(60,gy-Math.max(topY,-4));
    ctx.globalCompositeOperation='lighter';
    for(var m=0;m<9;m++){
      var mh=(t*(24+m*3)+m*41+p.seed*13)%span2,my=Math.round(gy-mh);
      if(my<-2||my>IH+2)continue;
      var mx=sx+plantLean(p,mh,t)+((m&1)?3:-3);
      ctx.fillStyle='rgba(240,228,150,'+(.35+.35*Math.sin(t*6+m)).toFixed(2)+')';ctx.fillRect(mx,my,1,1);
    }
    if(!climbing){
      disc(sx,gy-5,8+Math.round(pulse*3),'rgba(214,226,140,'+(.03+.03*pulse).toFixed(3)+')');
      for(var cv2=0;cv2<2;cv2++){
        var ch=(t*22+cv2*26)%52,cyy=Math.round(gy-14-ch),ca=Math.max(0,1-ch/52)*.7,cxx=sx+plantLean(p,14+ch,t);
        ctx.fillStyle='rgba(246,232,160,'+ca.toFixed(2)+')';
        ctx.fillRect(cxx-2,cyy+2,1,1);ctx.fillRect(cxx-1,cyy+1,1,1);ctx.fillRect(cxx,cyy,1,1);ctx.fillRect(cxx+1,cyy+1,1,1);ctx.fillRect(cxx+2,cyy+2,1,1);
      }
    }
    ctx.globalCompositeOperation='source-over';
  }
}
return {drawPlant:function(canvas,record,time){
  ctx=canvas.getContext('2d');IH=canvas.height;ANCHOR=52;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
  var p=Object.assign({health:1,hit:0,pulse:0,moisture:1},record,{stalk:false});
  drawGrowingFigmaPlant(p,Math.floor(canvas.width/2),65,time||0,58);
},metadata:{frame:[64,80],anchor:[32,65],families:8,kinds:9,matureHeight:46,resultMaxHeight:58}};
}};
})(typeof window!=='undefined'?window:this);
