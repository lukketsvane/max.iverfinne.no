# The twenty gardens

An attempt ends at the Hollow Crown in garden 20. Each garden has three finite
encounters. Clearing them grows an exit stalk; Down / Space / drag down at its
base advances the group. A naturally tall plant cannot skip a locked exit.
Defeating the final boss wins immediately. There is no garden 21 or saved run.

Time begins with Play, before planting, and carries through every garden and
transition. Boon choices freeze it; in-run Settings does not. Pressure is
`seconds / 210 + (garden - 1) × 0.14`. It increases movement and damage smoothly;
new encounters also use it for health and their fixed spawn budget. Fast kills
never extend an encounter. A later balance pass should use actual completion
times and failure points, especially in four-player runs.

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
| 4 | Spore caster | Lobs a delayed ground strike. Tap the moving spore to intercept it with a bomb; the cleared attack waters nearby plants. |
| 7 | Shield beetle | Its front shell blocks most damage. Dodge through or hit from behind. |
| 10 | Healing moth | A visible channel heals wounded allies. Interrupt it or prioritise the moth. |
| 20 | Hollow Crown | Three phases; root strikes and spores, then a cyan vulnerability window. |

The Crown summons a finite group at two-thirds and one-third health. Its strikes
give 1.4 seconds of warning; exposed hits deal double damage. It cannot be
frightened off-screen or permanently staggered. Root strikes can be jumped or
dodged; spores can be cleared in flight. Keyboard B prioritises a nearby incoming
spore. Root strikes remain active, so interception cannot replace all dodging.
Its health lights sit on the crown itself.

Enemy graphics currently use native pixel primitives. The graphics lead's
separate handoff is tracked in GitHub issue #10: 16×16 enemy cells, 32×32 boss
cells, amber windup / cyan exposure. Keep the existing player scale and controls.
