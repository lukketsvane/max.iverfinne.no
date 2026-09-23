(function (root) {
  'use strict';
  var builds = typeof module === 'object' && module.exports ? require('./build-paths.js') : root.MaxBuilds;
  // Each class keeps one exclusive ability; costumes never grant abilities.
  var all = [
    { id: 'mech', name: 'Mech', special: 'robots', desc: 'Clumsy hands, clever robots. Starts with a tiny rover; boons grow it into a crew. Tap Max to dispatch one to a plant under attack.', speed: 1, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1, care: .45, knockback: 1, protection: 0, radius: 0, robot: 1, skill: 'dispatch', skillCd: 8 },
    { id: 'runner', name: 'Moss', special: 'climbing', desc: 'Fastest mover. Climbs plants past half height. Tap Max to pounce: a slam that hits harder the higher you drop from.', speed: 1.25, jump: 1.15, control: 1.2, dodgeRecovery: .8, stagger: 1, care: 1, knockback: 1, protection: 0, radius: 0, robot: 0, skill: 'pounce', skillCd: 6, pounceRadius: 30, pounceDrop: 96 },
    { id: 'bulwark', name: 'Bulwark', special: 'guard', desc: 'Clumsy gardener, real fighter. Slow, heavy bombs hit double on a pest\'s bite tell. Brace as a pest winds up to parry it and get the brace back fast.', speed: .85, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1.5, care: .45, knockback: .55, protection: .3, radius: 48, robot: 0, skill: 'brace', skillCd: 10, braceTime: 3, braceProtection: .65, braceRadius: 64, throwCd: 1.7, parryCd: 2.5 },
    { id: 'herbalist', name: 'Herbalist', special: 'healing', desc: 'Stronger care that heals neighbours. Tap Max to bloom: heal and water nearby plants and revive one that just fell.', speed: 1, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1, care: 1.4, knockback: 1, protection: 0, radius: 34, robot: 0, skill: 'bloom', skillCd: 12, bloomRadius: 48, bloomShare: .35, bloomCap: .6 }
  ];
  all.forEach(Object.freeze); Object.freeze(all);
  function clean(id) { if (id === 'moss') id = 'runner'; return all.some(function (c) { return c.id === id; }) ? id : 'mech'; }
  function get(id) { var key = clean(id); return all.find(function (c) { return c.id === key; }); }
  function perks(id) { var p = builds.empty(); p.robot = get(id).robot; return p; }
  function canHaveRobot(id) { return id === 'mech'; }
  function canClimb(id) { return id === 'runner' || id === 'moss'; }
  function cleanPerks(value, id) { return builds.clean(value, clean(id)); }
  function skin(id) { return ['original', 'moss', 'tide', 'ember', 'moon'].indexOf(id) >= 0 ? id : 'original'; }
  var api = { all: all, clean: clean, get: get, perks: perks, skin: skin, canHaveRobot: canHaveRobot, canClimb: canClimb, cleanPerks: cleanPerks };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxClasses = api;
})(typeof window === 'object' ? window : globalThis);
