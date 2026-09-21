# The twenty gardens

An attempt ends at the Hollow Crown in garden 20. Each garden has three finite
raids. Clearing them grows an exit stalk; Down / Space / drag down at its base
commits to advancing the group. A naturally tall plant cannot skip a locked exit. Gardens
5, 10 and 15 have their own boss in the third raid; only defeating the final
Hollow Crown wins immediately. There is no garden 21 or resumable saved run.

Time begins when Solo or the co-op run starts, before planting, and carries
through every garden and transition. Boon choices freeze it; in-run Settings
does not. Ordinary Moss climbing remains active combat. The brief explicit exit
animation commits to upward travel: Down cannot reverse it and jumping cannot
cancel it, preventing a protected camping loop. Travel never resets the clock.

Movement and encounter pressure use `seconds / 150 + (garden - 1) × 0.14`.
Time also applies superlinear resistance and damage to enemies already alive:

```text
threat = (1 + seconds / 180)^1.7
durability = 1 + 0.65 × (threat - 1)
damage = (1 + (garden - 1) × 0.14 × 0.065) × (1 + 0.45 × (threat - 1))
```

Direct hits and ember burn are divided by durability. This preserves existing
damage and boss phases; it does not refill enemy HP. Neither damage nor
durability has a time ceiling. Ordinary damage stagger develops a refractory
period, so rapid bombs cannot permanently stun late enemies. Deliberate dodge,
lantern, marked-dive and healing-channel counters remain available.

| Elapsed time in garden 1, solo | Effective durability | Damage | Cleared-garden patrol cap | First-wave concurrency | First-wave budget |
| --- | --- | --- | --- | --- | --- |
| 0 minutes | 1× | 1× | 4 | 5 | 7 |
| 5 minutes | 3.79× | 2.93× | 10 | 10 | 13 |
| 10 minutes | 8.21× | 5.99× | 17 | 15 | 20 |
| 20 minutes | 21.09× | 14.91× | 24 | 24 | 33 |

Raids alternate sides and mix roles by layout, stage, wave and elapsed time.
Each wave has a finite budget, capped at 36; fast kills never extend that wave.
Clearing it does not create a safe waiting room. Mixed patrols continue after
all three waves, with a spawn interval falling from seven seconds initially to
about 0.57 seconds at ten minutes and 0.24 seconds at twenty. Waiting before
planting accumulates reward-free predators that immediately attack a new
seedling. All enemy sources share a 24-active limit; hazards cap at 32. Larger
teams raise encounter density within those limits. Human completion times and
failure points remain useful for subsequent tuning, especially in four-player runs.

## Platform routes

The twenty gardens use six layout themes. Terraces, canopy, crossings, ruins
and switchbacks repeat with different widths and route rhythms; garden 20 uses
the Crown layout. `stage-layout.js` creates two elevated routes per garden from
the same deterministic geometry for host and guests. Selected hops have gaps
that require jumping, and later versions narrow their shelves while keeping
the core route reachable without upgrades.

Ledges have one-way collision. Jump through from below and land while falling;
landing resets the available air jump. Walking beyond a lip releases support
and falls back toward another ledge or the soil. A dry platform above a pond
does not count as standing in water. Existing jump, movement and dodge controls
remain in use, with no separate platform action.

The core routes reach shrine trials and feather pickups with every class's
starting jump. Higher optional perches reward improved mobility. From garden 3,
one bonus perch offers a reserved ember or dew pickup for each player. The
opposite core route also offers a once-only two-seed planting reserve. Magnet
reach is radial, so it cannot pull a high reward down from outside its radius.
Planting
and tending remain on ground soil, while trials can be activated on their
actual ledges. Exploring above the garden costs time spent away from its crops.

## Classes and their special abilities

Choose a class and an independent cosmetic skin before starting Solo or
Together. Duplicate classes are allowed in co-op. The class lasts for that
attempt. Cultivator, Warden and Vanguard upgrades remain shared except for the
Mech-only Companion and Rain engine choices. The garden carries the health model:
Bulwark protects plants and Herbalist heals plants, without adding a Max health
bar or another action button.

| Class | Signature ability and starting kit |
| --- | --- |
| Mech | Exclusive robot ownership, starting with the supplied watering rover at its smallest native tier. |
| Moss | Exclusive living-plant climbing and plant-to-plant jumps, including immature plants. Also has 25% faster movement, 20% stronger acceleration, higher jumps and 20% shorter dodge recovery. |
| Bulwark | 15% slower movement; grounded, dry footing protects nearby plants from 30% of damage. Its dodge shoves and interrupts pests 50% more strongly, and it takes 45% less knockback. |
| Herbalist | 40% stronger active watering and healing. Tending also heals living neighbouring plants. It does not heal by standing idle. |

Bulwark's protection reaches 48 native pixels, with a 24-pixel vertical limit.
Several guards do not multiply the reduction. It covers bites, landed hazards
and plant damage from explosions, and combines with the team's Thorns boon.
Herbalist's healing splash reaches 34 native pixels. It adds 0.045 health on a
watering action, or 0.016 health per second while holding water, with no extra
score reward. Moss's jump launch speed is 15% greater, giving roughly 32%
more jump height before feather bonuses.

Moss uses Up or an upward swipe beside a living plant to attach. Another Up
leaps in the steering direction; contacting another stem in the air catches it.
Down descends. The climb stops at the plant's actual current tip and extends as
it grows. The physical height cap is 128 native pixels on every viewport, so
host and guest validate the same geometry. Dead or missing plants release the
climber, while shared snapshots rebind a living attachment by plant ID. Hazards
can knock Moss off. Ordinary traversal never creates sky seeds or triggers
travel; explicit Down at a cleared exit commits to departure for any class.

Moss retains the canonical `runner` class ID for existing selections; `moss`
is an accepted alias. Costume and class remain independent. A Moss appearance
on another class does not grant climbing.

Only Mech can own a rover, beginning at Companion rank 1. Ranks 2 and 3 unlock
the two larger supplied robots. Other classes cannot receive a rover from
boons, old perks, offered choices or incoming snapshots.
Rain engine requires rank 3 and a Seed rain boon. Every rover has its own finite
water tank, follows its owner and uses that owner's Companion ranks. A teammate
can refill it by standing nearby for two seconds. Rovers do not award passive
XP, heal plants or create instant growth. Their water survives garden travel.

A retry retains the selected class and skin but resets all acquired items,
boons, cooldowns and rover water to that class's starting kit. Completed garden
records can be viewed later; an unfinished attempt cannot be resumed.

## Stackable pickups

| Pickup | Each stack | Three stacks |
| --- | --- | --- |
| Swan feather | Higher jump, with diminishing returns | One midair jump, reset on landing |
| Ember | +12% bomb damage | Hits also burn for 1.6 seconds |
| Dew pearl | +8% care strength | A dodge waters and lightly heals nearby plants |

Each Max owns their collected items. Garden seeds and boon XP are shared. Each
stage has one explorable feather per player on an elevated route, and shrine
rewards are reserved for each participating player. Swan feather clouds can
also leave one pickup. Loose seed pickups fund planting and trials; collecting
them does not award boon XP. Defeating enemies, clearing raids, harvesting,
plant growth milestones and completing trials award XP.
New runs clear all item and boon stacks. Pickups show a short world-space
message and three small milestone pips; there is no permanent inventory HUD.
On touch, return a jumping thumb down and make a fresh upward stroke to use the
second jump while maintaining steering. A continued stroke or jitter never
adds another jump, and returning the thumb does not plant or tend accidentally.

## Optional trials and passing events

Two shrines sit on opposite platform routes in each stage. Their native pickup
icons show the rewards: feather/dew, dew/ember, then ember/feather, repeating
through the run.
The group can activate one trial per stage; the other shrine goes dark. A failed
attempt to pay does not lock either choice. This gives builds an earlier route
to their third item without doubling the available trial rewards.

Down in reach starts the chosen trial, with no movement automation or pause.
Small seed dots show the cost. Stay within the marked area for 10–14 seconds
and defeat its guards. Leaving the area horizontally or vertically stops trial
progress but not the world clock. Guards spawn around the shrine's actual
height and respect the active-enemy limit. Rewards are granted once per stage;
ground-level tending remains available while the trial runs. A tall plant can
still be tended before its exit opens, including during the final boss fight.

| Shrine | Cost | Reward |
| --- | --- | --- |
| Swan nest | 1 seed | Feather |
| Rain altar | 2 seeds | Dew pearl, water and healing for living plants |
| Ember cache | 3 seeds | Ember |

Trials also return seeds and boon XP. A garden gets one passing 14-second event:
bloom wind grows and heals, seedfall drops seeds, or a dry wind drains water.
The small particles and scenery carry these cues without a text overlay.

## Enemy roles

| First garden without waiting | Enemy | Interaction |
| --- | --- | --- |
| 2 | Seed thief | Telegraphs a theft, then escapes. Defeating it returns stolen seeds. |
| 3 | Spore caster | Lobs a delayed strike. Tap the moving spore to intercept it with a bomb; the cleared attack waters nearby plants. |
| 4 | Shield beetle | Its front shell blocks most damage. Dodge through or hit from behind. |
| 6 | Healing moth | A visible channel heals wounded allies. Interrupt it or prioritise the moth. |

Elapsed time unlocks specialists even when remaining in garden 1. Later patrols
mix all seven ordinary enemy roles; the initial garden is not a permanent
low-tier encounter.

Fast pests gain marked dive attacks from garden 2; scouts can use them earlier.
The dive aims at a player's height, including a platform, and can be interrupted.
From garden 8, caster volleys in canopy, crossing, switchback and Crown layouts
can target an elevated player as well as a plant. Keep moving through the route
and intercept projectiles rather than treating height as permanent safety.

## Four milestone bosses

| Garden | Boss | Attack and counterplay |
| --- | --- | --- |
| 5 | Mossback | Root markers announce a ground charge. Jump clear or take a higher route, then attack its exposed recovery. |
| 10 | Bellkeeper | Alternates spore patterns with roots targeted at players, including their platform height. Intercept the spores and leave marked strikes. |
| 15 | Moon Moth | Mixes spores and marked gusts with a channel that restores a wounded ally. Interrupting the channel opens a vulnerability window. |
| 20 | Hollow Crown | Three phases combine roots, spores and summoned guards; defeat it to win the attempt. |

Each boss gains phases and finite reinforcements as its health drops. The first
three bosses remain part of their raid: their defeat does not skip surviving
guards or end the run. Amber windup and cyan exposure communicate when to evade
and when to attack. Exposed hits deal double damage.

The Crown summons a finite group at two-thirds and one-third health. Its strikes
give 1.4 seconds of warning. It cannot be frightened off-screen or permanently
staggered. Root strikes can be jumped or
dodged; spores can be cleared in flight. Keyboard B prioritises a nearby incoming
spore. Root strikes remain active, so interception cannot replace all dodging.
Its health lights sit on the crown itself.

Enemy graphics use the supplied native atlas: 16×16 enemy cells and 32×32 boss
cells, with amber windup and cyan exposure. Defeat animations are visual only
and do not postpone damage, rewards or victory. Keep the existing player scale
and controls.

## Co-op timing

Guest rolls move locally. The host checks the segment between accepted movement
updates, limited to one roll's distance and a short allowance for packet timing.
Each teammate can interrupt a given pest once per roll, even when multiple
players overlap. Jumping, input cancellation, a boon choice or stage travel
closes that window.
The host samples continuous footing along a roll, so a delayed packet cannot
sweep through a gap or project an elevated attack onto the soil below it.

Actions carry the stage where they were issued. After travel, the host
acknowledges and discards older queued actions, so a delayed throw or planting
gesture cannot unexpectedly fire in the new garden. Legacy packets without a
stage remain accepted for clients that were already open before this update.

Class and skin selections are acknowledged through authenticated lobby channels
before the host can start. The host fixes each member's kit for the attempt;
later avatar input cannot change it. Snapshots carry each member's class, skin,
items and owned rover. Only the host changes garden health and rover water.
The host rejects non-Moss climbing avatars and checks living-stem reach. Both
host boon processing and snapshot restoration reject robot perks and rovers
for a non-Mech member. Another teammate may still refill Mech's robot.

The host validates a teammate's platform footing at the stage's actual ledge
height. Dodges and shrine interactions use that support; elevated growth
requests cannot plant in midair or tend soil from an upper route.

Successful garden travel clears held and queued local input as well as seeds
left in the previous, unreachable garden. This prevents accidental actions on
arrival and leaves snapshot space for seeds in the new garden. Classes, skins,
earned boons, run items and each rover's remaining water continue with the team.
