# Run design — current contract

This document describes the current run design. For implementation and infrastructure details, see `README.md` and `CLAUDE.md`.

## One shared run

Play always enters the shared live garden. There is no separate Solo/Together game mode.

A run supports up to four players. Players can join after it has started, and short PWA/background interruptions should reconnect rather than count as an intentional leave.

One character slot exists for each role:

- Mech — watering robot. Skill: dispatch the rover to the plant under attack.
- Moss — plant climbing. Skill: pounce, a landing slam that hits harder from higher.
- Bulwark — protection. Skill: brace, a wider and stronger guard that swallows warned roots.
- Herbalist — care/healing. Skill: bloom, a burst of care that revives the plant that fell most recently.

A skill is one tap on Max, or E. It has a cooldown that keeps running through boon choices and travel.

A character can be occupied by only one connected player. Taken characters are disabled in the join UI and reserved by the backend.

The first player starting an empty garden chooses Easy, Medium, Hard or Insane. That difficulty belongs to the shared run. Later players inherit it.

## Twenty gardens

An attempt begins in Garden 1 and ends at the Hollow Crown in Garden 20.

Each normal garden has three finite raids. Time pressure continues to rise throughout the attempt and is not reset by moving to a new garden. Clearing a garden unlocks the upward exit but does not create a permanent safe room; patrols continue.

The six route families are terraces, canopy, crossings, ruins, switchbacks and the final Crown layout. Platforms are one-way: jump through from below and land while descending.

Two elevated routes give reasons to leave the plants temporarily: feathers, optional pickups and shrine trials. Exploration is a time tradeoff because garden danger continues while players move through the route.

## Physical progression

Progression must feel like climbing out of a garden.

After a garden is cleared, a player must physically climb the exit plant to its top and cross into the next stage. Do not trigger travel by pressing Down at the base and do not teleport the ascender before the climb is completed.

Once one player has genuinely reached the next garden, the shared run advances and teammates can catch up automatically. This prevents a four-player run from waiting for every client to repeat the entire exit climb while preserving the important physical ascent.

A normal living plant cannot skip an uncleared garden.

## Moss

Moss can attach to ordinary living plants once they have reached at least 50% of their maximum physical height.

- Up / upward swipe near a valid plant attaches.
- Up again launches toward another stem.
- Contacting another valid stem in the air can catch it.
- Down descends.
- Dead or removed plants release the climber.
- Hazards can knock Moss off.
- A tap on a pest throws from an ordinary stem and keeps the grip. An exit climb never throws.
- A tap on Max pounces: a hop from the ground, or a dive from a stem or the air. The slam lands with up to double damage from 96 px or higher and never harms plants.
- Plant height and attachment geometry must be identical for host and guests.

Moss traversal does not itself unlock or advance a stage.

## No gameplay pause

The run is continuous.

- Settings do not pause.
- Boon choices do not pause.
- Other players do not wait for a teammate to finish choosing a boon.
- A backgrounded client may be suspended by the OS, but the shared run continues and authority can hand off.

Boon UI is an overlay on top of the running game.

## Difficulty

Easy is meant to be forgiving, not merely slightly below Medium. It reduces enemy damage, durability, density, wave size and the rate at which time pressure escalates, and gives a longer opening grace period.

Medium is the baseline. Hard and Insane add progressively more pressure.

Difficulty is fixed for the lifetime of a shared run.

## Enemy progression

Early gardens teach the basic flying pests and specialist counterplay. Later gardens add more complex roles rather than simply multiplying HP.

Specialists include:

- Seed thief — contests loose seeds.
- Spore caster — telegraphed projectiles that can be intercepted.
- Shield beetle — directional defence.
- Healing moth — supports other attackers.
- Thorn caster — telegraphed roots.
- Dew leech — drains plant moisture and sustains itself.
- Rammer — slow, clearly warned charge.

Milestone bosses:

| Garden | Boss |
| --- | --- |
| 5 | Mossback |
| 10 | Bellkeeper |
| 15 | Moon Moth |
| 20 | Hollow Crown |

Boss attacks need readable tells and real counterplay. Do not turn later difficulty into unavoidable damage.

## Rats

Rats are a later-game threat and should not dominate the opening.

Current intended first access:

- Easy: Garden 10 or roughly 9 minutes.
- Medium: Garden 8 or roughly 7 minutes.
- Hard: Garden 7 or roughly 6 minutes.
- Insane: Garden 6 or roughly 5 minutes.

Common rats appear first. Black, albino and plague variants stage in later. Rats were deliberately slowed and softened after playtesting; do not restore the original early high-damage tuning without explicit direction.

## Boons

Three broad paths remain: cultivation/care, defence/garden resilience and movement/combat.

Recent additions:

- Green Thumb — stronger tending.
- Wide Watering — tending reaches more neighbours.
- Barkskin — further plant damage reduction.
- Mulch — kills restore nearby plants.
- Long Stride — faster movement.
- Spring Step — higher jumps.

Mech-specific Companion and Rain Engine remain exclusive to Mech.

Every boon must affect actual simulation, not only UI text.

## Run pickups

Feathers, embers and dew are world pickups. Pickups must work for authoritative and guest clients.

They are run-scoped and do not become a permanent metagame inventory.

Loose seeds fund planting and optional interactions. A run's plant archive keeps the actual plants grown across stages for the final bouquet.

## Shared action authority

The host/authoritative client validates actions, but guest input must have parity:

- movement
- jumping/dodge
- bombs/defend
- pickups
- care/planting where geometrically valid
- shrine actions
- climbing where class and plant geometry allow

Network delay must not allow impossible movement through gaps or stale actions to fire after stage travel.

A brief disconnect reserves the player's membership. If the host becomes unavailable, another active member may take authority. Returning clients rebuild realtime channels.

## Results

The result is the player's actual garden, not a generic score screen. The complete plant records collected through the run are used to render the bouquet and saved run history.

Active attempts are intentionally not resumable from a page reload. Finished run records may persist.

## Audio

Music and effects are independent settings and can be muted separately. Boon/menu changes must not collapse them back into one global sound toggle.

## Mobile/PWA rule

The game must work in normal supported Safari/PWA conditions. Experimental WebKit feature flags can be useful for debugging, but they are never a production prerequisite.
