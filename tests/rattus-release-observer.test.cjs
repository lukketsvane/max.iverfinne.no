const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../scripts/check-rattus-combat-browser.cjs'),'utf8');
const observer=source.slice(source.indexOf('var rattusBrowserDriveReleases='),source.indexOf('var rattusBrowserOriginalDamage='));
const assertion=source.match(/function assertDriveRelease\(release,expected\)\{[\s\S]*?\n\}/)?.[0];
const helper=source.match(/async function releaseDrive\(page,game\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(observer&&assertion&&helper,'execute the actual review observer and release helper');
function fixture(momentum=100){
  const q={drivePhase:1,driveSerial:17,driveStartTag:23,momentum,driveSample:0,driveSpent:0,utilityCool:0};
  const member={id:'current-owner'};let calls=0;
  const sandbox={assert,rattusMember:()=>member,wrestlerState:()=>q,
    rattusDrivingReleaseWorld(aim,startTag){calls++;if(startTag!==q.driveStartTag||q.drivePhase!==1)return false;q.driveSample=q.momentum;q.driveSpent=Math.min(45,q.momentum);q.momentum-=q.driveSpent;q.utilityCool=5;q.drivePhase=2;return true;}};
  vm.runInNewContext(observer+'\n'+assertion+'\n'+helper,sandbox);
  const api={wrestler:q,coop:{me:member.id}};
  Object.defineProperty(api,'driveReleases',{get:()=>sandbox.rattusBrowserDriveReleases.slice()});sandbox.window={__rattusCombat:api};
  return {q,sandbox,calls:()=>calls,expected:{owner:member.id,serial:17,startTag:23}};
}
const copy=value=>JSON.parse(JSON.stringify(value));

test('actual release observer records canonical same-call sample, owner, cast and debit without changing the result',()=>{
  const f=fixture(99.442),result=f.sandbox.rattusDrivingReleaseWorld({x:80,y:0},23),events=f.sandbox.rattusBrowserDriveReleases;
  assert.equal(result,true);assert.equal(f.calls(),1);assert.equal(events.length,1);
  const event=events[0];f.sandbox.assertDriveRelease(event,f.expected);
  assert.equal(event.before.momentum,99.442);assert.equal(event.after.sample,99.442);assert.equal(event.after.momentum,99.442-45);
  const recorded=copy(event);f.q.momentum=1;f.q.drivePhase=0;assert.deepEqual(copy(event),recorded,'subsequent RAF state cannot rewrite the synchronous witness');
});

test('actual release helper allows real decay between preparation and keyup while checking the exact accepted sample',async()=>{
  const f=fixture(100),keys=[],frame={async evaluate(callback,arg){return callback(arg);}},page={keyboard:{async up(key){keys.push(key);f.q.momentum=96.9994;f.sandbox.rattusDrivingReleaseWorld({x:80,y:0},23);}}};
  const event=await f.sandbox.releaseDrive(page,frame);
  assert.deepEqual(keys,['v']);assert.equal(f.calls(),1);assert.equal(event.before.momentum,96.9994);assert.equal(event.after.sample,96.9994);
  assert.ok(Math.abs(event.after.sample-100)>.35,'the old asynchronous pre-keyup comparison is genuinely wrong');
});

test('semantic release assertions reject stale/foreign casts, rejected release and incorrect sample or payment',()=>{
  const f=fixture(20);f.sandbox.rattusDrivingReleaseWorld({},23);const event=copy(f.sandbox.rattusBrowserDriveReleases[0]);
  f.sandbox.assertDriveRelease(event,f.expected);assert.equal(event.after.spent,20);assert.equal(event.after.momentum,0);
  const corruptions=[e=>e.accepted=false,e=>e.owner='former-host',e=>e.before.phase=0,e=>e.after.phase=1,e=>e.before.serial++,e=>e.after.serial++,e=>e.before.startTag++,e=>e.after.startTag++,e=>e.after.sample++,e=>e.after.spent++,e=>e.after.momentum++,e=>e.after.cool=0];
  for(const corrupt of corruptions){const bad=copy(event);corrupt(bad);assert.throws(()=>f.sandbox.assertDriveRelease(bad,f.expected));}
});

test('observer preserves actual rejected release semantics instead of manufacturing an accepted witness',()=>{
  const f=fixture(),before=copy(f.q);assert.equal(f.sandbox.rattusDrivingReleaseWorld({},999),false);assert.equal(f.calls(),1);assert.deepEqual(f.q,before);
  const event=f.sandbox.rattusBrowserDriveReleases[0];assert.equal(event.accepted,false);assert.deepEqual(copy(event.before),copy(event.after));assert.throws(()=>f.sandbox.assertDriveRelease(event,f.expected));
});
