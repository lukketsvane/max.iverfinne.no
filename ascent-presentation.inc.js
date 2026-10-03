// A local, native-pixel view handoff. Simulation and co-op travel never wait
// for this compositor; no presentation field enters an authoritative snapshot.
var ascentPresentation=null,ascentFrame=null,ascentLive=null;
var ASCENT_PRESENTATION_MS=640;
function cancelAscentPresentation(){ascentPresentation=null;ascentFrame=null;ascentLive=null;}
function ascentCanvas(){
  var canvas=document.createElement('canvas');canvas.width=IW;canvas.height=IH;
  var context=canvas.getContext('2d',{alpha:false});if(!context)return null;
  context.imageSmoothingEnabled=false;
  return {canvas:canvas,context:context,w:IW,h:IH};
}
function rememberAscentFrame(){
  if(ascentPresentation)return;
  if(!runActive||rogueRun.ended||relicRunMode()||worldCovered||document.hidden||rogueRun.clearedWorld!==worldLevel()){
    ascentFrame=null;return;
  }
  try{
    if(!ascentFrame||ascentFrame.w!==IW||ascentFrame.h!==IH)ascentFrame=ascentCanvas();
    if(!ascentFrame)return;
    ascentFrame.context.drawImage(cv,0,0);
    ascentFrame.world=worldLevel();ascentFrame.seed=rogueRun.seed;ascentFrame.run=rogueRun;ascentFrame.at=performance.now();
  }catch(e){cancelAscentPresentation();}
}
function beginAscentPresentation(from,to,validated){
  var previous=ascentFrame;
  ascentPresentation=null;ascentLive=null;
  if(!validated||to!==from+1||from<1||to>RUN_STAGES||!runActive||rogueRun.ended||relicRunMode()||
     worldCovered||document.hidden||!previous||previous.world!==from||previous.seed!==rogueRun.seed||previous.run!==rogueRun||
     previous.w!==IW||previous.h!==IH||performance.now()-previous.at>250||
     window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    ascentFrame=null;return false;
  }
  ascentPresentation={from:from,to:to,seed:rogueRun.seed,run:rogueRun,start:performance.now(),offset:-(IH+16)};
  return true;
}
function ascentPresentationOffset(){return ascentPresentation?ascentPresentation.offset:0;}
function prepareAscentPresentation(){
  var view=ascentPresentation,previous=ascentFrame;if(!view)return;
  var elapsed=performance.now()-view.start;
  if(!previous||view.run!==rogueRun||view.seed!==rogueRun.seed||view.to!==worldLevel()||
     previous.w!==IW||previous.h!==IH||!runActive||rogueRun.ended||relicRunMode()||worldCovered||document.hidden||
     elapsed<0||elapsed>=ASCENT_PRESENTATION_MS){cancelAscentPresentation();return;}
  var progress=elapsed/ASCENT_PRESENTATION_MS,eased=progress*progress*(3-2*progress);
  view.offset=Math.round((IH+16)*eased)-IH-16;
}
function drawAscentPresentation(prepared){
  // The renderer prepares before drawing aim indicators: retain that exact
  // offset even if a costly world draw crosses another millisecond boundary.
  if(!prepared)prepareAscentPresentation();
  var view=ascentPresentation,previous=ascentFrame;if(!view)return;
  var saved=false;
  try{
    if(!ascentLive)ascentLive=ascentCanvas();if(!ascentLive){cancelAscentPresentation();return;}
    ascentLive.context.drawImage(cv,0,0);
    var next=view.offset,drop=next+IH+16;
    ctx.save();saved=true;ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#05070e';ctx.fillRect(0,0,IW,IH);
    ctx.drawImage(ascentLive.canvas,0,next);
    ctx.drawImage(previous.canvas,0,drop);
    // A short dark masonry seam joins the two native views without an outdoor
    // cloud flash. It is presentation only, never a platform or collision wall.
    var seam=drop-16;
    ctx.fillStyle='#111b28';ctx.fillRect(0,seam,IW,16);
    ctx.fillStyle='#1a2939';ctx.fillRect(0,seam+2,IW,1);ctx.fillRect(0,seam+13,IW,1);
    ctx.fillStyle='#05070e';
    for(var x=0;x<IW;x+=24){ctx.fillRect(x,seam+3,1,5);ctx.fillRect(x+12,seam+8,1,5);}
  }catch(e){cancelAscentPresentation();}
  finally{if(saved)ctx.restore();}
}
