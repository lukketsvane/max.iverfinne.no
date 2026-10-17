# Retired campaign layouts

Historical descriptions preserved from before the owner's 17 October 2026 map reset. These layouts, references and generated guardian-site arrangements are not shipped in the ordinary campaign. The current map authority is MASTER `1433:22060`; see `assets/master-source-v1/README.md`.

## Earlier garden designs

Generated gardens also have a **place** of their own to explore beside their routes (`garden-places.js`): a Shepherd Hut, a Hollow Oak, a Broken Aqueduct, a Sunken Chapel, a Root Stair, Cairn Terraces, Lantern Roots, a Silo Stair, a Collapsed Tower, a Bell Cellar, an Old Quarry, Weeping Roots, Twin Shafts, a Catacomb, Fault Steps, a Giant's Stair, a Reactor Nest, the Last Sluice, a Surface Breach and Crown Containment. Each has rooms, climbs and a false wall; one seed cache is out in the open and one is hidden behind the false wall. The run seed only picks its side and footing. A walking Erasmus Berg reaches both caches, can always get back out, and can cross the place in both directions.

Routes now look like their family: mossy cobble for terraces and crossings, ashlar ruins with broken pillars, leafy canopy branches and hanging roots on switchbacks. The frost gardens (11–15) wear snow and the ember gardens (16–19) ember moss. Each route side can grow a **bounce bloom**: jump or drop onto it and it springs Max through the ledge above, a shortcut up the route. Ledges also pay in a fight: a bomb thrown from high ground (20 px or more above the soil) hits harder, up to 35% from two ledges up. Hand-made gardens (the Seed Vault, the Railway Ruins and gardens drawn in Figma) now use their marked spots: a secret cache that only shows itself up close, cracked soil you blast open for seeds, a wonder puzzle on their puzzle spot, and a secret-garden gate at their door.

There are 20 gardens with six route families: terraces, canopy, crossings, ruins, switchbacks and the final Crown layout. Every run rolls a shared seed. A selected live MASTER row supplies authored geometry; gardens without one retain their picture or seeded layout, and the Crown stays authored. The current MASTER replacement is Garden 1. Garden 4 now uses the requested Pixel Mill turtle source; the other eighteen gardens retain their existing designs. One-way platforms let players jump through from below and land on top. Elevated routes contain exploration rewards and shrine trials.

The run begins underground and climbs toward the surface. Gardens 1–17 remain completely underground, through buried works and underworld faults. Gardens 18–19 offer the first glimpses of daylight through breaches high in the cave roof. Garden 20 emerges into a radioactive hellscape at sunrise, where the Hollow Crown waits. Outdoor sky, moon, clouds and exit-cloud effects cannot appear in the earlier gardens, including while backdrop images load. Garden 1 is the **Hollow Tree**, compiled from the actual MASTER Level 01: a native tree chamber with a pond, timber ledges, ladders, lanterns and a lower root passage. Its planting court and passage are real collision geometry. The historical **Seed Vault** picture remains preserved: glass tanks of plants, a great wheel of seed jars, an ice bridge over a frozen pool, and ladders up three floors to a lit door. Garden 2 remains the **Railway Ruins**, built at Max's scale from the owner's railway scene and kit sheets: a mill with its wheel and a wooden pier to the west, the station, viaduct and lift tower in the middle, and stone ruins and mossy floating islands to the east. Climb the vine off the viaduct or the lift tower to its roof beam.

Hollow Tree also has an optional canopy crossing joining its two upper terraces, two side nooks and three additional hidden seed caches. These use the existing native branch renderer and leave the registered Figma surfaces intact. Portrait framing stays inside the chamber above the upper route, preserving safe-area clearance during jumps.

Twenty campaign profiles give each garden a distinct traversal rhythm. Seeded sides pair a broad preparation route with a higher exploration route, using galleries, promenades, crossings and rest terraces. Both required paths remain reachable by an unupgraded walking Erasmus Berg. Upper districts pace shorter early climbs before the later, longer routes, with broad completion landings and differently shaped seed-cache branches. The physical exit climb, continuous threat clock and shared seed remain unchanged.

[The level design stack](../../docs/design/levels-overview/) pairs a unique full-scene reference for each of the twenty levels with its playable preview. Its Figma importer places one image frame in each level's ASSETS or an aligned reference column, and can create a separate vertical comparison stack. Generated references guide native authoring; the actual game keeps its verified source artwork and collision geometry.

Gardens 3–19 build enclosing chambers around their actual routes and upper districts, with Garden 4 using its native turtle shell. Broken masonry arches, textured piers, lamp recesses and attached side rooms connect the climb to the ground. Each garden has a large world-space landmark: buried aqueducts, mycelium, a frozen seed wheel, rib vaults, shafts and ruined machinery. Room surfaces carry chipped stone, bark, lichen, frost or rusty pipework. The architecture follows the rolled geometry without adding collision surfaces; all native source images retain their original size. See [campaign chambers](../../docs/design/campaign-chambers.md) and [the complete vertical stack](../../review/crown-ascent/).

Garden 4 is **Mossback Sanctuary**: a giant mossy turtle with dry shell galleries, a lower pool chamber, root ladders and a route over its crown toward the head. Three shrine destinations lead back to one safe planting court. A nearby planting cue teaches the first seed without revealing the distant shrine; discovered shrines point toward the actual court. The visible pool is scenery; the lower floor and return ladder use real collision. [The Pixel Mill source, editable project and local Figma import kit](../../docs/design/turtle-level-04/) are preserved with the original reference. The native rectangle renderer keeps 1:1 registration and leaves the verified Figma PNG masters unchanged.

Gardens 3, 5, 7, 8, 9, 10, 12, 13, 15, 17, 18 and 19 are now scene rooms (Frozen Seed Wheel, Railway Depot, Living Root Vault, Magnetworks, Mycelium Sanctuary, Giant Beaked Fossil, Bellflower Marsh, Night Watermill, Corvid Aqueduct, Salt Cistern Terraces, Heliostat Greenhouse, Twin Gondola Ravine): the owner's Figma foreground and backdrop pairs drawn 1:1 over authored collision, scaled to the player's pixel size, with ladders between tall tiers and the camera kept inside the room ([scene levels](../../docs/design/scene-levels/README.md)). Gardens 3, 7 and 14 have dedicated depth compositions; Garden 3's aqueduct remains the seeded fallback. The Buried Aqueduct uses worn masonry, unequal open portals and a fractured canal crown; the Mycelium Cathedral uses a tilted canopy, dark gills and distant fungi; the Fossil Vault uses cold organic framing, curved buried ribs, a deeper skull orbit and an irregular open jaw. Real ledges remain the clearest route cues. Same-camera [aqueduct](../../review/crown-ascent/garden-03-depth/), [fungal](../../review/crown-ascent/garden-07-depth/) and [fossil](../../review/crown-ascent/garden-14-depth/) reviews preserve actual before/after and mobile traversal evidence. Runtime PNGs, collision geometry and the other gardens' architecture remain unchanged.

Wayfinding uses small arrows and trail markers, with directions revealed after shrine discovery. Short interaction cues appear beside the shrine when needed. Permanent objective paragraphs, route/cache labels, place titles and large arrival numbers are absent; only compact run indicators remain. Teammate names sit small at the bottom and disappear when playing alone.

Every garden has three deliberately placed guardian-shrine destinations away from the entrance. Each run chooses one, so finding the amber shrine is part of exploring the map. A shared two-seed cache waits there. Grow a living plant near its soil court, gather upgrades along the routes, and use Tend at the shrine when ready. Some shrines require climbing to a lookout; their guardian wakes in the nearby court below. The fight and its objectives stay at that court. The guardian must fall before the exit plant opens. Victory awards a boon and seeds, restores some plant health and water, and cancels outstanding boss strikes. The exit prefers a living plant beside the court, and the team still has to physically climb it. Three optional preparation raids offer extra experience and a boon; defeating them alone does not clear the garden.

Bosses telegraph attacks in amber and expose themselves in cyan for double damage. All twenty guardians have distinct designs and combat kits. Sixteen native sprite designs join the four milestone bosses:

| Garden | Boss |
| --- | --- |
| 1–4 | Sprout Sentinel, Dew Duke, Thorn Duelist, Spore Oracle |
| 5 | Mossback |
| 6–9 | Root Ram, Silk Weaver, Glass Snail, Wick Hermit |
| 10 | Tiara |
| 11–14 | Frostjaw, Spindle Widow, Orchard Mimic, Tuning Fork |
| 15 | Moon Moth |
| 16–19 | Kiln Beetle, Ash Ferryman, Compost Choir, Seed Engine |
| 20 | Hollow Crown |

Garden 10's **Tiara** is the owner's tiara-wearing head sprite: a native 40-pixel
body that jumps, rolls and headbutts in a readable three-move rotation. Amber
marks the committed destination. Actual contact and landing strikes remain
host-owned; recovery leaves time for a planted bomb. Tiara keeps the authored
sprite colours without a procedural silhouette outline. Lower health adds
landing shock lanes and quicker movement. Bellkeeper remains a roaming guardian.
The eight 8-frame animation rows are registered in the
[Tiara atlas](../../assets/tiara-head-v1/README.md); see [the encounter contract](../../docs/design/tiara-head.md).

Hollow Crown is a tall native silver king with a faceless helmet and massive maul. Its four
acts follow the final-boss rhythm of Risk of Rain 2: a maul duel, a lunar
reinforcement and seal interlude, an empowered return with shockwaves and tall
energy lanes, then a wounded, weaponless last stand with needles and returning
orbs. Breaking the final cores weakens its temporary power; player upgrades
remain intact. A thin health bar, four phase pips and three seal/core dots leave
the body, hazards and nearby gardener clear on phones. See [the encounter design](../../docs/design/hollow-crown.md).

Cyan begins after the guardian's entire volley has landed and cleared. Every guardian gives enough time to react and plant a two-second bomb: 3.2 seconds on Easy, 2.75 on Medium, 2.5 on Hard and 2.35 on Insane. Moon Moth and Hollow Crown descend within ground-bomb reach during recovery. Solving a boss's special objective grants a longer opening; enrage shortens the gap before the next attack without taking that opening away.

Bomb flashes and camera kicks are brief, local and bounded; simultaneous blasts do not stack the shake. Planted bombs show their actual upgraded reach, and a short input buffer accepts an attack released just before a reload or bomb slot becomes ready.

The global run clock raises pressure continuously, including after a garden is cleared, so camping remains dangerous. Active populations and hazards are capped. Max bombs keep their two-second fuse on enemy contact, stay on ledges and fall vertically when placed in midair. Max can move while charging. Rattus norvegicus kicks nearby targets and uses a radial salto kick in the air; Erasmus Berg and Pølge show their close attack reach. Mycel fires aimed spores. Sligo retains aimed flesh throws.

Staying in the same campaign garden summons roaming guardians after 110 seconds on Medium, 90 on Hard, 70 on Insane or 240 on Easy. A five-second exact-position warning precedes each arrival. Mossback, Bellkeeper and Moon Moth rotate through the seeded order; repeated arrivals come sooner and grow tougher, with at most three live roaming bosses. The unbounded global clock continues raising enemy damage and durability. Roaming victories never replace the garden's required guardian or unlock its exit. During the required guardian fight, new roaming arrivals wait; physical ascent remains available after clearing.
