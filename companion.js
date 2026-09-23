/* Robots only move water (or charge) out of a finite tank: no XP, score,
 * growth or passive healing. The Mech's dispatch is the one paid exception. */
(function (root) {
  'use strict';
  var TIERS = [
    { art: 'mini', capacity: .6, speed: 20, rate: .07, reach: 10, search: 50, dispatch: 100 },
    { art: 'rover', capacity: 1, speed: 24, rate: .10, reach: 14, search: 60, dispatch: 120 },
    { art: 'robot', capacity: 1.6, speed: 29, rate: .13, reach: 18, search: 80, dispatch: 140 },
    { art: 'large', capacity: 2.4, speed: 34, rate: .16, reach: 23, search: 100, dispatch: 160 }
  ];
  var DISPATCH_COST = .25, FULL = .78, THIRSTY = .45, TOPUP = .6, ZAP = { range: 40, cost: .08, cool: 1.5 };
  function num(n, d) { return typeof n === 'number' && Number.isFinite(n) ? n : d; }
  function rank(n) { return Math.max(0, Math.min(TIERS.length - 1, num(n, 0) | 0)); }
  function live(p, env) { return !!p && !p.dead && env.plants.indexOf(p) >= 0; }
  function passable(env, a, b) {
    for (var n = Math.max(1, Math.ceil(Math.abs(b - a) / 2)), last = env.ground(a), i = 0; i <= n; i++) {
      var x = a + (b - a) * i / n, y = env.ground(x);
      if (env.wet(x - 3) || env.wet(x + 3) || Math.abs(y - last) > 3) return false;
      last = y;
    }
    return true;
  }
  function create(saved, x, tier, kind) {
    saved = saved || {}; tier = rank(tier);
    var s = { kind: kind === 'sentry' ? 'sentry' : 'water', slot: 0, tier: tier, state: 'idle', clock: 0,
      x: num(saved.x, x - 20), face: saved.face === -1 ? -1 : 1,
      water: Math.max(0, Math.min(TIERS[tier].capacity, num(saved.water, TIERS[tier].capacity))),
      refill: Math.max(0, Math.min(2, num(saved.refill, 0))),
      target: null, targetX: 0, dispatchT: 0, pourT: 0, cool: 0, zapT: 0, zapDX: 0, zapDY: 0 };
    function spec() { return TIERS[s.tier]; }
    function pose(name) { if (s.state !== name) { s.state = name; s.clock = 0; } }
    function stop(refund) {
      if (refund) s.water = Math.min(spec().capacity, s.water + DISPATCH_COST);
      s.dispatchT = s.pourT = 0; s.target = null;
    }
    function drive(to, dt, env, fast) {
      var dx = to - s.x;
      if (Math.abs(dx) <= 2) return;
      s.face = dx < 0 ? -1 : 1;
      var nx = s.x + s.face * Math.min(Math.abs(dx), spec().speed * (fast || 1) * dt);
      if (passable(env, s.x, nx)) { s.x = nx; pose('drive'); } else pose(s.water > .001 ? 'idle' : 'empty');
    }
    function reach(tx, r, dt, env, fast) {
      var dx = tx - s.x;
      if (Math.abs(dx) > r) { drive(tx - (dx < 0 ? -1 : 1) * (r - 2), dt, env, fast); return false; }
      s.face = dx < 0 ? -1 : 1; return true;
    }
    // Idle robots trail Max in a line; a dry one comes right up to him to be refilled.
    function home(dt, env, dry) {
      var x = env.safeX(env.player.x - env.player.face * (dry ? 12 + s.slot * 8 : 25 + s.tier * 7 + s.slot * 13));
      if (Math.abs(s.x - x) > 8) drive(x, dt, env); else pose(dry ? 'empty' : 'idle');
    }
    function claimed(p, env) {
      return (env.crew || []).some(function (o) { return o !== s && (o.target === p || o.dispatchT + o.pourT > 0 && o.targetX === p.x); });
    }
    function bitten(p, env) {
      return (env.pests || []).some(function (k) { return (k.target === p || k.attackTarget === p) && Math.abs(k.x - p.x) < 24; });
    }
    // Driest and weakest first, discounted by the drive and by what the tank can actually give.
    function pick(env) {
      var t = spec(), best = null, top = -Infinity;
      env.plants.forEach(function (p) {
        var d = Math.abs(p.x - s.x);
        if (p.dead || p.moisture >= (d <= t.reach + 4 ? TOPUP : THIRSTY) || Math.abs(p.x - env.player.x) > t.search || claimed(p, env) || !passable(env, s.x, p.x)) return;
        var need = FULL - p.moisture, v = Math.min(1, s.water / need) * (need + (1 - num(p.health, 1)) / 2) - d / (t.speed * 12) - (bitten(p, env) ? .5 : 0);
        if (v > top) { top = v; best = p; }
      });
      return best;
    }
    function water(dt, env) {
      var t = spec(), p = s.target;
      if (!live(p, env) || p.moisture >= FULL || Math.abs(p.x - env.player.x) > t.search || s.water <= .001) {
        if (p && (s.state === 'water' || s.state === 'deploy')) { s.target = null; return pose('retract'); }
        p = s.target = s.water > .001 ? pick(env) : null;
      }
      if (!p) return home(dt, env, s.water <= .001);
      if (!reach(p.x, t.reach, dt, env)) return;
      if (!passable(env, s.x, p.x)) { s.target = null; return pose('idle'); }
      if (s.state === 'deploy') { if (s.clock >= .6) pose('water'); return; }
      if (s.state !== 'water') return pose('deploy');
      var a = Math.min(t.rate * dt, s.water, FULL - p.moisture);
      p.moisture += a; p.pulse = Math.max(p.pulse || 0, .2); s.water = Math.max(0, s.water - a);
    }
    // The pest about to bite matters most; a sentry holds off at arm's length instead of driving under it.
    function prey(env) {
      var best = null, top = -Infinity;
      (env.pests || []).forEach(function (k) {
        var p = k.attackTarget || k.target;
        if (!p || p.dead || Math.abs(k.x - env.player.x) > spec().search + 30 || env.ground(k.x) - k.y > 70) return;
        var v = (k.attackTarget ? 1 : 0) - Math.abs(k.x - p.x) / 40 - Math.abs(k.x - s.x) / 120;
        if (v > top && passable(env, s.x, k.x + (k.x < s.x ? 1 : -1) * (ZAP.range - 8))) { top = v; best = k; }
      });
      return best;
    }
    function guard(dt, env) {
      var k = s.water >= ZAP.cost ? prey(env) : null, power = Math.max(1, env.sentry | 0);
      if (!k) return s.state === 'water' || s.state === 'deploy' ? pose('retract') : home(dt, env, s.water < ZAP.cost);
      if (!reach(k.x, ZAP.range - 6, dt, env)) return;
      if (s.state === 'deploy') { if (s.clock >= .3) pose('water'); return; }
      if (s.state !== 'water') return pose('deploy');
      if (s.cool > 0 || !env.zap || !env.zap(k, .3 + .2 * power, s.x)) return;
      s.water = Math.max(0, s.water - ZAP.cost); s.cool = ZAP.cool / (1 + .3 * (power - 1));
      s.zapT = .2; s.zapDX = k.x - s.x; s.zapDY = k.y - env.ground(s.x);
    }
    function charge(dt, env) {
      var r = env.refiller || env.player;
      if (!(env.refillerOnSoil !== false && Math.abs(r.x - s.x) <= 32 && Math.abs(r.vx) < 5 && !env.wet(s.x) && r.grounded !== false &&
        (!Number.isFinite(r.y) || Math.abs(r.y - env.ground(s.x)) < 18))) return pose('empty');
      pose('refill');
      if (!(s.refill = Math.max(0, s.refill - dt))) { s.water = spec().capacity; pose('idle'); }
    }
    function runDispatch(dt, env) {
      var p = s.target || (s.target = env.plants.find(function (q) { return !q.dead && q.x === s.targetX; }) || null);
      if (!live(p, env)) { stop(s.dispatchT > 0); return pose('retract'); }
      if (s.pourT > 0) {
        p.health = Math.min(1, p.health + (env.pourHeal || 0) * Math.min(dt, s.pourT));
        if ((s.pourT -= dt) <= 1e-9) { stop(false); pose('retract'); }
        return;
      }
      if ((s.dispatchT -= dt) <= 1e-9) { stop(true); return pose('idle'); }
      if (!reach(p.x, spec().reach, dt, env, 3.5)) return;
      if (!passable(env, s.x, p.x)) { stop(true); return pose('idle'); }
      if (s.state !== 'deploy') return pose('deploy');
      if (s.clock < .3) return;
      s.dispatchT = 0; s.pourT = 3; p.moisture = 1; p.pulse = Math.max(p.pulse || 0, 1.2); pose('water');
      if (env.onArrive) env.onArrive(p);
    }
    return {
      state: s,
      snapshot: function () { return { x: s.x, water: s.water, face: s.face, refill: s.refill }; },
      relocate: function (x) { stop(s.dispatchT > 0); s.x = x - 20 - s.slot * 13; pose('idle'); },
      requestRefill: function (playerX) {
        if (Math.abs(playerX - s.x) > 32 || s.water >= spec().capacity - .001) return false;
        stop(s.dispatchT > 0); if (!s.refill) s.refill = 2;
        pose('refill'); return true;
      },
      dispatch: function (ranked, env) {
        if (s.kind !== 'water' || s.state === 'packed' || s.refill > 0 || s.dispatchT + s.pourT > 0 || s.water < DISPATCH_COST - 1e-9) return null;
        var p = ranked.find(function (q) { return live(q, env) && Math.abs(q.x - env.player.x) <= spec().dispatch && passable(env, s.x, q.x); });
        if (!p) return null;
        s.water -= DISPATCH_COST; s.target = p; s.targetX = p.x; s.dispatchT = 4; s.pourT = 0; pose('drive');
        return p;
      },
      tick: function (dt, env) {
        if (env.paused || !(dt = Math.max(0, Math.min(.05, num(dt, 0))))) return;
        s.tier = rank(env.tier); s.clock += dt; s.cool = Math.max(0, s.cool - dt); s.zapT = Math.max(0, s.zapT - dt);
        if (env.transport) { stop(s.dispatchT > 0); return pose('packed'); }
        // Rejoin only after leaving the visible garden. Never work remotely.
        if (Math.abs(s.x - env.player.x) > 180 || s.state === 'packed') {
          stop(s.dispatchT > 0);
          var join = env.safeX(env.player.x - env.player.face * (22 + s.tier * 7 + s.slot * 13));
          if (!env.wet(join - 3) && !env.wet(join + 3)) s.x = join;
          pose('idle');
        }
        if (s.refill > 0) return charge(dt, env);
        if (s.dispatchT + s.pourT > 0) return runDispatch(dt, env);
        if (s.state === 'retract' && s.clock < .55) return;
        (s.kind === 'sentry' ? guard : water)(dt, env);
      }
    };
  }
  var art = null, artPromise;
  function loadArt() {
    if (artPromise) return artPromise;
    artPromise = fetch('assets/companion/animations.json').then(function (r) { if (!r.ok) throw Error('Companion atlas missing'); return r.json(); })
      .then(function (list) { return Promise.all(list.map(function (e) {
        return new Promise(function (ok, fail) { var im = new Image(); im.onload = function () { e.image = im; ok(e); }; im.onerror = fail; im.src = e.src; });
      })); }).then(function (list) { art = {}; list.forEach(function (e) { art[e.name] = e; }); });
    // A missing image must not stop a player's run. Reload will retry the assets.
    artPromise.catch(function () {}); return artPromise;
  }
  function frameFor(clip, seconds) {
    var total = clip.frames.reduce(function (n, f) { return n + f.ms; }, 0);
    var ms = clip.loop ? seconds * 1000 % total : Math.min(seconds * 1000, total - 1);
    for (var i = 0; i < clip.frames.length; i++) { ms -= clip.frames[i].ms; if (ms < 0) return clip.frames[i]; }
    return clip.frames[clip.frames.length - 1];
  }
  function draw(ctx, s, x, y) {
    var t = TIERS[rank(s.tier)], a = art && art[s.kind === 'sentry' ? 'sentry' : t.art], clip = a && s.state !== 'packed' && a.clips[(s.face < 0 ? 'left/' : 'right/') + s.state];
    if (!clip) return;
    var f = frameFor(clip, s.clock), X = Math.round(x), Y = Math.round(y), m = clip.mirror ? -1 : 1, i;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(X, Y); ctx.scale(m, 1);
    ctx.drawImage(a.image, f.x, f.y, f.w, f.h, -f.ax, -f.ay, f.w, f.h);
    ctx.restore();
    if (s.state === 'empty' || s.state === 'refill' || s.state === 'water') {
      ctx.fillStyle = '#0e1e1d'; ctx.fillRect(X - 5, Y - a.height - 5, 10, 3);
      ctx.fillStyle = s.state === 'empty' ? '#9d925b' : s.kind === 'sentry' ? '#c9a03a' : '#5e9caa';
      ctx.fillRect(X - 4, Y - a.height - 4, Math.max(1, Math.round(8 * (s.state === 'refill' ? 1 - s.refill / 2 : s.water / t.capacity))), 1);
    }
    if (s.zapT > 0) {
      ctx.fillStyle = '#ffe27a';
      for (var n = Math.max(2, Math.round(Math.hypot(s.zapDX, s.zapDY) / 2)), j = 0; j <= n; j++)
        ctx.fillRect(Math.round(X + s.zapDX * j / n), Math.round(Y - a.height + 1 + (s.zapDY + a.height - 1) * j / n) + (j && j < n ? (j * 7 + (s.clock * 30 | 0)) % 3 - 1 : 0), 1, 1);
    }
    if (s.state !== 'water' || s.kind === 'sentry' || !a.spray) return;
    var ex = X + m * (f.emitter.x - f.ax), ey = Y + f.emitter.y - f.ay;
    if (a.spray === 'drops') {
      ctx.fillStyle = '#5e9caa';
      for (i = 0; i < 3; i++) { var u = (s.clock * 2.5 + i / 3) % 1; ctx.fillRect(Math.round(ex - m * (1 + u * 5)), Math.round(ey + u * u * 7), 1, 1); }
      return;
    }
    var d = frameFor(art.spray.clips.spray, s.clock);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(ex, ey); ctx.scale(m, 1);
    ctx.drawImage(art.spray.image, d.x, d.y, d.w, d.h, -14, 0, d.w, d.h);
    ctx.restore();
  }
  var api = { create: create, tiers: TIERS, dispatchCost: DISPATCH_COST, zap: ZAP, draw: draw, loadArt: loadArt, frameFor: frameFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MaxCompanion = api;
})(typeof window !== 'undefined' ? window : globalThis);
