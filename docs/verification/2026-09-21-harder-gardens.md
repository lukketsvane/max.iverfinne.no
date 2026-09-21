# Relentless time pressure, exclusive classes and harder gardens

## Release state

The implementation and local verification are complete. This release is tracked
in [PR #21](https://github.com/lukketsvane/max.iverfinne.no/pull/21). The tested
work preserves the concurrent native raider-drone handoff on main; its artwork
remains a review asset because its proposed gameplay role is not finalized.
The concurrent platform/enemy release in
[PR #22](https://github.com/lukketsvane/max.iverfinne.no/pull/22) is consolidated
into one geometry and collision implementation, `stage-layout.js`. Its genuine
jump gaps, narrower late shelves, elevated seed reward, radial magnet reach,
continuous co-op roll support, exact-soil rover refill and prevention of mutual
moth healing are retained. Its earlier capped pressure design is superseded by
the requested unbounded time curve. The unused parallel platform engine is
removed while its unique regression coverage is adapted to the shared engine.

**Publication is blocked by Vercel's daily deployment quota.** At
2026-09-21 21:42:58 UTC, Vercel reported `api-deployments-free-per-day`, more than
100 deployments, and requested a retry after 24 hours. The
[provider's PR comment](https://github.com/lukketsvane/max.iverfinne.no/pull/21#issuecomment-5767931734)
records that failure. The last confirmed ready production deployment was
`dpl_8ERcz7TFGi7q8ZsELRVn4gJCFzm9`, from commit
`b1d7c4411e3f08b8c2c797e1335c0b49da547e32`.
These changes must not be called live until a newer production deployment is
ready and the custom domain has been verified.

A conservative retry checkpoint is **2026-09-22 around 21:43 UTC**; the exact
rolling quota reset is not verified. There is no confirmed automatic retry.
Vercel documents the Hobby limit as 100 deployments per 86,400 seconds in its
[rate limits](https://vercel.com/docs/limits#rate-limits). A prebuilt deployment
still creates a deployment and cannot bypass this limit. Billing and hosting
configuration were not changed.

## Time alone becomes overwhelming

The same garden becomes increasingly dangerous even after its three raids are
cleared. The global attempt clock strengthens enemies already alive, increases
wave budgets and concurrency, accelerates mixed patrols, and unlocks specialist
roles without changing stages. Damage and effective durability keep growing
without a time ceiling. Existing damage and boss phases are preserved.

| Elapsed time in garden 1, solo | Effective enemy durability | Enemy damage | Cleared-garden patrol cap | First-wave concurrency | First-wave budget |
| --- | --- | --- | --- | --- | --- |
| 0 minutes | 1× | 1× | 4 | 5 | 7 |
| 5 minutes | 3.79× | 2.93× | 10 | 10 | 13 |
| 10 minutes | 8.21× | 5.99× | 17 | 15 | 20 |
| 20 minutes | 21.09× | 14.91× | 24 | 24 | 33 |

All enemy sources share a 24-active cap and hazards cap at 32. Each raid retains
a finite budget, capped at 36, while patrols continue after the exit unlocks.
Waiting without planting accumulates reward-free predators; they immediately
threaten a new seedling. Rapid ordinary hits develop stagger resistance, so
bomb cadence cannot permanently freeze late enemies. Marked dives, healing
channels, dodges and lanterns retain deliberate counterplay.

Travel, Settings and ordinary Moss climbing preserve the active attempt clock.
Only earned boon choices pause live play. An explicit exit commits to a short
upward departure: Down cannot stall it and jump cannot cancel it. This closes
an independently reproduced protected-exit camping exploit. The original
oscillating-input reproduction now reaches garden 2 in about 3.08 simulated
seconds, with elapsed time preserved.

## Each class has a signature ability

| Class | Exclusive ability |
| --- | --- |
| Mech | Owns the watering robot and upgrades it through its three supplied native tiers. |
| Moss | Climbs living plants at their current growth height and jumps between stems. |
| Bulwark | Guards nearby plants against incoming damage while standing on dry footing. |
| Herbalist | Strengthens active care and heals neighbouring plants while tending. |

Mech alone can receive Companion and Rain engine boons, create a rover, or
restore it after travel. Solo choices, host-authoritative co-op actions and
snapshot restoration all enforce this restriction. Old robot perks and forged
choices cannot give another class a rover. Teammates can still refill Mech's
robot.

Moss uses Up or an upward swipe beside a plant to attach, another Up to leap in
the steering direction, and Down to descend. Airborne contact catches another
stem. Every living plant is eligible, including immature plants and sprouts;
climbing follows the actual growing tip. Death or removal drops the climber.
Co-op snapshots preserve attachment by plant ID, and physical plant height uses
the same 128-native-pixel maximum on every viewport. Combat continues during
ordinary climbing and hazards can knock Moss off.

A costume never grants another class's ability. Moss retains the canonical
`runner` ID for existing selections and accepts `moss` as an alias. All classes
can still explicitly use a cleared garden's exit stalk. Ordinary traversal
creates no exit rewards and cannot skip a locked garden or garden 20.

## More platforming, varied encounters and bosses

The twenty gardens have six route families: terraces, canopy, crossing, ruins,
switchbacks and the final Crown layout. Repeated families vary their shelf
widths and route rhythms, with selected real jump gaps and narrower late shelves. Across the twenty
gardens, 214 of 268 core hops have gaps wider than the six-pixel foot span;
all 308 core shelves remain reachable in the walking-speed audit.
Two elevated routes per garden lead to feathers and
shrine trials; higher optional perches reward improved jumping. From garden 3,
an optional perch offers an ember or dew pickup for each teammate. The opposite
route contains a once-only shared two-seed reward; magnet reach uses actual
two-dimensional distance.

Platforms support swept landing, upward passage, walking off ledges and coyote
jumping. A shelf above a pond provides dry footing. Planting and tending still
require soil reach; refilling a rover requires remaining on soil nearby. Co-op
validates each guest against the actual shared platform or living-plant geometry.
Local rolls end when support is lost, and co-op samples support along the whole
accepted roll segment instead of bridging gaps between sparse movement packets.

Raids mix earlier thieves, casters, shield beetles and healing moths. Fast pests
telegraph dives at the player's position, including elevated routes. Enemy
sources respect their shared limit. No permanent HUD or extra action button is
needed.

Mossback appears in garden 5, Bellkeeper in 10 and Moon Moth in 15, each using
supplied native artwork and distinct attacks. The existing three-phase Hollow
Crown ends the run in garden 20. All four bosses have finite reinforcements;
only the final Crown produces victory.

Loose seeds no longer award boon XP. Wave rewards, exit seed drops and travel
seed grants are smaller; combat, harvests, growth milestones and trials still
support build progression. Finished bouquets, accounts, online garden records,
co-op, original artwork and soundtrack remain integrated.

## Automated verification

- `npm test`: **277 passed, 0 failed**, including actual Postgres migration and
  account isolation tests, controls, classes, companion ownership, co-op,
  results, all-stage progression, platform physics, time pressure and review
  fixture isolation.
- `npm run build`: passed; the static production bundle includes the layout
  module and three adopted milestone PNG/JSON pairs.
- `python3 scripts/verify-native-art.py`: **1,088 cells and 176 clips passed**,
  validating binary alpha, fixed palettes, bounds, anchors and original gameplay
  markers. Runtime PNGs total 247,769 bytes.
- `git diff --check`: passed.

Actual game-physics tests reach every core shelf for all four starting classes
across all twenty terrains, without feather upgrades. Landing, walk-off, dry
footing, guest dodge contact and Moss plant-to-plant jumps are checked at 30,
60 and 120 Hz. The route audit uses walking speed for all four classes,
including Bulwark, with no feather assistance. Class-specific tests cover forged robot choices, stale snapshot
ownership, growing plants, plant death, viewport consistency, guest travel
request deduplication and committed exits.

An independent audit exercised all 60 waves in solo and four-player VM
configurations, using forced defeats to check progression and synchronization.
It found exactly four milestone bosses and one victory, at garden 20. Trials
could overlap raids without overflowing the enemy cap or trapping queued guards.

Adversarial time-pressure tests include continuous upgraded, perfectly aimed
wet bombs defending a full-health plant. The early comparison survives its
window; at twenty-minute pressure the regression requires that defense to fail
within 30 simulated seconds. Separate tests using actual bomb flight and
optimistic care failed in about 10.5 seconds solo and 18.2 seconds with four
simulated players and robots. These are reproducible stress cases, not promises
about every possible human build or exact survival time. An additional
independent class/co-op audit passed 13 runtime probes.

## Actual native-canvas render evidence

The images below were rendered by the current game frame loop in a Node VM with
`@napi-rs/canvas`, decoded embedded artwork and the built native-art adapter.
Each scene decoded 37 images; all 12 native atlas packs loaded without failure.
Each export is a pixel-verified, exact threefold nearest-neighbour expansion
from 130 × 282 to 390 × 846. Capture state and source hashes are recorded in
[native-render-verification.json](native-render-verification.json).

| Image | Captured state |
| --- | --- |
| [Moss growing-plant climb](max-native-moss-growing-climb.png) | Ordinary climbing in uncleared garden 1, with an immature plant growing from 0.65 to 0.669 and two neighbouring stems. |
| [Raised ruins route](max-native-raised-ruins-route.png) | Bulwark supported by garden 4's actual elevated platform, with collision running. |
| [Garden 1 after ten minutes](max-native-garden-one-ten-minutes.png) | Garden 1 at 602.17 seconds, with 17 enemies supplied by the actual patrol director and Mech's robot present. |
| [Mossback encounter](max-native-mossback-encounter.png) | The native garden 5 boss during phase-one attack windup, beside Herbalist and living plants. |

These are game-canvas renders, **not browser screenshots**. They verify drawing
and representative simulation states. New-release browser DOM layout,
compositing, sound, networking and physical iPhone input remain unverified while
publication is blocked. The earlier release's deployed browser evidence does
not establish those properties for this candidate.

`review.html` uses the actual built game with isolated in-memory storage. Its
selectors cover all six route families, bosses at 5/10/15/20, a mixed encounter,
all twenty individual layouts, Moss on immature plants, same-garden pressure
at 0/5/10/20 minutes, all classes and the complete 53-plant bouquet. Legacy
`platforms` review links retain their selected stage; `pressure` opens the
new ten-minute garden 1 scenario. Production exports no review/debug API.
