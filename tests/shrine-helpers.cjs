const assert=require('node:assert/strict');

function clearShrineGuards(g,e){
  for(let tick=0;tick<1600&&(e.guardsRemaining||g.floatKrek.some(k=>k.eventId===e.id));tick++){
    g.updateEncounters(.05);
    for(const k of [...g.floatKrek])if(k.eventId===e.id)g.damagePest(k,10000,k.x);
  }
  assert.equal(e.guardsRemaining,0,'all scheduled guards reached the landing');
  assert.equal(g.floatKrek.some(k=>k.eventId===e.id),false);
}
module.exports={clearShrineGuards};
