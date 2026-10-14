const {test}=require('node:test');
const assert=require('node:assert/strict');
const sessions=import('../coop-session.mjs');
const copy=value=>structuredClone(value);
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

function server(){
  let room={id:'room-reliability',host:'host',state:'playing',mode:'garden',difficulty:'medium',members:[
    {id:'host',slot:1,ready:true,name:'Host',classId:'mech'},
    {id:'guest',slot:2,ready:true,name:'Guest',classId:'runner'},
  ]};
  const calls=[],sent=[],channels=[],failures=new Map();let releaseLeave=null,holdHostLeave=false;
  function response(error,status=0){return {data:null,error,status};}
  function client(id){return {
    realtime:{async setAuth(){}},
    async rpc(name,args){
      const action=args?.p_action||name;calls.push({id,name,action,args:copy(args)});
      const queue=failures.get(id+':'+action);if(queue?.length){const failure=queue.shift();if(failure.throw)throw failure.throw;return response(failure.error,failure.status);}
      if(name==='max_coop_global'||name==='max_coop_join'){
        if(room.state==='closed')return response({message:'This garden has closed.',code:'PT404'},404);
        if(!room.members.some(m=>m.id===id))return response({message:'The garden is full.',code:'PT409'},409);
        return {data:copy(room),error:null,status:200};
      }
      assert.equal(name,'max_coop');assert.equal(args.p_args.room,room.id);
      if(action==='leave'){
        if(id==='host'&&holdHostLeave)await new Promise(resolve=>{releaseLeave=resolve;});
        room.members=room.members.filter(m=>m.id!==id);
        if(room.host===id){room.host=room.members[0]?.id||id;if(!room.members.length)room.state='closed';}
        return {data:{closed:room.state==='closed',host:room.host},error:null,status:200};
      }
      if(room.state==='closed')return response({message:'This garden has closed.',code:'PT404'},404);
      if(!room.members.some(m=>m.id===id))return response({message:'You are not in this garden.',code:'42501'},403);
      return {data:copy(room),error:null,status:200};
    },
    channel(name,options){
      assert.equal(options.config.private,true);
      const channel={id,name,removed:false,on(type,filter,receive){assert.equal(type,'broadcast');assert.equal(filter.event,'frame');channel.receive=receive;return channel;},subscribe(status){channel.status=status;status('SUBSCRIBED');return channel;},async send(frame){
        sent.push({id,name,payload:copy(frame.payload)});
        for(const other of channels)if(other.id!==id&&other.name===name&&!other.removed)other.receive?.({payload:copy(frame.payload)});
      }};
      channels.push(channel);return channel;
    },
    async removeChannel(channel){channel.removed=true;channel.status?.('CLOSED');},
  };}
  return {client,calls,sent,channels,get room(){return room;},set room(value){room=copy(value);},fail(id,action,error,status=0){const key=id+':'+action;failures.set(key,[...(failures.get(key)||[]),{error,status}]);},throw(id,action,error){const key=id+':'+action;failures.set(key,[...(failures.get(key)||[]),{throw:error}]);},deferHostLeave(){holdHostLeave=true;},releaseHostLeave(){holdHostLeave=false;releaseLeave?.();}};
}
async function join(net,id){
  const {CoopSession}=await sessions,events={errors:[],states:[],starts:0,rooms:[]},session=new CoopSession(net.client(id),{id},{error:e=>events.errors.push(e),state:s=>events.states.push(copy(s)),start:()=>events.starts++,room:r=>events.rooms.push(copy(r))},{classId:id==='host'?'mech':'runner'});
  await session.enter({global:true});clearInterval(session.timer);session.timer=null;
  return {session,events};
}
const state=(ended=false)=>({world:3,elapsed:180,ended,seeds:2,acks:{guest:1},members:[{id:'host',vital:{hp:80}},{id:'guest',vital:{hp:60}}]});

for(const error of [
  {error:{message:'TypeError: Failed to fetch',code:''},status:0},
  {error:{message:'Service unavailable',code:'PGRST002'},status:503},
  {error:{message:'Too many requests'},status:429},
  {error:{message:'Request timed out'},status:408},
])test(`an active session retains its admitted run across transient RPC ${error.status} and recovers on the next allowed poll`,async t=>{
  t.mock.timers.enable({apis:['Date'],now:100000});const net=server(),{session:s,events}=await join(net,'guest');
  try{
    const room=copy(s.room),token=s.token;s.pending=[{id:2,type:'grow',world:3}];net.fail('guest','get',error.error,error.status);
    await s.poll(true);assert.equal(s.closed,false);assert.equal(s.playing,true);assert.deepEqual(s.room,room);assert.equal(s.token,token);assert.deepEqual(s.pending,[{id:2,type:'grow',world:3}]);assert.deepEqual(events.errors,[]);assert.equal(net.calls.some(c=>c.action==='leave'),false);
    const gets=net.calls.filter(c=>c.action==='get').length;await s.poll();assert.equal(net.calls.filter(c=>c.action==='get').length,gets,'backoff prevents an immediate retry');
    t.mock.timers.tick(1000);await s.poll();assert.equal(s.pollFailures,0);assert.equal(s.nextPollRetry,0);assert.equal(s.closed,false);assert.equal(events.starts,1);assert.equal(net.room.members.some(m=>m.id==='guest'),true);
  }finally{await s.leave();}
});
test('a thrown fetch rejection is transient while auth and permanent RPC failures still close safely',async t=>{
  t.mock.timers.enable({apis:['Date'],now:200000});const net=server(),{session:s,events}=await join(net,'guest');
  net.throw('guest','get',new TypeError('fetch failed'));await s.poll(true);assert.equal(s.closed,false);assert.deepEqual(events.errors,[]);
  net.fail('guest','get',{message:'Permission denied',code:'42501'},503);await s.poll(true);await s.leaving;
  assert.equal(s.closed,true,'a permission code cannot be disguised by a transient HTTP status');assert.deepEqual(events.errors,['Permission denied']);assert.equal(net.calls.filter(c=>c.action==='leave').length,1);
});
test('capped automatic backoff survives a prolonged HTTP outage and recovers without a foreground event',async t=>{
  t.mock.timers.enable({apis:['Date'],now:300000});const net=server(),{session:s,events}=await join(net,'guest');
  try{
    const token=s.token,selection=copy(s.selection);s.pending=[{id:2,type:'grow',world:3}];
    for(let i=0;i<6;i++)net.fail('guest','get',{message:'Service unavailable',code:'PGRST002'},503);
    await s.poll(true);for(const delay of [1000,2000,4000,8000,10000]){t.mock.timers.tick(delay);await s.poll();}
    assert.equal(s.pollFailures,5);assert.equal(s.nextPollRetry,Date.now()+10000);assert.equal(s.closed,false);assert.deepEqual(events.errors,[]);
    const requests=net.calls.filter(c=>c.action==='get').length;t.mock.timers.tick(9999);await s.poll();assert.equal(net.calls.filter(c=>c.action==='get').length,requests,'capped backoff still prevents a request storm');
    t.mock.timers.tick(1);await s.poll();
    assert.equal(s.closed,false);assert.equal(s.pollFailures,0);assert.equal(s.token,token);assert.deepEqual(s.selection,selection);assert.deepEqual(s.pending,[{id:2,type:'grow',world:3}]);assert.equal(events.starts,1);assert.equal(net.calls.some(c=>c.action==='leave'),false);
  }finally{await s.leave();}
});
test('a transient foreground get failure keeps the reservation and the next poll rebuilds its removed state channel',async()=>{
  const net=server(),{session:s,events}=await join(net,'guest');
  try{
    net.fail('guest','get',{message:'Failed to fetch'},0);await s.resume();assert.equal(s.closed,false);assert.equal(s.channels.size,0);assert.deepEqual(events.errors,[]);
    await s.poll(true);assert.equal(s.channels.has('state'),true);assert.equal(s.channels.has('guest'),true);assert.equal(s.closed,false);assert.equal(net.calls.some(c=>c.action==='leave'),false);
  }finally{await s.leave();}
});
test('foreground recovery queues behind an in-flight poll instead of racing two room admissions',async()=>{
  const net=server(),{session:s,events}=await join(net,'guest'),rpc=s.client.rpc;let release,gets=0,auth=0;
  s.client.realtime.setAuth=async()=>{auth++;};
  s.client.rpc=async(name,args)=>{if(args?.p_action==='get'){gets++;if(gets===1)await new Promise(resolve=>{release=resolve;});}return rpc(name,args);};
  try{
    const polling=s.poll(true);await flush();assert.equal(gets,1);assert.equal(s.polling,true);
    await s.resume();await s.poll(true);assert.equal(gets,1);assert.equal(auth,0,'the ongoing poll owns the single refresh');
    release();await polling;await flush();assert.equal(gets,2);assert.equal(auth,1,'one queued foreground recovery rebuilds channels afterwards');assert.equal(s.closed,false);assert.equal(events.starts,1);assert.deepEqual(events.errors,[]);
  }finally{release?.();await s.leave();}
});
for(const outcome of ['closed','departed','invalid'])test(`a confirmed ${outcome} room result is not retried or admitted after recovery`,async()=>{
  const net=server(),{session:s,events}=await join(net,'guest');net.fail('guest','get',{message:'Failed to fetch'},0);await s.poll(true);assert.equal(s.closed,false);
  if(outcome==='closed')net.room={...net.room,state:'closed'};
  if(outcome==='departed')net.room={...net.room,members:net.room.members.filter(m=>m.id!=='guest')};
  if(outcome==='invalid')net.room={...net.room,host:'unknown'};
  await s.resume();await s.leaving;assert.equal(s.closed,true);assert.equal(s.playing,false);assert.equal(events.errors.length,1);assert.equal(s.channels.size,0);
  const calls=net.calls.length;await s.resume();await s.poll(true);assert.equal(net.calls.length,calls,'a closed session cannot silently re-admit itself');
  await assert.rejects(s.enter({global:true}),/session has ended/);assert.equal(net.calls.length,calls);
});
test('a healthy host departure hint cannot kill a guest while SQL promotion is still pending',async()=>{
  const net=server(),{session:host}=await join(net,'host'),{session:guest,events}=await join(net,'guest');
  try{
    host.tick({},()=>state(),Date.now());assert.equal(events.states.length,1);const saved=copy(events.states[0]);net.deferHostLeave();const leaving=host.leave();await flush();
    const departure=net.sent.find(s=>s.id==='host'&&s.payload.depart);assert.ok(departure);assert.equal(departure.payload.end,undefined);assert.equal(net.room.host,'host');assert.equal(guest.closed,false);assert.equal(guest.playing,true);assert.deepEqual(events.errors,[]);assert.deepEqual(events.states[0],saved);
    net.releaseHostLeave();await leaving;await guest.poll(true);assert.equal(guest.host,true);assert.equal(guest.room.host,'guest');assert.equal(guest.room.members.length,1);assert.equal(guest.closed,false);assert.equal(events.starts,1);assert.equal(net.calls.filter(c=>c.id==='guest'&&c.action==='leave').length,0);
    guest.tick({},()=>saved,Date.now()+1000);assert.equal(net.sent.at(-1).payload.state.elapsed,180);assert.equal(net.sent.at(-1).payload.state.members[1].vital.hp,60,'transport promotion retains the accepted game state for engine handoff');
  }finally{net.releaseHostLeave();await host.leave();await guest.leave();}
});
test('legacy unqualified host end hints consult the server rather than ending an otherwise healthy admitted run',async()=>{
  const net=server(),{session:s,events}=await join(net,'guest');
  try{
    s.receive('state',{v:1,proto:2,sid:'legacy-host-session',seq:1,end:true});await flush();assert.equal(s.closed,false);assert.equal(s.playing,true);assert.equal(net.calls.some(c=>c.action==='get'),true);assert.deepEqual(events.errors,[]);
  }finally{await s.leave();}
});
test('a genuine ended snapshot and host end packet still close guests and cannot reopen on resume',async()=>{
  const net=server(),{session:host}=await join(net,'host'),{session:guest,events}=await join(net,'guest');
  host.tick({},()=>state(true),Date.now());assert.equal(host.runEnded,true);assert.equal(guest.runEnded,true);assert.equal(events.states[0].ended,true);
  await host.leave();await flush();await guest.leaving;assert.equal(guest.closed,true);assert.equal(guest.playing,false);assert.ok(net.sent.some(s=>s.id==='host'&&s.payload.end&&s.payload.ended));
  const requests=net.calls.length;await guest.resume();await guest.poll(true);assert.equal(net.calls.length,requests);assert.equal(guest.channels.size,0);
});
test('an explicitly ended host closes a guest even if its final state transfer was lost',async()=>{
  const net=server(),{session:s,events}=await join(net,'guest');s.receive('state',{v:1,proto:2,sid:'finished-host-session',seq:1,end:true,ended:true});await s.leaving;
  assert.equal(s.closed,true);assert.equal(events.errors.length,1);assert.equal(s.channels.size,0);
});
test('a stale host stream requests bounded recovery and does not destroy a reserved membership on transport loss alone',async()=>{
  const net=server(),{session:s,events}=await join(net,'guest');
  try{
    net.fail('guest','get',{message:'Failed to fetch'},0);s.lastHost=Date.now()-90001;s.tick({},()=>{throw Error('guest must not capture authority');});await flush();
    assert.equal(s.closed,false);assert.equal(s.playing,true);assert.deepEqual(events.errors,[]);assert.equal(net.calls.some(c=>c.action==='leave'),false);
    net.room={...net.room,members:net.room.members.filter(m=>m.id!=='guest')};await s.resume();await s.leaving;assert.equal(s.closed,true,'actual server departure, not silence, revokes the run');
  }finally{await s.leave();}
});
test('failed initial membership admission never starts a run or opens private channels',async()=>{
  const {CoopSession}=await sessions,net=server();net.room={...net.room,state:'closed'};let starts=0;const s=new CoopSession(net.client('guest'),{id:'guest'},{start:()=>starts++},{classId:'runner'});
  await assert.rejects(s.enter({global:true}),/garden has closed/);assert.equal(starts,0);assert.equal(s.playing,false);assert.equal(s.entered,undefined);assert.equal(s.channels.size,0);assert.equal(net.calls.some(c=>c.action==='leave'),false);
});
