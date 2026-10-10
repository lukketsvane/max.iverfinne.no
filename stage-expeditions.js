(function(root){
  'use strict';
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
    ['Frostline Shaft','spine','relay','feathers',[9,2],'A scarf kept beneath the ice'],
    ['Thawwater Cistern','braid','watch','dew',[6,2],'A snowman behind the glass'],
    ['Dead Letter Depot','switch','salvage','embers',[10,2],'A letter addressed to Max'],
    ['Pressure Chime Vault','arch','bells','feathers',[9,2],'The buried pipes know your name'],
    ['Pale Moth Chamber','braid','watch','dew',[6,2],'A moths bedtime story'],
    ['Cinder Pumpworks','spine','relay','dew',[4,2],'Tea is still warm'],
    ['Buried Ember Archive','arch','salvage','embers',[5,2],'Please return before dawn'],
    ['First Light Gantry','switch','bells','embers',[9,2],'Three notes from home'],
    ['The Surface Warning Post','braid','watch','feathers',[6,2],'Forecast: radioactive dawn'],
    ['Dawn Containment Tower','spine','relay','embers',[5,2],'The last clean seed']
  ];
  var patterns={switch:[0,1],spine:[0,1,2,3,2,1],arch:[0,1,2,1],braid:[0,1,0,1,2,3,2,1]};
  var motifs=[
    {id:'broken-viaduct',name:'Broken Viaduct',lanes:[0,1,2,3,2,1],widths:[52,28,28,58,32,44],rises:[18,18,16,14,18,18],landing:68,rhythm:'crossing'},
    {id:'folded-stair',name:'Folded Stair',lanes:[0,1,0,1,2,3],widths:[46,28,48,28,32,48],rises:[18,16,18,18,16,18],landing:72,rhythm:'switchback'},
    {id:'hanging-galleries',name:'Hanging Galleries',lanes:[0,1,2,1,0,1],widths:[58,30,56,28,30,48],rises:[14,18,16,18,18,16],landing:76,rhythm:'gallery'},
    {id:'needle-crossing',name:'Needle Crossing',lanes:[0,1,2,3,2,3],widths:[44,26,26,48,28,48],rises:[18,16,18,14,18,18],landing:64,rhythm:'precision'},
    {id:'crown-steps',name:'Crown Steps',lanes:[0,1,2,1,2,3,2],widths:[48,30,54,28,28,56,48],rises:[18,18,14,18,18,16,18],landing:76,rhythm:'ceremonial'}
  ];
  var roomKinds=[
    {id:'shelter',name:'Sheltered Landing',width:64,nook:48,gap:8,drop:8,rise:16,style:'stone'},
    {id:'needle',name:'Needle Nook',width:32,nook:40,gap:12,drop:8,rise:18,style:'root'},
    {id:'gallery',name:'Outer Gallery',width:76,nook:56,gap:8,drop:4,rise:18,style:'ruin'}
  ];
  function roll(seed,stage){
    var a=(seed^Math.imul(stage,0x9e3779b9))>>>0;
    return function(){a=a+0x6d2b79f5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
  }
  var courts=[
    {family:'bell',name:'Broken Bell Court',width:104,style:'ruin'},
    {family:'arch',name:'Split Bough Court',width:96,style:'branch'},
    {family:'pump',name:'Old Pump Court',width:88,style:'stone'}
  ];
  function circuit(L,E,ground,random){
    var native=typeof module==='object'&&module.exports?require('./stage-layout.js'):root.MaxStageLayout;
    var before=L.platforms.slice(),byId={};before.forEach(function(p){byId[p.id]=p;});
    var main=E.path.map(function(id){return byId[id];}),protectedHops=[];
    function chain(ps,both){for(var i=1;i<ps.length;i++){protectedHops.push([ps[i-1],ps[i]]);if(both)protectedHops.push([ps[i],ps[i-1]]);}}
    chain(main,false);
    (L.routes||[]).forEach(function(r){chain(r.platformIds.map(function(id){return byId[id];}).filter(Boolean),false);});
    E.rooms.forEach(function(r){chain([byId[r.from],byId[r.platformId],byId[r.secret.platformId]],true);});
    function gap(a,b){return Math.max(0,b.x-a.x-a.w,a.x-b.x-b.w);}
    function canHop(a,b){var rise=a.y-b.y;return rise<=19&&gap(a,b)<=native.reach(0,rise)-native.move.margin;}
    function clash(a,b){return a!==b&&a.x<b.x+b.w+4&&b.x<a.x+a.w+4&&Math.abs(a.y-b.y)<14;}
    function blocks(p,a,b){
      if(p===a||p===b||p.y>=b.y||p.y<b.y-Math.max(12,20-a.y+b.y))return false;
      var from=b.x+b.w/2<a.x+a.w/2?a.x+3:a.x+a.w-3,to=Math.max(b.x+3,Math.min(b.x+b.w-3,from));
      return p.x<=Math.max(from,to)+3&&p.x+p.w>=Math.min(from,to)-3;
    }
    function lands(a,b,all,speed,jump,control,hz){
      var side=Math.sign(b.x+b.w/2-a.x-a.w/2),start=side>0?a.x+a.w-3:a.x+3;
      var target=Math.max(b.x+3,Math.min(b.x+b.w-3,start)),local={platforms:all.filter(function(p){return p.x<Math.max(start,target)+48&&p.x+p.w>Math.min(start,target)-48&&p.y>=Math.min(a.y,b.y)-48&&p.y<=Math.max(a.y,b.y)+4;})};
      var releases=[.08,.14,.18,.24,Infinity],dt=1/120,sub=120/hz;
      for(var r=0;r<releases.length;r++){
        var x=start,y=a.y,vx=0,vy=-154*jump,held=true,landed=false;
        for(var tick=0;tick<hz*1.4&&!landed;tick++){
          var axis=Math.abs(target-x)>1?Math.sign(target-x):0;
          for(var step=0;step<sub;step++){
            var oldX=x,oldY=y,want=axis*48*speed,acc=axis?(vx*axis<0?980:720)*control:1100;
            vx=vx<want?Math.min(want,vx+acc*dt):Math.max(want,vx-acc*dt);
            if(held&&tick/hz>=releases[r]&&vy< -52){vy=-52;held=false;}
            if(vy>=0)held=false;
            vy+=430*dt;x+=vx*dt;y+=vy*dt;
            var hit=vy>=0?native.landing(local,oldX,oldY,x,y):null;
            if(hit){if(hit.id===b.id)return true;landed=true;break;}
          }
        }
      }
      return false;
    }
    var design=courts[Math.floor(random()*courts.length)],ports=[],prefer=9+Math.floor(random()*3);
    for(var a=7;a<main.length-4;a++)for(var b=a+4;b<main.length;b++){
      var rise=main[a].y-main[b].y;
      if(E.nodes.some(function(n){var at=E.path.indexOf(n.platformId);return at>a&&at<b;}))continue;
      if(rise<=160&&(main[a].lane<=1?main[b].lane>=main[a].lane:main[b].lane<=main[a].lane))ports.push({a:a,b:b,score:Math.abs(a-prefer)*3+Math.abs(b-a-6)+Math.abs(main[b].lane-main[a].lane)+(main[a].lane===0||main[a].lane===3?0:10)});
    }
    ports.sort(function(a,b){return a.score-b.score||a.a-b.a||a.b-b.b;});
    for(var port=0;port<ports.length;port++)for(var attempt=0;attempt<5;attempt++){
      var fork=main[ports[port].a],rejoin=main[ports[port].b],dir=fork.lane<=1?-E.side:E.side;
      var inset=Math.abs(fork.lane-rejoin.lane),rise=fork.y-rejoin.y,lift=[32,40,24,48,16][attempt],count=4+inset,backRise=(rise-lift)/count;
      if(backRise<8||backRise>18)continue;
      var cx=fork.x+fork.w/2,added=[],out=[fork],back=[],id='exp-circuit:'+L.stage;
      function make(key,offset,y,w){
        var center=cx+dir*offset,p={id:id+':'+key,x:Math.round(center-w/2),y:Math.round(y),w:w,depth:6,style:design.style,route:E.side,optional:true,expedition:true,circuit:true,floor:Math.round(ground(center))};
        added.push(p);return p;
      }
      // Keep a walk-off end even when the fork is a broad rest terrace.
      var outset=Math.max(48,(fork.w+36)/2+8);
      for(var i=1;i<=3;i++)out.push(make('out'+i,outset+(i-1)*48,fork.y-lift*i/4,36));
      var courtEdge=Math.max(172,outset+122),courtOffset=courtEdge+design.width/2;
      var floor=make('court',courtOffset,fork.y-lift,design.width);floor.depth=9;floor.rest=true;out.push(floor);back.push(floor);
      for(var i=1;i<count;i++){
        var last=-44*inset+(rejoin.w+36)/2+8,firstBack=136+courtEdge-172,offset=firstBack+(last-firstBack)*(i-1)/(count-2);
        back.push(make('back'+i,offset,floor.y-(rise-lift)*i/count,36));
      }
      back.push(rejoin);
      var low=make('flank-low',courtOffset+design.width/2+24,floor.y-16,28),high=make('flank-high',courtOffset+design.width/2+68,floor.y-32,28);
      var hops=[];
      [out,back,[floor,low,high]].forEach(function(ps){for(var i=1;i<ps.length;i++)hops.push([ps[i-1],ps[i]],[ps[i],ps[i-1],true]);});
      var all=before.concat(added);
      if(!hops.every(function(h){return canHop(h[0],h[1])&&(h[2]||all.every(function(p){return !blocks(p,h[0],h[1]);}));}))continue;
      if(!added.every(function(p){
        for(var x=p.x;x<=p.x+p.w;x+=2)if(ground(x)-p.y<6)return false;
        return before.every(function(q){return !q.solid||p.x>=q.x+q.w||p.x+p.w<=q.x||p.y<=q.y||p.y-26>=q.y+(q.h||6);})&&all.every(function(q){return !clash(p,q);})&&protectedHops.every(function(h){return !blocks(p,h[0],h[1]);});
      }))continue;
      if(!hops.every(function(h){
        if(!h[2])return true;
        return [30,60,120].every(function(hz){return lands(h[0],h[1],all,.85,1,1,hz)&&lands(h[0],h[1],all,1.25,1.15,1.2,hz);});
      }))continue;
      var center=floor.x+floor.w/2,items=['feathers','dew','embers'].filter(function(item){return item!==E.item;});
      if(random()<.5)items.reverse();
      L.platforms=L.platforms.concat(added);
      return {id:id,family:design.family,name:design.name,fork:fork.id,rejoin:rejoin.id,
        outbound:out.map(function(p){return p.id;}),return:back.map(function(p){return p.id;}),platformIds:added.map(function(p){return p.id;}),
        arena:{x:floor.x,y:floor.y,w:floor.w,platformId:floor.id,floorId:floor.id,left:Math.min(floor.x,high.x),right:Math.max(floor.x+floor.w,high.x+high.w),top:floor.y-48,bottom:floor.y+28,perchIds:[low.id,high.id]},
        focus:{x:center,y:floor.y,platformId:floor.id},
        choices:items.map(function(item,i){return {id:id+':choice'+i,x:center+(i?20:-20),y:floor.y,platformId:floor.id,item:item};})};
    }
    return null;
  }
  function hollowCanopy(L,ground){
    if(L.hollowCanopy||L.stage!==1||!L.designed||L.replacePicture!==true||L.masterSceneSourceKey!=='62becf64d12195c503d6616439c1e9f909fd574447fa202e3e72e46b4b898c8f')return;
    var soil=L.authoredSoilY,origin=L.origin;
    if(!Number.isFinite(soil))return;
    var left=L.platforms.find(function(p){return p.id==='1:d1';}),right=L.platforms.find(function(p){return p.id==='1:d4';});
    if(!left||!right)return;
    // Optional native branch furnishing joins the two existing upper terraces.
    // The registered Figma surfaces and their source binding stay intact.
    var added=[];
    function branch(id,x,rise,w){
      var p={id:'canopy:1:'+id,x:origin+x,y:soil-rise,w:w,depth:7,style:'branch',route:x<0?-1:1,optional:true,canopy:true,floor:Math.round(ground(origin+x+w/2))};
      L.platforms.push(p);added.push(p);return p;
    }
    var crossing=[left];
    [[-112,32],[-68,32],[-24,44],[32,28],[72,20]].forEach(function(r,i){crossing.push(branch('cross'+i,r[0],200,r[1]));});
    crossing.push(right);
    var west=branch('west-nook',-274,140,42),east=branch('east-nook',234,100,40);
    var secrets=L.spots.secret||[];if(!Array.isArray(secrets))secrets=[secrets];
    [west,crossing[3],east].forEach(function(p){secrets.push({x:p.x+Math.floor(p.w/2),y:p.y,platformId:p.id,side:p.route});});
    L.spots.secret=secrets;
    L.hollowCanopy={name:'Canopy crossing',path:crossing.map(function(p){return p.id;}),platformIds:added.map(function(p){return p.id;}),nooks:[west.id,east.id]};
  }
  function furnish(L,ground,wet){
    hollowCanopy(L,ground);
    if(L.expedition||L.stage<1||L.stage>20)return L;
    var d=stages[L.stage-1],seed=L.seed>>>0,side=L.picture?-1:((seed^L.stage)&1?1:-1),pattern=patterns[d[1]],edge=L.origin+side*65;
    L.platforms.forEach(function(p){edge=side>0?Math.max(edge,p.x+p.w):Math.min(edge,p.x);});
    var x=Math.round(edge+side*136),best=null;
    for(var s=0;s<240;s+=4){
      var cx=x+side*s,lo=Infinity,hi=-Infinity,dry=true;
      for(var z=-16;z<=16;z+=2){var y=ground(cx+z);lo=Math.min(lo,y);hi=Math.max(hi,y);if(wet&&wet(cx+z))dry=false;}
      if(dry&&hi-lo<=4){best={x:cx,y:Math.floor(lo)};break;}
    }
    if(!best){
      for(var s=0;s<2000;s+=4){var cx=x+side*s;if(!wet||!wet(cx)){best={x:cx,y:Math.floor(ground(cx))};break;}}
    }
    best=best||{x:x,y:Math.floor(ground(x))};
    var random=roll(seed,L.stage),route=[],rooms=[],nodes=[],sections=[],path=[],lane=0,y=best.y;
    var first=Math.floor(random()*motifs.length),second=(first+1+Math.floor(random()*(motifs.length-1)))%motifs.length;
    var items=['feathers','dew','embers'],item=items[(items.indexOf(d[3])+Math.floor(random()*3))%3];
    var E=L.expedition={name:d[0],shape:d[1],mode:d[2],item:item,guards:d[4].slice(),egg:d[5],side:side,start:{x:best.x,y:ground(best.x)},path:route,rooms:rooms,nodes:nodes,sections:sections};
    function ledge(id,cx,py,w){var p={id:'exp:'+L.stage+':'+id,x:Math.round(cx-w/2),y:Math.round(py),w:w,depth:6,style:L.stage<6?'stone':L.stage<11?'ruin':L.stage<16?'root':'ruin',route:side,optional:true,expedition:true,floor:Math.round(ground(cx))};L.platforms.push(p);return p;}
    function step(next,rise,w,section){
      y-=rise;lane=next;
      var p=ledge(route.length,best.x+side*lane*44,y,w);
      p.section=section;p.lane=lane;route.push(p.id);path.push(p);return p;
    }
    function node(p){nodes.push({x:p.x+p.w/2,y:p.y,platformId:p.id});p.rest=true;}
    for(var i=0;i<7;i++){var p=step(pattern[i%pattern.length],16,36,'approach');if(i===5)node(p);}
    [first,second].forEach(function(which){
      // Early districts teach both motifs without repeating their upper transit beats.
      var motif=motifs[which],mirror=lane>1,span=L.stage<6?4:motif.lanes.length;
      var lanes=motif.lanes.slice(0,span).map(function(c){return mirror?3-c:c;}),start=route.length;
      while(Math.abs(lanes[0]-lane)>1)step(lane+Math.sign(lanes[0]-lane),18,36,motif.id);
      lanes.forEach(function(next,j){
        if(next===lane&&j===0)return;
        var width=motif.widths[j],rise=motif.rises[j];
        if(L.stage>10&&rise<18)rise++;
        var p=step(next,rise,width,motif.id);
        if(j===lanes.length-1)p.depth=8;
      });
      var minimum=L.stage<6?3:6;
      while(route.length-start<minimum)step(lane===0?1:lane===3?2:lane-1,18,48,motif.id);
      if(L.stage<6)while(lane!==0&&lane!==3)step(lane+(lane<2?-1:1),18,40,motif.id);
      var landing=path[path.length-1],center=landing.x+landing.w/2;
      landing.w=motif.landing;landing.x=Math.round(center-landing.w/2);landing.depth=9;
      node(landing);
      sections.push({id:motif.id,name:motif.name,rhythm:motif.rhythm,from:route[start],to:landing.id,
        platformIds:route.slice(start),landing:{x:center,y:landing.y,platformId:landing.id},
        beats:path.slice(start).map(function(p){return {platformId:p.id,kind:p===landing?'rest':p.w>=48?'landing':'traverse'};})});
    });
    var used=[],roomOffset=Math.floor(random()*roomKinds.length),steps=path.length;
    [4,Math.floor(steps/2)+1,steps-2].forEach(function(want,r){
      var choices=[];
      for(var at=3;at<steps;at++)if((path[at].lane===0||path[at].lane===3)&&used.every(function(other){return Math.abs(path[other].y-path[at].y)>=(L.stage<6?48:64);}))choices.push(at);
      choices.sort(function(a,b){return Math.abs(a-want)-Math.abs(b-want)||a-b;});
      var at=choices[0];used.push(at);
      var source=path[at],dir=source.lane===0?-side:side,kind=roomKinds[(r+roomOffset)%roomKinds.length];
      var cx=source.x+source.w/2+dir*((source.w+kind.width)/2+kind.gap);
      var room=ledge('room'+r,cx,source.y+kind.drop,kind.width);
      var nx=cx+dir*((kind.width+kind.nook)/2+kind.gap),nook=ledge('nook'+r,nx,room.y-kind.rise,kind.nook);
      room.style=nook.style=kind.style;room.depth=kind.id==='gallery'?9:8;nook.depth=8;
      var branch={x:source.x+source.w/2,y:source.y,platformId:source.id},outbound=[source.id,room.id,nook.id];
      rooms.push({kind:kind.id,name:kind.name,from:source.id,platformId:room.id,x:cx,y:room.y,side:dir,
        branch:branch,returnAnchor:branch,outbound:outbound,return:outbound.slice().reverse(),
        bounds:{x:Math.min(room.x,nook.x),y:Math.min(room.y,nook.y),w:Math.max(room.x+room.w,nook.x+nook.w)-Math.min(room.x,nook.x),h:Math.max(room.y,nook.y)-Math.min(room.y,nook.y)+8},
        secret:{x:nx,y:nook.y,platformId:nook.id}});
    });
    E.summit={x:nodes[2].x,y:nodes[2].y,platformId:nodes[2].platformId};
    E.descent=route.slice().reverse();
    E.circuit=circuit(L,E,ground,random);
    return L;
  }
  var api={stages:stages,motifs:motifs,furnish:furnish};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MaxExpeditions=api;
})(typeof window==='object'?window:globalThis);
