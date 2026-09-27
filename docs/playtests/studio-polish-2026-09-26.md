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
node scripts/playtest-garden-guardians.cjs
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

## Intermediate audio/combat comparison, before shrine relocation

Baseline: `b5da68d7cea8a978d02c00dc7ff3cff298ae8f3e`, using the same
seeded QA harness and keyboard pilot in an isolated worktree. After: this studio
pass at `6a55`, before the subsequent distant-shrine and ladder changes. These
timings do not describe the final exploration loop. Both use seed `260926`, 30 simulation frames per second, two independent
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

Reproduce the three intermediate after-runs from commit `6a55e15` (the current
shrines deliberately require more exploration):

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


## Final shrine and ladder verification

The final exploration pass moves each guardian shrine to one of three designed
sites in every garden. The earlier timing table is retained only as evidence
for the intermediate audio/combat pass; it is not a speed comparison for this
new exploration loop.

`tests/guardian-site-reach.test.cjs` verifies all 60 candidate sites under each
of two layout seeds (`1` and `260926`): 120 entrance-to-shrine trips and 120
returns. An unupgraded walking Bulwark must stand on the real shrine support,
and must be able to descend and return. Search branches restore previously
reached states; each accepted route is then replayed continuously from the
actual entrance without position changes between actions. Both production
picture maps are loaded. The new mill ladder fixes the Railway's awkward
return from its 41-pixel east rock face.

`tests/guardian-site-coop.test.cjs` confirms the chosen site through ordinary
snapshots, late joining and authority handoff in all 20 gardens. A duplicated
guest seed-cache claim awards the two shared seeds once and cannot respawn
after handoff. All 19 non-final gardens still require a guest to physically
reach the local victory plant's top before the team advances.

The current paired keyboard pilot also completed these continuous stories:

| Run | Shrine/cache reached | Local plant | Guardian summoned | Guardian defeated | Physical arrival onward |
| --- | ---: | ---: | ---: | ---: | ---: |
| Seed 4, Easy, Seed Vault soil shrine | 5.7 s | 6.2 s | 10.7 s | 18.8 s | Garden 2 at 22.1 s |
| Same run, Railway mill shrine | 33.0 s | 33.5 s | 36.7 s | 45.4 s | Both in garden 3 at 48.6 s |
| Seed 11, Medium, elevated Tank Gallery | 5.7 s | 10.2 s | 18.7 s | 45.2 s | Both in garden 2 at 48.6 s |

These use Mech + Herbalist with 100 ms one-way latency. Times record the
listed test iterations; the keyboard pilot was subsequently extended with the
separate-VM planner for elevated shrines. They are not a performance benchmark.
The elevated route
includes collecting the cache upstairs, descending to plant in the court,
climbing back to summon, descending into the fight, and finally climbing the
victory plant. Mech spent 5.3 seconds on actual ladders and Herbalist 2.7 seconds.
The planner runs in a separate VM and supplies keyboard actions; it never moves
live players or injects damage, resources or rewards. These scenarios exercise
successful cooperation, not a claim of complete-campaign or human playtesting.

Reproduce the elevated continuous story (also the current pilot default):

```sh
node scripts/playtest-garden-guardians.cjs --seed=11 --difficulty=medium --limit=1 --latency=100
```

Exercise both production picture maps with the soil-shrine selection:

```sh
node scripts/playtest-garden-guardians.cjs --seed=4 --easy --limit=2 --latency=100
```
