(function(root){
  'use strict';
  var paths=['Cultivator','Warden','Vanguard'];
  var perks=[
    {id:'needle',name:'Heavy boots',desc:'Kicks and splits stomps deal 25% more damage per rank',path:2,max:3,classId:'runner'},
    {id:'fletching',name:'Wide stance',desc:'Kicks reach 3 px farther and splits stomps 4 px farther per rank',path:1,max:3,classId:'runner'},
    {id:'tailwind',name:'Ring tempo',desc:'12% faster skill recovery per rank',path:0,max:3,classId:'runner'},
    {id:'crosswind',name:'Crowd crush',desc:'Each additional pest caught in a kick takes 25% more damage',path:2,max:1,classId:'runner',needs:{needle:1,fletching:1}},
    {id:'updraft',name:'Flying press',desc:'Airborne kicks deal 25% more damage; splits stomps reach 12 px farther',path:0,max:1,classId:'runner',needs:{tailwind:2,spring:1}},
    {id:'fault',name:'Fault line',desc:'Cleaves reach 6 px farther per rank',path:2,max:3,classId:'bulwark'},
    {id:'counter',name:'Reprisal',desc:'Parries punish pests 25% harder per rank',path:1,max:3,classId:'bulwark'},
    {id:'bedrock',name:'Stone pulse',desc:'Brace deals 0.4 more damage per rank',path:0,max:3,classId:'bulwark'},
    {id:'aftershock',name:'Aftershock',desc:'A successful parry releases a second cleave',path:2,max:1,classId:'bulwark',needs:{fault:2,counter:1}},
    {id:'sanctuary',name:'Sanctuary',desc:'Brace restores 15% health and 12% water to nearby plants',path:0,max:1,classId:'bulwark',needs:{bedrock:2,tender:1}},
    {id:'colony',name:'Far spores',desc:'Spore chains reach 5 px farther per rank',path:1,max:3,classId:'herbalist'},
    {id:'ferment',name:'Ferment',desc:'Spores deal 20% more damage per rank',path:2,max:3,classId:'herbalist'},
    {id:'symbiosis',name:'Symbiosis',desc:'Spore hits heal and water nearby plants',path:0,max:3,classId:'herbalist'},
    {id:'outbreak',name:'Outbreak',desc:'Spores chain to two extra pests, even far from plants',path:2,max:1,classId:'herbalist',needs:{colony:1,ferment:2}},
    {id:'symphony',name:'Living chorus',desc:'Bloom heals up to 50% more and readies your next attack',path:0,max:1,classId:'herbalist',needs:{symbiosis:2,regen:1}},
    {id:'varnish',name:'Many hands',desc:'Flurry lands one extra punch per rank',path:1,max:3,classId:'polge'},
    {id:'splinters',name:'Heavy hands',desc:'Uppercuts deal 25% more damage per rank',path:2,max:3,classId:'polge'},
    {id:'raincoat',name:'Ringcraft',desc:'Combo hits restore 0.2 s of Flurry per rank',path:0,max:3,classId:'polge'},
    {id:'haymaker',name:'Haymaker',desc:'Uppercuts strike every pest within 36 px',path:2,max:1,classId:'polge',needs:{splinters:2,raincoat:1}},
    {id:'secondwind',name:'Second wind',desc:'Flurry restores 15% health and 12% water to nearby plants',path:1,max:1,classId:'polge',needs:{varnish:2,dash:1}},
    {id:'growth',name:'Quick roots',desc:'35% faster growth',path:0},
    {id:'water',name:'Deep soil',desc:'30% less water loss',path:0},
    {id:'yield',name:'Seed rain',desc:'More seeds per harvest',path:0},
    {id:'regen',name:'Sap',desc:'Watered plants heal faster',path:0},
    {id:'bloom',name:'Bloom pulse',desc:'Harvest heals and waters nearby plants',path:0,max:1,needs:{growth:2,regen:1}},
    {id:'tender',name:'Green thumb',desc:'12% stronger tending each rank',path:0,max:5},
    {id:'spread',name:'Wide watering',desc:'Water splashes farther to neighbours',path:0,max:4},
    {id:'robot',name:'Companion',desc:'A bigger, faster watering robot',path:1,max:4,classId:'mech'},
    {id:'shield',name:'Thorns',desc:'22% less bite damage',path:1},
    {id:'bark',name:'Barkskin',desc:'22% less root, spore, blast and drain damage',path:1,max:4},
    {id:'mulch',name:'Mulch',desc:'Defeated pests heal and water nearby plants',path:1,max:4},
    {id:'magnet',name:'Seed sense',desc:'Wider seed collection',path:1},
    {id:'luck',name:'Golden seeds',desc:'More rare seeds',path:1},
    {id:'recycle',name:'Rain engine',desc:'Harvest refills your robot',path:1,max:1,classId:'mech',needs:{robot:3,yield:1}},
    {id:'blast',name:'Big blast',desc:'Larger explosions',path:2,classIds:['mech','sligo']},
    {id:'slow',name:'Sticky pollen',desc:'Pests fly more slowly',path:2},
    {id:'cadence',name:'Quick hands',desc:'12% less time between attacks',path:2,max:3},
    {id:'dash',name:'Light step',desc:'17% faster dodge recovery',path:2,max:3},
    {id:'stride',name:'Long stride',desc:'6% faster movement each rank',path:2,max:5},
    {id:'spring',name:'Spring step',desc:'6% stronger jumps each rank',path:2,max:4},
    {id:'chain',name:'Chain bloom',desc:'Blast kills strike nearby pests',path:2,max:1,classIds:['mech','sligo'],needs:{blast:2,cadence:1}},
    {id:'dew',name:'Morning dew',desc:'Dry plants collect extra moisture',path:0,max:3},
    {id:'bounty',name:'Bumper crop',desc:'20% chance per rank of a double harvest',path:0,max:3},
    {id:'bramble',name:'Bramble',desc:'Pests that bite a plant are cut by thorns',path:1,max:3},
    {id:'evergreen',name:'Evergreen',desc:'Once per garden a dying plant lives on',path:1,max:1,needs:{shield:1,bark:1}},
    {id:'wild',name:'Wild spark',desc:'12% chance per rank of triple blast damage',path:2,max:3,classIds:['mech','sligo']},
    {id:'glue',name:'Sap burst',desc:'Blasts slow ordinary pests by 80%',path:2,max:3,classIds:['mech','sligo']},
    {id:'fleet',name:'Robot crew',desc:'One more watering robot',path:1,max:2,classId:'mech',needs:{robot:2}},
    {id:'sentry',name:'Guard bot',desc:'A robot that zaps pests off plants; ranks zap harder',path:1,max:3,classId:'mech',needs:{robot:2}}
  ];
  function max(id){var p=perks.find(function(q){return q.id===id;});return p?p.max||5:0;}
  function empty(){var p={};perks.forEach(function(q){p[q.id]=0;});return p;}
  function allowed(q,classId){classId=classId||'mech';return (!q.classId||q.classId===classId)&&(!q.classIds||q.classIds.indexOf(classId)>=0);}
  function clean(p,classId){var out=empty();perks.forEach(function(q){if(allowed(q,classId))out[q.id]=Math.max(0,Math.min(max(q.id),Number(p&&p[q.id])|0));});return out;}
  function available(p,q,classId,mode){
    var id=typeof q==='string'?q:q&&q.id;q=perks.find(function(option){return option.id===id;});
    p=p||{};
    return !!q&&allowed(q,classId)&&inMode(q,mode)&&(p[q.id]||0)<max(q.id)&&Object.keys(q.needs||{}).every(function(key){return (p[key]||0)>=q.needs[key];});
  }
  var tidePerks=['growth','water','regen','tender','shield','bark','mulch','blast','slow','cadence','dash','stride','spring','chain','wild','glue',
    'needle','fletching','tailwind','crosswind','updraft','fault','counter','bedrock','aftershock','sanctuary',
    'colony','ferment','symbiosis','outbreak','symphony','varnish','splinters','raincoat','haymaker','secondwind'];
  var seedlessPerks=['yield','bloom','spread','magnet','luck','recycle','bounty'];
  function inMode(q,mode){return mode==='high-tide'?tidePerks.indexOf(q.id)>=0:mode!=='last-seed'||seedlessPerks.indexOf(q.id)<0;}
  function catalogue(classId,mode){return perks.filter(function(q){return allowed(q,classId)&&inMode(q,mode);});}
  function unlocks(p,id,classId,mode){
    p=clean(p,classId);
    if(!available(p,id,classId)||!catalogue(classId,mode).some(function(q){return q.id===id;}))return [];
    var next=Object.assign({},p);next[id]++;
    return catalogue(classId,mode).filter(function(q){return q.needs&&!available(p,q,classId)&&available(next,q,classId);});
  }
  function hash(text){var h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function roller(seed){return function(){seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  function continuation(p,pool,classId,mode){
    function invested(id){return Math.max(0,(p[id]||0)-(id==='robot'&&(classId||'mech')==='mech'?1:0));}
    var progress={},best=0;
    catalogue(classId,mode).forEach(function(q){
      if(!q.needs||p[q.id])return;
      var keys=Object.keys(q.needs),spent=keys.reduce(function(n,id){return n+Math.min(q.needs[id],invested(id));},0);
      if(!spent)return;
      var missing=keys.filter(function(id){return p[id]<q.needs[id]&&pool.some(function(a){return a.id===id;});});
      if(!missing.length)return;
      var total=keys.reduce(function(n,id){return n+q.needs[id];},0),score=spent/total;
      missing.forEach(function(id){progress[id]=Math.max(progress[id]||0,score);best=Math.max(best,score);});
    });
    return best?pool.filter(function(q){return progress[q.id]===best;}):pool.filter(function(q){return invested(q.id)>0;});
  }
  function choices(p,level,salt,classId,mode){
    p=clean(p,classId);
    var pool=catalogue(classId,mode).filter(function(q){return available(p,q,classId);}),out=[];
    if(!pool.length)return out;
    var roll=roller(hash([level|0,salt|0,classId||'mech',mode||'garden'].join(':')));
    function weight(q){return (q.classId?1.6:1)*(q.needs?.6:1);}
    function draw(list){
      var total=list.reduce(function(n,q){return n+weight(q);},0),r=roll()*total;
      for(var i=0;i<list.length;i++){r-=weight(list[i]);if(r<0)return list[i];}
      return list[list.length-1];
    }
    var fresh=pool.filter(function(q){return q.needs&&!p[q.id];});
    if(fresh.length)out.push(fresh[Math.floor(roll()*fresh.length)]);
    else{
      var next=continuation(p,pool,classId,mode);
      if(!next.length)next=pool.filter(function(q){return q.classId&&q.classId!=='mech'&&!q.needs;});
      if(next.length)out.push(draw(next));
    }
    var spent=Object.keys(p).reduce(function(n,id){return n+p[id];},0)-((classId||'mech')==='mech'?Math.min(1,p.robot):0);
    var early=spent<=1&&pool.some(function(q){return q.classId&&q.classId!=='mech';});
    var focus=out.length?out[0].path:null;
    while(out.length<3){
      var left=pool.filter(function(q){return out.indexOf(q)<0;});if(!left.length)break;
      if(focus!==null){var alternatives=left.filter(function(q){return q.path!==focus;});if(alternatives.length)left=alternatives;}
      if(early&&out.length===1){var identity=left.filter(function(q){return q.classId&&!q.needs;});if(identity.length)left=identity;}
      if(out.length===2){var other=left.filter(function(q){return out.every(function(pick){return pick.path!==q.path;});});if(other.length)left=other;}
      out.push(draw(left));
    }
    return out;
  }
  var api={perks:perks,paths:paths,max:max,empty:empty,clean:clean,choices:choices,available:available,unlocks:unlocks,catalogue:catalogue};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MaxBuilds=api;
})(typeof window==='object'?window:globalThis);
