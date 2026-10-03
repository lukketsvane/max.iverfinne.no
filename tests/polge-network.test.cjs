const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function party(mode='garden'){
  const room={id:'room',host:ids[0],mode,members:ids.map((id,i)=>({id,slot:i+1,ready:true}))};
  const loadouts={[ids[0]]:{classId:'mech',skinId:'tide'},[ids[1]]:{classId:'polge',skinId:'polge'}};
  const peers=ids.map(id=>{const h=loadGame(),pending=[];h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){},fail(reason){throw Error(reason);}});return {...h,pending};});
  const host=peers[0].game,guest=peers[1].game;
  function sync(){guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));}
  function send(actions=peers[1].pending,avatar=guest.coopAvatar()){host.coopInput(ids[1],{avatar,actions});}
  sync();return {host,guest,peers,send,sync,member:host.coop.members[ids[1]]};
}
function pest(g,x,y,fields={}){const k=Object.assign(g.makeKrek(1,false,0),{x,y,hp:20,maxHp:20,scout:false,raid:true},fields);g.floatKrek.push(k);return k;}
function fighter(fields={}){return {owner:ids[1],world:1,combo:1,window:.8,weave:0,rhythm:2,rhythmIdle:.4,rhythmDecay:.2,utilityCool:2,slip:0,counter:.7,avoidedWarning:1,clinchCool:3,flurry:.5,next:.1,flurryBeats:4,flurryFinish:1,flurryStep:.14,flurryAge:.45,...fields};}

test('guest clinch is host validated, acknowledged once and cannot forge reach or its cooldown',()=>{
  const {host,guest,member,send,sync,peers}=party();host.floatKrek=[];
  const near=pest(host,guest.P.x+12,guest.P.y-12),far=pest(host,guest.P.x+160,guest.P.y-12);
  sync();
  assert.equal(guest.polgeClinch({x:near.x,y:near.y}),true);
  assert.equal(near.hp,20);send();assert.ok(near.hp<20);const after=near.hp;
  send();assert.equal(near.hp,after);assert.equal(member.secondaryTag,1);assert.equal(host.classFighters[0].clinchCool,4);
  send([{id:2,type:'secondary',world:1,secondaryTag:2,x:near.x,y:near.y,damage:999,rhythm:3}]);
  assert.equal(near.hp,after);assert.equal(member.secondaryTag,2);
  host.updateClassCombat(4.1);peers[0].advance(4100);
  send([{id:3,type:'secondary',world:1,secondaryTag:3,x:far.x,y:far.y,damage:999}]);
  assert.equal(far.hp,20);assert.equal(near.hp,after);assert.equal(host.classFighters[0].clinchCool,0);
  sync();assert.equal(guest.P.secondaryCool,0);assert.equal(host.bombs.length,0);assert.equal(host.classShots.length,0);
});

test('fighter resources and cooldowns survive authority transfer while acknowledged action tags prevent replay',()=>{
  const {host,guest,member,send,sync,peers}=party();host.floatKrek=[];
  const target=pest(host,guest.P.x+12,guest.P.y-12);
  sync();
  guest.polgeClinch({x:target.x,y:target.y});send();
  Object.assign(host.classFighters[0],fighter({clinchCool:2.7,utilityCool:1.6,slip:0,flurry:.5}));
  const expected=JSON.parse(JSON.stringify(host.classFighters[0]));sync();
  assert.deepEqual(JSON.parse(JSON.stringify(guest.classFighters[0])),expected);
  guest.coopRoster({...guest.coop.network.room,host:ids[1]});
  assert.equal(guest.classFighters[0].rhythm,2);assert.equal(guest.classFighters[0].counter,.7);
  assert.equal(guest.classFighters[0].clinchCool,2.7);assert.equal(guest.polgeUtilityReady(),false);
  // The prior host can also become host again; its ordered action IDs rebase, but tags remain.
  host.coopRoster({...host.coop.network.room,host:ids[1]});host.coopRoster({...host.coop.network.room,host:ids[0]});
  host.updateClassCombat(4);peers[0].advance(4000);const hp=target.hp;
  send([{id:80,type:'secondary',world:1,secondaryTag:1,x:target.x,y:target.y}]);
  assert.equal(target.hp,hp);assert.equal(member.secondaryTag,1);
});

test('snapshots clamp fighter scalars, reject other owners and remove duplicate or arbitrary fighter fields',()=>{
  const {host,guest}=party(),state=JSON.parse(JSON.stringify(host.coopCapture()));
  state.fighters=[fighter({combo:99,rhythm:99,rhythmIdle:Infinity,rhythmDecay:-8,utilityCool:999,slip:8,counter:999,clinchCool:999,flurry:999,next:-2,flurryBeats:999,flurryStep:999,flurryAge:999,avoidedWarning:999,flurryFinish:999,damage:999}),fighter(),fighter({owner:ids[0]})];
  guest.coopState(state);assert.equal(guest.classFighters.length,1);const q=guest.classFighters[0];
  assert.equal(q.combo,2);assert.equal(q.rhythm,3);assert.equal(q.rhythmIdle,0);assert.equal(q.rhythmDecay,0);
  assert.equal(q.utilityCool,3.5);assert.equal(q.slip,.18);assert.equal(q.counter,1.1);assert.equal(q.clinchCool,4);
  assert.equal(q.flurry,.95);assert.equal(q.next,0);assert.equal(q.flurryBeats,11);assert.equal(q.flurryStep,.168);
  assert.equal(q.flurryAge,.95);assert.equal(q.avoidedWarning,1);assert.equal(q.flurryFinish,1);assert.equal('damage' in q,false);
});

test('Pølge slip validates fresh tags and cumulative travel, including steering back through the cast origin',()=>{
  const {host,guest,member,send}=party();
  const start=guest.P.x,y=guest.P.y;
  send([{id:1,type:'dodge',world:1,dodgeTag:1,x:start,y,direction:1}],{...guest.coopAvatar(),dodging:true});
  assert.ok(member.dodge&&member.dodge.boxer);assert.equal(host.classFighters[0].counter,0);
  send([],{...guest.coopAvatar(),x:start+10,dodging:true});assert.equal(member.dodge.progress,10);
  send([],{...guest.coopAvatar(),x:start-2,dodging:true});assert.equal(member.dodge.progress,22);
  send([],{...guest.coopAvatar(),x:start+4,dodging:true});assert.equal(member.dodge,null,'six more pixels exceed the two pixels left');
  host.updateClassCombat(4);
  send([{id:2,type:'dodge',world:1,dodgeTag:1,x:start+4,y,direction:1}],{...guest.coopAvatar(),x:start+4,dodging:true});
  assert.equal(member.dodge,null,'an old tag cannot restart an expired slip');
  send([{id:3,type:'dodge',world:1,dodgeTag:2,x:start+4,y,direction:1}],{...guest.coopAvatar(),x:99999,dodging:true});
  assert.equal(member.dodge,null,'a rejected movement packet cannot authorize a fresh slip');
  assert.equal(host.classFighters[0].counter,0);
});

test('only a host validated warned contact grants one counter; a cosmetic dodge or an expired packet grants none',()=>{
  const {host,guest,member,send,peers}=party('last-seed'),warning={warned:true,key:'guard-contact'};
  send([],{...guest.coopAvatar(),dodging:true});
  assert.equal(host.damageGardener(member,20,warning),true,'a claimed dodge pose has no invulnerability');
  Object.assign(host.seedVital(member),{hp:100,shield:0,hurt:0});
  send([{id:1,type:'dodge',world:1,dodgeTag:1,x:guest.P.x,y:guest.P.y,direction:1}],{...guest.coopAvatar(),dodging:true});
  const q=host.classFighters[0];assert.equal(q.counter,0);
  assert.equal(host.damageGardener(member,20),false);assert.equal(q.counter,0,'unwarned contact gives movement protection only');
  assert.equal(host.damageGardener(member,20,warning),false);assert.equal(q.counter,1.1);
  q.counter=.4;host.damageGardener(member,20,{warned:true,key:'second-contact'});assert.equal(q.counter,.4,'the same slip cannot refresh or stack its counter');
  q.counter=0;peers[0].advance(200);send([],{...guest.coopAvatar(),dodging:true});
  assert.equal(member.dodge,null);assert.equal(host.damageGardener(member,20,warning),true);assert.equal(q.counter,0);
});

test('a validated unfinished Pølge slip keeps its remaining distance and warning avoidance after host handoff',()=>{
  const {host,guest,member,send,sync}=party('last-seed');
  const start=guest.P.x,y=guest.P.y;
  send([{id:1,type:'dodge',world:1,dodgeTag:1,x:start,y,direction:1}],{...guest.coopAvatar(),dodging:true});
  send([],{...guest.coopAvatar(),x:start+8,dodging:true});host.updateClassCombat(.04);
  Object.assign(guest.P,{x:start+8,dodgeT:.14,dodgeId:1,slipDistance:8,dodgeDir:1});
  sync();assert.ok(guest.coop.members[ids[1]].dodge);assert.equal(guest.coop.members[ids[1]].dodge.progress,8);
  // The Pølge becomes remote under the returning first host after a snapshot round trip.
  host.coopRoster({...host.coop.network.room,host:ids[1]});host.coopState(JSON.parse(JSON.stringify(guest.coopCapture())));
  host.coopRoster({...host.coop.network.room,host:ids[0]});
  assert.ok(member.dodge&&member.dodge.boxer);assert.equal(member.dodge.progress,8);
  assert.equal(host.damageGardener(member,20,{warned:true,key:'handoff-contact'}),false);assert.equal(host.classFighters[0].counter,1.1);
});
