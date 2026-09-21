(function (root) {
  'use strict';
  var builds = typeof module === 'object' && module.exports ? require('./build-paths.js') : root.MaxBuilds;
  // A class is a starting kit. Every class can still learn every boon.
  var all = [
    { id: 'mech', name: 'Mech', desc: 'Begin with a watering rover. Upgrade its tank and reach through Companion boons.', speed: 1, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1, care: 1, knockback: 1, protection: 0, radius: 0, robot: 1 },
    { id: 'runner', name: 'Runner', desc: 'Run 25% faster, jump higher, and recover your dodge 20% sooner.', speed: 1.25, jump: 1.15, control: 1.2, dodgeRecovery: .8, stagger: 1, care: 1, knockback: 1, protection: 0, radius: 0, robot: 0 },
    { id: 'bulwark', name: 'Bulwark', desc: 'Guard nearby plants from 30% of incoming damage. Stronger shoves, less knockback, 15% slower movement.', speed: .85, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1.5, care: 1, knockback: .55, protection: .3, radius: 48, robot: 0 },
    { id: 'herbalist', name: 'Herbalist', desc: 'Give 40% stronger care. Tending also heals neighbouring plants.', speed: 1, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1, care: 1.4, knockback: 1, protection: 0, radius: 34, robot: 0 }
  ];
  all.forEach(Object.freeze); Object.freeze(all);
  function clean(id) { return all.some(function (c) { return c.id === id; }) ? id : 'mech'; }
  function get(id) { var key = clean(id); return all.find(function (c) { return c.id === key; }); }
  function perks(id) { var p = builds.empty(); p.robot = get(id).robot; return p; }
  function skin(id) { return ['original', 'moss', 'tide', 'ember', 'moon'].indexOf(id) >= 0 ? id : 'original'; }
  var api = { all: all, clean: clean, get: get, perks: perks, skin: skin };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxClasses = api;
})(typeof window === 'object' ? window : globalThis);
