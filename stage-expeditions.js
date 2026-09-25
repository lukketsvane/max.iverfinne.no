/* Optional vertical districts. Geometry is seed-stable and uses the same native
   ledges as the garden. No item, class skill or spring is required to enter. */
(function(root){
  'use strict';
  // title, route silhouette, interaction, reward, local guards, hidden keepsake
  var stages=[
    ['The Lost Seed Lift','switch','relay','dew',[0,2],'A tiny watering can'],
    ['Signalbox Nine','spine','bells','embers',[2,0],'The last train ticket'],
    ['Rainwell Galleries','arch','watch','dew',[2,1],'An umbrella for a beetle'],
    ['The Hanging Archive','braid','salvage','embers',[0,2],'A book of pressed leaves'],
    ['Mossback Lookout','switch','relay','feathers',[2,1],'Mossback was here'],
    ['Thiefwind Rigging','spine','salvage','embers',[3,2],'A stolen golden spoon'],
    ['Sporeglass Conservatory','arch','watch','dew',[4,2],'Do not water the moon'],
    ['The Armoured Belfry','braid','bells','embers',[5,2],'A beetle sized helmet'],
    ['Rootwell Observatory','switch','relay','feathers',[6,2],'A star in a jam jar'],
    ['The Silent Carillon','arch','bells','dew',[4,2],'The bell that says meow'],
    ['Aurora Scaffold','spine','relay','feathers',[9,2],'A scarf for the aurora'],
    ['Snowmelt Reservoir','braid','watch','dew',[6,2],'A snowman facing summer'],
    ['The Frozen Post','switch','salvage','embers',[10,2],'A letter addressed to Max'],
    ['Windchime Orchard','arch','bells','feathers',[9,2],'The wind knows your name'],
    ['Moon Moth Roost','braid','watch','dew',[6,2],'A moths bedtime story'],
    ['Cinder Pumpworks','spine','relay','dew',[4,2],'Tea is still warm'],
    ['The Ember Library','arch','salvage','embers',[5,2],'Please return before dawn'],
    ['Furnace Choir','switch','bells','embers',[9,2],'Three notes from home'],
    ['The Last Weather Station','braid','watch','feathers',[6,2],'Forecast: one more try'],
    ['Above the Hollow Crown','spine','relay','embers',[5,2],'A crown for the gardener']
  ];
  var patterns={switch:[0,1],spine:[0,1,2,3,2,1],arch:[0,1,2,1],braid:[0,1,0,1,2,3,2,1]};
  function furnish(L,ground,wet){
    if(L.expedition||L.stage<1||L.stage>20)return L;
    var d=stages[L.stage-1],seed=L.seed>>>0,side=L.picture?-1:((seed^L.stage)&1?1:-1),pattern=patterns[d[1]],edge=L.origin+side*65;
    L.platforms.forEach(function(p){edge=side>0?Math.max(edge,p.x+p.w):Math.min(edge,p.x);});
    // A dry, level launch outside the painted scene and the existing routes.
    var x=Math.round(edge+side*136),best=null;
    for(var s=0;s<240;s+=4){
      var cx=x+side*s,lo=Infinity,hi=-Infinity,dry=true;
      for(var z=-16;z<=16;z+=2){var y=ground(cx+z);lo=Math.min(lo,y);hi=Math.max(hi,y);if(wet&&wet(cx+z))dry=false;}
      if(dry&&hi-lo<=4){best={x:cx,y:Math.floor(lo)};break;}
    }
    if(!best){ // Wide ponds still have a dry bank; never put an entrance in water.
      for(var s=0;s<2000;s+=4){var cx=x+side*s;if(!wet||!wet(cx)){best={x:cx,y:Math.floor(ground(cx))};break;}}
    }
    best=best||{x:x,y:Math.floor(ground(x))};
    var steps=18+2*Math.floor((L.stage-1)/5),route=[],rooms=[],nodes=[],rise=16;
    var E=L.expedition={name:d[0],shape:d[1],mode:d[2],item:d[3],guards:d[4].slice(),egg:d[5],side:side,start:{x:best.x,y:ground(best.x)},path:route,rooms:rooms,nodes:nodes};
    function ledge(id,cx,y,w){var p={id:'exp:'+L.stage+':'+id,x:Math.round(cx-w/2),y:Math.round(y),w:w,depth:6,style:L.stage<6?'stone':L.stage<11?'ruin':L.stage<16?'branch':'root',route:side,optional:true,expedition:true,floor:Math.round(ground(cx))};L.platforms.push(p);return p;}
    for(var i=0;i<steps;i++){
      var p=ledge(i,best.x+side*pattern[i%pattern.length]*44,best.y-16-i*rise,36);route.push(p.id);
      if(i===5||i===Math.floor(steps/2)||i===steps-1)nodes.push({x:p.x+18,y:p.y,platformId:p.id});
    }
    // Three genuine side rooms: a short descent off the ascent, then a hidden
    // upper nook. Returning uses the same modest jump; walking off is a fast exit.
    var used={},max=Math.max.apply(null,pattern);
    [4,Math.floor(steps/2)+2,steps-3].forEach(function(want,r){
      var choices=[];for(var at=3;at<steps;at++)if(!used[at]&&(pattern[at%pattern.length]===0||pattern[at%pattern.length]===max))choices.push(at);
      choices.sort(function(a,b){return Math.abs(a-want)-Math.abs(b-want);});var at=choices[0];used[at]=true;
      var dir=pattern[at%pattern.length]===0?-side:side,source=L.platforms.find(function(p){return p.id===route[at];}),cx=source.x+18+dir*44;
      var room=ledge('room'+r,cx,source.y+6,36),nook=ledge('nook'+r,cx+dir*44,source.y-10,36);
      rooms.push({from:source.id,platformId:room.id,x:cx,y:room.y,secret:{x:cx+dir*44,y:nook.y,platformId:nook.id}});
    });
    E.summit={x:nodes[2].x,y:nodes[2].y};
    return L;
  }
  var api={stages:stages,furnish:furnish};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MaxExpeditions=api;
})(typeof window==='object'?window:globalThis);
