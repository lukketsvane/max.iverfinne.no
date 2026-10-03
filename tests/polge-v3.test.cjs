const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
function fresh(){const h=loadGame();const g=h.game;g.resetRogueRun('test',{classId:'polge',skinId:'polge',difficulty:'medium'});g.floatKrek=[];g.gardenPlots=[];g.runHazards=[];return h;}
function pest(g,fields={}){const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x+14,y:g.P.y-12,hp:100,maxHp:100,scout:false,raid:true},fields);g.floatKrek.push(k);return k;}
function punch(g,target){g.bombCool=0;assert.equal(g.throwBomb(target),true);}
function tick(g,seconds,hz=60){for(let i=0;i<Math.round(seconds*hz);i++)g.updateClassCombat(1/hz);}
function close(actual,expected){assert.ok(Math.abs(actual-expected)<1e-7,actual+' should equal '+expected);}

test('Pølge confirms jab, cross and uppercut damage, keeps Rhythm capped, and never creates projectiles',()=>{
 const {game:g}=fresh(),k=pest(g),damage=[];
 for(let i=0;i<3;i++){const hp=k.hp;punch(g,k);damage.push(hp-k.hp);}
 damage.forEach((d,i)=>close(d,[.52,.72,1.1][i]));assert.equal(g.classAttackCooldown(),.22);assert.equal(g.fighterState().rhythm,3);
 punch(g,k);assert.equal(g.fighterState().rhythm,3);assert.equal(g.classShots.length,0);assert.equal(g.bombs.length,0);
});
test('misses neither advance combo nor refresh its window, Rhythm or Ringcraft recovery',()=>{
 const {game:g}=fresh(),k=pest(g,{x:g.P.x-30}),far={x:g.P.x+90,y:g.P.y-12};g.rogueRun.perks.raincoat=3;g.P.skillCool=8;
 punch(g,far);assert.equal(g.fighterState().window,0);assert.equal(g.fighterState().rhythm,0);assert.equal(g.P.skillCool,8);
 k.x=g.P.x+14;punch(g,k);assert.equal(g.fighterState().combo,0);assert.equal(g.fighterState().rhythm,1);close(g.P.skillCool,7.4);
 tick(g,.3);k.x=g.P.x-30;const window=g.fighterState().window;punch(g,far);close(g.fighterState().window,window);assert.equal(g.fighterState().combo,0);assert.equal(g.fighterState().rhythm,1);
 tick(g,.7);k.x=g.P.x+14;const hp=k.hp;punch(g,k);close(hp-k.hp,.52);assert.equal(g.fighterState().combo,0);
});
test('all three primary reaches are measured from the body and solid rock blocks confirmed contact',()=>{
 for(const [step,reach] of [[0,18],[1,20],[2,24]]){
  const h=fresh(),g=h.game,k=pest(g,{x:g.P.x+reach+.1});const q=g.fighterState();q.combo=(step+2)%3;q.window=step? .95:0;
  punch(g,k);assert.equal(k.hp,100);assert.equal(q.rhythm,0);k.x=g.P.x+reach-.1;punch(g,k);assert.ok(k.hp<100);
 }
 const h=fresh(),g=h.game,k=pest(g);const original=h.window.MaxStageLayout.inRock;
 h.window.MaxStageLayout.inRock=(layout,x,y)=>x>g.P.x+4&&x<g.P.x+8||original(layout,x,y);
 punch(g,k);assert.equal(k.hp,100);assert.equal(g.fighterState().rhythm,0);assert.equal(g.polgeClinch(k),false);assert.equal(g.useClassSkill(),false);
});
test('Rhythm waits two seconds after a confirmed hit, then loses one beat each second at every supported frame rate',()=>{
 for(const hz of [30,60,120]){const {game:g}=fresh(),k=pest(g);for(let i=0;i<3;i++)punch(g,k);tick(g,2,hz);assert.equal(g.fighterState().rhythm,3);tick(g,1,hz);assert.equal(g.fighterState().rhythm,2);tick(g,1,hz);assert.equal(g.fighterState().rhythm,1);punch(g,k);assert.equal(g.fighterState().rhythm,2);tick(g,2,hz);assert.equal(g.fighterState().rhythm,2);tick(g,1,hz);assert.equal(g.fighterState().rhythm,1);}
});
test('a cosmetic slip supplies no counter; one host-confirmed warned avoidance powers one actual primary hit',()=>{
 const {game:g}=fresh(),k=pest(g);assert.equal(g.boxerDodge(),true);assert.equal(g.fighterState().utilityCool,3.5);assert.equal(g.fighterState().slip,.18);assert.equal(g.fighterState().counter,0);assert.equal(g.boxerDodge(),false);
 assert.equal(g.polgeAvoidedWarning(null,{key:'unwarned',warned:false}),false);assert.equal(g.polgeAvoidedWarning(null,{key:'warned:1',warned:true}),true);assert.equal(g.polgeAvoidedWarning(null,{key:'warned:2',warned:true}),false);
 const q=g.fighterState();punch(g,{x:g.P.x-90,y:g.P.y-12});assert.equal(q.counter,1.1);assert.equal(q.rhythm,0);const hp=k.hp;punch(g,k);close(hp-k.hp,.52*1.5);assert.equal(q.counter,0);const next=k.hp;punch(g,k);close(next-k.hp,.72);assert.equal(q.rhythm,2);
});
test('a successful warned weave preserves only an existing confirmed combo continuation',()=>{
 const {game:g}=fresh(),k=pest(g);punch(g,k);tick(g,.7);assert.ok(g.fighterState().window<.3);assert.equal(g.boxerDodge(),true);assert.equal(g.polgeAvoidedWarning(null,{key:'warned:1',warned:true}),true);assert.equal(g.fighterState().window,.95);assert.equal(g.fighterState().rhythm,1);tick(g,.2);const hp=k.hp;punch(g,k);close(hp-k.hp,.72*1.5);
 const {game:empty}=fresh();empty.boxerDodge();empty.polgeAvoidedWarning(null,{key:'warned:2',warned:true});assert.equal(empty.fighterState().window,0);assert.equal(empty.fighterState().rhythm,0);
});
test('clinch needs a real hit inside twenty pixels and spends exactly one available beat, with a bounded ordinary interrupt',()=>{
 const {game:g}=fresh(),k=pest(g,{x:g.P.x+21}),q=g.fighterState();q.rhythm=3;
 assert.equal(g.polgeClinch(k),false);assert.equal(q.rhythm,3);assert.equal(q.clinchCool,0);k.x=g.P.x+14;k.windup=.4;k.flee=0;
 const hp=k.hp;assert.equal(g.polgeClinch(k),true);close(hp-k.hp,1);assert.equal(q.rhythm,2);assert.equal(q.clinchCool,4);assert.equal(k.windup,0);assert.equal(k.flee,.35);assert.equal(g.polgeClinch(k),false);
 tick(g,4);q.rhythm=0;const base=k.hp;assert.equal(g.polgeClinch(k),true);close(base-k.hp,.7);assert.equal(q.rhythm,0);
});
test('bosses retain motion and windup after clinch and uppercut while ordinary uppercuts suppress for six tenths',()=>{
 const {game:g}=fresh(),boss=pest(g,{boss:true,vx:19,vy:22,windup:.8});g.fighterState().rhythm=1;assert.equal(g.polgeClinch(boss),true);assert.equal(boss.vx,19);assert.equal(boss.vy,22);assert.equal(boss.windup,.8);
 for(let i=0;i<3;i++)punch(g,boss);assert.equal(boss.vx,19);assert.equal(boss.vy,22);assert.equal(boss.windup,.8);
 g.floatKrek=[];const ordinary=pest(g,{windup:.8});g.fighterState().combo=1;g.fighterState().window=.95;punch(g,ordinary);assert.equal(ordinary.windup,0);assert.equal(ordinary.flee,.6);assert.equal(ordinary.vy,-85);
});
test('empty special is rejected without spending Rhythm or starting cooldown, and base special has exactly six contacts plus its finish',()=>{
 const {game:g}=fresh(),q=g.fighterState();q.rhythm=3;assert.equal(g.useClassSkill(),false);assert.equal(q.rhythm,3);assert.equal(g.P.skillCool,0);
 const k=pest(g);q.rhythm=0;const hp=k.hp;assert.equal(g.useClassSkill(),true);assert.equal(g.P.skillCool,8);assert.equal(g.throwBomb(k),false);tick(g,1);
 close(hp-k.hp,6*.35+1.2);assert.equal(g.booms.filter(b=>b.strike==='flurry').length,6);assert.equal(g.booms.filter(b=>b.strike==='finisher').length,1);assert.equal(q.flurry,0);assert.equal(q.rhythm,0);
});
test('special spends saved Rhythm once and adds only capped local Varnish contacts independently of frame rate',()=>{
 for(const hz of [30,60,120])for(const rank of [0,3,99]){const {game:g}=fresh(),k=pest(g),q=g.fighterState();q.rhythm=3;g.rogueRun.perks.varnish=rank;const hp=k.hp;assert.equal(g.useClassSkill(),true);assert.equal(q.rhythm,0);assert.equal(g.useClassSkill(),false);tick(g,1,hz);const count=9+Math.min(3,rank);close(hp-k.hp,count*.35+1.2);assert.equal(g.booms.filter(b=>b.strike==='flurry').length,count);assert.equal(q.rhythm,0);assert.equal(g.classShots.length,0);}
});
test('each flurry pulse reacquires close targets from the moving body and misses never trigger Second wind',()=>{
 const {game:g}=fresh(),old=pest(g),next=pest(g,{x:g.P.x+70}),near=plot({x:g.P.x+70,health:.5,moisture:.2});g.gardenPlots=[near];g.rogueRun.perks.secondwind=1;assert.equal(g.useClassSkill(),true);const oldHp=old.hp;g.P.x+=70;tick(g,.9);assert.equal(old.hp,oldHp);assert.ok(next.hp<100);assert.equal(near.health,.5);next.x+=100;tick(g,.1);assert.equal(near.health,.5);assert.equal(near.moisture,.2);
});
test('Second wind restores bounded care only at a successful finisher and Ringcraft recovers once per confirmed strike, never per enemy',()=>{
 const {game:g}=fresh(),a=pest(g),b=pest(g,{x:g.P.x+12}),near=plot({x:g.P.x,health:.5,moisture:.2}),far=plot({x:g.P.x+80,health:.5,moisture:.2});g.gardenPlots=[near,far];g.rogueRun.perks.secondwind=1;g.rogueRun.perks.raincoat=2;
 assert.equal(g.useClassSkill(),true);close(g.P.skillCool,7.6);assert.equal(near.health,.5);tick(g,1);close(g.P.skillCool,5.2);close(near.health,.65);close(near.moisture,.32);assert.equal(far.health,.5);assert.ok(a.hp<100&&b.hp<100);
});
test('Haymaker and Splinters improve the primary uppercut, retain guarded resistance and never move bosses',()=>{
 const outcomes=[0,1].map(haymaker=>{const {game:g}=fresh(),k=pest(g,{kind:5,face:-1,windup:.4,flee:0});g.rogueRun.perks.splinters=2;g.rogueRun.perks.haymaker=haymaker;const q=g.fighterState();q.combo=1;q.window=.95;const hp=k.hp;punch(g,k);return {damage:hp-k.hp,lift:k.vy};});
 close(outcomes[0].damage,1.1*1.5*.25);close(outcomes[1].damage,1.1*1.5*1.25*.25);assert.equal(outcomes[0].lift,-85);assert.equal(outcomes[1].lift,-110);
});

test('one nearest ordinary pest receives the uppercut windup suppression, while nearby hits keep ordinary stagger rules',()=>{
 const {game:g}=fresh(),near=pest(g,{x:g.P.x+12,windup:.4,flee:0}),other=pest(g,{x:g.P.x+14,windup:.4,flee:0});const q=g.fighterState();q.combo=1;q.window=.95;punch(g,near);assert.equal(near.flee,.6);assert.equal(other.flee,.42);assert.equal(q.rhythm,1);
});
