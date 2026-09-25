// Relics are personal games reached through the collection, never shared-run rewards.
// Future unlocks use the same account-scoped list as the hidden characters.
export const RELICS = Object.freeze([
  Object.freeze({ id: 'bastion', name: 'Bastion', note: 'Grow towers. Guard the heart.', color: '#9fdbbf' }),
  Object.freeze({ id: 'minos', name: 'Minos', note: 'Three seals. One way out.', color: '#e4ac78' }),
]);
export function relicCollection(user, unlocks = []) {
  if (!user?.id || user.is_anonymous) return [];
  // This only enables these local games. It grants no database or multiplayer rights.
  // Use the Auth account's canonical identifier, never editable profile metadata.
  const owner = user.email === 'lukketsvane@players.max.invalid';
  return RELICS.filter(r => owner || unlocks.includes('relic-' + r.id));
}

export function drawRelicStone(g, id, x, ground, t = 0, selected = false) {
  x = Math.round(x); ground = Math.round(ground);
  const amber = id === 'minos', ink = amber ? '#e4ac78' : '#9fdbbf';
  const rows = amber ? [
    '     111111    ', '   112222211   ', '  12222222221  ', ' 122233222221  ',
    ' 1222222222221 ', '12222222222221 ', '122222222222221', '122222222222221',
    '122222222222221', '122222222222221', '122222222222221', '122222222222221',
    '12222222222221 ', ' 1222222222221 ', '11222222222111 ', '111111111111111',
  ] : [
    '    11111     ', '   1222221    ', '  122223221   ', '  122222221   ',
    ' 12222222221  ', ' 12222222221  ', ' 12222222221  ', ' 122222222221 ',
    ' 122222222221 ', ' 122222222221 ', '1222222222221 ', '1222222222221 ',
    '1222222222221 ', '1222222222221 ', '1222222222221 ', '12222222222221',
    '12222222222221', '11222222222111', '11111111111111',
  ];
  const y = ground - rows.length;
  g.fillStyle = '#0c1420'; g.fillRect(x - 10, ground, 20, 2);
  rows.forEach((row, yy) => [...row].forEach((p, xx) => {
    if (p === ' ') return;
    g.fillStyle = p === '1' ? '#26313d' : p === '3' ? '#7b8990' : amber ? '#53504f' : '#52636a';
    g.fillRect(x - 7 + xx, y + yy, 1, 1);
  }));
  g.fillStyle = ink;
  const rune = amber ? ['1110111','1010101','1011101','1000001','1111101','1000101','1110111'] : ['10001','10101','11111','01110','01010','01010','11011'];
  rune.forEach((row, yy) => [...row].forEach((p, xx) => { if (p === '1') g.fillRect(x - (amber ? 3 : 2) + xx, ground - 12 + yy, 1, 1); }));
  g.fillStyle = '#6b8a65'; g.fillRect(x - 6, ground - 2, 4, 2); g.fillRect(x + 4, ground - 1, 4, 1);
  if (selected || Math.sin(t * 1.7) > .4) { g.fillStyle = ink; g.fillRect(x - 10, ground - 8, 1, 1); g.fillRect(x + 9, ground - 15, 1, 1); }
}

export function relicRecord(storage,owner,id,result){
  if(!owner)return null;const key='max-relic-records-v1';let all;
  try{all=JSON.parse(storage?.getItem(key)||'{}');if(!all||typeof all!=='object'||Array.isArray(all))all={};}catch{all={};}
  const account=Object.hasOwn(all,owner)&&all[owner]&&typeof all[owner]==='object'?all[owner]:{};
  const prev=Object.hasOwn(account,id)&&account[id]&&typeof account[id]==='object'?account[id]:{};
  if(!result)return prev;
  const next={runs:Math.min(999999,Math.max(0,Number(prev.runs)||0)+1),wins:Math.min(999999,Math.max(0,Number(prev.wins)||0)+(result.result==='won'?1:0)),best:Math.max(0,Number(prev.best)||0)};
  if(result.result==='won')next.best=next.best?Math.min(next.best,result.time):result.time;
  Object.defineProperty(account,id,{value:next,enumerable:true,configurable:true});Object.defineProperty(all,owner,{value:account,enumerable:true,configurable:true});
  try{storage?.setItem(key,JSON.stringify(all));}catch{}return next;
}
