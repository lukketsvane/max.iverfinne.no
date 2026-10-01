const {test}=require('node:test');
const assert=require('node:assert/strict');

test('a finished solo session leaves immediately and repeated leave waits for the same departure',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  const room={id:'room',host:'host',state:'playing',mode:'last-seed',members:[{id:'host',slot:1,ready:true,name:'host',classId:'runner'}]};
  const net=fakeChannelClient({room,userId:'host'}),calls=[];let release;
  const original=net.client.rpc;
  net.client.rpc=async(name,args)=>{
    if(args?.p_action==='leave'){calls.push(args);await new Promise(resolve=>{release=resolve;});return {data:{closed:true},error:null};}
    return original(name,args);
  };
  const s=new CoopSession(net.client,{id:'host'},{},{classId:'runner',mode:'last-seed'});
  await s.enter({global:true});
  s.tick({},()=>({ended:true}),1000);
  assert.equal(s.closed,true);assert.equal(s.playing,false);assert.equal(calls.length,1);assert.equal(s.channels.size,0);
  let departed=false;const again=s.leave().then(()=>{departed=true;});await Promise.resolve();
  assert.equal(departed,false,'retry cannot race the pending server departure');
  release();await again;assert.equal(departed,true);assert.equal(calls.length,1);
  s.tick({},()=>{throw new Error('closed run must not send more state');},2000);
});

test('a downed player keeps the session while a teammate can still revive them',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  const room={id:'room',host:'host',state:'playing',members:[{id:'host',slot:1,ready:true,name:'host'},{id:'guest',slot:2,ready:true,name:'guest'}]};
  const net=fakeChannelClient({room,userId:'host'}),s=new CoopSession(net.client,{id:'host'});
  try {
    await s.enter({global:true});s.tick({},()=>({ended:false,members:[{id:'host',vital:{hp:0}},{id:'guest',vital:{hp:100}}]}),1000);
    assert.equal(s.closed,false);assert.equal(s.playing,true);assert.ok(net.sent.some(f=>f.frame.payload.state?.members?.[0]?.vital?.hp===0));
  }finally{await s.leave();}
});

function fakeChannelClient({room,pollHost}={}){
  const channels=new Map(),removed=[],sent=[];
  const client={
    realtime:{setAuth:async()=>{}},
    async rpc(name,args){
      if(name==='max_coop'&&args?.p_action==='get'&&pollHost)room={...room,host:pollHost};
      return {data:name==='max_coop'&&args?.p_action==='leave'?{closed:false}:JSON.parse(JSON.stringify(room)),error:null};
    },
    channel(name,options){
      assert.equal(options.config.private,true);
      const ch={name,on(_type,_filter,fn){ch.receive=fn;return ch;},subscribe(fn){ch.status=fn;fn('SUBSCRIBED');return ch;},async send(frame){sent.push({name,frame});}};
      channels.set(name,ch);return ch;
    },
    async removeChannel(ch){removed.push(ch.name);ch.status?.('CLOSED');}
  };
  return {client,channels,removed,sent};
}

test('a running garden survives a realtime channel drop instead of treating backgrounding as leaving',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  const room={id:'room',host:'host',state:'playing',members:[{id:'host',slot:1,ready:true,name:'host'},{id:'guest',slot:2,ready:true,name:'guest'}]};
  const net=fakeChannelClient({room,userId:'host'}),errors=[],departures=[];
  const s=new CoopSession(net.client,{id:'host'},{error:r=>errors.push(r),depart:id=>departures.push(id)},{classId:'mech',difficulty:'easy'});
  s.room=room;s.entered=true;s.playing=true;
  await s.subscribe('state');await s.subscribe('guest');
  const prior=global.document;global.document={hidden:true};
  try{
    net.channels.get('max-coop:room:guest').status('CHANNEL_ERROR');
    net.channels.get('max-coop:room:state').status('CLOSED');
    assert.equal(s.closed,false);assert.deepEqual(errors,[]);assert.deepEqual(departures,[]);
    assert.equal(s.channels.has('guest'),false);assert.equal(s.channels.has('state'),false);
  }finally{if(prior===undefined)delete global.document;else global.document=prior;}
});

test('joining an already-running shared garden begins immediately without a lobby or ready step',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  const room={id:'room',host:'host',state:'playing',members:[{id:'host',slot:1,ready:true,name:'host'},{id:'guest',slot:2,ready:true,name:'guest'}]};
  const net=fakeChannelClient({room,userId:'guest'}),starts=[];
  const s=new CoopSession(net.client,{id:'guest'},{start:n=>starts.push(n)},{classId:'runner',skinId:'ember',difficulty:'hard'});
  try{
    await s.enter({id:'room'});
    assert.equal(s.playing,true);assert.equal(starts.length,1);assert.equal(s.canReady,false);
    assert.deepEqual(s.selection,{classId:'runner',skinId:'moss-pink',difficulty:'hard'});
    assert.ok(net.sent.some(x=>x.name==='max-coop:room:guest'),'late joiner immediately publishes its character selection');
  }finally{await s.leave();}
});

test('a foreground poll adopts server host handoff and reauthorizes the state channel',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  let room={id:'room',host:'old-host',state:'playing',members:[{id:'old-host',slot:1,ready:true,name:'old'},{id:'new-host',slot:2,ready:true,name:'new'}]};
  const net=fakeChannelClient({room,pollHost:'new-host'}),seen=[];
  const s=new CoopSession(net.client,{id:'new-host'},{room:r=>seen.push(r.host)},{classId:'bulwark',difficulty:'medium'});
  s.room=JSON.parse(JSON.stringify(room));s.entered=true;s.playing=true;s.loadouts['new-host']=s.selection;s.memberTokens['new-host']=s.token;
  await s.subscribe('state');await s.subscribe('new-host');
  const oldState=net.channels.get('max-coop:room:state');
  await s.poll(true);
  assert.equal(s.host,true);assert.equal(s.room.host,'new-host');assert.ok(seen.includes('new-host'));
  assert.notEqual(net.channels.get('max-coop:room:state'),oldState);assert.ok(s.channels.has('old-host'),'new authority listens for the old host when it returns as a guest');
});

test('a returning former host reconnects as a guest with its own input channel',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  let room={id:'room',host:'old-host',state:'playing',members:[{id:'old-host',slot:1,ready:true,name:'old'},{id:'new-host',slot:2,ready:true,name:'new'}]};
  const net=fakeChannelClient({room,pollHost:'new-host'});
  const s=new CoopSession(net.client,{id:'old-host'}, {}, {classId:'mech',difficulty:'easy'});
  s.room=JSON.parse(JSON.stringify(room));s.entered=true;s.playing=true;s.loadouts['old-host']=s.selection;s.memberTokens['old-host']=s.token;
  await s.subscribe('state');await s.subscribe('new-host');
  await s.poll(true);
  assert.equal(s.host,false);assert.equal(s.room.host,'new-host');
  assert.ok(s.channels.has('old-host'),'former host gets the private input channel it needs as a guest');
  assert.equal(s.channels.has('new-host'),false,'guest no longer listens on another player’s input channel');
});

test('foreground resume rebuilds stale realtime channels after an iOS-style suspension',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  const room={id:'room',host:'host',state:'playing',members:[{id:'host',slot:1,ready:true,name:'host'},{id:'guest',slot:2,ready:true,name:'guest'}]};
  const net=fakeChannelClient({room,userId:'guest'});
  const s=new CoopSession(net.client,{id:'guest'}, {}, {classId:'runner',difficulty:'easy'});
  s.room=JSON.parse(JSON.stringify(room));s.entered=true;s.playing=true;s.loadouts.guest=s.selection;s.memberTokens.guest=s.token;
  await s.subscribe('state');await s.subscribe('guest');
  const staleState=net.channels.get('max-coop:room:state'),staleInput=net.channels.get('max-coop:room:guest');
  await s.resume();
  assert.notEqual(net.channels.get('max-coop:room:state'),staleState);
  assert.notEqual(net.channels.get('max-coop:room:guest'),staleInput);
  assert.ok(net.removed.includes('max-coop:room:state'));assert.ok(net.removed.includes('max-coop:room:guest'));
  assert.equal(s.closed,false);assert.equal(s.playing,true);
});

test('global join reserves the requested character and inherits the server run difficulty',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  const calls=[];
  const room={id:'room',host:'host',state:'playing',difficulty:'easy',members:[
    {id:'host',slot:1,ready:true,name:'host',classId:'mech'},
    {id:'guest',slot:2,ready:true,name:'guest',classId:'runner'}
  ]};
  const net=fakeChannelClient({room,userId:'guest'});
  const original=net.client.rpc;
  net.client.rpc=async(name,args)=>{calls.push({name,args});return original(name,args);};
  const s=new CoopSession(net.client,{id:'guest'}, {}, {classId:'runner',skinId:'moss-pink',difficulty:'insane'});
  try{
    await s.enter({global:true});
    const join=calls.find(q=>q.name==='max_coop_global');
    assert.deepEqual(join.args,{p_class_id:'runner',p_difficulty:'insane'});
    assert.deepEqual(s.selection,{classId:'runner',skinId:'moss-pink',difficulty:'easy'},'the chosen outfit survives the authoritative class reservation and difficulty');
  }finally{await s.leave();}
});
