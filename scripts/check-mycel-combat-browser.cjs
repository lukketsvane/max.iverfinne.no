'use strict';

// This observer is inserted only into intercepted local review responses.
// Published review pages and player storage never receive a debug API.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const root = path.resolve(process.env.MYCEL_REVIEW_DIST || path.join(__dirname, '../dist'));
const output = path.resolve(process.env.MYCEL_REVIEW_OUTPUT || 'mycel-combat-browser-review');
const engines = (process.env.MYCEL_BROWSER_ENGINES || 'chromium,webkit').split(',');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const build = Object.fromEntries([
  'index.html', 'assets/characters-v2/mycel/main.png',
  'assets/characters-v2/mycel/interaction.png', 'assets/characters-v2/mycel/atlas.json'
].map(file => [file, hash(file)]));
for (const [file, expected] of Object.entries({
  'main.png':'042cb200ab9c7e8072ed1af71fbd973b149bd76527ab80fc7ebccd87f2955ae3',
  'interaction.png':'b504a0926190418e1d9be148d6f19327de8c68de2eaf6705b072036d8ec979d9',
  'atlas.json':'f0e897172b614b9ef1284fae776591618121d69f7602663363ecd230200549d5'
})) assert.equal(build['assets/characters-v2/mycel/'+file], expected, 'Original Mycel '+file+' bytes');
const atlas = JSON.parse(fs.readFileSync(path.join(root, 'assets/characters-v2/mycel/atlas.json')));
assert.deepEqual(atlas.cell, [32, 32]);
assert.deepEqual(atlas.anchor, [16, 31]);
assert.ok(atlas.frames.every(frame => frame.rect[2] === 32 && frame.rect[3] === 32 &&
  frame.anchor[0] === 16 && frame.anchor[1] === 31));
const types = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.json':'application/json', '.png':'image/png', '.css':'text/css', '.webmanifest':'application/manifest+json' };

function browserProbe() {
  var log = { accepts:[], contacts:[], damage:[], restores:[], pulses:[], moves:[],
    landings:[], replays:[], ticks:[], timers:[], fx:[], bodies:{}, initial:null };
  function record(key, value) { log[key].push(value); if (log[key].length > 1600) log[key].shift(); }
  function actor() { return { x:P.x, y:P.y, vx:P.vx, vy:P.vy, face:P.face, grounded:!!P.grounded,
    platform:P.platform || '', st:P.st, anim:P.anim, wet:!!P.wet, autoIdlePose:!!P.autoIdlePose,
    dodgeT:P.dodgeT || 0, dodgeCool:P.dodgeCool || 0, airJumpUsed:!!P.airJumpUsed,
    lampBlock:!!P.lampBlock, skin:P.skin }; }
  function captured(member) { var q = mycelPeek(member); return q ? mycelCaptureState(q) : null; }
  var create = mycelState;
  mycelState = function(member) {
    var q = create.apply(this, arguments);
    if (!log.initial && mycelClass(mycelMember(member)) === 'herbalist')
      log.initial = { culture:q.culture, at:performance.now() };
    return q;
  };
  function accepted(name, original) { return function() {
    var result = original.apply(this, arguments);
    if (result) record('accepts', { name:name, at:performance.now(), owner:skillOwner(),
      body:actor(), q:captured() });
    return result;
  }; }
  mycelPrimaryWorld = accepted('primary', mycelPrimaryWorld);
  mycelCloudWorld = accepted('cloud', mycelCloudWorld);
  mycelDriftWorld = accepted('drift', mycelDriftWorld);
  mycelBloomWorld = accepted('bloom', mycelBloomWorld);
  var contact = mycelPrimaryContact, damage = combatDamage, restore = mycelRestoreCast,
    pulse = mycelPulse, movement = mycelMovement, landing = mycelLanding,
    replay = mycelReplayMotion, update = updateMycelCombat, timer=mycelSetTimer,
    fx = combatFx, image = ctx.drawImage;
  mycelSetTimer=function(q,key,value) {
    record('timers',{at:performance.now(),key:key,value:value});return timer.apply(this,arguments);
  };
  mycelPrimaryContact = function(shot, enemy) {
    var event = { at:performance.now(), owner:shot && shot.owner, serial:shot && shot.primarySerial,
      target:enemy && enemy.combatId, before:captured(coop && shot ? coop.members[shot.owner] : null) };
    var result = contact.apply(this, arguments);
    event.accepted = result; event.after = captured(coop && shot ? coop.members[shot.owner] : null);
    event.seenIds = shot && (shot.seenIds || []).slice();
    event.consumed = shot && shot.initialRewardConsumed;
    record('contacts', event); return result;
  };
  combatDamage = function(enemy, amount, source, perks, context) {
    var before = enemy.hp, result = damage.apply(this, arguments);
    record('damage', { at:performance.now(), id:enemy.combatId, requested:amount,
      before:before, after:enemy.hp, owner:skillOwner(), context:context ? {
        kind:context.kind, owner:context.owner, serial:context.serial, world:context.world } : null });
    return result;
  };
  mycelRestoreCast = function(cast, plot, health, water) {
    var before = { health:plot.health, water:plot.moisture }, result = restore.apply(this, arguments);
    record('restores', { at:performance.now(), serial:cast.serial, id:plot.id,
      request:{health:health, water:water}, before:before, delivered:result,
      after:{health:plot.health, water:plot.moisture}, debt:(cast.plots || []).map(function(d) {
        return Object.assign({}, d);
      }) }); return result;
  };
  mycelPulse = function(member, cast, kind, slot) {
    var before = cast.pulseMask, result = pulse.apply(this, arguments);
    record('pulses', { at:performance.now(), owner:mycelOwner(member), serial:cast.serial,
      kind:kind, slot:slot, before:before, mask:cast.pulseMask, useful:result });
    return result;
  };
  mycelMovement = function(member, before, after, dt, context) {
    var result = movement.apply(this, arguments);
    record('moves', { at:performance.now(), owner:mycelOwner(member), before:before, after:after,
      dt:dt, context:context, accepted:result, drift:captured(member)?.drift }); return result;
  };
  mycelLanding = function(member, support, before, after, context) {
    var plants = gardenPlots.map(function(p) { return { id:p.id, health:p.health, water:p.moisture }; });
    var result = landing.apply(this, arguments);
    record('landings', { at:performance.now(), owner:mycelOwner(member), support:support,
      before:before, after:after, context:context, awarded:result, plantsBefore:plants,
      plantsAfter:gardenPlots.map(function(p) { return { id:p.id, health:p.health, water:p.moisture }; }),
      drift:captured(member)?.drift }); return result;
  };
  mycelReplayMotion = function(member, before, elapsed, context) {
    var result = replay.apply(this, arguments);
    record('replays', { at:performance.now(), owner:mycelOwner(member), elapsed:elapsed,
      before:before, input:context && context.ordinaryInput, fromAge:context && context.fromTotalAge,
      result:result }); return result;
  };
  updateMycelCombat = function(dt) {
    var before=captured(),network=mycelNetwork(),result=update.apply(this,arguments);
    record('ticks',{dt:dt,before:before&&before.culture,after:captured()?.culture,
      wet:network.filter(function(n){return n.wet;}).length});return result;
  };
  combatFx = function(kind, x, y, r, face) {
    record('fx', { at:performance.now(), kind:kind, x:x, y:y, r:r, face:face, owner:skillOwner() });
    return fx.apply(this, arguments);
  };
  ctx.drawImage = function(img) {
    if (img && img.src && arguments.length === 9 && P.skin === 'moon' &&
        /\/characters-v2\/mycel\//.test(img.src)) {
      var q = captured(), kind = q && q.drift && q.drift.phase ? 'drift' :
        q && q.primaryPoseT > 0 ? 'primary' : q && q.cloudPoseT > 0 ? 'cloud' :
        q && q.bloomPoseT > 0 ? 'bloom' : P.st === 'task' || P.st === 'watering' ? 'tend' : 'idle';
      log.bodies[kind] = { at:performance.now(), source:img.src.split('/').pop(),
        rect:Array.prototype.slice.call(arguments, 1),
        cell:P.mycelMotionCell ? Object.assign({}, P.mycelMotionCell) : null, q:q };
    }
    return image.apply(this, arguments);
  };
  function plant(dx, wet, health, id) {
    var p = { id:id || ++rogueRun.nextPlantId, x:P.x + dx, kind:3, seed:197 + (id || 1),
      growth:.75, stalk:false, health:health == null ? .4 : health,
      moisture:wet == null ? .45 : wet, pulse:0, hit:0, age:0 };
    gardenPlots.push(p); return p;
  }
  function guard(dx, hp, y) {
    var e = { id:905 + floatKrek.length, x:P.x + dx, y:y == null ? P.y : y + 12,
      type:'cache', cost:0, active:true, done:false, locked:false, duration:75,
      progress:0, guardsRemaining:0, age:0, away:0 };
    runEncounters.push(e);
    var k = makeKrek(dx < 0 ? -1 : 1, false, 0);
    Object.assign(k, { combatId:++classPestId, x:e.x, y:e.y - 12, vx:0, vy:0,
      hp:hp || 100, maxHp:hp || 100, scout:false, trialGuard:true, eventId:e.id,
      eventX:e.x, eventY:e.y, bite:60, hitStaggerCooldown:60 });
    floatKrek.push(k); return k;
  }
  function resetLog() {
    Object.keys(log).forEach(function(k) { if (Array.isArray(log[k])) log[k] = []; });
    log.bodies = {};
  }
  function arrange(kind) {
    clearRunInput(); if (window.MaxRunResults) window.MaxRunResults.hide();
    task = holdWater = climb = warp = null;
    classShots = []; bombs = []; booms = []; runHazards = []; floatKrek = [];
    runEncounters = []; gardenPlots = []; runLoot = [];
    rogueRun.mode = 'garden'; rogueRun.ended = false; rogueRun.choice = null;
    rogueRun.next = 1e9; rogueRun.plantedThisWorld = false;
    gardenRaidActive = false; krekSpawnT = gardenRaidT = 9999;
    gardenFeverT=gardenPower=gardenCombo=gardenComboT=0;
    runActive = true; menuPaused = false; activeStageLayout = null;
    if (worldLevel() !== 1) enterLevel(1);
    var m = mycelMember(); (m || rogueRun).mycel = null;
    Object.assign(P, { skin:'moon', x:levelOriginX(1) + 150, vx:0, vy:0, grounded:true,
      platform:null, wet:false, st:'free', face:1, held:false, hurt:0, brace:0,
      skillCool:0, secondaryCool:0, utilityCool:0, dodgeT:0, dodgeCool:0, still:0,
      idleT:0, lampLit:0, throwPose:0, autoIdlePose:false, lampBlock:false, fidget:null,
      coyote:.1, airJumpUsed:false, mycelPrimaryInput:null, mycelCloudInput:null,
      mycelDriftInput:null, mycelBloomInput:null, mycelMotionObserved:null,
      mycelAppliedLaunchSerial:0, mycelCancelledCasts:null, mycelInput:null });
    var found = false;
    for (var x = levelOriginX(1) + 100; x < levelOriginX(1) + 550; x += 4) {
      P.x = x; P.y = surfaceY(x);
      if (!mycelWetBody(P) && cairnSupportPoint(P.x, P.y, null) &&
          mycelCloudPlacement({x:P.x + 48, y:P.y - 12}).valid &&
          [0, 8, 16, 24, 32, 40, 48].every(function(dx) {
            return Math.abs(surfaceY(P.x + dx) - P.y) < .2 &&
              combatLineClear(P.x, P.y - 12, P.x + dx, P.y - 12);
          })) { found = true; break; }
    }
    if (!found) throw Error('No genuine dry supported Mycel fixture route');
    P.platform = playerSupportId(P.x, P.y); setAnim('idle');
    ['colony','ferment','symbiosis','outbreak','symphony','cadence','mulch'].forEach(function(k) {
      rogueRun.perks[k] = 0; if (m) m.perks[k] = 0;
    });
    ownTraits().embers=0;
    bombCool = bombCoolMax = jumpBuf = dodgeBuf = 0; gardenPress = false;
    rogueRun.nextPlantId = 10;
    var q = mycelState(); resetLog();
    if (kind === 'primary') { plant(18, .08, .4, 1); [20, 46, 72, 98].forEach(function(dx) { guard(dx); }); }
    if (kind === 'bare-primary') [20, 46, 72, 98].forEach(function(dx) { guard(dx); });
    if (kind === 'network') [-20, 16, 32].forEach(function(dx, i) { plant(dx, .8, .7, i + 1); });
    if (kind === 'cloud') { guard(48); q.culture = 2; }
    if (kind === 'bloom') { [-20, 24].forEach(function(dx, i) { plant(dx, .3, .3, i + 1); }); guard(20); q.culture = 4; }
    if (kind === 'drift') { plant(35, .08, .7, 1); plant(48, .08, .7, 2); }
    if (kind === 'revive') { var p = plant(16, .08, .01, 1); recordGardenPlant(p); plantFalls(p); q.culture = 4; }
    if (kind === 'wall') {
      enterLevel(2); activeStageLayout = pictureLayout(2); var selected;
      (stageLayout().platforms || []).some(function(wall) {
        if (!wall.solid || wall.h < 18) return false;
        return [1, -1].some(function(face) {
          var x = face > 0 ? wall.x - 5 : wall.x + wall.w + 5, y = surfaceY(x);
          if (mycelWetBody({x:x,y:y,st:'free'}) || !cairnSupportPoint(x, y, null) ||
              combatLineClear(x, y - 12, x + face * (wall.w + 12), y - 12)) return false;
          selected = {x:x, y:y, face:face, wall:wall}; return true;
        });
      });
      if (!selected) throw Error('No authentic solid Mycel LOS barrier');
      P.x = selected.x; P.y = selected.y; P.face = selected.face; P.platform = playerSupportId(P.x, P.y);
      guard(selected.face * (selected.wall.w + 12)); q.world = worldLevel(); q.culture = 6;
    }
    mycelRebaseClocks(m); camX = P.x - IW * .5; camY = P.y - climbAnchor();
    return api.state;
  }
  var api = window.__mycelCombat = {
    get initial() { return log.initial; }, get player() { return P; }, get canvas() { return cv; },
    get coop() { return coop; }, get q() { return mycelPeek(); },
    get state() {
      var q = captured(), a = actor();
      return { at:performance.now(), world:worldLevel(), mode:rogueRun.mode, actor:a, q:q,
        policy:mycelPhasePolicy(), build:mycelBuild(),
        network:mycelNetwork().map(function(n) { return {id:n.id,x:n.x,y:n.y,wet:n.wet,distance:n.distance}; }),
        placement:mycelCloudPlacement({x:P.x + P.face * 48,y:P.y - 12}),
        accepts:log.accepts.slice(), contacts:log.contacts.slice(), damage:log.damage.slice(),
        restores:log.restores.slice(), pulses:log.pulses.slice(), moves:log.moves.slice(),
        landings:log.landings.slice(), replays:log.replays.slice(), ticks:log.ticks.slice(),
        timers:log.timers.slice(),fx:log.fx.slice(), bodies:log.bodies,
        plants:gardenPlots.map(function(p) { return {id:p.id,x:p.x,kind:p.kind,seed:p.seed,
          growth:p.growth,stalk:p.stalk,dead:p.dead || 0,health:p.health,moisture:p.moisture}; }),
        targets:floatKrek.map(function(k) { return {id:k.combatId,kind:k.kind,x:k.x,y:k.y,
          hp:k.hp,boss:!!k.boss,guardian:!!k.guardianStage,windup:k.windup || 0,
          slow:mycelSlowFactor(k),wet:k.mechWet || 0,events:mycelCapturePestEvents(k),
          burnOwner:k.mycelBurnOwner || '',burnSerial:k.mycelBurnSerial || 0,
          burnWorld:k.mycelBurnWorld || 0,burnKind:k.mycelBurnKind || ''}; }),
        shots:classShots.filter(function(s) { return s.kind === 'spore'; }).map(mycelCaptureShot),
        bombs:bombs.length, vital:lastSeedMode() ? Object.assign({},seedVital(null)) : null,
        hands:{task:task ? {kind:task.kind,fired:task.fired} : null,water:!!holdWater,
          heldDown:heldDown,heldSpace:heldSpace,gardenPress:gardenPress},
        controller:{connected:!!lastPad,single:!!pad.single,lamp:lampToggle} };
    },
    arrange:arrange, begin:beginCoop, capture:coopCapture, stateIn:coopState, input:coopInput,
    avatar:coopAvatar, roster:coopRoster, member:function(id) { return coop.members[id]; },
    memberState:function(id) { return coopWithMember(coop.members[id],function() { return api.state; }); },
    clearEvents:resetLog, clearTargets:function() { floatKrek = []; runEncounters = []; },
    clearPlants:function() { gardenPlots = []; },
    seed:function(fields) { Object.assign(mycelState(), fields); mycelRebaseClocks(mycelMember()); },
    seedMember:function(id, fields) { return coopWithMember(coop.members[id],function() { api.seed(fields); }); },
    boons:function(on) { ['colony','ferment','symbiosis','outbreak','symphony'].forEach(function(k) {
      var rank = on ? ['outbreak','symphony'].includes(k) ? 1 : 3 : 0;
      rogueRun.perks[k] = rank; if (mycelMember()) mycelMember().perks[k] = rank;
    }); },
    native:function(kind) { delete log.bodies[kind]; },
    cloudAt:function(x,y) { return mycelCloud({x:x,y:y}); },
    cloudWorld:function(x,y,tag) { return mycelCloudWorld({x:x,y:y},tag); },
    harmPlants:function() { gardenPlots.forEach(function(p) { p.health=.3;p.moisture=.08; }); },
    deleteBoundStub:function() { var q=mycelPeek();gardenPlots=gardenPlots.filter(function(p) { return p.id !== q.bloom.reviveId; }); },
    replaceBoundStub:function() { var q=mycelPeek(),p=gardenPlots.find(function(p) { return p.id === q.bloom.reviveId; });if(p){p.seed++;} },
    setNetwork:function(count, moisture) { gardenPlots=[];for(var i=0;i<count;i++)plant((i-1)*16,moisture,.7,i+1); },
    supported:function() { return cairnSupportPoint(P.x,P.y,P.platform); },
    arrangeMember:function(id,kind) {
      var m=coop.members[id];coopWithMember(m,function() {
        arrange(kind);m.avatar=Object.assign(m.avatar,coopAvatar());m.place=(m.place||0)+1;
        m.mycelProof=null;m.mycelCorrection=null;
      });
    },
    separateHost:function() { P.x=levelOriginX(1)+280;P.y=surfaceY(P.x);P.vx=P.vy=0;P.grounded=true;P.platform=null; },
    mode:function(name,scene) {
      arrange('empty');rogueRun.mode=name;activeStageLayout=null;
      if(name==='high-tide'){
        resetHighTide();var s=rogueRun.survival;s.height=120;
        gardenPlots=[{id:1,x:s.root,kind:0,seed:37,growth:.65,stalk:false,health:.5,
          moisture:.3,tideVine:true,tideHeight:s.height,pulse:0,hit:0,age:0}];
        highTideLayout();P.x=scene==='stem'?32:358;P.y=s.base+(scene==='stem'?0:-4);
        P.platform=scene==='stem'?'five-gardens-0':'five-gardens-101';
      }else if(name==='night-relay'){
        resetNightRelay();rogueRun.survival.stage=1;nightRelayLayout();
        P.x=100;P.y=rogueRun.survival.base;P.platform=null;
      }else if(name==='last-seed'){resetLastSeed();}
      P.st='free';P.vx=P.vy=0;P.grounded=true;P.wet=false;
      (mycelMember()||rogueRun).mycel=null;var q=mycelState();q.culture=6;mycelRebaseClocks(mycelMember());
      camX=P.x-IW*.5;camY=P.y-climbAnchor();return api.state;
    },
    floodFoot:function() { rogueRun.survival.waterY=P.y-1; },
    placeAir:function() { P.y-=28;P.vy=80;P.grounded=false;P.platform=null;P.coyote=0;P.airJumpUsed=true; },
    causal:function(kind,castKind) {
      arrange('empty');var p=plant(18,.08,.3,1),q=mycelState();q.culture=6;
      if(kind==='spore')addRunHazard('spore',P.x+20,8,10,0,P.x+20,P.y-12,P.y-12);
      if(kind==='echo'){
        var k=makeStageBoss(18);Object.assign(k,{combatId:++classPestId,bossId:'tuning-fork',
          x:P.x+20,y:P.y-12,vx:0,vy:0,hp:100,maxHp:100,pattern:'echo',
          windup:3,tell:3,exposed:0,cool:60,finalBoss:false});
        floatKrek=[k];
      }
      if(['mulch','burn','fever','burn-fever'].includes(kind)){
        rogueRun.perks.mulch=4;if(mycelMember())mycelMember().perks.mulch=4;
        var k=guard(20),amount=castKind==='cloud'?.25:.8;
        var delayed=kind==='burn'||kind==='burn-fever';
        if(delayed)ownTraits().embers=3;
        if(kind==='fever'||kind==='burn-fever'){gardenPower=99;gardenFeverT=0;}
        k.hp=amount*(1+.12*(delayed?3:0))*runPlayerPower()/runDurabilityScale(k)+
          (delayed?.06:-.05);k.maxHp=100;
      }
      mycelRebaseClocks(mycelMember());return api.state;
    },
    chorus:function() {
      arrange('empty');api.boons(true);
      var p=plant(16,.65,.8,1),k=makeKrek(1,false,0);
      Object.assign(k,{combatId:++classPestId,x:P.x+14,y:P.y-12,vx:0,vy:0,hp:100,
        maxHp:100,scout:false,target:p,attackTarget:p,windup:.6,bite:0,hitStaggerCooldown:0});
      floatKrek=[k];return api.state;
    },
    movementComparison:function(boss,wet) {
      var cloud=mycelPeek().clouds[0],k=makeKrek(1,false,0);
      Object.assign(k,{x:cloud.x,y:cloud.y,vx:40,vy:0,hp:100,maxHp:100,
        boss:!!boss,guardianStage:boss?1:0,mechWet:wet?2:0});
      var baseline=Object.assign({},k),x=k.x,clouds=mycelPeek().clouds;
      moveEnemyTo(k,k.x+100,k.y,.01,30);mycelPeek().clouds=[];
      moveEnemyTo(baseline,baseline.x+100,baseline.y,.01,30);
      mycelPeek().clouds=clouds;return {ratio:(k.x-x)/(baseline.x-x),factor:mycelSlowFactor(k)};
    },
    party:function() {
      rogueRun.mode='last-seed';resetLastSeed();gardenPlots=[];floatKrek=[];runEncounters=[];
      var center={x:P.x,y:P.y},owner=mycelMember(),ids=[
        '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
      ids.forEach(function(id,i){coop.network.room.members.push({id:id,slot:i+3,ready:true});
        coop.members[id]=coopMember(id,i+3,{classId:i?'bulwark':'runner',skinId:i?'ember':'moss-pink'},
          {x:center.x+(i?24:-24),y:center.y,world:worldLevel(),st:'free',grounded:true});});
      Object.values(coop.members).forEach(function(m){
        var v=seedVital(m);v.hp=m.id===owner.id?50:m.id===ids[1]?0:50;
        v.shield=m.id===ids[1]?8:0;v.revive=m.id===ids[1] ? .4:0;v.hurt=0;
        if(m.id!==owner.id){m.avatar.x=center.x+(m.slot-2)*10;m.avatar.y=center.y;}
      });
      var q=mycelState();q.culture=4;mycelRebaseClocks(owner);return api.partyVitals();
    },
    partyVitals:function(){return seedActors().map(function(a){return {id:a.id,x:a.p.x,y:a.p.y,
      hp:a.v.hp,shield:a.v.shield,revive:a.v.revive,air:a.p.air};});},
    partyFor:function(id){
      coopWithMember(coop.members[id],function(){api.party();});
      var a=coop.members[id].avatar;P.x=a.x+10;P.y=a.y;P.vx=P.vy=0;
      P.grounded=true;P.platform=playerSupportId(P.x,P.y);return api.partyVitals();
    },
    distantShot:function(){floatKrek=[];runEncounters=[];gardenPlots=[];guard(100);},
    primaryLeft:function(){return mycelPrimary({x:P.x-100,y:P.y-13});}
  };
}

const server = http.createServer((req,res) => {
  try {
    const url = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root, '.' + (url.endsWith('/') ? url + 'index.html' : url));
    if (!file.startsWith(root + path.sep)) throw Error('Outside build');
    res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404);res.end(); }
});
let base, browser, peerBrowser, activePage, activeGame, activeHost, activeMember;
const state = game => game.evaluate(() => window.__mycelCombat.state);
const arrange = (game,kind) => game.evaluate(kind => window.__mycelCombat.arrange(kind),kind);
const near = (a,b,t,message) => assert.ok(Math.abs(a-b)<=t,(message || 'Expected close values')+': '+a+' vs '+b);
const options = engine => ({headless:true,...(engine==='chromium' && process.env.MYCEL_CHROMIUM_EXECUTABLE ?
  {executablePath:process.env.MYCEL_CHROMIUM_EXECUTABLE} : {})});
async function installProbe(context) {
  await context.route('**/index.html',route => {
    const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
    assert.ok(source.includes('function drawPlayer() {'),'Unchanged local observer injection seam');
    return route.fulfill({contentType:'text/html',body:source.replace('function drawPlayer() {',
      '('+browserProbe.toString()+')();\nfunction drawPlayer() {')});
  });
}
function collectErrors(context,errors) {
  context.on('page',page => {
    page.on('pageerror',e => errors.push({kind:'runtime',message:e.message}));
    page.on('console',m => { if(m.type()==='error')errors.push({kind:'console',message:m.text()}); });
    page.on('requestfailed',r => errors.push({kind:'request',url:r.url(),failure:r.failure()}));
    page.on('response',r => { if(r.status()>=400 && !r.url().endsWith('/favicon.ico'))
      errors.push({kind:'http',status:r.status(),url:r.url()}); });
  });
}
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#status')?.dataset.guardian,null,{timeout:20000});
  const game=page.frames().find(frame => frame!==page.mainFrame());
  assert.ok(game);assert.equal(await game.evaluate(() => typeof window.__mycelCombat),'object');
  assert.deepEqual((await game.evaluate(() => window.MaxNativeArt.load())).failed,[]);
  return game;
}
async function focus(game) {
  await game.evaluate(() => { window.focus();window.__mycelCombat.canvas.tabIndex=-1;
    window.__mycelCombat.canvas.focus({preventScroll:true}); });
}
async function press(page,game,key,pose) {
  await focus(game);if(pose)await game.evaluate(pose => window.__mycelCombat.native(pose),pose);
  await page.keyboard.press(key);
}
async function body(game,kind) {
  await game.waitForFunction(kind => !!window.__mycelCombat.state.bodies[kind],kind,{timeout:2000});
  const b=(await state(game)).bodies[kind];
  assert.deepEqual([b.rect[2],b.rect[3],b.rect[6],b.rect[7]],[32,32,32,32]);
  assert.ok(b.rect.every(Number.isInteger));
  assert.ok(b.cell,'Accepted original native pose is observed before the next action');
  assert.equal(b.source,b.cell.sheet+'.png');assert.equal(b.rect[0],b.cell.column*32);assert.equal(b.rect[1],b.cell.row*32);
  return b;
}
async function shot(page,engine,name) {
  await page.locator('iframe').screenshot({path:path.join(output,engine+'-'+name+'.png')});
}
function wholeRestore(s,serial) {
  const sum=new Map();
  for(const r of s.restores.filter(r=>r.serial===serial)){
    const d=sum.get(r.id)||{health:0,water:0};
    d.health+=r.delivered.health;d.water+=r.delivered.water;sum.set(r.id,d);
  }
  for(const d of sum.values()){assert.ok(d.health<=.12+1e-8);assert.ok(d.water<=.15+1e-8);}
  return Object.fromEntries(sum);
}

// Verification groups are added below; each positive path uses real browser input
// and the original host simulator. Isolated seeded cases test rejection/budget edges.
async function presentation(page,game,engine,results,visuals) {
  const initial=await game.evaluate(()=>window.__mycelCombat.initial);
  assert.equal(initial?.culture ?? 0,0,'Public Mycel review has no resource prefill');
  for(const [viewport,width,height] of [['desktop',1000,650],['phone',390,844],['small',320,568]]) {
    await page.locator('#viewport').selectOption(viewport);
    await game.waitForFunction(({width,height})=>innerWidth===width&&innerHeight===height,{width,height});
    const view=await game.evaluate(()=>({
      width:innerWidth,height:innerHeight,skin:window.__mycelCombat.player.skin,
      smoothing:window.__mycelCombat.canvas.getContext('2d').imageSmoothingEnabled,
      buttons:Array.from(document.querySelectorAll('#mycelControls button')).filter(b=>!b.hidden).map(b=>{
        const r=b.getBoundingClientRect();return {id:b.id,label:b.getAttribute('aria-label'),
          hidden:!!b.closest('[hidden]'),left:r.left,right:r.right,top:r.top,bottom:r.bottom};
      })
    }));
    assert.equal(view.skin,'moon');assert.equal(view.smoothing,false);assert.equal(view.buttons.length,4);
    assert.ok(view.buttons.every(b=>!b.hidden&&b.left>=0&&b.right<=width&&b.top>=0&&
      b.bottom<=height&&b.bottom-b.top>=48));
    visuals.push(view);await shot(page,engine,viewport);
  }
  await page.locator('#viewport').selectOption('phone');
  results.push('Original Mycel sheets/atlas bytes,32px cells,16/31 anchors and integer native body; desktop/390/320 four coarse48px controls');
}
async function primary(page,game,engine,results) {
  await arrange(game,'primary');await press(page,game,'b','primary');await body(game,'primary');
  await game.waitForFunction(()=>window.__mycelCombat.state.contacts.some(c=>c.accepted));
  let s=await state(game),contact=s.contacts.find(c=>c.accepted);
  near(contact.after.culture-contact.before.culture,.5,1e-8,'Only initial dart adds Culture');
  assert.equal(contact.seenIds.length,2,'One dry living network anchors one baseline chain');
  assert.equal(new Set(contact.seenIds).size,2);assert.equal(contact.consumed,1);
  assert.deepEqual(s.damage.map(d=>d.requested),[1,.65]);assert.equal(s.q.culture,.5);
  assert.equal(s.accepts.filter(a=>a.name==='primary').length,1);assert.equal(s.bombs,0);
  await game.waitForFunction(()=>window.__mycelCombat.q.primaryCool<=0);
  await press(page,game,'b');await game.waitForFunction(()=>window.__mycelCombat.state.contacts.filter(c=>c.accepted).length===2);
  assert.equal((await state(game)).q.culture,1,'Distinct darts are independent of any shared four-second reward gate');
  await arrange(game,'bare-primary');await press(page,game,'b');await game.waitForFunction(()=>window.__mycelCombat.state.contacts.some(c=>c.accepted));
  assert.equal((await state(game)).contacts.find(c=>c.accepted).seenIds.length,1,'Plant-free base dart has no chain');
  await arrange(game,'bare-primary');await game.evaluate(()=>window.__mycelCombat.boons(true));
  await press(page,game,'b');await game.waitForFunction(()=>window.__mycelCombat.state.contacts.some(c=>c.accepted));
  s=await state(game);assert.equal(s.contacts.find(c=>c.accepted).seenIds.length,3);
  assert.equal(s.q.culture,.5,'Two Outbreak links do not multiply Culture');
  await arrange(game,'primary');await game.evaluate(()=>window.__mycelCombat.boons(true));
  await press(page,game,'b');await game.waitForFunction(()=>window.__mycelCombat.state.contacts.some(c=>c.accepted));
  s=await state(game);assert.equal(s.contacts.find(c=>c.accepted).seenIds.length,4);
  assert.equal(s.q.culture,.5);assert.ok(s.contacts.every(c=>new Set(c.seenIds).size===c.seenIds.length));
  await arrange(game,'empty');await press(page,game,'b');await game.waitForTimeout(1250);
  assert.equal((await state(game)).q.culture,0,'A miss cannot earn initial contact resource');
  await arrange(game,'wall');await press(page,game,'b');await game.waitForTimeout(1250);
  s=await state(game);assert.equal(s.damage.length,0);assert.equal(s.q.culture,6);
  assert.equal(s.contacts.filter(c=>c.accepted).length,0,'Real solid wall blocks the dart and links');
  await shot(page,engine,'primary-wall');
  results.push('Real aimed B: initial1D/one.65D distinct dry-network chain,+.5 once per actual dart; Outbreak2/3links bounded, misses/solid LOS grant no attack resource');
}
async function network(page,game,engine,results) {
  for(const count of [1,2,3]) {
    await arrange(game,'empty');await game.evaluate(count=>window.__mycelCombat.setNetwork(count,.8),count);
    await game.waitForFunction(()=>window.__mycelCombat.state.ticks.length>=35);
    const s=await state(game),dt=s.ticks.reduce((sum,t)=>sum+Math.max(0,Math.min(.1,t.dt)),0);
    near(s.q.culture,.5*Math.min(2,count)*dt,.003,'Only actual valid host simulation dt generates Culture');
    assert.equal(s.network.length,count);assert.ok(s.network.every(n=>n.wet));
    assert.ok(s.q.networkIds.length<=3);
  }
  await arrange(game,'empty');await game.evaluate(()=>window.__mycelCombat.setNetwork(3,.08));
  await game.waitForTimeout(550);assert.equal((await state(game)).q.culture,0,'Dry living anchors are not passive generators');
  await game.evaluate(()=>window.__mycelCombat.seed({culture:5.9}));
  await game.evaluate(()=>window.__mycelCombat.setNetwork(3,.8));
  await game.waitForFunction(()=>window.__mycelCombat.q.culture===6);
  await game.evaluate(()=>window.__mycelCombat.clearPlants());await game.waitForTimeout(350);
  assert.equal((await state(game)).q.culture,6,'Leaving/removing network retains earned resource without decay');
  await shot(page,engine,'network');
  results.push('Actual wet-network simulation.5/s perplot with max1/s fromtwo, nearestthree stableIDs; dry anchors stop generation, cap6/no decay');
}
async function cloud(page,game,engine,results) {
  await arrange(game,'cloud');await press(page,game,'c','cloud');await body(game,'cloud');
  let s=await state(game),c=s.q.clouds[0];assert.ok(c);assert.equal(s.q.culture,0);
  assert.ok(s.q.cloudCool>4.6);assert.equal(c.life,3);assert.equal(c.pulseMask,0);
  assert.equal(s.targets[0].slow,.7);await shot(page,engine,'cloud-start');
  await game.waitForFunction(()=>window.__mycelCombat.state.pulses.filter(p=>p.kind==='cloud'&&p.before!==p.mask).length===3,null,{timeout:4500});
  s=await state(game);const pulses=s.pulses.filter(p=>p.kind==='cloud'&&p.before!==p.mask);
  assert.deepEqual(pulses.map(p=>p.slot),[0,1,2]);
  const accepted=s.accepts.find(a=>a.name==='cloud');
  for(let i=0;i<3;i++)assert.ok(pulses[i].at-accepted.at>=990+i*1000,'Source cloud pulse cannot arrive early');
  near(s.damage.filter(d=>d.context?.serial===c.serial).reduce((sum,d)=>sum+d.requested,0),.75,1e-8);
  assert.equal(s.q.culture,0);assert.equal(s.restores.length,0);
  await arrange(game,'cloud');await game.evaluate(()=>window.__mycelCombat.boons(true));
  await press(page,game,'c');await game.waitForFunction(()=>window.__mycelCombat.state.pulses.filter(p=>p.kind==='cloud'&&p.before!==p.mask).length===3,null,{timeout:4500});
  s=await state(game);assert.equal(s.q.clouds[0].life,6);assert.equal(s.q.clouds[0].pulseMask,7);
  assert.equal(s.targets[0].slow,.7);near(s.damage.reduce((sum,d)=>sum+d.requested,0),.75,1e-8,'Ferment changes uptime only');
  for(const boss of [false,true])for(const wet of [false,true]){
    const comparison=await game.evaluate(({boss,wet})=>window.__mycelCombat.movementComparison(boss,wet),{boss,wet});
    near(comparison.ratio,boss?.9:.7,1e-8,'ActualmoveEnemyTo cloud displacement composes once withWet');
  }
  await game.waitForTimeout(650);assert.equal((await state(game)).pulses.filter(p=>p.before!==p.mask).length,3);
  await game.evaluate(()=>window.__mycelCombat.seed({culture:4}));
  await game.waitForFunction(()=>window.__mycelCombat.q.cloudCool<=0);
  await press(page,game,'c');s=await state(game);assert.equal(s.q.clouds.length,2);
  const twoStock=s.q.culture;await game.evaluate(()=>window.__mycelCombat.seed({cloudCool:0}));
  await press(page,game,'c');s=await state(game);assert.equal(s.q.clouds.length,2);
  assert.equal(s.q.culture,twoStock);assert.equal(s.q.cloudCool,0,'Third ownercloud deniedbeforedebit/cooldown');
  await arrange(game,'empty');await game.evaluate(()=>window.__mycelCombat.seed({culture:6}));
  const before=await state(game);
  assert.equal(await game.evaluate(()=>window.__mycelCombat.cloudWorld(window.__mycelCombat.player.x+81,window.__mycelCombat.player.y-12,999)),false);
  s=await state(game);assert.equal(s.q.culture,before.q.culture);assert.equal(s.q.cloudCool,0);
  await arrange(game,'wall');
  assert.equal(await game.evaluate(()=>{const s=window.__mycelCombat.state,k=s.targets[0];return window.__mycelCombat.cloudWorld(k.x,k.y,1000);}),false);
  assert.equal((await state(game)).q.cloudCool,0);
  results.push('C spends2/CD5 only after clear<=80 placement; three1/2/3s.25D slots/.75D cap, Ferment slow-anchor tail6s without added damage or restoration; wall/range rejection unpaid');
}
async function bloom(page,game,engine,results) {
  await arrange(game,'bloom');await press(page,game,'e','bloom');await body(game,'bloom');
  let s=await state(game),cast=s.q.bloom;assert.ok(cast);assert.equal(s.q.culture,0);
  assert.ok(s.q.specialCool>11.5);assert.equal(s.policy.blockTend,false);assert.equal(s.policy.lockSteer,false);
  await focus(game);await page.keyboard.down('ArrowLeft');
  try { await game.waitForTimeout(120); } finally { await page.keyboard.up('ArrowLeft'); }
  assert.ok((await state(game)).actor.x<cast.x-1,'Accepted fixed Bloom permits immediate real movement');
  await game.waitForFunction(()=>window.__mycelCombat.q.bloom?.pulseMask===7,null,{timeout:5000});
  s=await state(game);assert.equal(s.q.bloom.x,cast.x);assert.equal(s.q.bloom.y,cast.y);
  const pulses=s.pulses.filter(p=>p.serial===cast.serial&&p.before!==p.mask);
  assert.deepEqual(pulses.map(p=>p.slot),[0,1,2]);
  assert.equal(s.damage.filter(d=>d.context?.serial===cast.serial).length,3);
  near(s.damage.filter(d=>d.context?.serial===cast.serial).reduce((sum,d)=>sum+d.requested,0),2.4,1e-8);
  const restores=wholeRestore(s,cast.serial);assert.ok(Object.keys(restores).length===2);
  for(const d of Object.values(restores)){near(d.health,.12,.0001);near(d.water,.15,.0001);}
  assert.ok(s.q.bloom.plots.every(d=>d.healthUsed<=.12+1e-8&&d.waterUsed<=.15+1e-8));
  await shot(page,engine,'bloom-complete');
  await arrange(game,'empty');await game.evaluate(()=>window.__mycelCombat.seed({culture:4,chorusT:4}));
  await press(page,game,'e');s=await state(game);
  assert.equal(s.q.culture,4);assert.equal(s.q.specialCool,0);assert.equal(s.q.bloom,null);
  assert.ok(s.q.chorusT>3.5,'Empty denial preserves the genuinely stored opportunity');
  await arrange(game,'bloom');await press(page,game,'e');
  await game.waitForFunction(()=>window.__mycelCombat.q.bloom?.pulseMask===1);
  await game.evaluate(()=>{window.__mycelCombat.player.wet=true;});await game.waitForTimeout(60);
  s=await state(game);assert.equal(s.q.bloom.cancelled,1);assert.equal(s.q.bloom.pulseMask,7);
  assert.ok(s.q.specialCool>0);assert.equal(s.q.culture,0);
  results.push('E acceptedfixedr48 centre/three0/2/4s.8D slots; actualmovement staysfree, wholeplot.12/.15 debt, emptydenial preservesstock/Chorus, wetpaidcancel preservescost/CD');
}
async function revive(page,game,engine,results) {
  await arrange(game,'revive');const before=(await state(game)).plants[0];
  assert.ok(before.dead>0);await press(page,game,'e');
  await game.waitForFunction(()=>window.__mycelCombat.q.bloom?.reviveConsumed===1);
  let s=await state(game),p=s.plants[0];assert.equal(p.dead,0);
  assert.deepEqual([p.id,p.kind,p.seed,p.growth,p.stalk],[before.id,before.kind,before.seed,before.growth,before.stalk]);
  assert.ok(p.health<=before.health+.04+.001,'No old.2HP minimum');
  assert.ok(p.moisture<=before.moisture+.05+.001,'No old.5water minimum');
  await game.waitForFunction(()=>window.__mycelCombat.q.bloom?.pulseMask===7,null,{timeout:5000});
  s=await state(game);wholeRestore(s,s.q.bloom.serial);
  assert.equal(s.q.bloom.reviveId,before.id);assert.equal(s.q.bloom.reviveSeed,before.seed);
  await arrange(game,'revive');
  await game.evaluate(()=>{window.__mycelCombat.player.st='lamp';window.__mycelCombat.player.autoIdlePose=false;});
  await press(page,game,'e');assert.equal((await state(game)).q.bloom,null,'Manual pose cannot resurrect');
  await shot(page,engine,'revive-identity');
  results.push('Real retained plantFalls stub revives once by exactID/kind/seed, originalgrowth/stalk retained and ordinarycastdebt/no legacyHP-water minimum');
}
async function drift(page,game,engine,results) {
  await arrange(game,'drift');const before=await state(game);
  await press(page,game,'v','drift');await body(game,'drift');
  let s=await state(game),d=s.q.drift;assert.ok(d);assert.equal(d.face,1);
  assert.equal(d.launchVY,-90);assert.ok(s.q.utilityCool>5.5);
  assert.equal(s.policy.blockSecondary,true);assert.equal(s.policy.blockJump,true);
  assert.equal(s.policy.blockPrimary,false);assert.equal(s.policy.blockDodge,false);
  await game.evaluate(()=>window.__mycelCombat.seed({culture:6}));
  await press(page,game,'c');await press(page,game,'e');
  s=await state(game);assert.equal(s.q.clouds.length,0);assert.equal(s.q.bloom,null);
  await focus(game);await page.keyboard.down('ArrowLeft');
  try { await press(page,game,'b');await game.waitForTimeout(70); } finally { await page.keyboard.up('ArrowLeft'); }
  assert.ok((await state(game)).actor.x>before.actor.x,'Ordinary steering cannot turn accepted Drift');
  assert.ok((await state(game)).accepts.some(a=>a.name==='primary'),'B remains usable during Drift');
  await game.waitForFunction(()=>window.__mycelCombat.q.drift?.landingConsumed===1,null,{timeout:2000});
  s=await state(game);d=s.q.drift;
  assert.ok(d.travel>30&&d.travel<=48);assert.equal(d.seenAir,1);assert.equal(d.landingPlantId,1);
  const landings=s.landings.filter(l=>l.awarded);assert.equal(landings.length,1);
  const water=landings[0].plantsAfter.reduce((sum,p)=>{
    const b=landings[0].plantsBefore.find(b=>b.id===p.id);return sum+p.water-(b?.water||0);
  },0);near(water,.04,1e-8,'One first actual landing restores.04 total to oneplot');
  assert.deepEqual(landings[0].plantsBefore.map(p=>p.health),landings[0].plantsAfter.map(p=>p.health));
  assert.equal(s.actor.dodgeT,0);assert.equal(s.damage.length,0,'Drift itself damages noenemy');
  assert.ok(s.moves.every(m=>!m.accepted||m.drift.travel<=48));
  await shot(page,engine,'drift-landed');
  await arrange(game,'drift');await game.evaluate(()=>window.__mycelCombat.placeAir());
  await press(page,game,'v');await press(page,game,'x');
  s=await state(game);assert.equal(s.q.drift.phase,0);assert.equal(s.q.drift.landingConsumed,1);
  assert.ok(s.q.utilityCool>0);assert.equal(s.actor.dodgeT,0,'AirX cancels paidDrift without an airiframe');
  await game.waitForTimeout(850);assert.equal((await state(game)).landings.filter(l=>l.awarded).length,0);
  results.push('Real vulnerableVX100/VY-90 Drift.35s nativecollisionpath<=48; Ballowed/steer-C-E-jumplocked, actualfirstlanding+.04totalonce, airXpaidcancelwithoutiframe');
}
async function idle(page,game,engine,results) {
  await arrange(game,'empty');await focus(game);
  await game.waitForFunction(()=>['lampUp','lamp'].includes(window.__mycelCombat.player.st),null,{timeout:9500});
  assert.equal((await state(game)).actor.autoIdlePose,true);
  await press(page,game,'c');let s=await state(game);
  assert.equal(s.actor.autoIdlePose,true);assert.equal(s.q.clouds.length,0);
  await press(page,game,'b','primary');await body(game,'primary');
  s=await state(game);assert.equal(s.actor.autoIdlePose,false);assert.equal(s.actor.st,'free');
  await arrange(game,'empty');await press(page,game,'l');
  await game.waitForFunction(()=>['lampUp','lamp'].includes(window.__mycelCombat.player.st));
  await press(page,game,'v');s=await state(game);assert.equal(s.q.drift,null);
  assert.equal(s.actor.autoIdlePose,false);
  results.push('Actual7sidle: deniedzeroCultureCpreservespose, acceptedBwakes; manuallyraisedlanternremainsineligible');
}
async function causal(page,game,engine,results) {
  const evidence=[];
  for(const kind of ['spore','echo','mulch','burn','fever','burn-fever']) {
    await game.evaluate(kind=>window.__mycelCombat.causal(kind,'bloom'),kind);
    await press(page,game,'e');
    await game.waitForFunction(()=>window.__mycelCombat.q.bloom?.pulseMask===7,null,{timeout:5000});
    const s=await state(game),cast=s.q.bloom;
    assert.ok(cast);const delivered=wholeRestore(s,cast.serial);
    assert.ok(s.restores.some(r=>r.serial===cast.serial&&
      (r.request.water>.05||r.request.health>.04)),kind+' traverses the actual causal restoration seam');
    for(const d of cast.plots){assert.ok(d.healthUsed<=.12+1e-8);assert.ok(d.waterUsed<=.15+1e-8);}
    if(kind==='burn'||kind==='burn-fever')assert.ok(s.damage.some(d=>d.context?.serial===cast.serial),'Accepted E creates the real burn cause');
    evidence.push({kind:'bloom-'+kind,cast:cast,delivered:delivered,restores:s.restores});
  }
  for(const kind of ['spore','echo','mulch','burn','fever','burn-fever']) {
    const before=await game.evaluate(kind=>window.__mycelCombat.causal(kind,'cloud'),kind);
    await press(page,game,'c');
    await game.waitForFunction(()=>window.__mycelCombat.state.pulses.some(p=>p.kind==='cloud'&&p.before!==p.mask),null,{timeout:2000});
    if(kind==='burn'||kind==='burn-fever')await game.waitForFunction(()=>window.__mycelCombat.state.targets.length===0,null,{timeout:1500});
    else await game.waitForTimeout(100);
    const s=await state(game);
    assert.ok(s.plants[0].health<=before.plants[0].health+.002,kind+' Cloud restores no friendly health');
    assert.ok(s.plants[0].moisture<=before.plants[0].moisture+.002,kind+' Cloud restores no friendly water');
    assert.equal(s.restores.filter(r=>r.delivered.health||r.delivered.water).length,0);
    evidence.push({kind:'cloud-'+kind,before:before.plants,after:s.plants,damage:s.damage});
  }
  fs.writeFileSync(path.join(output,engine+'-causal-restoration.json'),JSON.stringify(evidence,null,2));
  results.push('Actual accepted E direct/spore/echo/Mulch/deferredEmber restoration shares one absolute.12/.15 currentID ledger; same real C causal paths suppress friendly restoration');
}
async function boons(page,game,engine,results) {
  await arrange(game,'primary');await game.evaluate(()=>window.__mycelCombat.boons(true));
  await press(page,game,'b');await game.waitForFunction(()=>window.__mycelCombat.state.contacts.some(c=>c.accepted));
  let s=await state(game);assert.equal(s.damage[0].requested,1.6);
  assert.ok(s.q.symbiosis.length>0);
  assert.ok(s.q.symbiosis.every(d=>d.healthUsed<=.045+1e-8&&d.waterUsed<=.105+1e-8));
  const debt=s.q.symbiosis.map(d=>({id:d.id,health:d.healthUsed,water:d.waterUsed}));
  await game.evaluate(()=>window.__mycelCombat.seed({primaryCool:0}));
  await press(page,game,'b');await game.waitForFunction(()=>window.__mycelCombat.state.contacts.filter(c=>c.accepted).length===2);
  s=await state(game);for(const d of debt){
    const after=s.q.symbiosis.find(a=>a.id===d.id);
    near(after.healthUsed,d.health,1e-8);near(after.waterUsed,d.water,1e-8);
  }
  await game.evaluate(()=>window.__mycelCombat.chorus());
  await press(page,game,'b');
  await game.waitForFunction(()=>window.__mycelCombat.q.chorusT>0);
  s=await state(game);assert.ok(s.q.chorusSerial>0);assert.equal(s.q.chorusPlantId,1);
  await game.evaluate(()=>window.__mycelCombat.seed({culture:4,primaryCool:.58}));
  await press(page,game,'e');
  await game.waitForFunction(()=>window.__mycelCombat.q.bloom?.pulseMask===1);
  s=await state(game);assert.equal(s.q.bloom.chorusPulse,1);assert.equal(s.q.chorusT,0);
  assert.equal(s.q.bloom.readied,1);assert.equal(s.q.primaryCool,0);
  const cast=s.q.bloom.serial,first=s.damage.find(d=>d.context?.serial===cast);
  near(first.requested,1.6,1e-8,'One first pulse owns fullFerment×Chorus, no restoration multiplier');
  await game.waitForFunction(()=>window.__mycelCombat.q.bloom?.pulseMask===7,null,{timeout:5000});
  s=await state(game);assert.equal(s.timers.filter(t=>t.key==='primaryCool'&&t.value===0).length,1);
  assert.ok(s.damage.filter(d=>d.context?.serial===cast).reduce((sum,d)=>sum+d.requested,0)<=4.16+1e-8);
  wholeRestore(s,cast);await shot(page,engine,'living-chorus');
  results.push('Owned Colony/Ferment/Outbreak effects preserved; actualinitial-onlySymbiosis fixed1s debt; real threatenedhealthyplant dart interruption primes one1.25pulse, Symphony readiesBoncewithout raisingrestorationcaps');
}
async function modes(page,game,engine,results) {
  await game.evaluate(()=>window.__mycelCombat.mode('high-tide','stem'));
  let s=await state(game);
  assert.ok(s.network.length>0,'Actual nearby bentTide stem is reachable even when itsroot isremote');
  await press(page,game,'e');await game.waitForFunction(()=>window.__mycelCombat.q.bloom?.pulseMask===1);
  assert.equal((await state(game)).q.bloom.hpUsed,0,'Tide Bloom has no LastSeed HP allowance');
  await game.evaluate(()=>window.__mycelCombat.floodFoot());await game.waitForTimeout(70);
  s=await state(game);assert.equal(s.q.bloom.cancelled,1);
  assert.ok(s.q.specialCool>0);const stock=s.q.culture;
  await press(page,game,'v');assert.equal((await state(game)).q.drift,null);
  near((await state(game)).q.culture,stock,.001);
  await game.evaluate(()=>window.__mycelCombat.mode('night-relay'));
  await press(page,game,'e');s=await state(game);assert.equal(s.q.bloom,null);
  assert.equal(s.q.culture,6);assert.equal(s.q.specialCool,0,'Plant-free unsupportedemptyE denies withoutspend');
  await press(page,game,'c');s=await state(game);assert.equal(s.q.clouds.length,1);
  assert.equal(s.q.culture,4);assert.equal(s.plants.length,0,'Cloud is no plant/progression/seed record');
  await press(page,game,'v');await game.waitForFunction(()=>window.__mycelCombat.q.drift?.phase!==1);
  s=await state(game);assert.ok(s.q.drift.travel<=48);
  assert.equal(s.q.bloom,null);assert.equal(s.plants.length,0);
  await shot(page,engine,'relay-cloud-drift');await arrange(game,'empty');
  results.push('ActualTide bentstem network/restoration, physicalrisingwater paidcancel/no Drift; plant-freeRelay Cloud/realboundedDrift without plants/HP/progression and emptyEunpaid');
}
async function touch(page,game,engine,results) {
  await arrange(game,'primary');
  await game.evaluate(()=>window.__mycelCombat.native('primary'));
  await game.locator('#mycelPrimary').tap();await body(game,'primary');
  await game.waitForFunction(()=>window.__mycelCombat.state.contacts.some(c=>c.accepted));
  await arrange(game,'cloud');await game.evaluate(()=>window.__mycelCombat.native('cloud'));
  await game.locator('#mycelSecondary').tap();await body(game,'cloud');
  assert.equal((await state(game)).q.culture,0);
  await arrange(game,'drift');const x=(await state(game)).actor.x;
  await focus(game);await page.keyboard.down('ArrowRight');
  try {
    await game.locator('#mycelUtility').tap();
    await game.waitForFunction(()=>window.__mycelCombat.q.drift?.landingConsumed===1,null,{timeout:2000});
  } finally { await page.keyboard.up('ArrowRight'); }
  assert.ok((await state(game)).actor.x>x+30,'Touch ability coexists with real directional movement');
  await arrange(game,'bloom');await game.evaluate(()=>window.__mycelCombat.native('bloom'));
  await game.locator('#mycelSpecial').tap();await body(game,'bloom');
  assert.equal((await state(game)).q.culture,0);
  for(const id of ['mycelSecondary','mycelSpecial']) {
    await arrange(game,id==='mycelSecondary'?'cloud':'bloom');
    const button=game.locator('#'+id),before=await state(game);
    await button.dispatchEvent('pointerdown',{pointerId:13,pointerType:'touch',clientX:10,clientY:10});
    await button.dispatchEvent('pointercancel',{pointerId:13,pointerType:'touch'});
    await button.dispatchEvent('click');let s=await state(game);
    assert.equal(s.q.culture,before.q.culture);assert.equal(s.accepts.length,0,'Canceledtouch cannotcast');
    await button.dispatchEvent('pointerdown',{pointerId:14,pointerType:'touch',clientX:10,clientY:10});
    await button.dispatchEvent('pointermove',{pointerId:14,pointerType:'touch',clientX:2000,clientY:2000});
    await button.dispatchEvent('click');s=await state(game);
    assert.equal(s.q.culture,before.q.culture);assert.equal(s.accepts.length,0,'Drag-out cancels tap');
  }
  await shot(page,engine,'touch');
  results.push('Real coarse touch B/C/V/E, simultaneousdirectionalmovement, tapDrift surviveskeyup; pointercancel/drag-out cannotspend or createeffects');
}
async function controller(page,game,engine,results) {
  const cases=[];
  for(const single of [false,true]) {
    await arrange(game,'empty');
    await game.evaluate(single=>{
      window.__mycelPad={id:single?'Joy-Con (L) Gamepad':'Xbox Wireless Controller',
        mapping:'standard',connected:true,index:0,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__mycelPad?[window.__mycelPad]:[]});
      window.focus();
    },single);
    await game.waitForFunction(()=>window.__mycelCombat.state.controller.connected);
    const pad=buttons=>game.evaluate(buttons=>window.__mycelPad.buttons.forEach((_,i)=>
      window.__mycelPad.buttons[i]={pressed:buttons.includes(i),value:buttons.includes(i)?1:0}),buttons);
    const tap=async buttons=>{await pad(buttons);await game.waitForTimeout(80);await pad([]);await game.waitForTimeout(35);};
    await arrange(game,'primary');await tap([2]);
    await game.waitForFunction(()=>window.__mycelCombat.state.contacts.some(c=>c.accepted));
    await arrange(game,'cloud');await tap([8]);assert.equal((await state(game)).q.culture,0);
    await arrange(game,'drift');await tap([single?10:6]);
    await game.waitForFunction(()=>window.__mycelCombat.q.drift?.landingConsumed===1,null,{timeout:2000});
    await arrange(game,'bloom');await tap([single?3:4]);
    await game.waitForFunction(()=>window.__mycelCombat.q.bloom?.pulseMask===1);
    await arrange(game,'empty');await game.evaluate(()=>window.__mycelCombat.seed({culture:6}));
    await pad([1]);await game.waitForTimeout(200);await pad([1,8]);await game.waitForTimeout(120);
    let s=await state(game);assert.equal(s.q.clouds.length,0);assert.equal(s.q.culture,6);
    assert.equal(s.hands.heldSpace,false,'Tend+Crefill chord suppresses gardening');
    await pad([]);await game.waitForTimeout(50);
    await arrange(game,'empty');await pad([1]);await game.waitForTimeout(200);
    await pad([1,single?10:6]);await game.waitForTimeout(120);
    s=await state(game);assert.equal(s.q.drift,null);assert.equal(s.hands.heldSpace,false);
    cases.push({single:single,refillSuppressed:true,lantern:s.actor.st});
    await pad([]);await game.waitForTimeout(50);
    await arrange(game,'empty');await tap([16]);
    assert.ok(['lampUp','lamp'].includes((await state(game)).actor.st));
    await game.evaluate(()=>{window.__mycelPad=null;});
    await game.waitForFunction(()=>!window.__mycelCombat.state.controller.connected);
    await shot(page,engine,single?'joycon':'standard');
  }
  fs.writeFileSync(path.join(output,engine+'-controllers.json'),JSON.stringify(cases,null,2));
  results.push('Actualstandard/JoyCon polling B2/C8/V6-or10/E4-or3; humanpacedTend200ms+Crefill and Tend+Vlantern suppressgardening/casts, Home16manualpose anddisconnect');
}
