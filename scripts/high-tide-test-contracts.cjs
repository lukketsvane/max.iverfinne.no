'use strict';
const fs=require('node:fs');
function edit(file,from,to,all=false){let s=fs.readFileSync(file,'utf8');const n=s.split(from).length-1;if(!n||!all&&n!==1)throw Error(file+': expected '+(all?'at least one':'one')+' match, found '+n+' for '+from);fs.writeFileSync(file,all?s.split(from).join(to):s.replace(from,to));}
const m='tests/menu.test.cjs';
edit(m,"['Play', 'Login', 'Settings', 'Credits']","['Play', 'Garden', 'Settings', 'Credits', 'Login']");
edit(m,"nav.includes('Login')&&!nav.includes('Garden')","nav.includes('Login')&&nav.includes('Garden')");
edit(m,"assert.match(m.w.document.querySelector('.max-garden-note').textContent, /LAST SEED/);","assert.match(m.w.document.querySelector('.max-garden-note').textContent, /HIGH TIDE/);");
// A publicly visible stone shifts the flower one slot right; preserve its own click test.
let s=fs.readFileSync(m,'utf8'),begin=s.indexOf("test('a home flower opens"),end=s.indexOf("test('a double tap",begin);if(begin<0||end<0)throw Error('Missing flower fixture');
const block=s.slice(begin,end);if(block.split('gardenTapAt(m, 150, 400);').length!==3)throw Error('Unexpected flower clicks');
s=s.slice(0,begin)+block.replaceAll('gardenTapAt(m, 150, 400);','gardenTapAt(m, 380, 400);')+s.slice(end);fs.writeFileSync(m,s);
edit(m,"Array.from(scenes.at(-1).relics,r=>r.id),['last-seed']","Array.from(scenes.at(-1).relics,r=>r.id),['high-tide','last-seed']");
edit(m,"Array.from(scenes.at(-1).relics,r=>r.id),granted.map(id=>id.slice(6))","Array.from(scenes.at(-1).relics,r=>r.id),['high-tide',...granted.map(id=>id.slice(6))]");
edit(m,"for (const mode of ['garden', 'last-seed'])", "for (const mode of ['garden', 'last-seed', 'high-tide'])",true);
edit('tests/results.test.cjs',"w.eval(functionSource('finalizeRogueRun'));","w.highTideMode = () => w.rogueRun.mode === 'high-tide';\n    w.eval(functionSource('finalizeRogueRun'));");
fs.appendFileSync(m,`\n
test('a first-time guest opens High Tide, chooses a character and keeps the relic on replay', async()=>{
  const scenes=[],m=await menu(undefined,{scenes});
  try{
    m.click('Garden');await m.settle();
    assert.deepEqual(Array.from(scenes.at(-1).relics,r=>r.id),['high-tide']);
    m.click('High Tide relic');m.click('ENTER');await m.settle();
    assert.match(m.w.document.body.textContent,/High Tide/);
    assert.ok(m.classIds().includes('polge'));
    m.click('Play');await m.settle();
    assert.equal(m.beginCount,1);assert.equal(m.begun.room.mode,'high-tide');
    assert.equal(m.calls.find(([name])=>name==='max_coop_global')[1].p_mode,'high-tide');
    m.w.MaxGameMenu.replay();await m.settle();m.click('Play');await m.settle();
    assert.equal(m.begun.room.mode,'high-tide');
  }finally{m.dom.window.close();}
});
`);
console.log('Updated public mode contracts and added guest entry/replay coverage.');
