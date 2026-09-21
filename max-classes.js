(function (root) {
  'use strict';
  var builds = typeof module === 'object' && module.exports ? require('./build-paths.js') : root.MaxBuilds;
  // Each class keeps one exclusive ability; costumes never grant abilities.
  var all = [
    { id: 'mech', name: 'Mech', special: 'robots', desc: 'Only Mech owns watering robots. Start with a rover and upgrade it through Companion boons.', speed: 1, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1, care: 1, knockback: 1, protection: 0, radius: 0, robot: 1 },
    { id: 'runner', name: 'Moss', special: 'climbing', desc: 'Climb every plant and leap between them as they grow. Move quickly through the living garden.', speed: 1.25, jump: 1.15, control: 1.2, dodgeRecovery: .8, stagger: 1, care: 1, knockback: 1, protection: 0, radius: 0, robot: 0 },
    { id: 'bulwark', name: 'Bulwark', special: 'guard', desc: 'Guard nearby plants from incoming damage. Stand firm against attacks and push pests away.', speed: .85, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1.5, care: 1, knockback: .55, protection: .3, radius: 48, robot: 0 },
    { id: 'herbalist', name: 'Herbalist', special: 'healing', desc: 'Tending heals neighbouring plants. Give 40% stronger care to keep the garden alive.', speed: 1, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1, care: 1.4, knockback: 1, protection: 0, radius: 34, robot: 0 }
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
