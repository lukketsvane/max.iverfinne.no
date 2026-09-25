// A finite, deterministic tower defence. Time is in seconds and positions are tile centres.
export const TOWERS = Object.freeze({
  thorn: Object.freeze({ name: 'Thorn', cost: 35, range: 3.25, rate: .62, damage: 13, color: '#e5c986', kind: 24 }),
  frost: Object.freeze({ name: 'Frost', cost: 45, range: 2.7, rate: 1.05, damage: 6, color: '#9bd6ec', kind: 14 }),
  ember: Object.freeze({ name: 'Ember', cost: 65, range: 3, rate: 1.8, damage: 23, color: '#e98d6b', kind: 3 }),
});
export const TD_WAVES = 12;
const points = [[0,2],[11,2],[11,6],[3,6],[3,10],[11,10],[11,14],[5,14],[5,17],[14,17]];
export const TD_PATH = Object.freeze(points.flatMap((p, i) => {
  if (!i) return [{ x: p[0], y: p[1] }];
  const prev = points[i-1], n = Math.abs(p[0]-prev[0])+Math.abs(p[1]-prev[1]);
  return Array.from({ length: n }, (_, j) => ({ x: prev[0]+Math.sign(p[0]-prev[0])*(j+1), y: prev[1]+Math.sign(p[1]-prev[1])*(j+1) }));
}));
const road = new Set(TD_PATH.map(p => p.x + ',' + p.y));
export function createTowerGame() {
  return { mode:'bastion', width:15, height:19, path:TD_PATH, towers:[], enemies:[], shots:[], seeds:125, hearts:20, wave:0,
    phase:'build', time:0, queue:[], spawn:0, nextId:1, kills:0, speed:1, result:null };
}
export function towerStats(t) {
  const base = TOWERS[t.type], rank = t.level - 1;
  return { ...base, damage:base.damage*(1+rank*.8), range:base.range+rank*.32, rate:base.rate/(1+rank*.18) };
}
export function towerUpgradeCost(t) { return t.level >= 3 ? 0 : Math.round(TOWERS[t.type].cost*(.7+t.level*.35)); }
export function buildable(s,x,y) {
  return Number.isInteger(x)&&Number.isInteger(y)&&x>0&&x<s.width-1&&y>0&&y<s.height-1&&!road.has(x+','+y)&&!s.towers.some(t=>t.x===x&&t.y===y);
}
export function buildTower(s,type,x,y) {
  const spec=TOWERS[type];
  if(s.result||!spec||!buildable(s,x,y)||s.seeds<spec.cost)return false;
  s.seeds-=spec.cost;s.towers.push({id:s.nextId++,type,x,y,level:1,cool:0,spent:spec.cost});return true;
}
export function upgradeTower(s,id) {
  const t=s.towers.find(t=>t.id===id),cost=t&&towerUpgradeCost(t);
  if(s.result||!cost||s.seeds<cost)return false;
  s.seeds-=cost;t.spent+=cost;t.level++;return true;
}
export function sellTower(s,id) {
  const i=s.towers.findIndex(t=>t.id===id);if(s.result||i<0)return false;
  s.seeds+=Math.floor(s.towers[i].spent*.7);s.towers.splice(i,1);return true;
}
export function startWave(s) {
  if(s.phase!=='build'||s.result||s.wave>=TD_WAVES)return false;
  s.wave++;s.phase='wave';s.spawn=.8;
  s.queue=Array.from({length:7+s.wave*2},(_,i)=>s.wave>=3&&i%5===3?'shell':s.wave>=2&&i%4===1?'runner':'crawler');
  if(s.wave%4===0)s.queue.push('brute');
  if(s.wave===TD_WAVES)s.queue.push('crown');
  return true;
}
export function pathPosition(progress) {
  const p=Math.max(0,Math.min(TD_PATH.length-1,progress)),i=Math.floor(p),a=TD_PATH[i],b=TD_PATH[Math.min(i+1,TD_PATH.length-1)],f=p-i;
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}
function spawnEnemy(s,type) {
  const specs={crawler:[1,1,0,5,1],runner:[.65,1.65,0,6,1],shell:[1.9,.75,5,9,2],brute:[5,.58,2,22,4],crown:[20,.52,4,80,10]},v=specs[type];
  const hp=(24+Math.pow(s.wave,1.65)*7)*v[0];
  s.enemies.push({id:s.nextId++,type,hp,maxHp:hp,armor:v[2],speed:v[1],reward:v[3],leak:v[4],progress:0,slow:0,...pathPosition(0)});
}
function hitEnemy(e,damage,pierce=false) { e.hp-=Math.max(1,damage-(pierce?0:e.armor)); }
export function stepTower(s,dt) {
  if(s.result)return;dt=Math.min(.1,Math.max(0,dt));s.time+=dt;
  s.shots=s.shots.filter(p=>(p.life-=dt)>0);
  if(s.phase!=='wave')return;
  s.spawn-=dt;
  if(s.queue.length&&s.spawn<=0){spawnEnemy(s,s.queue.shift());s.spawn=Math.max(.38,.95-s.wave*.035);}
  for(const e of s.enemies){
    e.slow=Math.max(0,e.slow-dt);e.progress+=e.speed*(e.slow>0?.46:1)*dt;
    Object.assign(e,pathPosition(e.progress));
    if(e.progress>=TD_PATH.length-1&&e.hp>0){s.hearts=Math.max(0,s.hearts-e.leak);e.escaped=true;e.hp=0;}
  }
  if(s.hearts<=0){s.result='lost';s.phase='ended';return;}
  for(const t of s.towers){
    t.cool-=dt;if(t.cool>0)continue;const spec=towerStats(t);
    const targets=s.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-t.x,e.y-t.y)<=spec.range).sort((a,b)=>b.progress-a.progress);
    const e=targets[0];if(!e)continue;t.cool=spec.rate;
    s.shots.push({x:t.x,y:t.y,tx:e.x,ty:e.y,type:t.type,life:.16});
    if(t.type==='ember')for(const q of s.enemies){if(q.hp>0&&Math.hypot(q.x-e.x,q.y-e.y)<1.35+(t.level-1)*.12)hitEnemy(q,spec.damage,true);}
    else {hitEnemy(e,spec.damage);if(t.type==='frost')e.slow=2+(t.level-1)*.65;}
  }
  s.enemies=s.enemies.filter(e=>{if(e.hp>0)return true;if(!e.escaped){s.seeds+=e.reward;s.kills++;}return false;});
  if(!s.queue.length&&!s.enemies.length){
    s.seeds+=30+s.wave*5;s.hearts=Math.min(20,s.hearts+1);
    if(s.wave===TD_WAVES){s.result='won';s.phase='ended';}else s.phase='build';
  }
}
