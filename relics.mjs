// Relics open alternate rules in the same shared garden engine.
export const RELICS = Object.freeze([
  Object.freeze({ id: 'high-tide', name: 'High Tide', open: true, note: 'Ei morplante. Fem hagar. Stell planta, finn oppgraderingar og slå vaktarane før floa tek deg.', color: '#73afbd' }),
  Object.freeze({ id: 'last-seed', name: 'Last Seed', note: 'One seed. Endless waves. Tend your plant and revive your team. Everyone down ends the run.', color: '#9fdbbf' }),
]);
export function hasFullDiscovery(user) {
  return !!user?.id && !user.is_anonymous && user.email === 'lukketsvane@players.max.invalid';
}
export function relicCollection(user, unlocks = []) {
  const signedIn = !!user?.id && !user.is_anonymous;
  const owner = hasFullDiscovery(user);
  return RELICS.filter(r => r.open || signedIn && (owner || unlocks.includes('relic-' + r.id)));
}
export function drawRelicStone(g, id, x, ground, t = 0, selected = false) {
  x = Math.round(x); ground = Math.round(ground);
  const ink = id === 'high-tide' ? '#73afbd' : '#9fdbbf';
  const rows = [
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
    g.fillStyle = p === '1' ? '#26313d' : p === '3' ? '#7b8990' : '#52636a';
    g.fillRect(x - 7 + xx, y + yy, 1, 1);
  }));
  g.fillStyle = ink;
  const rune = id === 'high-tide'
    ? ['00100','01110','10101','00100','11011','00100','11011']
    : ['10001','10101','11111','01110','01010','01010','11011'];
  rune.forEach((row, yy) => [...row].forEach((p, xx) => { if (p === '1') g.fillRect(x - 2 + xx, ground - 12 + yy, 1, 1); }));
  g.fillStyle = '#6b8a65'; g.fillRect(x - 6, ground - 2, 4, 2); g.fillRect(x + 4, ground - 1, 4, 1);
  if (selected || Math.sin(t * 1.7) > .4) { g.fillStyle = ink; g.fillRect(x - 10, ground - 8, 1, 1); g.fillRect(x + 9, ground - 15, 1, 1); }
}
