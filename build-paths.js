(function(root){
  'use strict';
  var paths=['Cultivator','Warden','Vanguard'];
  var perks=[
    {id:'growth',name:'Quick roots',desc:'35% faster growth',path:0},
    {id:'water',name:'Deep soil',desc:'30% less water loss',path:0},
    {id:'yield',name:'Seed rain',desc:'+1 seed per harvest',path:0},
    {id:'regen',name:'Sap',desc:'Plants recover health',path:0},
    {id:'bloom',name:'Bloom pulse',desc:'Harvest heals nearby plants',path:0,max:1,needs:{growth:2,regen:1}},
    {id:'tender',name:'Green thumb',desc:'12% stronger tending each rank',path:0,max:5},
    {id:'spread',name:'Wide watering',desc:'Water splashes farther to neighbours',path:0,max:4},
    {id:'robot',name:'Companion',desc:'Upgrade your watering robot',path:1,max:3,classId:'mech'},
    {id:'shield',name:'Thorns',desc:'22% less pest damage',path:1},
    {id:'bark',name:'Barkskin',desc:'8% less plant damage each rank',path:1,max:4},
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
    {id:'chain',name:'Chain bloom',desc:'Pest kills strike nearby pests',path:2,max:1,needs:{blast:2,cadence:1}}
  ];
  function max(id){var p=perks.find(function(q){return q.id===id;});return p?p.max||5:0;}
  function empty(){var p={};perks.forEach(function(q){p[q.id]=0;});return p;}
  function allowed(q,classId){return !q.classId||q.classId===(classId||'mech');}
  function clean(p,classId){var out=empty();perks.forEach(function(q){if(allowed(q,classId))out[q.id]=Math.max(0,Math.min(max(q.id),Number(p&&p[q.id])|0));});return out;}
  function available(p,q,classId){
    var id=typeof q==='string'?q:q&&q.id;q=perks.find(function(option){return option.id===id;});
    return !!q&&allowed(q,classId)&&(p[q.id]||0)<max(q.id)&&Object.keys(q.needs||{}).every(function(key){return (p[key]||0)>=q.needs[key];});
  }
  function choices(p,level,salt,classId){
    p=clean(p,classId);var score=paths.map(function(_,i){return perks.filter(function(q){return q.path===i;}).reduce(function(n,q){return n+p[q.id];},0);});
    var lead=score.indexOf(Math.max.apply(null,score)),out=[],base=Math.abs((level||1)+(salt||0));
    function take(path){
      var pool=perks.filter(function(q){return q.path===path&&available(p,q,classId)&&out.indexOf(q)<0;});
      if(!pool.length)return;
      var signature=pool.find(function(q){return q.needs;});
      out.push(signature||pool[base%pool.length]);
    }
    if(score[lead]>=2){take(lead);take(lead);take((lead+1+base%2)%3);}
    else {take(0);take(1);take(2);}
    perks.forEach(function(q){if(out.length<3&&available(p,q,classId)&&out.indexOf(q)<0)out.push(q);});
    return out;
  }
  var api={perks:perks,paths:paths,max:max,empty:empty,clean:clean,choices:choices,available:available};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MaxBuilds=api;
})(typeof window==='object'?window:globalThis);
