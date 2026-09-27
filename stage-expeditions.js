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
  // Short authored phrases have an arrival, a traversal rhythm and a broad
  // landing. The run composes two different phrases, never a shuffled cloud
  // of ledges. Column neighbours stay 44px apart; the narrowest pair leaves
  // an 18px gap, reachable by the slowest unupgraded walking character.
  var motifs=[
    {id:'broken-viaduct',name:'Broken Viaduct',lanes:[0,1,2,3,2,1],widths:[42,28,28,46,32,44],rises:[18,18,16,14,18,18]},
    {id:'folded-stair',name:'Folded Stair',lanes:[0,1,0,1,2,3],widths:[38,28,40,28,32,48],rises:[18,16,18,18,16,18]},
    {id:'hanging-galleries',name:'Hanging Galleries',lanes:[0,1,2,1,0,1],widths:[46,30,44,28,30,48],rises:[14,18,16,18,18,16]},
    {id:'needle-crossing',name:'Needle Crossing',lanes:[0,1,2,3,2,3],widths:[40,26,26,40,28,48],rises:[18,16,18,14,18,18]},
    {id:'crown-steps',name:'Crown Steps',lanes:[0,1,2,1,2,3,2],widths:[40,30,42,28,28,44,48],rises:[18,18,14,18,18,16,18]}
  ];
  var roomKinds=[
    {id:'shelter',width:44,nook:40,gap:8,drop:6,rise:16},
    {id:'needle',width:28,nook:30,gap:14,drop:8,rise:18},
    {id:'gallery',width:48,nook:36,gap:8,drop:4,rise:18}
  ];
  function roll(seed,stage){
    var a=(seed^Math.imul(stage,0x9e3779b9))>>>0;
    return function(){a=a+0x6d2b79f5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
  }
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
    var random=roll(seed,L.stage),route=[],rooms=[],nodes=[],sections=[],path=[],lane=0,y=best.y;
    var first=Math.floor(random()*motifs.length),second=(first+1+Math.floor(random()*(motifs.length-1)))%motifs.length;
    var items=['feathers','dew','embers'],item=items[(items.indexOf(d[3])+Math.floor(random()*3))%3];
    var E=L.expedition={name:d[0],shape:d[1],mode:d[2],item:item,guards:d[4].slice(),egg:d[5],side:side,start:{x:best.x,y:ground(best.x)},path:route,rooms:rooms,nodes:nodes,sections:sections};
    function ledge(id,cx,py,w){var p={id:'exp:'+L.stage+':'+id,x:Math.round(cx-w/2),y:Math.round(py),w:w,depth:6,style:L.stage<6?'stone':L.stage<11?'ruin':L.stage<16?'branch':'root',route:side,optional:true,expedition:true,floor:Math.round(ground(cx))};L.platforms.push(p);return p;}
    function step(next,rise,w,section){
      y-=rise;lane=next;
      var p=ledge(route.length,best.x+side*lane*44,y,w);
      p.section=section;p.lane=lane;route.push(p.id);path.push(p);return p;
    }
    function node(p){nodes.push({x:p.x+p.w/2,y:p.y,platformId:p.id});p.rest=true;}
    // Keep the entrance and its first seven steps stable: guardian lookouts
    // depend on these dry, reachable lower landings. Only the upper district
    // is recomposed. Pictures, normal routes and guardian courts are untouched.
    for(var i=0;i<7;i++){var p=step(pattern[i%pattern.length],16,36,'approach');if(i===5)node(p);}
    [first,second].forEach(function(which){
      var motif=motifs[which],mirror=lane>1,lanes=motif.lanes.map(function(c){return mirror?3-c:c;}),start=route.length;
      // A short connecting stair joins the phrase without teleporting sideways.
      while(Math.abs(lanes[0]-lane)>1)step(lane+Math.sign(lanes[0]-lane),18,36,motif.id);
      lanes.forEach(function(next,j){
        if(next===lane&&j===0)return;
        var width=motif.widths[j],rise=motif.rises[j];
        // Broad rests alternate with precise gaps. Late gardens add a little
        // height, while every single ascent remains below the C0 ceiling.
        if(L.stage>10&&rise<18)rise++;
        var p=step(next,rise,width,motif.id);
        if(j===lanes.length-1)p.depth=8;
      });
      if(route.length-start<6)step(lane===0?1:lane===3?2:lane-1,18,48,motif.id);
      node(path[path.length-1]);
      sections.push({id:motif.id,name:motif.name,from:route[start],to:route[route.length-1]});
    });
    // The three cache routes deliberately leave the main ascent at its outer
    // edges. Each can be climbed back both ways; a miss returns to the soil.
    // Their rhythms differ: a broad refuge, a narrow precision spur and a
    // gallery. The final nook retains the existing once-per-run keepsake.
    var used=[],roomOffset=Math.floor(random()*roomKinds.length),steps=path.length;
    [4,Math.floor(steps/2)+1,steps-2].forEach(function(want,r){
      var choices=[];
      for(var at=3;at<steps;at++)if((path[at].lane===0||path[at].lane===3)&&used.every(function(other){return Math.abs(path[other].y-path[at].y)>=64;}))choices.push(at);
      choices.sort(function(a,b){return Math.abs(a-want)-Math.abs(b-want)||a-b;});
      var at=choices[0];used.push(at);
      var source=path[at],dir=source.lane===0?-side:side,kind=roomKinds[(r+roomOffset)%roomKinds.length];
      var cx=source.x+source.w/2+dir*((source.w+kind.width)/2+kind.gap);
      var room=ledge('room'+r,cx,source.y+kind.drop,kind.width);
      var nx=cx+dir*((kind.width+kind.nook)/2+kind.gap),nook=ledge('nook'+r,nx,room.y-kind.rise,kind.nook);
      room.style=nook.style='root';
      rooms.push({kind:kind.id,from:source.id,platformId:room.id,x:cx,y:room.y,secret:{x:nx,y:nook.y,platformId:nook.id}});
    });
    E.summit={x:nodes[2].x,y:nodes[2].y};
    return L;
  }
  var api={stages:stages,motifs:motifs,furnish:furnish};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MaxExpeditions=api;
})(typeof window==='object'?window:globalThis);
