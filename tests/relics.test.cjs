const {test}=require('node:test');
const assert=require('node:assert/strict');
const relics=import('../relics.mjs');

test('only the signed-in owner receives all relics; future grants are per account and cannot come from a display name',async()=>{
  const {relicCollection}=await relics;
  assert.deepEqual(relicCollection({id:'owner',email:'lukketsvane@players.max.invalid'}).map(r=>r.id),['night-relay','high-tide','last-seed']);
  for(const user of [null,{id:'guest',is_anonymous:true,email:'lukketsvane@players.max.invalid'},{id:'other',email:'someone@players.max.invalid',user_metadata:{name:'lukketsvane'}},{email:'lukketsvane@players.max.invalid'}])assert.deepEqual(relicCollection(user).map(r=>r.id),['night-relay','high-tide']);
  assert.deepEqual(relicCollection({id:'other',email:'someone@players.max.invalid'},['relic-last-seed']).map(r=>r.id),['night-relay','high-tide','last-seed']);
});
test('future relic unlocks survive account caching and never invent a login phrase',async()=>{
  const {createEasterEggs}=await import('../easter-eggs.mjs'),data=new Map(),calls=[];
  const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},eggs=createEasterEggs(storage);
  const client={rpc:async(name,args)=>{calls.push([name,args]);return{data:['relic-last-seed'],error:null};}};
  eggs.setUser('owner');await eggs.sync(client,{id:'owner'},'lukketsvane');assert.equal(eggs.has('relic-last-seed'),true);
  eggs.setUser('other');assert.equal(eggs.has('relic-last-seed'),false);eggs.setUser('owner');assert.equal(eggs.has('relic-last-seed'),true);
  eggs.unlockLocal('relic-last-seed');await eggs.sync({rpc:async()=>({data:[],error:null})},{id:'owner'},'owner');
  assert.equal(await eggs.ensure(client,{id:'owner'},'relic-last-seed'),false);assert.equal(calls.length,1);
});
