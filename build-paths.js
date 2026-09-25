(function(root){
  'use strict';
  var paths=['Cultivator','Warden','Vanguard'];
  var perks=[
    {id:'varnish',name:'Varnish',desc:'Stand-ins take one more bite',path:1,max:3,classId:'polge'},
    {id:'splinters',name:'Splinters',desc:'Stand-ins burst harder and wider',path:2,max:3,classId:'polge'},
    {id:'raincoat',name:'Raincoat',desc:'Bursting stand-ins water nearby plants',path:0,max:3,classId:'polge'},
    {id:'growth',name:'Quick roots',desc:'35% faster growth',path:0},
    {id:'water',name:'Deep soil',desc:'30% less water loss',path:0},
    {id:'yield',name:'Seed rain',desc:'More seeds per harvest',path:0},
    {id:'regen',name:'Sap',desc:'Plants recover health',path:0},
    {id:'bloom',name:'Bloom pulse',desc:'Harvest heals nearby plants',path:0,max:1,needs:{growth:2,regen:1}},
    {id:'tender',name:'Green thumb',desc:'12% stronger tending each rank',path:0,max:5},
    {id:'spread',name:'Wide watering',desc:'Water splashes farther to neighbours',path:0,max:4},
    {id:'robot',name:'Companion',desc:'A bigger, faster watering robot',path:1,max:4,classId:'mech'},
    {id:'shield',name:'Thorns',desc:'22% less bite damage',path:1},
    {id:'bark',name:'Barkskin',desc:'22% less root, spore, blast and drain damage',path:1,max:4},
    {id:'mulch',name:'Mulch',desc:'Defeated pests heal nearby plants',path:1,max:4},
    {id:'magnet',name:'Seed sense',desc:'Wider seed collection',path:1},
    {id:'luck',name:'Golden seeds',desc:'More rare seeds',path:1},
    {id:'recycle',name:'Rain engine',desc:'Harvest refills your robot',path:1,max:1,classId:'mech',needs:{robot:3,yield:1}},
    {id:'blast',name:'Big blast',desc:'Larger explosions',path:2},
    {id:'slow',name:'Sticky pollen',desc:'Pests fly more slowly',path:2},
    {id:'cadence',name:'Quick fuse',desc:'12% faster throws',path:2,max:3},
    {id:'dash',name:'Light step',desc:'17% faster dodge recovery',path:2,max:3},
    {id:'stride',name:'Long stride',desc:'6% faster movement each rank',path:2,max:5},
    {id:'spring',name:'Spring step',desc:'6% higher jumps each rank',path:2,max:4},
    {id:'chain',name:'Chain bloom',desc:'Pest kills strike nearby pests',path:2,max:1,needs:{blast:2,cadence:1}},
    {id:'dew',name:'Morning dew',desc:'Dry plants refill with dew',path:0,max:3},
    {id:'bounty',name:'Bumper crop',desc:'20% chance per rank of a double harvest',path:0,max:3},
    {id:'bramble',name:'Bramble',desc:'Pests that bite a plant are cut by thorns',path:1,max:3},
    {id:'evergreen',name:'Evergreen',desc:'Once per garden a dying plant lives on',path:1,max:1,needs:{shield:1,bark:1}},
    {id:'wild',name:'Wild spark',desc:'12% chance per rank of a triple blast',path:2,max:3},
    {id:'glue',name:'Sap burst',desc:'Blasts glue pests in place',path:2,max:3},
    {id:'fleet',name:'Robot crew',desc:'One more watering robot',path:1,max:2,classId:'mech',needs:{robot:2}},
    {id:'sentry',name:'Guard bot',desc:'A robot that zaps pests off plants; ranks zap harder',path:1,max:3,classId:'mech',needs:{robot:2}}
  ];
  function max(id){var p=perks.find(function(q){return q.id===id;});return p?p.max||5:0;}
  function empty(){var p={};perks.forEach(function(q){p[q.id]=0;});return p;}
  function allowed(q,classId){return !q.classId||q.classId===(classId||'mech');}
  function clean(p,classId){var out=empty();perks.forEach(function(q){if(allowed(q,classId))out[q.id]=Math.max(0,Math.min(max(q.id),Number(p&&p[q.id])|0));});return out;}
  function available(p,q,classId){
    var id=typeof q==='string'?q:q&&q.id;q=perks.find(function(option){return option.id===id;});
    return !!q&&allowed(q,classId)&&(p[q.id]||0)<max(q.id)&&Object.keys(q.needs||{}).every(function(key){return (p[key]||0)>=q.needs[key];});
  }
  function hash(text){var h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function roller(seed){return function(){seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  // Risk of Rain item rolls: every offer is a fresh weighted draw, so no path can
  // lock the menu. A capstone the build has just unlocked always shows up, class
  // boons are a little more common for their own class, and the three picks span
  // at least two paths whenever the pool allows it. The roll is seeded, so the
  // host and every guest see the same offer.
  function choices(p,level,salt,classId){
    p=clean(p,classId);
    var pool=perks.filter(function(q){return available(p,q,classId);}),out=[];
    if(!pool.length)return out;
    var roll=roller(hash([level|0,salt|0,classId||'mech'].join(':')));
    function weight(q){return (q.classId?1.6:1)*(q.needs?.6:1);}
    function draw(list){
      var total=list.reduce(function(n,q){return n+weight(q);},0),r=roll()*total;
      for(var i=0;i<list.length;i++){r-=weight(list[i]);if(r<0)return list[i];}
      return list[list.length-1];
    }
    var fresh=pool.filter(function(q){return q.needs&&!p[q.id];});
    if(fresh.length)out.push(fresh[Math.floor(roll()*fresh.length)]);
    while(out.length<3){
      var left=pool.filter(function(q){return out.indexOf(q)<0;});if(!left.length)break;
      if(out.length===2&&out[0].path===out[1].path){var other=left.filter(function(q){return q.path!==out[0].path;});if(other.length)left=other;}
      out.push(draw(left));
    }
    return out;
  }
  var api={perks:perks,paths:paths,max:max,empty:empty,clean:clean,choices:choices,available:available};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MaxBuilds=api;
})(typeof window==='object'?window:globalThis);
