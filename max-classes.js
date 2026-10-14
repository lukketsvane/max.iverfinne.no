(function (root) {
  'use strict';
  var builds = typeof module === 'object' && module.exports ? require('./build-paths.js') : root.MaxBuilds;
  var all = [
    { id: 'mech', name: 'Max', special: 'robots', desc: 'Trap gardener and water engineer. Useful care and bomb defence charge the Circuit. Mist slows pests for your two-second bombs; dispatch your rover, then spend three charges on a Floodgate Overload.', speed: 1, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1, care: .45, knockback: 1, protection: 0, radius: 0, robot: 1, skill: 'overload', skillCd: 18, utility: 'dispatch', utilityCd: 8, secondary: 'fan', secondaryCd: 6, seeds: .4 },
    { id: 'runner', name: 'Rattus norvegicus', special: 'climbing', desc: 'A rat pro wrestler. Sprint and land kicks to build Momentum. Latch onto a real stem, ledge or pest, hold a Driving dropkick, then spend Momentum on a splits stomp. Longer drops hit harder.', speed: 1.25, jump: 1.15, control: 1.2, dodgeRecovery: .8, stagger: 1, care: 1, knockback: 1, protection: 0, radius: 0, robot: 0, seeds: .7, skill: 'pounce', skillCd: 8, secondary: 'latch', secondaryCd: 5, utility: 'driving', utilityCd: 5, pounceRadius: 38, pounceDrop: 96 },
    { id: 'bulwark', name: 'Erasmus Berg', special: 'guard', desc: 'A living stone guardian. Land three heavy sweeps or defend a plant to build Strata. Throw a loose stone, brace a real attack for one counter, then raise a garden ridge with three plates.', speed: .85, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1.5, care: .45, knockback: .55, protection: .3, radius: 48, robot: 0, seeds: .4, skill: 'brace', skillCd: 20, secondary: 'stone', secondaryCd: 5, utility: 'brace', utilityCd: 10, braceTime: 3, braceProtection: .65, braceRadius: 64, throwCd: 1.15, parryCd: 2.5 },
    { id: 'herbalist', name: 'Mycel', special: 'healing', desc: 'A walking mushroom colony. Living wet plants and landed spores build Culture. Spread a rooting cloud, drift between stems, then release a recovery bloom.', speed: 1, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1, care: 1.4, knockback: 1, protection: 0, radius: 34, robot: 0, seeds: .7, skill: 'bloom', skillCd: 12, secondary: 'cloud', secondaryCd: 5, utility: 'drift', utilityCd: 6, bloomRadius: 48 },
    { id: 'polge', name: 'Pølge', special: 'boxing', desc: 'The glue of the pølgevenner. Land jab, cross and uppercut to build Rhythm. Clinch to make room, slip a warned attack for one strong counter, then spend Rhythm in a moving close flurry.', speed: 1.05, jump: 1, control: 1.1, dodgeRecovery: .65, stagger: 1.2, care: .75, knockback: .8, protection: 0, radius: 0, robot: 0, seeds: .55, skill: 'flurry', skillCd: 8 },
    { id: 'sligo', name: 'Sligo', fullName: 'Max Sligo Neverdahl', hidden: true, special: 'tun', desc: 'The forgotten, defiled zygote. Drained by JP and IE. Eats meat to grow and divide; throws flesh to shrink. Tap to curl into a tun: nearby plants take half damage.', speed: 1, jump: 1, control: 1, dodgeRecovery: 1, stagger: 1, care: 1, knockback: 1, protection: 0, radius: 0, robot: 0, seeds: .55, skill: 'tun', skillCd: 9, tunTime: 3, tunRadius: 40, tunProtection: .5 }
  ];
  all.forEach(Object.freeze); Object.freeze(all);
  function clean(id) { if (id === 'moss') id = 'runner'; return all.some(function (c) { return c.id === id; }) ? id : 'mech'; }
  function get(id) { var key = clean(id); return all.find(function (c) { return c.id === key; }); }
  function perks(id) { var p = builds.empty(); p.robot = get(id).robot; return p; }
  function canHaveRobot(id) { return id === 'mech'; }
  function canClimb(id) { return id === 'runner' || id === 'moss'; }
  function cleanPerks(value, id) { return builds.clean(value, clean(id)); }
  function skin(id, classId) { return id === 'moss' ? 'moss-pink' : ['original', 'moss-pink', 'tide', 'ember', 'moon', 'polge', 'sligo'].indexOf(id) >= 0 ? id : !id && clean(classId) === 'runner' ? 'moss-pink' : 'original'; }
  var hidden = Object.freeze(all.filter(function (c) { return c.hidden; }).map(function (c) { return c.id; }));
  var kits={
    mech:{secondary:[['base','Fan','1 Circuit · mist cone, Wet and rover irrigation'],['shock','Shock pulse','1 Circuit · immediate close shock, no irrigation']],special:[['base','Floodgate Overload','3 Circuit · planted blast and threatened-plant priority'],['steam','Steam vent','2 Circuit · radial blast and Wet, no rover priority']]},
    runner:{secondary:[['base','Tail latch','Latch to stems, ledges and pests'],['snap','Snapkick','15 Momentum · close kick that pushes pests away']],special:[['base','Splits stomp','50 Momentum · leap; longer falls hit harder'],['quake','Earthshaker','35 Momentum · grounded shock; no leap']]},
    bulwark:{secondary:[['base','Stone','1 Strata · thrown stone and grounded grit'],['clap','Fault clap','1 Strata · short forward cleave, no thrown stone']],special:[['base','Ridge','3 Strata · emergence, obstruction and bite ward'],['quake','Quake','2 Strata · immediate wide shock, no ward']]},
    herbalist:{secondary:[['base','Cloud','2 Culture · fixed cloud with three slow pulses'],['miasma','Miasma burst','2 Culture · immediate close blast and brief slow']],special:[['base','Bloom','4 Culture · three healing and watering pulses'],['storm','Spore storm','4 Culture · wide offensive burst, no restoration']]},
    polge:{secondary:[['base','Clinch','Close strike that makes room'],['rise','Rising clinch','1 Rhythm · close uppercut that lifts one pest']],special:[['base','Flurry','Spend Rhythm · moving punches and an uppercut finish'],['haymaker','Haymaker','3 Rhythm · one powerful close uppercut']]},
    sligo:{special:[['base','Tun','3 seconds · protects plants within 40 pixels'],['watch','Watchful tun','1.5 seconds · protects plants within 64 pixels']]}
  };
  function cleanSkills(classId,value){var out={},kit=kits[classId]||kits.mech;Object.keys(kit).forEach(function(slot){var id=value&&value[slot];if(id!=='base'&&kit[slot].some(function(v){return v[0]===id;}))out[slot]=id;});return out;}
  function skillOptions(classId){return kits[classId]||kits.mech;}
  var skillLoadouts={clean:cleanSkills,options:skillOptions};
  root.MaxSkillLoadouts=skillLoadouts;
  var api = { skillLoadouts: skillLoadouts, all: all, hidden: hidden, clean: clean, get: get, perks: perks, skin: skin, canHaveRobot: canHaveRobot, canClimb: canClimb, cleanPerks: cleanPerks };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxClasses = api;
})(typeof window === 'object' ? window : globalThis);
