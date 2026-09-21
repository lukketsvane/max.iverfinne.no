# The twenty gardens

An attempt ends at the Hollow Crown in garden 20. Each garden has three finite
encounters. Clearing them grows an exit stalk; Down / Space / drag down at its
base advances the group. A naturally tall plant cannot skip a locked exit.
Defeating the final boss wins immediately. There is no garden 21 or saved run.

Time begins with Play, before planting, and carries through every garden and
transition. Boon choices freeze it; in-run Settings does not. Pressure is
`seconds / 150 + (garden - 1) × 0.22`. It increases movement and damage smoothly;
new encounters also use it for health and their fixed spawn budget. Fast kills
never extend an encounter. A later balance pass should use actual completion
times and failure points, especially in four-player runs.

## Platform routes and level variety

Each garden has two deterministic routes of real one-way platforms: jump up
through their undersides and land on top while descending. The soil remains a
separate surface for plants, ponds and rovers. The arrival area stays clear.
Six physical profiles repeat with harder dimensions through the twenty gardens:
stone terraces, forked boughs, root switchbacks, stone spires, broken bridges and
high canopies. They change direction, platform width, gaps and vertical spacing.

There are 8–12 platforms per garden. Later versions narrow to 14 native pixels,
add hops and widen gaps up to 14 pixels. An ascent never exceeds 20 pixels.
Every route is reachable by a walking Bulwark with no feathers; Runner and earned
jump upgrades give more freedom to cross or skip sections. Falling returns Max
to the existing garden below. Leaving an edge retains the normal coyote jump.

One route holds each player's reserved feather; the opposite route holds one
shared two-seed pickup. Reward perches sit at least 48 pixels above the soil.
These are optional time-versus-reward detours while the garden remains under
attack. Each new garden clears the previous route's uncollected seeds.

Platforms use integer pixels and the existing night-garden palette. Each co-op
client generates the same geometry without extra snapshot fields. Remote dodge
sweeps require continuous footing and stop at an unsupported gap. Gardening,
shrine activation, ground-rover refills and exit travel require dry soil footing.

## Denser encounters

With two active plants, the first garden's waves contain 6, 7 and 8 enemies
(previously 4, 5 and 6). A wave fixes its budget when it starts: later gardens,
more elapsed pressure and additional teammates increase it, up to 32 planned
spawns. Quick kills and waiting never add more enemies to the same wave.

The simultaneous raid limit starts at 5 enemies in solo, rises to 6 for that
garden's final wave, and reaches 9–10 late in the run. Four players can face up
to 13 simultaneous raiders. Shrine guards and the Crown's finite phase summons
are separate encounters. Six mixed formations follow the platform profile and
rotate by wave, approaching from both sides. Spawn intervals shorten with
pressure, with a short gap after every fourth reinforcement.

Caster and healer allowances count all living ordinary enemies, including
ambient pests and shrine guards. Solo/duo runs allow one healer; larger groups
allow two. Casters allow one before garden 7, then two, plus one for groups of
three or four. Healing moths cannot heal each other or the boss. Attack warnings
and the final Crown's three phases retain their existing timings.

## Starting classes

Choose a class and an independent cosmetic skin before Play. Duplicate classes
are allowed in co-op. The class lasts for that attempt; it never restricts the
Cultivator, Warden or Vanguard boon paths. The garden carries the health model:
Bulwark protects plants and Herbalist heals plants, without adding a Max health
bar or another action button.

| Class | Starting difference |
| --- | --- |
| Mech | Starts with the supplied watering rover, at its smallest native tier. |
| Runner | 25% faster movement, 20% stronger acceleration, higher jumps and 20% shorter dodge recovery. Feathers still improve jumps and unlock the second jump. |
| Bulwark | 15% slower movement; grounded, dry footing protects nearby plants from 30% of damage. Its dodge shoves and interrupts pests 50% more strongly, and it takes 45% less knockback. |
| Herbalist | 40% stronger active watering and healing. Tending also heals living neighbouring plants. It does not heal by standing idle. |

Bulwark's protection reaches 48 native pixels, with a 24-pixel vertical limit.
Several guards do not multiply the reduction. It covers bites, landed hazards
and plant damage from explosions, and combines with the team's Thorns boon.
Herbalist's healing splash reaches 34 native pixels. It adds 0.045 health on a
watering action, or 0.016 health per second while holding water, with no extra
score reward. Runner's jump launch speed is 15% greater, giving roughly 32%
more jump height before feather bonuses.

Companion rank 1 unlocks the basic rover; ranks 2 and 3 unlock the two larger
supplied robots. Mech begins at rank 1 and every other class begins at rank 0.
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
stage has one explorable feather per player, and shrine rewards are reserved
for each participating player. Swan feather clouds can also leave one pickup.
New runs clear all item and boon stacks. Pickups show a short world-space
message and three small milestone pips; there is no permanent inventory HUD.
On touch, return a jumping thumb down and make a fresh upward stroke to use the
second jump while maintaining steering. A continued stroke or jitter never
adds another jump, and returning the thumb does not plant or tend accidentally.

## Optional trials and passing events

Two shrines sit on opposite routes in each stage. Their native pickup icons show
the rewards: feather/dew, dew/ember, then ember/feather, repeating through the run.
The group can activate one trial per stage; the other shrine goes dark. A failed
attempt to pay does not lock either choice. This gives builds an earlier route
to their third item without doubling the available trial rewards.

Down in reach starts the chosen trial, with no movement automation or pause.
Small seed dots show the cost. Stay within the marked area for 10–14 seconds
and defeat its guards. Leaving the area stops trial progress but not the world
clock. Rewards are granted once per stage; tending remains available while the
trial runs. A tall plant can still be tended before its exit opens, including
during the final boss fight.

| Shrine | Cost | Reward |
| --- | --- | --- |
| Swan nest | 1 seed | Feather |
| Rain altar | 2 seeds | Dew pearl, water and healing for living plants |
| Ember cache | 3 seeds | Ember |

Trials also return seeds and boon XP. A garden gets one passing 14-second event:
bloom wind grows and heals, seedfall drops seeds, or a dry wind drains water.
The small particles and scenery carry these cues without a text overlay.

## Enemy roles

| First garden | Enemy | Interaction |
| --- | --- | --- |
| 2 | Seed thief | Telegraphs a theft, then escapes. Defeating it returns stolen seeds. |
| 3 | Spore caster | Lobs a delayed ground strike. Tap the moving spore to intercept it with a bomb; the cleared attack waters nearby plants. |
| 5 | Shield beetle | Its front shell blocks most damage. Dodge through or hit from behind. |
| 7 | Healing moth | A visible channel heals wounded allies. Interrupt it or prioritise the moth. |
| 20 | Hollow Crown | Three phases; root strikes and spores, then a cyan vulnerability window. |

The Crown summons a finite group at two-thirds and one-third health. Its strikes
give 1.4 seconds of warning; exposed hits deal double damage. It cannot be
frightened off-screen or permanently staggered. Root strikes can be jumped or
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

Actions carry the stage where they were issued. After travel, the host
acknowledges and discards older queued actions, so a delayed throw or planting
gesture cannot unexpectedly fire in the new garden. Legacy packets without a
stage remain accepted for clients that were already open before this update.

Class and skin selections are acknowledged through authenticated lobby channels
before the host can start. The host fixes each member's kit for the attempt;
later avatar input cannot change it. Snapshots carry each member's class, skin,
items and owned rover. Only the host changes garden health and rover water.

Successful garden travel clears held and queued local input as well as seeds
left in the previous, unreachable garden. This prevents accidental actions on
arrival and leaves snapshot space for seeds in the new garden. Classes, skins,
earned boons, run items and each rover's remaining water continue with the team.
