(function(root){
  'use strict';
  var paths=['Cultivator','Warden','Vanguard'];
  var perks=[
    {id:'growth',name:'Quick roots',desc:'35% faster growth',path:0},
    {id:'water',name:'Deep soil',desc:'30% less water loss',path:0},
    {id:'yield',name:'Seed rain',desc:'+1 seed per harvest',path:0},
    {id:'regen',name:'Sap',desc:'Plants recover health',path:0},
    {id:'bloom',name:'Bloom pulse',desc:'Harvest heals nearby plants',path:0,max:1,needs:{growth:2,regen:1}},
    {id:'robot',name:'Companion',desc:'Unlock or upgrade your watering rover',path:1,max:3},
    {id:'shield',name:'Thorns',desc:'22% less pest damage',path:1},
    {id:'magnet',name:'Seed sense',desc:'Wider seed collection',path:1},
    {id:'luck',name:'Golden seeds',desc:'More rare seeds',path:1},
    {id:'recycle',name:'Rain engine',desc:'Harvest refills your robot',path:1,max:1,needs:{robot:3,yield:1}},
    {id:'blast',name:'Big blast',desc:'Larger explosions',path:2},
    {id:'slow',name:'Sticky pollen',desc:'Pests fly more slowly',path:2},
    {id:'cadence',name:'Quick fuse',desc:'12% faster throws',path:2,max:3},
    {id:'dash',name:'Light step',desc:'17% faster dodge recovery',path:2,max:3},
    {id:'chain',name:'Chain bloom',desc:'Pest kills strike nearby pests',path:2,max:1,needs:{blast:2,cadence:1}}
  ];
  function max(id){var p=perks.find(function(q){return q.id===id;});return p?p.max||5:0;}
  function empty(){var p={};perks.forEach(function(q){p[q.id]=0;});return p;}
  function clean(p){var out=empty();perks.forEach(function(q){out[q.id]=Math.max(0,Math.min(max(q.id),Number(p&&p[q.id])|0));});return out;}
  function available(p,q){return (p[q.id]||0)<max(q.id)&&Object.keys(q.needs||{}).every(function(id){return (p[id]||0)>=q.needs[id];});}
  function choices(p,level,salt){
    p=clean(p);var score=paths.map(function(_,i){return perks.filter(function(q){return q.path===i;}).reduce(function(n,q){return n+p[q.id];},0);});
    var lead=score.indexOf(Math.max.apply(null,score)),out=[],base=Math.abs((level||1)+(salt||0));
    function take(path){
      var pool=perks.filter(function(q){return q.path===path&&available(p,q)&&out.indexOf(q)<0;});
      if(!pool.length)return;
      var signature=pool.find(function(q){return q.needs;});
      out.push(signature||pool[base%pool.length]);
    }
    if(score[lead]>=2){take(lead);take(lead);take((lead+1+base%2)%3);}
    else {take(0);take(1);take(2);}
    perks.forEach(function(q){if(out.length<3&&available(p,q)&&out.indexOf(q)<0)out.push(q);});
    return out;
  }
  var api={perks:perks,paths:paths,max:max,empty:empty,clean:clean,choices:choices};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MaxBuilds=api;
})(typeof window==='object'?window:globalThis);
