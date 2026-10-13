# Secrets, easter eggs and special nights

`secrets.inc.js` is injected into the game closure at `/* MAX_SECRETS */`. Everything here is rare, seeded, never pauses the garden and never takes a finger away from the one-thumb controls. Tests: [historical secrets.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/secrets.test.cjs).

Rules:

- A garden's night is rolled once, by the host, from `rogueRun.seed` (or a hash of the run's record id and start time) and the garden number. Guests receive it in `coopCapture().secrets` and never roll their own.
- The banner that shows the garden number on arrival adds one word for a special night.
- Balance effects are small, and device-date decorations have none.
- Secret rewards are exact gifts: the spot, hedgehog, wish and golden-plant seeds skip the class seed rate, like returned seeds, so a Mech or Bulwark team still gets what the find promises.
- Everything is drawn in native pixels from the muted night palette: no additive glow and no gradients.

## Special nights

About half of opening gardens have fireflies, drizzle or a chorus. Later gardens also roll the established moon, meteor, fog and winter aurora variants. Underground scenery remains underground.

| Night | Word | What happens |
| --- | --- | --- |
| Full moon | MOON | A brighter moon, twice the fireflies, moths circle Max's lit lamp. Decoration only. |
| Meteor shower | METEORS | Streaks cross the upper sky all night, and the night always carries a wishing star. |
| Fog | FOG | Low drifting banks hide pests near the ground; the damp keeps every garden plant at 30% water or more. Never in a milestone-boss garden. |
| Aurora | AURORA | Green and violet curtains ripple above the mountains. Only in the snow gardens 11-15, about one in three. Decoration only. |
| Dawn chorus | CHORUS | Up to nine blue tits gather and sing, often for the first 30 s and now and then after. Decoration only. |
| Firefly gathering | FIREFLIES | Eighteen native fireflies and a longer twinkle at the hidden ground gift. |
| Drizzle | DRIZZLE | Slowly restores dry living plants toward 45% water. |

## Shooting star

About one garden in four, and on every meteor night, a wishing star begins between 14 and 38 seconds. A tap within 2.2 seconds gives the team three exact seeds or one boon, seeded half and half. The tap throws nothing; the host allows 0.8 seconds for a guest's round trip. Existing cavern rendering still governs sky presentation.

## Hidden things

| Secret | How to find it | What it gives |
| --- | --- | --- |
| Golden plant | About one garden plant in 120 grows golden, seeded by the run and the plant's id, and sparkles. | Each harvest drops two extra seeds and rings a chime. |
| Secret spot | One patch of ground per garden, 70-200 px from where the team arrives, twinkles faintly every few seconds. Stand still on it for 3 s. | A swirl of fireflies and two seeds, once per garden. |
| Hedgehog | In about half of gardens, 18–48 seconds in, a hedgehog settles under a grown plant for 20 seconds. Keep that plant at 30% water or more. | Two seeds when it trundles off. A dry or fallen plant sends it away with nothing. |
| Owl | Play between 03:00 and 03:59 on the device clock. | A soft hoot-hoo and two amber eyes in the dark, about once a minute. Local to each player. |

## Device-date decorations (local, never balance)

| Date | Decoration |
| --- | --- |
| 24-26 December | Gentle snowfall and a twinkling star on the exit plant, or on the tallest plant before the garden is cleared. |
| 31 October | Two jack-o'-lanterns (the existing pumpkin art) flank the landing spot. |
| 23 June | A sankthans bonfire with rising sparks beside the landing spot. |
| 17 May | A tiny Norwegian flag on every grown garden plant, up to twelve. |

## Easter eggs

| Egg | How | What |
| --- | --- | --- |
| Moonlit Max | Tap the MAX title seven times, each within 1.5 s of the last. | A rising chime and a lavender tint on your own Max for the session. Seven more taps take it off. The menu sends a `max-logo-tap` window event; other players see Max as usual. |

## Wonders

The host rolls wonders from the run seed. Every non-milestone garden has a puzzle; Garden 1 always has a chance encounter and later eligible gardens have a 75% chance. Twelve seconds after resolving the first encounter, a different second encounter appears if no guardian is active. A seeded deck varies the sequence across gardens and runs. The catalogue now has 30 discoveries; the collection reads its actual size. Authored puzzle spots restrict the roll to puzzles that work on their standing surface.

| Kind | Wonders | How |
| --- | --- | --- |
| Puzzles | Firefly order, Twin plates, High lantern, Cracked stone, Rune plot, Buried relic, Three stars, Bell stones, Echo stone | Stand on the stones in the order they blink; step on one plate, then the other within 4 s; stand 2 s at the lantern on the highest ledge; bomb the crack; grow a plant on the rune; stand still 3 s on the mound; stand at the tablet and tap its three stars within 10 s; bomb all three bells within 12 s; land three jumps on the drum stone within 5 s of each other. |
| Seed offering | A small tablet showing its two-seed cost | Stand still for 2.5 seconds with two seeds. Pays one personal ember to each current teammate, once. |
| Lantern pact | A dark lantern | Hold a real lit lamp beside it while standing still for 2.5 seconds. Pays two exact seeds and one personal dew to each teammate, once. |
| Hidden spring | A little well | Stand still for two seconds. Restores nearby living plants' water, a little health, one exact seed and one seeded personal item for each teammate. |
| Cache keepers | A cache with a nearby challenge cue | Stand still for 1.5 seconds to opt in. Two pests enter after separate 1.35-second exact-position warnings on valid nearby footing. Defeat both within 45 seconds for two exact seeds and one seeded personal item per teammate. Escape, disappearance or expiry grants no challenge reward. It never locks the guardian. |
| Ultra-rare | Moon well (1 in 50), Crown relic (1 in 80), Four-leaf clover (1 in 120) | Stand at the well 3 s, dig the crown 4 s, or tap the clover. They pay levels. |
| Existing chance encounters | Trader rover, Lost fledgling, Hurt bee, Rival gardener, Sleeping beetle, Riddle statue, Storm flock, Broken robot | Stand by the rover with 3 seeds to trade them for a level; walk the fledgling to its nest; tend the bee 2 s so it lifts nearby plants; beat the ghost to its flag; sneak (walk, never run or bomb) to the mound behind the beetle, or it wakes with two elites; answer the statue by bombing, planting or standing still as its glyph shows; the flock drops seeds; stand 3 s to fix the robot and it waters every plant. |
| Special gardens (35% of eligible gardens 2–18, guaranteed at authored door spots) | Secret garden, Seed vault, Moonlit meadow, Root cavern, Boss-rush door | A door hides on a high ledge. Stand in it 1.5 s and the next garden becomes that level for one garden: seeds on every ledge and plants that stay moist; free guarded caches and loot on every ledge; a moon night with a new shooting star after every wish; darkness around Max, roots striking plants every 10 s and dew on every ledge; or the next milestone boss at once, worth two levels. The boss door only opens two or three gardens before a boss. |

## Garden events

Two different seeded events per garden start at 18–27 seconds and 58–85 seconds, each lasting 14 seconds. Seedfall gives three seeds per current player; bloom restores a little health and growth; drizzle adds bounded water; dewfall drops one owner-reserved dew per player; forage adds up to three hidden two-seed caches at existing reachable route rewards. Drought appears only from Garden 4 outside Easy. The host owns the event clock, round and payouts; handoff cannot restart an already paid shower. These are campaign events, not new Last Seed, High Tide or Night Relay rules.

## The old shovel

A Bulwark playing solo finds an old shovel lying in one garden per run (35% of gardens from 2 on, always by garden 12). Walk over it to take it. From then on the class skill digs in when there is no parry to make: Max drops under the soil, moves through a tunnel that stays dug for the garden, and finds two buried caches of three seeds each. Jump or press the skill again to erupt, hitting every pest above for 2. Swans you do not blast in a garden bring 2 seeds each (up to three swans) when the garden is cleared.
