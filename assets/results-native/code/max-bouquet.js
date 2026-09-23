/* Native 1x bouquet compositor. No generated concept image is used as a sprite.
 * Supply the game's existing drawResultPlant callback; records are rogueRun.garden.
 * Every plant is retained. Long runs produce additional bundles of 24 plants.
 */
(function(root){
'use strict';
var W=96,H=96,AX=48,AY=91,CAPACITY=24;
var SWAY=[0,1,2,1,0,-1,-2,-1];
var ROPE=['#261e18','#6d5141','#9d925b','#d7bf69'];

function chunks(plants,capacity){
  if(!Array.isArray(plants))throw new TypeError('plants must be the saved plant array');
  capacity=Math.max(1,Math.min(CAPACITY,Math.floor(capacity||CAPACITY)));
  var out=[];
  for(var i=0;i<plants.length;i+=capacity)out.push(plants.slice(i,i+capacity));
  return out.length?out:[[]];
}

function rope(ctx,cx,y,width){
  width=width||13;var x=cx-Math.floor(width/2);
  ctx.fillStyle=ROPE[0];ctx.fillRect(x,y,width,5);
  ctx.fillStyle=ROPE[1];ctx.fillRect(x+1,y+1,width-2,3);
  ctx.fillStyle=ROPE[2];ctx.fillRect(x+1,y+1,width-2,1);ctx.fillRect(x+2,y+3,width-4,1);
  ctx.fillStyle=ROPE[3];ctx.fillRect(cx-1,y+1,2,1);
  ctx.fillStyle=ROPE[0];ctx.fillRect(cx,y+2,2,2);
}

function render(canvas,plants,options){
  options=options||{};
  if(typeof options.drawPlant!=='function')throw new TypeError('drawPlant callback is required');
  var groups=chunks(plants,options.capacity);
  var page=Math.max(0,Math.min(groups.length-1,Math.floor(options.bundle||0)));
  var group=groups[page],frame=((Math.floor(options.frame||0)%8)+8)%8;
  canvas.width=W;canvas.height=H;
  var ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);
  if(!group.length){
    ctx.fillStyle='#5f633c';ctx.fillRect(47,88,3,2);
    ctx.fillStyle='#d9c760';ctx.fillRect(48,87,2,2);
    return {bundle:page,bundleCount:groups.length,plantCount:0,visibleIds:[],anchor:[AX,AY]};
  }
  var stamp=canvas.ownerDocument.createElement('canvas');stamp.width=64;stamp.height=96;
  // Draw the outer stems first, centre stems last; all frame data retain their IDs.
  var placement=group.map(function(record,i){
    var u=group.length===1?0:(i/(group.length-1)*2-1);
    return {record:record,index:i,spread:Math.round(u*Math.min(20,4+group.length))};
  }).sort(function(a,b){return Math.abs(b.spread)-Math.abs(a.spread)||a.index-b.index;});
  placement.forEach(function(item){
    var sp=stamp.getContext('2d');sp.setTransform(1,0,0,1,0,0);sp.clearRect(0,0,64,96);
    // Extra headroom protects flower heads extending above the old result canvas.
    sp.translate(0,12);options.drawPlant(stamp,item.record);sp.setTransform(1,0,0,1,0,0);
    // Scanline shearing uses whole-pixel translations. Never scale or rotate a leaf.
    // Rows >=78 contain the old result baseline/roots and are intentionally excluded.
    for(var sy=0;sy<78;sy++){
      var q=Math.min(1,(77-sy)/65);
      var dx=AX-32+Math.round(item.spread*q+SWAY[frame]*q*q);
      ctx.drawImage(stamp,0,sy,64,1,dx,2+sy,64,1);
    }
    // The bundle's gathered stem ends meet a common, frame-stable grounding anchor.
    var end=Math.round(item.spread*.22),start=Math.round(item.spread*.07);
    for(var y=78;y<AY;y++){
      var k=(y-78)/(AY-79),x=AX+Math.round(start+(end-start)*k);
      ctx.fillStyle='#183427';ctx.fillRect(x,y,1,1);
      ctx.fillStyle='#0e1e1d';ctx.fillRect(x+1,y,1,1);
    }
  });
  rope(ctx,AX,76,group.length>16?17:13);
  return {bundle:page,bundleCount:groups.length,plantCount:plants.length,
    visibleIds:group.map(function(p){return p.id;}),anchor:[AX,AY]};
}

root.MaxBouquet={render:render,chunks:chunks,drawTie:rope,
  frame:{w:W,h:H},anchor:{x:AX,y:AY},capacity:CAPACITY,
  animation:{frames:8,durationMs:120,loop:true}};
})(typeof window!=='undefined'?window:this);
