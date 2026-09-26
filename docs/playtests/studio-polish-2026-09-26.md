# Studio polish: combat, sound and builds

This pass addresses friction in the existing garden loop: prepare and explore,
tend living plants, summon a guardian, exploit its opening, pick a boon and
physically climb to the next garden. The twenty existing guardians and the
streamed soundtrack remain part of that loop.

## Decisions

- Keep Mech and Moss's stationary two-second bombs. Replace the long hiss and
  accumulating camera shake with short, warm, local impacts. A quiet placement
  and nearby fuse cue explain timing; a small input buffer catches near-ready
  attacks without leaving an unexpected bomb queued for later.
- Give all guardians a complete reaction-and-fuse opening. Their own lingering
  strikes must finish before cyan begins. Crown and Moon Moth come within ground
  bomb reach. Tactical interruptions still earn longer openings.
- Every optional trial can expire, releasing the mandatory altar. Defeating a
  shrine's guards accelerates the remaining charge when a player returns.
- Offer one useful continuation of the player's chosen build, with alternatives
  from other paths. Show names, effects and newly unlocked signature boons in
  the live choice dock. Keep mode-inappropriate rewards out of Last Seed.
- Preserve authority, duplicate-action handling, independent boon queues,
  physical ascent, native artwork, separate music/effects settings and Easy's
  gentler damage/pressure rules.

## Reproducing checks

```sh
npm test
npm run build
node scripts/playtest-garden-guardians.cjs --easy
node scripts/render-effects-preview.cjs
node scripts/check-garden-guardians-browser.cjs
```

The browser check requires installed Playwright Chromium and WebKit browsers.
It exercises all twenty boss warnings, planted bombs, every animation action,
and readable boon selection at four phone viewport sizes/orientations.

The sound preview uses production oscillator, noise, envelope and filter
schedules. It renders before the live compressor, so reported peak headroom is
conservative. It is an engineering audition file, not a second sound recipe.
The soundtrack files and player are unchanged. Automated envelope and mix
measurements do not establish subjective listening quality.

The paired pilot uses a fixed reported seed, actual input and snapshot paths,
100 ms latency and the production Seed Vault/Railway maps by default.
`--generated` explicitly selects fallback geometry. Bot navigation and scripted
combat cannot establish whether the game is as enjoyable as a commercial
reference; results report those limits instead of treating test completion as
proof of fun.

## Paired run comparison

Baseline: `b5da68d7cea8a978d02c00dc7ff3cff298ae8f3e`, using the same
seeded QA harness and keyboard pilot in an isolated worktree. After: this studio
pass. Both use seed `260926`, 30 simulation frames per second, two independent
clients, ordinary actions, authoritative snapshots and production picture maps.
No position, damage or reward is injected during these runs. The endpoint is
three defeated guardians followed by physical ascent and **both clients**
arriving in garden 4.

| Difficulty and pair | One-way latency | Baseline | After |
| --- | ---: | ---: | ---: |
| Easy, Mech + Herbalist | 100 ms | 63.8 s | 58.2 s |
| Medium, Mech + Herbalist | 100 ms | 131.8 s | 96.6 s |
| Medium, Moss + Herbalist | 250 ms | 116.1 s | 90.9 s |

All six runs reached that endpoint with the run still alive. In the Medium
Mech pair, the second guardian fight fell from 45.0 to 23.3 seconds; the third
fell from 39.5 to 23.4 seconds. These numbers assess the combined changes under
one fixed pilot and seed. They do not isolate one mechanic or measure enjoyment.

Reproduce the three after-runs:

```sh
node - <<'NODE'
const {run}=require('./scripts/playtest-garden-guardians.cjs');
for (const spec of [
  {difficulty:'easy',classes:['mech','herbalist'],latency:100},
  {difficulty:'medium',classes:['mech','herbalist'],latency:100},
  {difficulty:'medium',classes:['runner','herbalist'],latency:250},
]) console.log(JSON.stringify(run({...spec,seed:260926,limit:3,seconds:240})));
NODE
```

## Encounter, input and authority checks

`tests/studio-coop-qa.test.cjs` runs all twenty guardians through the actual
paired frame loop in explicitly isolated arenas. The rotating pairs are Mech /
Herbalist, Moss / Bulwark, Pølge / Herbalist, and Sligo / Mech. Every guardian
reached an amber warning, a real attack and cyan recovery on both clients;
objective nodes matched the authoritative snapshot. This is encounter coverage,
not a claim that the pilot completed twenty consecutive gardens.

The same test file verifies a nearly-ready guest bomb slot under repeated
identical input packets. One release plants exactly one bomb. A subsequent
authority handoff preserves its fuse without replaying the release. The seed
check also confirms that virtual phones have independent deterministic random
streams without modifying the test process's global randomness.

The existing gamepad and class/co-op checks passed: standard and Joy-Con face
button mappings, controller disconnect, held-confirm protection, exclusive
class powers, and a guest physically reaching an exit plant's top before the
whole team moves forward. These are simulated input checks, not a claim of
physical controller hardware testing.

A preliminary longer baseline pilot stalled above a plant on a one-way ledge,
where its held Tend input could not reach the soil. The pilot now walks off the
ledge before trying to tend. We did not interpret that navigation mistake as a
balance defect or claim a complete twenty-garden playthrough. Human touch
playtesting and sustained listening remain the next qualitative checks.
