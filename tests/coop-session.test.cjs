const {test}=require('node:test');
const assert=require('node:assert/strict');
test('removing a departed guest channel leaves the host running; losing the host state channel ends the session',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  const channels=new Map(),errors=[],departures=[];
  const client={
    channel(name){const c={on(){return c;},subscribe(fn){c.status=fn;fn('SUBSCRIBED');return c;},send:async()=>{}};channels.set(name,c);return c;},
    async removeChannel(c){c.status('CLOSED');},
    async rpc(){return {data:{}};},
  };
  const session=new CoopSession(client,{id:'host'},{error:r=>errors.push(r),depart:id=>departures.push(id)});
  session.room={id:'room',host:'host',members:[{id:'host'},{id:'guest'}]};
  await session.subscribe('state');await session.syncChannels();session.playing=true;
  session.room.members=[{id:'host'}];await session.syncChannels();assert.equal(errors.length,0);assert.equal(session.closed,false);
  session.room.members.push({id:'other'});await session.syncChannels();
  channels.get('max-coop:room:other').status('CHANNEL_ERROR');assert.deepEqual(departures,['other']);assert.equal(session.closed,false);
  channels.get('max-coop:room:state').status('CLOSED');assert.equal(errors.length,1);assert.equal(session.closed,true);
});
