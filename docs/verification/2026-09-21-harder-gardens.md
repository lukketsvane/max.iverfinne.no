# Harder gardens, platform routes and milestone bosses

## Implemented behavior

The twenty-garden run now combines raised routes with denser mixed encounters.
The first established plant starts a finite raid. Early solo waves contain
7, 9 and 11 enemies before later stage, time and garden-size modifiers. Party
budgets scale with player count and cap at 36. Raid fronts admit 5–12 simultaneous
enemies; all enemy sources share a 24-active cap. Hazards cap at 32.

Pressure grows by active run seconds / 150 plus the stage modifier, replacing
seconds / 210. Spawn intervals start at 0.85 seconds and tighten toward 0.4;
between-wave breaks tighten from 6.5 seconds toward 4.5. Wave rewards, exit drops
and travel seed grants are smaller. Loose seed collection no longer awards boon
XP; combat, harvests, growth milestones, trials and clears still do.

Five repeating route families—terraces, canopy, crossing, ruins and switchbacks—
vary in dimensions and arrangement across stages. Garden 20 has a crown layout.
Both sides contain a core climb and an optional higher perch. Feathers and
trials use the real shelf heights. From garden 3, the optional perch holds an
ember or dew for each teammate. Trial progress requires feet at the trial's
height or in a nearby jump above it; waiting on the soil underneath does not
complete the trial.

Platforms have swept downward collision, upward passage, edge departure and
coyote jumping. Feet on platforms above ponds stay dry. Missed jumps return to
the continuous soil. Planting and tending require soil reach; rover refilling
requires the gardener to remain grounded near the rover. Co-op derives each
guest's support from the shared deterministic stage geometry.

Thieves arrive in garden 2, casters in 3, beetles in 4 and healing moths in 6.
Fast pests can mark a gardener's position and dive after a visible warning.
Movement, a timed dodge, or interrupting the pest avoids the marked gust.
Lanterns grant a short reprieve followed by enemy resistance; they cannot hold
an enemy in an endless scare loop. Scouts arrive after 22 seconds without an
established garden and give no kill rewards. Raid enemies separated from the
last surviving plant return to it instead of drifting indefinitely.

Mossback (5), Bellkeeper (10) and Moon Moth (15) use the supplied native sheets
and distinct attacks, exposed windows and bounded reinforcements. Only Hollow
Crown (20) ends the run. The existing 128-frame, three-phase Crown stays in use.
No new persistent gameplay HUD or controls were added.

## Automated verification

- `npm test`: **210 passed, 0 failed**. Includes the actual Postgres migration
  and account isolation tests, existing controls/classes/results/co-op tests,
  plus platform, difficulty and review-fixture coverage.
- `npm run build`: passed; generated production assets include the layout
  module and the three adopted milestone PNG/JSON pairs.
- `python3 scripts/verify-native-art.py`: **1,088 cells, 176 clips passed**;
  checks binary alpha, palettes, bounds, anchors and original gameplay markers.
  Runtime PNGs total 247,769 bytes.
- `git diff --check`: passed.

Actual game-physics tests reach every core shelf for all four starting classes
across all twenty terrains, without feather upgrades. Landing, walk-off, dry
platform footing and guest dodge contact are checked at 30, 60 and 120 Hz.

An independent audit exercised all 60 waves in solo and four-player VM
configurations, using forced defeats to check progression and synchronization.
It found exactly four milestone bosses and exactly one victory, at garden 20.
Trials overlapped active raids without overflowing the active-enemy cap or
leaving queued guards stuck. These scripted checks establish completion and
state correctness; they do not replace a human balance playthrough.

## Visual review routes

`review.html` uses the actual built game with isolated in-memory saves. Its scene
and class selectors cover all six terrain families, live bosses at 5/10/15/20,
a mixed encounter and the existing complete 53-plant bouquet. It includes
portrait/landscape controls and review-only visible position/status telemetry.
No review state is exposed through the production game API.
