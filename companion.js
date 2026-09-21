/* The companion uses the same art-pixel coordinates as Max. No passive XP,
 * score, healing or instant growth: it only moves water from its finite tank. */
(function (root) {
  'use strict';
  var TIERS = [
    { capacity: 1, speed: 24, rate: .10, reach: 14, search: 60 },
    { capacity: 1.6, speed: 29, rate: .13, reach: 18, search: 80 },
    { capacity: 2.4, speed: 34, rate: .16, reach: 23, search: 100 }
  ];
  function finite(n, fallback) { return typeof n === 'number' && Number.isFinite(n) ? n : fallback; }
  function tier(n) { return Math.max(0, Math.min(2, finite(n, 0) | 0)); }
  function create(saved, x, rank) {
    saved = saved || {}; rank = tier(rank);
    var s = { x: finite(saved.x, x - 20), water: Math.max(0, Math.min(TIERS[rank].capacity, finite(saved.water, 1))),
      face: saved.face === -1 ? -1 : 1, state: 'idle', clock: 0, target: null,
      refill: Math.max(0, Math.min(2, finite(saved.refill, 0))), tier: rank };
    function pose(name) { if (s.state !== name) { s.state = name; s.clock = 0; } }
    function passable(from, to, env) {
      var steps = Math.max(1, Math.ceil(Math.abs(to - from) / 2)), last = env.ground(from);
      for (var i = 0; i <= steps; i++) {
        var at = from + (to - from) * i / steps, y = env.ground(at);
        if (env.wet(at - 3) || env.wet(at + 3) || Math.abs(y - last) > 3) return false;
        last = y;
      }
      return true;
    }
    function move(to, dt, env) {
      var dx = to - s.x;
      if (Math.abs(dx) <= 2) return true;
      s.face = dx < 0 ? -1 : 1;
      var nx = s.x + s.face * Math.min(Math.abs(dx), TIERS[s.tier].speed * dt);
      if (passable(s.x, nx, env)) { s.x = nx; pose('drive'); }
      else pose(s.water <= .001 ? 'empty' : 'idle');
      return false;
    }
    return {
      state: s,
      snapshot: function () { return { x: s.x, water: s.water, face: s.face, refill: s.refill }; },
      relocate: function (x) { s.x = x - 20; s.target = null; pose('idle'); },
      requestRefill: function (playerX) {
        if (Math.abs(playerX - s.x) > 32 || s.water >= TIERS[s.tier].capacity - .001) return false;
        if (!s.refill) s.refill = 2;
        s.target = null; pose('refill'); return true;
      },
      tick: function (dt, env) {
        if (env.paused) return;
        dt = Math.max(0, Math.min(.05, finite(dt, 0))); if (!dt) return;
        s.tier = tier(env.tier); s.clock += dt;
        if (env.transport) { s.target = null; pose('packed'); return; }
        // Rejoin only after leaving the visible garden. Never water remotely.
        if (Math.abs(s.x - env.player.x) > 180 || s.state === 'packed') {
          var join = env.safeX(env.player.x - env.player.face * (22 + s.tier * 7));
          if (!env.wet(join - 3) && !env.wet(join + 3)) s.x = join;
          s.target = null; pose('idle');
        }
        if (s.refill > 0) {
          var refiller = env.refiller || env.player;
          if (Math.abs(refiller.x - s.x) <= 32 && Math.abs(refiller.vx) < 5 && !env.wet(s.x) && refiller.grounded !== false && (!Number.isFinite(refiller.y) || Math.abs(refiller.y - env.ground(s.x)) < 18)) {
            pose('refill'); s.refill = Math.max(0, s.refill - dt);
            if (!s.refill) { s.water = TIERS[s.tier].capacity; pose('idle'); }
          } else pose('empty');
          return;
        }
        var spec = TIERS[s.tier];
        if (s.state === 'retract' && s.clock < .55) return;
        var target = s.target;
        if (!target || target.dead || env.plants.indexOf(target) < 0 || target.moisture >= .78 ||
            Math.abs(target.x - env.player.x) > spec.search || s.water <= .001) {
          if (target && (s.state === 'water' || s.state === 'deploy')) {
            s.target = null; pose('retract'); return;
          }
          target = null;
          if (s.water > .001) {
            var thirsty = env.plants.filter(function (p) {
              return !p.dead && p.moisture < .45 && Math.abs(p.x - env.player.x) <= spec.search &&
                passable(s.x, p.x, env);
            }).sort(function (a, b) { return a.moisture - b.moisture || Math.abs(a.x - s.x) - Math.abs(b.x - s.x); });
            target = thirsty[0] || null;
          }
          s.target = target;
        }
        if (target) {
          var dx = target.x - s.x;
          if (Math.abs(dx) > spec.reach) { move(target.x - (dx < 0 ? -1 : 1) * (spec.reach - 2), dt, env); return; }
          if (!passable(s.x, target.x, env)) { s.target = null; pose('idle'); return; }
          s.face = dx < 0 ? -1 : 1;
          if (s.state !== 'deploy' && s.state !== 'water') { pose('deploy'); return; }
          if (s.state === 'deploy') { if (s.clock >= .6) pose('water'); return; }
          var amount = Math.min(spec.rate * dt, s.water, Math.max(0, .78 - target.moisture));
          target.moisture += amount; target.pulse = Math.max(target.pulse || 0, .2);
          s.water = Math.max(0, s.water - amount);
          return;
        }
        var follow = env.safeX(env.player.x - env.player.face * (25 + s.tier * 7));
        if (Math.abs(s.x - follow) > 8) move(follow, dt, env);
        else pose(s.water <= .001 ? 'empty' : 'idle');
      }
    };
  }
  var art = [], artPromise;
  function loadArt() {
    if (artPromise) return artPromise;
    artPromise = fetch('assets/companion/animations.json').then(function (r) { if (!r.ok) throw Error('Companion atlas missing'); return r.json(); })
      .then(function (data) { return Promise.all(data.map(function (entry) {
        return new Promise(function (resolve, reject) {
          var im = new Image(); im.onload = function () { entry.image = im; resolve(entry); };
          im.onerror = reject; im.src = entry.src;
        });
      })); }).then(function (loaded) { art = loaded; });
    // A missing image must not stop a player's run. Reload will retry the assets.
    artPromise.catch(function () {}); return artPromise;
  }
  function frameFor(clip, seconds) {
    var total = clip.frames.reduce(function (n, f) { return n + f.ms; }, 0);
    var ms = clip.loop ? seconds * 1000 % total : Math.min(seconds * 1000, total - 1);
    for (var i = 0; i < clip.frames.length; i++) { ms -= clip.frames[i].ms; if (ms < 0) return clip.frames[i]; }
    return clip.frames[clip.frames.length - 1];
  }
  function draw(ctx, state, x, y) {
    if (state.state === 'packed' || !art.length) return;
    var a = art[state.tier], clip = a.clips[(state.face < 0 ? 'left/' : 'right/') + state.state];
    if (!clip) return;
    var f = frameFor(clip, state.clock), dx = Math.round(x), dy = Math.round(y);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (clip.mirror) { ctx.translate(dx, dy); ctx.scale(-1, 1); dx = 0; dy = 0; }
    ctx.drawImage(a.image, f.x, f.y, f.w, f.h, dx - f.ax, dy - f.ay, f.w, f.h);
    ctx.restore();
    if (state.state === 'empty' || state.state === 'refill' || state.state === 'water') {
      ctx.fillStyle = '#0e1e1d'; ctx.fillRect(Math.round(x) - 5, Math.round(y) - a.height - 5, 10, 3);
      ctx.fillStyle = state.state === 'empty' ? '#9d925b' : '#5e9caa';
      var amount = state.state === 'refill' ? 1 - state.refill / 2 : state.water / TIERS[state.tier].capacity;
      ctx.fillRect(Math.round(x) - 4, Math.round(y) - a.height - 4, Math.max(1, Math.round(8 * amount)), 1);
    }
    // The little rover's spray is separate. Larger supplied sheets already contain it.
    if (state.tier === 0 && state.state === 'water') {
      var spray = art[3], drop = frameFor(spray.clips.spray, state.clock);
      var ex = Math.round(x) + (clip.mirror ? f.ax - f.emitter.x : f.emitter.x - f.ax);
      var ey = Math.round(y) + f.emitter.y - f.ay;
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(ex, ey);
      if (clip.mirror) ctx.scale(-1, 1);
      ctx.drawImage(spray.image, drop.x, drop.y, drop.w, drop.h, -14, 0, drop.w, drop.h);
      ctx.restore();
    }
  }
  var api = { create: create, tiers: TIERS, draw: draw, loadArt: loadArt, frameFor: frameFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MaxCompanion = api;
})(typeof window !== 'undefined' ? window : globalThis);
