# Max: Circuit engineer

Max sets up a garden defence: keep the plants alive to charge Circuit, slow
approaching pests with mist, and time planted bombs around their fixed fuse.
Dispatch provides care without using Circuit; Floodgate Overload spends a full
Circuit on one ring and a short period of targeted rover work. Max keeps his
existing Tide appearance, stationary bombs and watering robots.

Source: [MAX characters and game](https://app.notion.com/p/tingogtang/MAX-karakterar-og-spel-3ec1c6815f7881f08a79e6012e9b517b),
[Max proposal](https://app.notion.com/p/3ec1c6815f7881bf86b7d82292c8eb89).
This document describes the implemented runtime contract. The runtime and
saved character ID stays `mech`; the displayed character name is Max. The
Notion proposal's remote status has not been changed by this implementation.

## Abilities

`D` denotes base damage before the existing player level, difficulty, exposure
and enemy durability rules. Distances are game pixels. Mist and Overload use
real contacts and line of sight; gardening retains its separate Tend action.

| Ability | Runtime behavior |
| --- | --- |
| Circuit | 0–3 charges. Actual positive care of a living plant by Max or his water rover earns one charge. A Max primary bomb can also earn one charge by genuinely interrupting a pest threatening a living plant within 48 px. Care and defence share one 4 s reward gate; each bomb can reward at most once. Full plants, misses, cosmetic spray, passive recovery, mist and Overload care earn none. |
| Planted bomb | Preserve the existing charge, damage, cooldown and two active bomb slots. Moving during charge is allowed. The bomb stays where it lands, retains its complete 2 s fuse on enemy contact, and falls vertically when placed in air. Mist and Overload never accelerate the fuse. |
| Irrigation fan | C, 6 s cooldown, costs one Circuit. After .16 s windup, three .25 D pulses over .45 s cover a forward 56 px cone. Confirmed contacts become Wet. At most one eligible living plant gains exactly .04 moisture, funded by exactly .04 from one owned available water rover. Recovery lasts .2 s; recoil moves at most 6 px backward through legal terrain. |
| Rover dispatch / recall | V, independent 8 s cooldown, no Circuit cost. Select a legal reachable useful plant within 96 px of Max. One water rover reserves the existing .25 water budget, walks to the plant, fills its moisture and performs its existing 3 s healing pour and arrival protection. If no ready legal job exists, recall one rover on foot; canceling a pending delivery refunds its reserved water once. |
| Floodgate Overload | E, 18 s cooldown, costs three Circuit. Remain planted for a .4 s warning, then emit one 64 px ring for 2.4 D, a .3 s light stagger on ordinary susceptible pests, and Wet. For the next 4 s, water rovers prioritize reachable threatened plants inside the cast ring using their remaining water. It adds no seeds, free water, turret damage or invulnerability. |

Wet is an enemy combat status separate from the player's wet environment
state. It slows movement by 25% for 2 s and grants one ×1.25 damage bonus to the
next actual Max primary blast; that blast consumes Wet. Skills, Guard bot zaps,
raw unrelated blasts and passive effects do not consume its primary bonus.
Bosses keep their movement and interruption resistance.

High Tide uses the living motherplant's nearby stem route point for fan reach,
and genuine primary interruptions of sap attacks or mother-draining Moon Moth
channels can earn Circuit through the same shared reward gate.

The fan chooses the nearest living, visible plant in its cone that can accept
all .04 moisture. A plant above .96 moisture is ineligible. It debits one of
Max's own water rovers with sufficient reserve; dry, packed or actively
refilling rovers and the separate Guard bot cannot fund it. There is no spray
water when no eligible reserve exists. Ordinary rover flow debits its actual
positive moisture increase. Dispatch deliberately preserves the existing
prepaid .25 delivery contract rather than changing its watering economy.

Dispatch reach remains 96 px at every robot tier. Reachability checks the
actual rover path, water gaps and solid terrain. A remote owner cannot pull an
active job or recall across a gap by teleporting the rover. Normal float/climb
transport cancels and packs the rover once. Hidden packed equipment follows
the actual carrier and unpacks on nearby reachable dry soil, using the
owner's bank if the trailing position lies across a gap. Explicit garden
transitions retain the existing relocation behavior. Overload priority is bounded to the original
ring and expires after 4 s, without granting a new reserve or changing a
pending paid job into a second delivery.

## Controls

| Action | Keyboard | Touch | Standard controller | Horizontal single controller |
| --- | --- | --- | --- | --- |
| Bomb | B | Tap a threat | Existing attack input | Existing attack input |
| Irrigation fan | C | — | View/minus, button 8 | View/minus, button 8 |
| Dispatch / recall | V | — | Left trigger, button 6 | Stick click, button 10 |
| Overload | E | Tap Max | Left shoulder, button 4 | Top face button, button 3 |
| Dodge | X | Quick horizontal flick | Stick click, button 10/11 | Left shoulder, button 4 |
| Tend / plant / harvest | Space or ↓ | Drag down | Existing Tend input | Existing Tend input |
| Refill | R | Tap a nearby rover | Hold Tend + press Fan (button 8) | Hold Tend + press Fan (button 8) |
| Lantern | L | — | Home (16), or hold Tend + Rover (6) | Home (16), or hold Tend + Rover (10) |

Gameplay has no on-screen action buttons. Fan, dispatch/recall and lantern
require keyboard or controller input. Touch keeps movement, tending, attack,
Overload, dodge and refill through the canvas. Threat taps retain their ordinary
priority, including a threat overlapping the character; exit climbing keeps
its normal boost interaction.

Any nearby teammate can refill a rover while grounded and still on soil.
The controller refill and lantern chords suppress garden action while held
and leave ordinary Fan/Rover input unchanged. The lantern chord is also
available when Home is reserved by the device. Refill lasts 2 s and pauses if the actual
refiller moves away, leaves the soil
or leaves the party. The job retains that teammate's identity across snapshots
and host promotion; a missing refiller is not silently replaced by the owner.

## Existing build directions

Every current boon remains available with its existing ranks, prerequisites
and mode restrictions. The free starter robot remains distinct from a chosen
upgrade. No new boon is required to play the four base actions.

| Direction | Runtime IDs | Preserved progression |
| --- | --- | --- |
| Water robots | `robot`, `fleet`, `recycle` | Companion has four ranks of capacity, speed, rate and art. Robot crew adds up to two water rovers after Companion 2. Rain engine needs Companion 3 and Seed rain 1 and refills owned robots on harvest. |
| Guard bot | `sentry` | After Companion 2, add a separate defensive robot; its three ranks strengthen existing zaps. It is not a water rover and cannot dispatch, recall or fund mist irrigation. |
| Bombs | `blast`, `cadence`, `chain`, `wild`, `glue` | Big blast, Quick hands, Chain bloom, Wild spark and Sap burst preserve their existing primary blast effects. Chain bloom still needs Big blast 2 and Quick hands 1. Wild spark and Sap burst retain three ranks and their existing restrictions to Max and Sligo. |
| Shared gardening and movement | Existing common IDs | Tending, harvesting, growth, plant defence and movement keep their current choices and prerequisites. Tender care still improves the dispatch healing pour. |

Boon damage, blast chains, critical sparks, burning and plant effects retain
their normal owner and run scaling. Their secondary procs do not create extra
Circuit rewards. Guard bot remains the existing separately purchased damage
upgrade; the new water-rover priority action does not turn a water rover into
an autonomous attacker.

## Shared simulation

`mech.inc.js` owns each member's `engineer` state: charge, shared reward gate,
independent fan/utility/special cooldowns, remaining fan pulses, consumed mist
water, Overload windup and bounded priority. The host accepts resource costs,
contacts, irrigation debits and cooldowns. Guests send tagged normal action
requests and display prediction without spending authoritative Circuit or
water. Duplicate, old-world and invalid requests cannot repeat a cast or debit.

Rovers keep stable owner/slot identity, target plant ID, refiller ID and actual
remaining dispatch/pour/refill phase in the regular snapshot. Handoff binds a
job to the current shared plant with that ID; another plant at the same X is
not a replacement. Promotion continues remaining pulses, ring warnings,
water jobs and cooldowns without repeating an accepted effect or refund.

A paused, downed or illegal actor cannot cast. Fan and Overload lock other new
casts during their active phases; Overload also rejects an active dodge.
Overload's planted warning blocks movement,
jump, dodge, attacks and Tend without granting protection. Losing grounded,
free footing through air, ladders, climbing, water or a downed state cancels
unfinished Fan or Overload. Garden travel also cancels an accepted pending
cast; every cancellation preserves its paid cost and remaining cooldown.
Ordinary bomb, soil, seal and guardian interactions retain
their existing handlers.

## Appearance and review

The Tide player sheets and every selected companion PNG remain byte for byte
unchanged. Existing atlas cells, native dimensions, palette, foot anchors,
integer registration and disabled smoothing remain binding. Casts use the
existing native poses with separate mist, charge and ring effects; the player
body is never recoloured, enlarged or replaced. Companion source provenance
remains in [the selected watering robot review](../asset-review/watering-robot/selection.md).

Connected Figma accounts required reauthentication during this October 3 pass;
there is no fresh remote synchronization claim or new art export. Future art
work must follow [the Figma runtime contract](../figma.md).

`review.html?mode=mech&portrait=1` provides the unupgraded kit, two damaged
wettable plants, close trial keepers with real warned attacks, and a real pest
threatening a plant. Circuit begins empty and must be earned through actual
care or defence. `&boons=1` enables the preserved rover, Guard bot and bomb
branches for comparison. Fixtures store their saves only in memory.

Review buttons send normal B/C/V/E/X inputs. The observation panel and
`#status`'s `data-guardian` expose owner engineer state, rover reserves and jobs,
Wet targets, plants, bombs and effects without awarding resources or advancing
combat. Release checks cover conserved water, blocked paths, refill identity,
host/guest commands, duplicate tags, travel and authority handoff, then the
real touch and keyboard inputs at desktop and phone sizes.
