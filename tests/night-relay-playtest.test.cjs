const {test}=require('node:test');
const assert=require('node:assert/strict');
const {run}=require('../scripts/playtest-night-relay.cjs');
for(const classes of [['mech','herbalist'],['runner','bulwark'],['sligo','polge']])test('Night Relay input-only paired completion: '+classes.join(' + '),()=>{
 const r=run({classes,seconds:100});
 assert.equal(r.won,true,JSON.stringify(r));assert.equal(r.locks,3);assert.ok(r.passes>=2);assert.ok(r.players.every(p=>p.hp>0&&p.jumps>0));assert.equal(r.resets,0);
});
test('Night Relay remains playable at 250 ms one-way latency on Hard',()=>{
 const r=run({classes:['bulwark','polge'],difficulty:'hard',latency:250,seconds:140});
 assert.equal(r.won,true,JSON.stringify(r));assert.ok(r.passes>=2);
});
for(const fps of [30,60,120])test('Night Relay completes through host handoff at '+fps+' Hz',()=>{
 const r=run({fps,handoffAt:7,seconds:100});assert.equal(r.won,true,JSON.stringify(r));
});
