# Mycel — Culture and the living network

Mycel remains the walking mushroom colony: a broad burgundy cap, cream spots,
mint gills and ivory root feet. Saved class `herbalist` and skin `moon` keep their
existing identity. Both original sheets, atlas, palette, 32px cells and foot
anchor `(16,31)` remain unchanged. New spores and network cues are separate
world effects; the unuploaded replacement-art concept is not used.

Sources: [Mycel proposal](https://app.notion.com/p/3ec1c6815f78813b8c43fc1a04467fda),
[Living network](https://app.notion.com/p/3ec1c6815f78816a8eb7f1804312fa52),
[Spore dart](https://app.notion.com/p/3ec1c6815f78816081eafe2f7d3560b3),
[Rooting cloud](https://app.notion.com/p/3ec1c6815f7881429b5cea111af7cb15),
[Spore drift](https://app.notion.com/p/3ec1c6815f78816d8ec0f3e7c3d8761b),
[Recovery bloom](https://app.notion.com/p/3ec1c6815f7881089fccff7b4ac56157).
These connected pages remain marked Proposal. This implementation develops
their kit with the bounded choices below; it does not change their review status.
The preserved Figma sheets are
[main454:601](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF/MAX?node-id=454-601)
and [interaction454:600](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF/MAX?node-id=454-600).

Mycel builds a small living network, lands darts to earn Culture, and decides
whether to spread a temporary cloud or save for a recovery bloom. Drift provides
a short vulnerable reposition while the fixed bloom continues working behind
her. Real tending remains valuable: healthy wet plants supply Culture, while
combat restoration has finite budgets.

## Base kit

`D` is literal1 before the usual owned boon, level, Ember and target resistance,
armor, exposure and difficulty scaling. Base speed, jump and control remain1;
care remains1.4 and the seed multiplier remains.7.

| Verb | Timing, cost and effect |
| --- | --- |
| Living network | Culture0–6, no decay. Each confirmed initial dart earns.5 once. Each qualifying living wet plot within58px contributes.5/s; at most two contributors,1/s total. Show at most three living stable plot IDs. |
| Spore dart / B | Free, .58s recovery, speed140px/s, life1.15s. Initial hit1D; one network-enabled distinct chain at.65D within38px of the previous target. Every link needs actual wall clearance. |
| Rooting cloud / C | Cost2, cooldown5s. A clear dry reachable point within80px receives one fixed radius44 cloud. Three.25D pulses at1/2/3s; base total.75D per target. At most two owned clouds. |
| Spore drift / V | Free, cooldown6s, .35s movement, cumulative actual path at most48px. Dry free-ground or free-air launch, ordinary terrain and vulnerability. One eligible first landing can water one real living network plot by at most.04. |
| Recovery bloom / E | Cost4, cooldown12s, fixed radius48 at the accepted body center. Three.8D pulses at0/2/4s; base total2.4D per target. Move, shoot, jump or tend after acceptance. Whole-cast restoration per plot is capped at.12 health/.15 moisture. |

Cadence shortens B recovery by `.88^min(3,rank)`. Misses, chains, objectives,
Cloud, Bloom, Drift, restoration and damage procs supply no primary Culture.
Independent darts may land in reverse order; each carries its own consumed bit.

Wet means a current living plot with moisture at least.20. Passive generation
stops while the owner is down, absent, wet, travelling or outside actual reachable
plant range, and never catches up offline. Earned Culture persists. Dry living
plots still enable chains. Range and line of sight use the real current stem,
including the bent High Tide route at the query height. Sort visible links by
actual distance, then stable ID. Clouds are temporary chain anchors in every
mode; they never generate passive Culture or enter plot, seed or exit arrays.

## Cloud and Bloom stay in the world

C validates its actual finite point, dry space, range, wall clearance and owned
population before debiting stock or starting cooldown. A third cloud is denied.
Ordinary pests move at.70 speed in a legal cloud; bosses at.90. The strongest
cloud applies once and composes with existing Wet/Grit on actual movement.
Attack, warning and recovery clocks are unchanged. Cloud/Bloom add no generic
hit stagger; Dart retains its genuine hit interruption.

Ferment extends Cloud lifetime from3 to6s at rank3, but damaging slots remain
exactly1/2/3. The extra tail provides slow and a chain anchor. Separate accepted
clouds can deal their own damage; overlapping slow does not multiply. Cloud
causes no friendly restoration, including incidental defense, kill procs or Garden Fever.
Objectives still need real contact and line of sight.

E rejects an empty unsupported cast before cost, cooldown or chorus consumption.
A legal enemy/objective, deficient living plot, eligible retained Garden stub
or injured living Last Seed teammate must be able to benefit. The first pulse
is scheduled by the ordinary host update. The owner stays free; the center
does not follow her. Each consumed slot is recorded before effects and rechecks
current targets and walls.

Direct requests are.04 health/.05 water per pulse. Each exact current plot ID
shares one whole-cast ledger, capped at.12/.15, including Bloom-caused spore
interception, echo defense, Mulch, Garden Fever and deferred Ember kills. Debit actual clamped
increases before applying them. No care multiplier or broader proc radius
expands the fixed48px/LOS budget. Unrelated rain, tending, Sap or another owner's
care remains independent. Debt persists through a bounded5.6s causal Ember tail;
it creates no fourth pulse or extra healing phase. Replaced or retired burn
causes cannot fall back to unbudgeted healing.

In Last Seed, Bloom can restore at most12HP total to other living reachable
teammates, at most4 newly available per pulse. The caster and downed teammates
are excluded. Garden, High Tide and Night Relay gain no player HP. Existing
Tend revival, shields, air and revive progress remain unchanged. Earned mode
completion rewards, including Tide guardian-stage recovery, remain their
existing progression rewards rather than Bloom restoration.

Bloom may revive at most one exact currently retained Garden stub within its
real eight-second window. Bind the latest fallen ID, kind and uint32 seed at
acceptance, then revalidate the actual object at the first applicable pulse.
Its bounded.04/.05 restoration consumes the same cast ledger. Preserve growth,
stalk, seed and object identity; impose no old.2-health/.5-water minimum.
Expired, archived, replaced or terminal relic losses cannot revive, and a failed
bound candidate does not select another historical record.

## Drift uses actual physics

Accepted horizontal motion is fixed at100px/s in the chosen direction. Ground
launch velocity is−90; free air clamps its current vertical velocity to−90..0.
Existing gravity430 and terminal340 follow afterward. The ordinary native120Hz
terrain/support/Relay resolver records actual Euclidean path, ascent, world,
serial and seen-air evidence. No wall, ceiling, water or stage bypass, fresh
path allowance after correction, invulnerability, damage or barrier is added.

B can fire and turn the visual body without turning Drift's accepted direction.
During active motion C/V/E, Tend, steering, jump, climb and automatic catches
are blocked. Ordinary controls return after.35s. Universal X cancels Drift and
its landing opportunity first, retaining the paid6s cooldown, then attempts
the unchanged ordinary ground dodge. An air cancellation creates no air iframe.

One real first descending air-to-support landing, during movement or the.8s
post-motion lease, consumes the opportunity before any restore. The total lease
ends by1.15s from acceptance. Water at most one nearest stable living network
plot by.04 total, using actual clamping. Full/off-network landings also consume
the opportunity. Cloud, dead, archived or replaced links fail. New jump, Tend,
climb, X, hazard, water or travel cancels the lease; no health, Culture, HP,
mass, seed or care callback follows the landing. Correction/promotion retains
path, ascent, age, seen-air proof and consumption without renewing the lease.

## Five retained upgrades

IDs, ranks, paths, prerequisites and mode filters remain unchanged.

| Boon | Effect |
| --- | --- |
| Far spores / `colony`, max3 | Chain reach+5px/rank:38→53px. No extra links. |
| Ferment / `ferment`, max3 | Dart and Bloom damage ×`(1+.2×rank)`; Cloud lifetime+1s/rank. Cloud retains three.25D base pulses. |
| Symbiosis / `symbiosis`, max3 | Initial dart contact restores nearby34px/LOS living plants. Per owner/plot bounded1s window, at most.015 health/.035 moisture per rank; rank3 caps.045/.105. Actual debt survives handoff. No chain or ally HP credit. |
| Outbreak / `outbreak`, max1 | Two extra distinct chains, including plant-free starts. Maximum three links beyond the initial victim with a network, two without. Each checks walls and stable unhit IDs. Needs Colony1/Ferment2. |
| Living chorus / `symphony`, max1 | First actually useful Bloom pulse readies B once. A genuine initial dart kill/interruption of a current threat to a linked healthy plant primes one pulse×1.25 for4s. Needs Symbiosis2/Sap1. |

Chorus checks the threatened plant's health≥.75 and moisture≥.30 before contact
effects. Activation proximity, chains and proc recursion cannot prime it. A
useful accepted E consumes the one bonus; rejected/empty casts preserve it.
At rank3 Ferment plus one chorus pulse, whole-cast damage is4.16D before common
scaling. Every plant and allied HP restoration cap remains absolute.

## Controls, authority and native presentation

B / threat tap fires Spore; C / Cloud places Rooting cloud; V / Drift performs
the vulnerable hop; E / Bloom or tap Mycel releases Recovery bloom. Standard
controller C8/V6/E4; horizontal single C8/V10/E3. Held Tend+C refills, Home16 or
held Tend+V toggles the lantern; the chords suppress gardening. X, ordinary
Tend and lantern L stay separate. B retains dry non-exit plant/ladder shooting;
C/E use dry free ground/free air. Manual work and travel cannot be interrupted
by rejected casts. A flagged automatic idle pose wakes only after accepted input.

`mycel.inc.js` owns solo `rogueRun.mycel` or co-op `member.mycel`. Separate
positive monotonic B/C/V/E tags≤1e9 receive host acceptance or rejection ACKs.
Guests supply intent, never resource, hits, pulse masks, debt, revival or landing.
Owner clocks, initial-hit bits, active cloud/Bloom target tuples, bounded
restoration debt and remaining Drift proof survive snapshots/promotion.
Duplicate exact tuples merge consumed masks without reopening another owner.
Remote Drift gaps over.5s cancel paid motion and its landing lease with a
canonical correction, retaining cooldown. Rejected poses replay previously
accepted input, consume any witnessed landing without water, and use a newer
valid input only on future receipts. The tiny `{tag,axis,speed}` input ledger
contains no guest timestamp. No frame/packet double ticking or offline passive
catch-up occurs.

Down/water cancels pending paid Bloom pulses and Drift/landing while preserving
stock and paid cooldowns. Already-released darts/clouds may finish their finite
current-world lifetime. Departure, class change and world travel retire all
owned transients. A new run resets the kit.

`mycel-motion.mjs` reads accepted release cues and pure phase policy into the
existing sheets. B/C briefly reuse the original attack row; grounded stationary
E briefly crouches. Real Drift ascent/descent uses existing jump cells and
actual landing keeps the ordinary landing animation. Moving/jumping/tending
owners never acquire a Bloom channel pose. Rejected exact cues and cancellation
policy override stale snapshots. Only presentation clocks/cells change; there
are no combat callbacks or body transformations. Rattus, Cairn and Crown remain
on their own native adapters.

## Live review

[`review.html?mode=mycel`](../../review.html?mode=mycel) starts with zero Culture,
real supported dry space, a healthy wet plant, a dry damaged plant and one true
recently fallen retained stub. Real ordinary pests provide dart contacts and
plant threats; existing nearby solid rock provides a blocked target where the
stage permits it. Terrain, enemy AI, support and clocks remain ordinary.
`&network=none` provides a plant-free start; `&boons=1` enables the five retained
upgrades and their existing prerequisite. `&stage=1` through20 select actual
campaign entry geometry. Normal controls and isolated memory saves are used.

Pure observations expose bounded q, selected actual network points, spores and
their initial-consumed/seen IDs, exact target masks/burn cause, plot identity and
state, body/support/policy and native cells. They are review-only observations,
not gameplay authority. Focused native/review regression tests accompany the
core/network/browser release gates run by the character coordinator.
