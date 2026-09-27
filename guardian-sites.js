(function(root){
  'use strict';
  // Each row is a level design, not a random coordinate roll: a ground court
  // under one route, a raised rest on the other, and the landmark's approach.
  // The seeded layout may bend a route or mirror its landmark; the identity
  // and approach of each destination stay the same.
  var designs=[null,
    ['Ice bridge bank','Tank gallery','Eastern seed store'],
    ['Mill yard','Station balcony','Eastern gate'],
    ['Western aqueduct bank','Eastern crossing lookout','Aqueduct forecourt',-1,.72,.58],
    ['Eastern chapel approach','Western ruined gallery','Chapel forecourt',1,.72,.64],
    ['Western root basin','Eastern root landing','Root Stair approach',-1,.65,.72],
    ['Eastern terrace foot','Western cairn overlook','Cairn forecourt',1,.72,.68],
    ['Western lantern clearing','Eastern canopy rest','Lantern Tree approach',-1,.7,.64],
    ['Eastern bridge bank','Western sky landing','Sky Stair forecourt',1,.75,.58],
    ['Western tower court','Eastern broken gallery','Collapsed Tower approach',-1,.7,.67],
    ['Eastern bell clearing','Western root balcony','Bell Cellar forecourt',1,.66,.7],
    ['Western frost basin','Eastern quarry overlook','Quarry forecourt',-1,.72,.64],
    ['Eastern willow clearing','Western branch rest','Willow forecourt',1,.72,.64],
    ['Western tower bank','Eastern crossing rest','Twin Towers approach',-1,.72,.67],
    ['Eastern crypt court','Western ruined lookout','Catacomb forecourt',1,.7,.66],
    ['Western moon basin','Eastern moon landing','Moon Steps forecourt',-1,.75,.7],
    ['Eastern ember terrace','Western giant landing','Giant Stair forecourt',1,.72,.7],
    ['Western nest clearing','Eastern crown branch','Nest Crown approach',-1,.7,.67],
    ['Eastern sluice bank','Western crossing rest','Sluice Gate forecourt',1,.74,.62],
    ['Western gate court','Eastern ruined balcony','Gatehouse approach',-1,.72,.67],
    ['Eastern throne court','Western crown gallery','Throne Vault approach',1,.7,.9]
  ];
  var pictureSites={
    'seed-vault':[
      {key:'ice-bank',x:244,y:253,courtX:244},
      {key:'tank-gallery',x:96,y:123,platformId:'l0',courtX:96},
      {key:'east-store',x:500,y:253,courtX:500}
    ],
    'railway-ruins':[
      {key:'mill-yard',x:224,y:200,courtX:224},
      {key:'station-balcony',x:770,y:146,platformId:'l3',courtX:770},
      {key:'east-gate',x:974,y:200,courtX:974}
    ]
  };
  function center(p){return p.x+Math.floor(p.w/2);}
  function groundAt(L,ground,x){return L.ground&&x>=L.ground.x0&&x<=L.ground.x1?L.ground.y:ground(x);}
  function clearSoil(L,ground,wet,x){
    var y=groundAt(L,ground,x);
    if(wet&&wet(x))return false;
    return !L.platforms.some(function(p){return p.solid&&p.x<x+5&&p.x+p.w>x-5&&p.y<y-5&&p.y+(p.h||6)>y-32;});
  }
  function court(L,ground,wet,x){
    x=Math.round(x);var y=groundAt(L,ground,x),lo=y,hi=y;
    for(var dx=-50;dx<=50;dx+=2){
      if(!clearSoil(L,ground,wet,x+dx))return null;
      var floor=groundAt(L,ground,x+dx);lo=Math.min(lo,floor);hi=Math.max(hi,floor);
      if(hi-lo>24)return null;
    }
    var left=x-50,right=x+50;
    for(var n=52;n<=112;n+=2){if(!clearSoil(L,ground,wet,x-n)||Math.abs(groundAt(L,ground,x-n)-y)>24)break;left=x-n;}
    for(var n=52;n<=112;n+=2){if(!clearSoil(L,ground,wet,x+n)||Math.abs(groundAt(L,ground,x+n)-y)>24)break;right=x+n;}
    return {courtX:x,courtY:y,courtLeft:left,courtRight:right};
  }
  function searchCourt(L,ground,wet,anchor,radius){
    for(var d=0;d<=radius;d+=4)for(var side=0;side<(d?2:1);side++){
      var x=anchor+(side?-d:d),c=court(L,ground,wet,x);if(c)return c;
    }
    return null;
  }
  function routePath(L,side){
    var r=L.routes.find(function(r){return r.side===side;});
    return r?r.platformIds.map(function(id){return L.platforms.find(function(p){return p.id===id;});}).filter(Boolean):[];
  }
  function routeOrder(L,side,fraction){
    var path=routePath(L,side),at=Math.max(2,Math.round((path.length-1)*fraction));
    return path.map(function(p,i){return {p:p,i:i};}).filter(function(v){return v.i>=2;}).sort(function(a,b){return Math.abs(a.i-at)-Math.abs(b.i-at)||b.i-a.i;});
  }
  function clearShrine(L,p,x){
    // A designed trial is an authored landmark; choose another rest rather
    // than relocating the artist's interaction marker.
    if(L.designed&&(L.trials||[]).some(function(t){return Math.abs(t.x-x)<22&&Math.abs(t.y-p.y)<7;}))return false;
    return p.w>=32&&x-p.x>=12&&p.x+p.w-x>=12&&!L.platforms.some(function(q){return q!==p&&q.x<x+11&&q.x+q.w>x-11&&q.y<p.y&&q.y+(q.solid?q.h||6:4)>p.y-27;});
  }
  function routeSite(L,ground,wet,side,fraction,raised){
    var order=routeOrder(L,side,fraction);
    for(var i=0;i<order.length;i++){
      var p=order[i].p,x=center(p),c;
      if(raised&&!clearShrine(L,p,x))continue;
      if(raised&&Math.abs(x-L.origin)+Math.abs(groundAt(L,ground,L.origin)-p.y)<160)continue;
      c=searchCourt(L,ground,wet,x,60);if(!c)continue;
      if(!raised&&Math.abs(c.courtX-L.origin)<160)continue;
      return Object.assign({x:raised?x:c.courtX,y:raised?p.y:c.courtY,platformId:raised?p.id:null,route:side,routePlatform:p.id},c);
    }
    if(!raised){
      // A crossing may finish over water. Its court belongs on the outer dry
      // bank of that same route, not back beside the entrance.
      var path=routePath(L,side),end=path.reduce(function(a,p){return side*center(p)>side*a?center(p):a;},L.origin+side*160);
      for(var d=0;d<=520;d+=4){var c=court(L,ground,wet,end+side*d);if(c&&Math.abs(c.courtX-L.origin)>=160)return Object.assign({x:c.courtX,y:c.courtY,platformId:null,route:side,routePlatform:path.length?path[path.length-1].id:null},c);}
    }
    return null;
  }
  function landmarkSite(L,ground,wet,others){
    function separate(c){return Math.abs(c.courtX-L.origin)>=160&&!(others||[]).some(function(s){return s&&Math.abs(s.courtX-c.courtX)<128;});}
    var p=L.place;
    if(p){
      // Stand outside the foundation, never inside a secret wall or atop the
      // cache. Both approaches connect to the place's tested entrance ramps.
      for(var flank=0;flank<2;flank++){
        var side=flank?p.side:-p.side,edge=side<0?p.bounds.x:p.bounds.x+p.bounds.w;
        for(var off=56;off<=260;off+=4){var c=court(L,ground,wet,edge+side*off);if(c&&separate(c))return Object.assign({x:c.courtX,y:c.courtY,platformId:null,landmark:p.name},c);}
      }
    }
    // Designed gardens without a place use their far route gate, still an
    // authored approach rather than a spawn-relative random coordinate.
    var ends=L.routes.map(function(r){var ps=routePath(L,r.side);return {side:r.side,x:ps.reduce(function(a,p){return r.side*center(p)>r.side*a?center(p):a;},L.origin)};});
    for(var i=0;i<ends.length;i++)for(var off=100;off<=360;off+=4){var c=court(L,ground,wet,ends[i].x+ends[i].side*off);if(c&&separate(c))return Object.assign({x:c.courtX,y:c.courtY,platformId:null,landmark:'Outer route gate'},c);}
    return null;
  }
  function districtCourt(L,ground,wet,side,others){
    var anchors=[];
    if(L.place){anchors.push(L.place.bounds.x-56,L.place.bounds.x+L.place.bounds.w+56);}
    L.routes.forEach(function(r){var path=routePath(L,r.side);if(path.length)anchors.push(center(path[path.length-1])+r.side*56);});
    if(L.expedition)anchors.push(L.expedition.start.x);
    anchors.sort(function(a,b){return (side*(b-L.origin)>0)-(side*(a-L.origin)>0)||Math.abs(a-L.origin)-Math.abs(b-L.origin);});
    if(!anchors.length)anchors.push(L.origin+side*180);
    for(var radius=0;radius<=4096;radius+=8)for(var i=0;i<anchors.length;i++)for(var dir=-1;dir<=1;dir+=2){
      var x=anchors[i]+dir*radius;
      if(Math.abs(x-L.origin)<160||(others||[]).some(function(s){return s&&Math.abs(s.courtX-x)<160;}))continue;
      var c=court(L,ground,wet,x);if(c)return Object.assign({x:c.courtX,y:c.courtY,platformId:null,landmark:'Outer district court'},c);
    }
    // The production terrain always has dry banks. Retain a complete metadata
    // shape for externally supplied layouts too, without stopping game entry.
    var x=L.origin+side*(720+(others||[]).length*240),y=groundAt(L,ground,x);
    return {x:x,y:y,platformId:null,courtX:x,courtY:y,courtLeft:x-50,courtRight:x+50,unverified:true};
  }
  function alternateRaised(L,ground,wet,side,others){
    var list=routeOrder(L,side,.6).map(function(v){return v.p;});
    if(L.expedition)list=list.concat(L.expedition.path.slice(2,7).map(function(id){return L.platforms.find(function(p){return p.id===id;});}).filter(Boolean));
    for(var i=0;i<list.length;i++){
      var p=list[i],x=center(p);if(!clearShrine(L,p,x)||Math.abs(x-L.origin)+Math.abs(groundAt(L,ground,L.origin)-p.y)<160)continue;
      var c=searchCourt(L,ground,wet,x,60);if(!c||(others||[]).some(function(s){return s&&Math.abs(s.courtX-c.courtX)<128;}))continue;
      return Object.assign({x:x,y:p.y,platformId:p.id,route:p.route,routePlatform:p.id,approach:p.expedition?L.expedition.name+' lower landing':null},c);
    }
    return null;
  }
  function separateTrial(L,site){
    if(!site||!site.platformId||L.picture||L.designed)return;
    (L.trials||[]).forEach(function(t){
      if(Math.abs(t.x-site.x)>=22||Math.abs(t.y-site.y)>=7)return;
      var path=routePath(L,site.route),target=path.filter(function(p){return p.id!==site.platformId&&p.w>=24;}).sort(function(a,b){return Math.abs(a.y-site.y)-Math.abs(b.y-site.y);})[0];
      if(target){t.x=center(target);t.y=target.y;t.platformId=target.id;}
    });
  }
  function furnish(L,ground,wet){
    if(!L||L.guardianSites||!designs[L.stage])return L;
    var row=designs[L.stage],raw=pictureSites[L.picture],sites;
    if(raw)sites=raw.map(function(s,i){
      var x=L.art.x+s.x,y=L.art.y+s.y,c=court(L,ground,wet,L.art.x+s.courtX);
      if(!c)throw Error('Guardian court is blocked: '+L.picture+' '+s.key);
      return Object.assign({id:L.stage+':'+s.key,name:row[i],x:x,y:y,platformId:s.platformId||null},c);
    });
    else{
      var side=row[3]||-1;
      sites=[routeSite(L,ground,wet,side,row[4]||.7,false)];
      if(!sites[0])sites[0]=districtCourt(L,ground,wet,side,[]);
      sites.push(routeSite(L,ground,wet,-side,row[5]||.65,true)||alternateRaised(L,ground,wet,side,sites)||districtCourt(L,ground,wet,-side,sites));
      sites.push(landmarkSite(L,ground,wet,sites)||districtCourt(L,ground,wet,side,sites));
      separateTrial(L,sites[1]);
      sites.forEach(function(s,i){s.id=L.stage+':'+['route-court','route-lookout','landmark-court'][i];s.name=s.approach||row[i];});
    }
    L.guardianSites=sites;return L;
  }
  var api={furnish:furnish,designs:designs,pictureSites:pictureSites};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MaxGuardianSites=api;
})(typeof window==='object'?window:globalThis);
