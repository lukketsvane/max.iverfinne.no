# Cairn — Strata and the garden ridge

Cairn remains the broad living stone creature, with his existing moss, palette,
body sheets and foot registration. Class ID `bulwark` and skin `ember` remain
compatible with saved players and co-op reservations. This kit develops the
connected proposal; the unapproved replacement-art proposal is not used.

Sources: [Cairn](https://app.notion.com/p/3ec1c6815f7881afa426caf601377f26),
[Rooted Weight](https://app.notion.com/p/3ec1c6815f7881e49b0af56315a02a10),
[Three-Stone Rhythm](https://app.notion.com/p/3ec1c6815f7881cf8ef9d6f7a0d523bf),
[Loose Stone](https://app.notion.com/p/3ec1c6815f788148a035dabbbf12af54),
[Brace and Answer](https://app.notion.com/p/3ec1c6815f7881839a37f4f72de000ba),
[Garden Breakwater](https://app.notion.com/p/3ec1c6815f7881efb158f875c0285c62).
The preserved native sheets are [main454:599](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF/MAX?node-id=454-599)
and [interaction454:598](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF/MAX?node-id=454-598).

Cairn makes a defended patch of garden valuable. Land deliberate close sweeps
to earn plates, or stand where a real plant bite benefits from his guard. Spend
one plate to slow a grounded approach with Loose Stone; save three to raise a
Ridge. Brace rewards reading an actual frontal attack, while its short counter
range keeps positioning important. Movement, tending and dodge remain ordinary
garden actions.

## Base kit

`D` is literal1 before the usual owner level/Ember and target resistance,
armor, exposure and run difficulty. His speed `.85`, shove factor `.55`,
stagger trait `1.5`, care `.45` and seeds `.4` stay unchanged.

| Verb | Timing, cost and effect |
| --- | --- |
| Rooted Weight | Strata0–3. Every third confirmed B action or an actual effective guarded plant bite can award one plate, sharing a1.5s gate. While alive, dry and grounded outside travel, living plants within48px receive30% class guard. |
| Three-Stone Rhythm / B |1.15s acceptance interval, `.22s` startup and `.3s` recovery each;2.4s chain window from confirmed contact. Forward sweep1D, reverse sweep1D, planted knuckle1.35D. First/second body reach32px; third36px with an actual supported ground route. One `.25s` ordinary-light stagger per impact. |
| Loose Stone / C | One plate,5s cooldown. One low physical stone travels at most72px; first enemy contact deals1.4D and `.4s` light stagger, then leaves one radius24px grit patch for3s. Actually grounded pests within the patch and line of sight move20% slower. Grit does no damage. |
| Brace and Answer / V | No plates,10s cooldown. Stationary grounded defense up to3s; living plants within64px receive65% guard. One real frontal pest strike during the first `.28s` can consume one1.5D counter, actual attacker only, body reach36px and line of sight. A successful parry leaves2.5s cooldown. |
| Garden Breakwater / E | Three plates,20s cooldown, `.5s` anticipation. Reachable dry ground48px ahead receives one2.5D/radius36 emergence. The owned64×16px Ridge obstructs ordinary actually grounded pests for2s, then remains a fixed radius48px45% bite-only ward through6s. |

Fault adds6px per rank to B only: maximum first/second reach50 and third54.
Cadence shortens the accepted B interval by `.88^min(3,rank)`; startup and
recovery stay fixed. First/second may strike in air. The third requires real
support both at acceptance and impact; denying an airborne third starts no new
cooldown. Bosses retain their displacement and stagger resistance.

Only confirmed enemy contact advances the visible combo. Misses and objective
contacts preserve its next step. One B action counts once even when it contacts
several enemies; Stone, counters, emergence and boon follow-ups contribute no
primary contacts. Guardian objectives still receive the bounded actual impact.

## Plates come from contact

The third-contact remainder is separate from the visible combo and survives
chain expiry. At cap3, completed opportunities are discarded. If the shared
gate is closed, keep at most one completed-primary opportunity: the next real
B contact after the gate opens realizes it and starts a fresh remainder0.
Idle never releases a queued plate. A real guarded bite shares the same gate
and does not consume that pending primary opportunity.

Plant guard lookup is pure. Passive30%, Brace65%, Ridge45% and Sligo's class
guard select the strongest eligible contribution instead of multiplying.
Existing Shelter, Shield and Barkskin keep their separate rules. Equal guards
choose the lower member slot, then stable owner ID. Only the effective Cairn
owner can receive the plate, and only if the reduction saved positive actual
health from a living plant's accepted pest bite.

Range uses the actual damage point, including the actual bent High Tide stem.
Roots, blasts, drain, friendly damage, nominal icons, healing and defense queries
do not award plates. A ward-only award also requires its owner alive, dry,
supported and within48px of that contact; the ward cannot farm offscreen plates.
One canonical enemy attack identity spans its plant and gardener callbacks.
Consumed flags on the original attack reject delayed repeats after the gate
reopens or the host changes.

## Brace, Stone and Ridge decisions

The connected proposal leaves several physical and transaction details open.
These are the bounded implementation choices:

- Stone launches at `(x,y-12)` with horizontal speed80, vertical speed−32,
  gravity120 and radius3. Authority sweeps at most1/120s per step through actual
  enemy, platform, solid, soil and water contacts; earliest contact wins and
  terrain wins an exact tie. Actual cumulative trajectory caps at72px, life2s.
  Terrain/water/range/life misses create no grit. Enemy-contact grit uses the
  nearest unobstructed dry support within24px, or the actual contact point.
  It cannot project down a cliff, ground flight or stretch attack clocks.
- Brace can parry an actual gardener strike or an actual bite covered by that
  active brace, with accepted facing and host contact time in `[0,.28)`.
  A distant covered bite may consume the parry while its attacker lies outside
  counter reach. Activation, proximity and a warning alone cause no counter.
  Existing65% survival gardener mitigation remains; there is no new immunity,
  HP refund or retroactive damage undo. Moving, jumping, dodging, climbing,
  tending, starting B/C/E, forced displacement over6px, water, down or travel
  ends personal defense while retaining the accepted cooldown.
- Ridge reserves3 plates during anticipation without debiting them or starting
  cooldown. Competing casts/spenders are locked. Commit revalidates owner,
  world and the entire footprint, then debits3 and starts20s exactly once.
  Invalidity/interruption clears the reservation; it never adds a refund.
  A committed Ridge replaces the owner's prior Ridge and emits emergence once.
- The entire64px footprint must occupy continuous reachable dry support with
  at most6px height variation. Touching equal-height supports may join. Reject
  gaps, walls, water and exit/ladder/warp corridors expanded12px, relay
  carrier/door/rune lanes, and the actual High Tide stem corridor expanded12px.
  This validates geometry in Night Relay too; it does not ban a mode by name.
- Ridge sweeps ordinary pest feet through its side boundaries with their real
  body margin. Rats prove `ratGrounded/ratPlatform`; floor rams prove actual
  support. Initially-inside pests may leave. Flight, airborne leaps, bosses,
  guardians and queens bypass it. Players, teammates, rovers, ladders and
  progression remain traversable. It is never a player platform or new terrain.

Personal primary startup/recovery blocks new B/C/V/E and tending. First/second
keep ordinary steering/jump; the planted third locks steering/jump/climb and
automatic catches. Dodge can cancel unconsumed startup while retaining the paid
interval. Ridge anticipation locks steering/jump/climb/care, but dodge can
cancel its reservation. Live stone/grit/ward creates no personal movement lock.

## Five retained upgrades

IDs, ranks, prerequisites, paths and mode lists are unchanged.

| Boon | Effect |
| --- | --- |
| Fault line / `fault`, max3 | +6px primary reach per rank. |
| Reprisal / `counter`, max3 | Genuine base counter damage ×`(1+.25×rank)`. |
| Stone pulse / `bedrock`, max3 | Genuine consumed parry emits one separate `.4D×rank` radius64/LOS pulse. Brace activation emits none; Reprisal does not multiply it. |
| Aftershock / `aftershock`, max1 | Genuine parry emits one front1D cleave after `.12s`, reach32+Fault, with its own consumed serial. No recursive parry or Strata. Needs Fault2/Reprisal1. |
| Sanctuary / `sanctuary`, max1 | Accepted legal Brace restores `.15` health and `.12` water once to living plants within64, using actual Tide stem geometry. No Strata. Needs Stone pulse2/Green Thumb1. |

## Controls and preserved Shovel

B / threat tap uses Three-Stone Rhythm; C / Stone throws Loose Stone; V / Brace
starts a stationary brace; E / Ridge or tap Cairn uses Garden Breakwater.
X remains dodge. Standard controller C8/V6/E4; horizontal single C8/V10/E3.
Held Tend+C8 refills, Home16 or held Tend+V toggles the lantern; these chords
suppress garden work. Ordinary tending and lantern L remain available.

Plain E always selects Ridge. A solo owned Shovel retains its old burrow as
explicit Down+E, controller Tend+Special, or the visible owned-Shovel touch
glyph. Dry ordinary-soil, travel and nearby-enemy constraints remain. Underground
speed is `.8×WALK_V`; jump erupts2damage/radius28. Burrow/cache seeds/eruption
are world interaction and generate no Strata, counter, guard or exit bypass.
The Shovel chord accepts an ongoing hand pose even when Down or Tend arrived
earlier than E; it cancels the remaining pose without undoing completed care or
planting. Automatic lantern/rest poses wake on a successfully accepted combat
action. Rejected casts and manually selected lantern poses remain intact.

## Authority and presentation

`cairn.inc.js` owns solo `rogueRun.cairn` or co-op `member.cairn`. B/C/V/E use
separate positive monotonic tags and host acceptance; rejected valid tags are
acknowledged. Guest overlays predict only pose/cooldown/phase. They cannot spend
owner plates, supply hit lists or execute contacts.

Capture/restore carries remaining clocks, startup/recovery, stone→grit,
Brace age/consumption, reserved/committed Ridge, delayed Aftershock and source
attack consumption. Host promotion rebases clocks without restarting the
`.28s` window or replaying a hit, heal, reward, emergence or refund. Travel
cancels old-world phases/entities and visible combo but preserves earned plates,
contact remainder/pending and paid cooldowns. Down cancels personal strike,
Brace, reservation and proc; an accepted finite stone or committed ward can
finish in its world, with no downed-owner passive/Brace/resource eligibility.
Class change/departure retires owned transients; a new run resets them.

`cairn-motion.mjs` reads accepted q and phase policy into existing cells only.
Reverse sweeps reverse arm-cell order while keeping accepted facing. Third
anticipation, stationary Brace and Ridge anticipation reuse original crouch
and squat poses; gardening markers and ladder/lantern/rest actions remain
native. Draw-only clocks interpolate between snapshots and hold anticipation
until authority changes phase. They never move the body or mutate combat.
Both256×256 sheets,32px cells, sixteen-color palette and anchor16,31 remain
byte-for-byte unchanged. Rattus's motion bank and Crown presentation stay separate.

## Live review

[`review.html?mode=cairn`](../../review.html?mode=cairn) selects an actual dry
continuous Ridge footprint, living plants, front/rear sentries, a real common
rat and floor ram. Normal AI, warnings, contact, support and clocks stay active.
It starts with zero Strata; earn plates using real B contacts or protected bites.
`&boons=1` enables the five retained class upgrades and their existing prerequisite.
Desktop, phone and landscape use normal game controls and isolated memory saves.

The read-only observation exposes bounded captured q, phase policy, placement,
body/support, real source serials/consumption and contact FX. It is not a
production debug API. Pure motion and review regression tests accompany the
authority/mode/browser tests; complete release gates belong to the character
coordinator before the next character begins.
