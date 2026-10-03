# MAX FUGLESPRENGER

A phone-first native-pixel garden roguelite. Grow a garden, defend it, explore twenty vertical stages and physically climb onward. The result of a run is the actual garden you grew.

**Production:** https://max.iverfinne.no  
**Production branch:** `main`  
**Runtime:** static HTML/JS/CSS built with esbuild and deployed on Vercel  
**Realtime/backend:** Supabase Auth + Realtime + Postgres RPCs

## The current game contract

These are product rules, not suggestions. Preserve them unless the design is explicitly changed.

### One shared game

There is no separate single-player and multiplayer mode. **Play** enters the one shared live garden.

Unlocked **relic stones** in the collection garden select game modes using the same garden, characters, assets and controls. Each mode has its own shared room; ordinary Play enters the main garden.

- 1–4 players can be present.
- Players may join an already-running garden.
- A brief PWA/background interruption must not count as leaving.
- If the authoritative player disappears, authority can hand over to another active player.
- A returning player reconnects to the same shared run when the reserved membership is still valid.
- During a run, **Settings → Invite** copies a link to that exact session and mode. Friends choose a free character and inherit its difficulty. Ended sessions cannot be joined through an old link; mode and character unlocks still apply.
- When a run ends with one player left in the room, the client leaves immediately so its dead session cannot be rejoined. Play again waits for that departure before joining a fresh run.
- Settings and boon selection do **not** pause the world.
- The app must work with normal current Safari/WebKit behavior. Experimental WebKit feature flags are not a requirement.

### Characters are exclusive

Five open characters and the hidden Sligo each own a gameplay role. Before Play, double-tap a character sprite to cycle its available cosmetic outfits. Rattus uses only her latest Ring gear; saved earlier outfits migrate to it. Costumes share the same character slot and abilities and stay fixed during the run. The garden still holds at most four players.

| Character | Primary attack | Skill (tap character / E) |
| --- | --- | --- |
| Max | Stationary bombs, fixed two-second fuse | Spend three Circuit on Floodgate Overload |
| Rattus norvegicus | Ground boot combination and airborne salto kick | Spend Momentum on one leaping splits-stomp landing |
| Cairn | Sweep → reverse sweep → planted knuckle; confirmed contacts build Strata | Spend three Strata on a garden ridge and bite ward |
| Mycel | Spore bolts that chain near living plants | Bloom heals and waters plants, revives a recent fall and strikes nearby pests |
| Pølge | Jab → cross → uppercut; confirmed contacts build Rhythm | Spend Rhythm in a freely steered close flurry |

Rattus norvegicus defaults to a grey-furred rat wrestler with orange hair, a pink tail, powerful thighs and magenta-and-gold ring gear, without a hat or cape. Her Figma-authored animation bank adds four-legged walking and sprinting, braking, kneeling after four seconds of input silence, resting and varied ground and aerial strikes. The 25 clips preserve native body scale, variable pose timing and co-op presentation. Cairn is a broad stone creature and Mycel a walking mushroom. Rattus fights with her boots: close dropkicks, airborne saltos and a wide splits stomp. She also lowers into a split while planting, then returns to her guard. Their generated native sheets replace the old Max recolours in the game, menus and results. The persisted IDs `runner`, `bulwark`, `herbalist` and legacy skin keys remain wire-compatible with existing accounts and room reservations; those are compatibility identifiers, not additional characters.

Rattus builds up to 100 **Momentum** from real sprinting, tail-pull travel and confirmed boot contacts. Hold **Tail latch** (C) toward a mature living stem, real ledge or pest; heavy anchors pull her and light pests are tugged toward her. Hold **Driving** (V) for .2–.6 seconds, then release for a short body kick through real collision. **Stomp** (E / tap Rattus) spends Momentum and hits only her first actual landing; longer falls add damage. A genuine boot contact at 40 Momentum gives three seconds of knockback resistance, with a bounded temporary barrier only in Last Seed. Tend, dodge and ordinary climbing remain separate. Her existing Ring gear and complete planting poses stay unchanged. See [Rattus's complete kit](docs/design/rattus-v3.md) for timings, controls and all five retained upgrades.

Cairn is a living stone guardian. Every third confirmed sweep or a truly reduced plant bite can build one of three **Strata** plates, with a shared 1.5-second gate. **Stone** (C) spends one plate on a low physical throw that leaves a short grounded-pest slow after enemy contact. **Brace** (V) protects nearby living plants; timing its first .28 seconds against a real frontal strike gives one close counter. **Ridge** (E / tap Cairn) reserves three plates, then raises a reachable dry ridge: one emergence hit, two seconds of ordinary grounded-pest obstruction and six seconds of bite protection. Players, flight, bosses and progression pass through. His existing stone body, moss and native sheets stay unchanged. See [Cairn’s complete kit](docs/design/cairn-v3.md) and [live review](review.html?mode=cairn).

Max is a trap gardener and water engineer. Actual useful care or a bomb that interrupts a threat to a living plant builds up to three **Circuit**, with one shared four-second reward gate. **Fan** (C) spends one charge on a close forward mist that slows pests and sets up one stronger delayed primary blast. **Rover** (V) dispatches a watering robot to reachable soil within 96 px, or recalls it on foot. **Overload** (E / tap Max) spends three charges on a planted ring, then prioritizes threatened plants for four seconds. Fan irrigation debits exactly .04 from one available owned water rover; Overload priority spends the remaining reserve. Tend and X dodge remain separate. The original Tide body and all robot art are preserved. See [Max's complete kit](docs/design/mech-v3.md) for timings, controls, water conservation and existing upgrades.

Pølge is a limbless mannequin boxer and the glue of the pølgevenner. Confirmed jab, cross and uppercut contacts build up to three Rhythm beats; misses keep the current combo step. **Clinch** (C) makes room at close range. **Slip** (X or a quick horizontal flick) is a short ground weave: avoiding an actual warned attack primes one stronger primary for 1.1 seconds. Tap Pølge / E to unleash six close punches and an uppercut finish, with an extra punch for each spent beat. Steer throughout the flurry; every hit follows his current position and respects solid walls.

Pølge never creates a bomb or projectile. Close strikes can interrupt threats and break the same seals, soil and guardian objectives as other attacks. His old stand-ins have been retired. The host validates his combo, Rhythm, clinch, genuine counters, flurry contacts and cooldowns, and carries them through an authority handoff. His native body sheets and silhouette are preserved. See [Pølge's complete kit](docs/design/polge-v3.md) for timings, controls and upgrades.

A hidden character waits to be found: type its name into the Login form. **Sligo** (Max Sligo Neverdahl), the forgotten, defiled zygote drained of his endoplasm by the gluttonous twins JP and IE and starved out of the Triforce, taps Max to curl into a tun for 3 s: it cannot move or throw, nothing knocks it back, and plants within 40 px take half damage; a jump uncurls it and the 9 s cooldown starts then. He survived. He grows only his own two cords and leaves a slime-and-blood trail. He begins at half his previous height (about 6 art pixels). Harvesting either cord drops meat; walking over meat feeds a Sligo. Throws shed real body mass, down to a tiny 3-pixel body that must eat before throwing again. At 42 pixels (1.75× Max’s 24-pixel standing height), a cell divides into two equal-mass bodies. Four divisions are shared across the colony for the run: at most five bodies, one controlled and four AI companions. Companions follow, eat and defend with their own flesh. Hold a companion for 480 ms to exchange control in place, including momentum, size and cooldowns. Q or the left trigger cycles bodies. Throws keep the existing damage and boon rules. His specials sheet supplies throw, tending lash, hurt, floating tendrils and sleep poses.

Only one connected player may occupy each character. If Max is already playing, Max is disabled/greyed for the next player, and the same rule applies to every other character. The database also reserves the character so two clients cannot race into the same role.

### Difficulty belongs to the run

Difficulty is **Easy / Medium / Hard / Insane**.

Only the first player starting an empty shared garden chooses it. Once a run exists, later players see the running difficulty locked and inherit it. Difficulty is not a per-player preference inside an existing run.

Easy is intentionally forgiving. It has much lower enemy damage, durability, density and wave budget, slower pressure growth and a longer opening grace period.

### Progression must be physical

Do not replace stage progression with a ground-level teleport.

A player must physically climb the cleared exit plant to its top and reach the next stage. When one player has successfully crossed into the next garden, the remaining teammates may be brought forward so the party can continue together. The player who made the ascent stays the ascender; do not teleport them before they complete the climb.

Rattus norvegicus can also climb ordinary living plants for traversal, but ordinary plant climbing never skips uncleared stages.

After a confirmed physical ascent, a short native-pixel upward view handoff joins the two gardens through a dark masonry seam. This is local presentation only: the simulation, pressure clock and shared stage advance immediately, while the HUD stays fixed. Late joins and unrelated stage jumps do not replay an ascent. Reduced-motion preferences keep the direct entry.

### Input and items

Gameplay uses canvas gestures without on-screen action buttons. C/V class actions, Shovel burrowing and lantern toggling require keyboard or controller input; there are no replacement touch gestures for them.

- Touch drag left/right: move.
- Swipe up: jump.
- Rattus norvegicus: B / threat tap kicks; hold C for Tail latch and release to retain actual velocity; hold V for Driving for .2–.6 seconds, then release to kick; E / tap Rattus starts one Stomp landing attack. Controller View/minus (8) latches, left trigger (6) drives and left shoulder (4) stomps; horizontal single controllers use View/minus (8), stick click (10) and top face (3). Swipe up beside a climbable plant to attach; swipe up again to leap between plants; drag down to descend. A tap on the held stem climbs faster.
- Drag down / Space: tend, harvest or plant when in reach.
- Tap a threat / B: throw/defend.
- X or a quick horizontal flick: dodge.
- Max: B plants a bomb; C / Fan spends one Circuit; V / Rover dispatches or recalls; E / tap Max uses Overload and spends three Circuit. Controller View/minus (8) uses Fan, left trigger (6) dispatches and left shoulder (4) overloads; horizontal single controllers use View/minus (8), stick click (10) and top face (3).
- Cairn: B / threat tap sweeps; C / Stone spends one Strata; V / Brace defends and can counter an actual frontal strike; E / tap Cairn uses Ridge and spends three Strata after valid placement. Controller C8/V6/E4, horizontal single C8/V10/E3. Moving, jumping or dodging releases Brace. A solo owned Shovel burrows with Down+E or controller Tend+Special.
- Pølge: C / Clinch makes room; X / horizontal flick uses Slip through a warned attack. Controller View/minus (button 8) clinches; his skill and dodge retain the existing controller mapping.
- Tap your character / E: class skill (Max Overload, Rattus Stomp, Cairn Ridge, Mycel Bloom, Pølge Flurry, Sligo Tun). A pest body right under the finger, or anywhere on a boss, still takes the tap, and every tap during an exit climb boosts the climb. While the skill cools, a character tap throws at a pest near the finger, or boosts a stem climb. Interrupted committed Rattus motion retains its spent Momentum and accepted cooldown.
- R or tap a nearby Max rover: refill; any grounded, stationary teammate can help. Max, Rattus and Cairn can also hold controller Tend and press their secondary (button 8), on standard and horizontal single controllers; the chord suppresses garden action while held.
- L: lantern. Max, Rattus and Cairn use controller Home (16), or hold Tend + Utility (standard left trigger 6 / horizontal single stick click 10) when Home is reserved by the device; the chord suppresses garden action.
- Sligo: hold an AI clone for half a second to swap; Q / left trigger cycles bodies.
- Shift: run on keyboard.

Pickups and bombs must work for both the authoritative player and guests. Guest actions are validated by the host rather than silently discarded.

## Relic stones

The signed-in owner also sees every plant (including Sligo's two cords) and every wonder as discovered. This follows the canonical account across devices and clears on sign-out; it does not create run records, scores or gameplay rewards. Future plants and wonders in the catalogues are included automatically.

The stones stand beside the collected flowers, at the beginning of **Garden**. Tap a visible flower or stone directly from the main menu to open its note. Double-click/tap the landscape, swipe up on it, scroll firmly down, or use **Garden** to enter the collection. A second quick tap keeps the opened note visible. Tap **Last Seed**, then **Enter**, choose your character and press **Play**. The canonical signed-in `lukketsvane@players.max.invalid` account receives all modes automatically. Other accounts use the `relic-last-seed` unlock. The server verifies the unlock when joining; a display name never grants access.

**Last Seed** uses the main garden engine with different rules. The team shares exactly one seed. Planting it starts the timer and endless waves of existing enemies. No more seeds drop, the single plant can be tended but never harvested, and the team stays in the same garden. Clearing a wave earns a boon and a short care break. A living, watered plant heals nearby gardeners; losing it removes that recovery but does not end the run.

Each player has 100 health. Attacks have a warning, dodging avoids damage and Cairn's brace reduces it. At zero health a gardener goes down. A living teammate holds the normal Tend control (↓ / Space, controller Tend, or touch drag down) within reach for three uninterrupted seconds to revive them at half health. Moving away, taking damage or releasing Tend resets progress. The run ends when everyone is down. Health, waves, the plant and revives replicate from the host and survive a host handoff.

Results preserve the actual single plant, wave, survival time and plant lifetime in the garden archive; they are excluded from normal garden scores and public leaderboard publishing. Retry keeps Last Seed selected. `review.html?mode=last-seed` runs the real simulation with isolated memory storage; `mode=relic-garden` previews the owner collection. Bastion and Minos have been removed.

## Garden runs

Every garden also has a **place** of its own to explore beside its routes (`garden-places.js`): a Shepherd Hut, a Hollow Oak, a Broken Aqueduct, a Sunken Chapel, a Root Stair, Cairn Terraces, Lantern Roots, a Silo Stair, a Collapsed Tower, a Bell Cellar, an Old Quarry, Weeping Roots, Twin Shafts, a Catacomb, Fault Steps, a Giant's Stair, a Reactor Nest, the Last Sluice, a Surface Breach and Crown Containment. Each has rooms, climbs and a false wall; one seed cache is out in the open and one is hidden behind the false wall. The run seed only picks its side and footing. A walking Cairn reaches both caches, can always get back out, and can cross the place in both directions.

Routes now look like their family: mossy cobble for terraces and crossings, ashlar ruins with broken pillars, leafy canopy branches and hanging roots on switchbacks. The frost gardens (11–15) wear snow and the ember gardens (16–19) ember moss. Each route side can grow a **bounce bloom**: jump or drop onto it and it springs Max through the ledge above, a shortcut up the route. Ledges also pay in a fight: a bomb thrown from high ground (20 px or more above the soil) hits harder, up to 35% from two ledges up. Hand-made gardens (the Seed Vault, the Railway Ruins and gardens drawn in Figma) now use their marked spots: a secret cache that only shows itself up close, cracked soil you blast open for seeds, a wonder puzzle on their puzzle spot, and a secret-garden gate at their door.

There are 20 gardens with six route families: terraces, canopy, crossings, ruins, switchbacks and the final Crown layout. Every run rolls a seed and grows gardens 1–19 from it, so no two runs climb the same ledges; the Crown stays authored. One-way platforms let players jump through from below and land on top. Elevated routes contain exploration rewards and shrine trials.

The run begins in the deepest vaults and climbs toward the surface. Gardens 1–17 remain completely underground, through buried works and underworld faults. Gardens 18–19 offer the first glimpses of daylight through breaches high in the cave roof. Garden 20 emerges into a radioactive hellscape at sunrise, where the Hollow Crown waits. Outdoor sky, moon, clouds and exit-cloud effects cannot appear in the earlier gardens, including while backdrop images load. Garden 1 is the **Seed Vault**, frozen and dark: glass tanks of plants, a great wheel of seed jars, an ice bridge over a frozen pool, and ladders up three floors to a lit door. Garden 2 is the **Railway Ruins**, built at Max's scale from the owner's railway scene and kit sheets: a mill with its wheel and a wooden pier to the west, the station, viaduct and lift tower in the middle, and stone ruins and mossy floating islands to the east. Climb the vine off the viaduct or the lift tower to its roof beam.

Twenty campaign profiles give each garden a distinct traversal rhythm. Seeded sides pair a broad preparation route with a higher exploration route, using galleries, promenades, crossings and rest terraces. Both required paths remain reachable by an unupgraded walking Cairn. Upper districts pace shorter early climbs before the later, longer routes, with broad completion landings and differently shaped seed-cache branches. The physical exit climb, continuous threat clock and shared seed remain unchanged.

Gardens 3–19 now build enclosing chambers around their actual routes and upper districts. Broken masonry arches, textured piers, lamp recesses and attached side rooms connect the climb to the ground. Each garden has a large world-space landmark: buried aqueducts, mycelium, a frozen seed wheel, rib vaults, shafts and ruined machinery. Room surfaces carry chipped stone, bark, lichen, frost or rusty pipework. The architecture follows the rolled geometry without adding collision surfaces; all native source images retain their original size. See [campaign chambers](docs/design/campaign-chambers.md) and [the complete vertical stack](review/crown-ascent/).

Wayfinding uses small arrows and trail markers, with directions revealed after shrine discovery. Short interaction cues appear beside the shrine when needed. Permanent objective paragraphs, route/cache labels, place titles and large arrival numbers are absent; only compact run indicators remain. Teammate names sit small at the bottom and disappear when playing alone.

Every garden has three deliberately placed guardian-shrine destinations away from the entrance. Each run chooses one, so finding the amber shrine is part of exploring the map. A shared two-seed cache waits there. Grow a living plant near its soil court, gather upgrades along the routes, and use Tend at the shrine when ready. Some shrines require climbing to a lookout; their guardian wakes in the nearby court below. The fight and its objectives stay at that court. The guardian must fall before the exit plant opens. Victory awards a boon and seeds, restores some plant health and water, and cancels outstanding boss strikes. The exit prefers a living plant beside the court, and the team still has to physically climb it. Three optional preparation raids offer extra experience and a boon; defeating them alone does not clear the garden.

Bosses telegraph attacks in amber and expose themselves in cyan for double damage. All twenty guardians have distinct designs and combat kits. Sixteen native sprite designs join the four milestone bosses:

| Garden | Boss |
| --- | --- |
| 1–4 | Sprout Sentinel, Dew Duke, Thorn Duelist, Spore Oracle |
| 5 | Mossback |
| 6–9 | Root Ram, Silk Weaver, Glass Snail, Wick Hermit |
| 10 | Bellkeeper |
| 11–14 | Frostjaw, Spindle Widow, Orchard Mimic, Tuning Fork |
| 15 | Moon Moth |
| 16–19 | Kiln Beetle, Ash Ferryman, Compost Choir, Seed Engine |
| 20 | Hollow Crown |

Hollow Crown is a tall native silver king with a faceless helmet and massive maul. Its four
acts follow the final-boss rhythm of Risk of Rain 2: a maul duel, a lunar
reinforcement and seal interlude, an empowered return with shockwaves and tall
energy lanes, then a wounded, weaponless last stand with needles and returning
orbs. Breaking the final cores weakens its temporary power; player upgrades
remain intact. A thin health bar, four phase pips and three seal/core dots leave
the body, hazards and nearby gardener clear on phones. See [the encounter design](docs/design/hollow-crown.md).

Cyan begins after the guardian's entire volley has landed and cleared. Every guardian gives enough time to react and plant a two-second bomb: 3.2 seconds on Easy, 2.75 on Medium, 2.5 on Hard and 2.35 on Insane. Moon Moth and Hollow Crown descend within ground-bomb reach during recovery. Solving a boss's special objective grants a longer opening; enrage shortens the gap before the next attack without taking that opening away.

Bomb flashes and camera kicks are brief, local and bounded; simultaneous blasts do not stack the shake. Planted bombs show their actual upgraded reach, and a short input buffer accepts an attack released just before a reload or bomb slot becomes ready.

The global run clock raises pressure continuously, including after a garden is cleared, so camping remains dangerous. Active populations and hazards are capped. Max bombs keep their two-second fuse on enemy contact, stay on ledges and fall vertically when placed in midair. Max can move while charging. Rattus norvegicus kicks nearby targets and uses a radial salto kick in the air; Cairn and Pølge show their close attack reach. Mycel fires aimed spores. Sligo retains aimed flesh throws.

New boss objectives reward tactics: crack Glass Snail’s front or flank it, snuff Wick Hermit’s wicks, cut Spindle Widow’s silk anchors, find Orchard Mimic’s cyan fruit, interrupt Tuning Fork’s echo, carry dew into Ash Ferryman, silence all Compost Choir voices, and break Seed Engine’s orbiting seeds. These actions open longer damage windows; ordinary attacks still work.

Optional trials include Dew Relay (retrieve a drop from a platform route), Rain Loom (tend both seedbeds before they dry), and Echo Nest (hit the cyan egg three times). Each awards a personal upgrade to every player. Defeating all the guards at a Nest, Rain or Cache shrine makes its remaining charge four times faster while a player is present. All six trial types fade after 75 seconds without a reward and retire their guards, so an abandoned optional route cannot lock the guardian altar forever.

Before starting a trial, its shrine shows the reward, seed cost and number of guards. Amber marks show the exact entry point for 1.35 seconds before each sentry arrives; a solo fight has at most two live trial sentries, while a full party has at most four. Sentries stay near their landing and within melee reach. Leave the trial area for four seconds to withdraw and open the other route; spent seeds are not refunded. Dew Relay counts the journey to its drop as participation. The global pressure clock keeps running.

Later specialist enemies include seed thieves, spore casters, shield beetles, healing moths, thorn casters, dew leeches and rammers.

Rats are deliberately a later threat and were softened after playtesting. Their introduction is difficulty-aware:

- Easy: Garden 10 or roughly 9 minutes of elapsed run time.
- Medium: Garden 8 or roughly 7 minutes.
- Hard: Garden 7 or roughly 6 minutes.
- Insane: Garden 6 or roughly 5 minutes.

Black, albino and plague rat variants unlock later still.

## Boons and run pickups

Boons are a live overlay; the simulation continues underneath them. Each choice shows its name, effect, rank and any signature upgrade that the pick unlocks. Once a build is started, one choice develops it whenever possible: an unlocked signature first, then a missing prerequisite or another owned rank. The other two choices explore other paths. Current build paths include the original upgrades plus:

- Green Thumb — stronger tending.
- Wide Watering — reaches more neighbours.
- Thorns — plants take less bite damage.
- Barkskin — plants take less damage from roots, spores, blasts and drain.
- Mulch — defeated pests restore nearby plants.
- Long Stride — faster movement.
- Spring Step — higher jumps.
- Quick Hands — shorter recovery between attacks; planted bombs keep their two-second fuse.

The close and spore fighters have three mutation directions and two signature combinations: Heavy boots, Wide stance and Ring tempo combine into Crowd crush and Flying press for Rattus norvegicus; cleave/parry/shelter for Cairn; chains/fermentation/plant symbiosis for Mycel; flurry/uppercut/skill recovery on confirmed hits for Pølge. Pølge's Haymaker extends uppercuts and strengthens them against guards without lifting bosses; Second wind restores plants only when his flurry finish contacts an enemy. Early choices introduce class mutations, while later choices continue invested paths and offer alternatives. Signatures show a gold edge. Offers use the actual run seed, so a new run can open differently. Bomb-only boons are restricted to Max and Sligo. Max keeps every existing robot, Guard bot, harvest and bomb upgrade; the new base abilities add no prerequisite boon.

Max-only robot boons remain exclusive to Max. Last Seed excludes harvest, loose-seed and neighbour-watering upgrades that cannot work with its single, unharvestable plant. High Tide also offers only upgrades supported by its motherplant rules.

Run pickups include feathers, embers and dew. They are collected in-world and belong to the current attempt. A run keeps its full plant archive across all twenty gardens and builds the result bouquet from those exact plants.

## Audio

Music and effects are separate device preferences.

Settings cycles each independently through **75% → 50% → 25% → Off**. Muting music must not mute effects, and muting effects must not stop the soundtrack. Effects come back after an iPhone interruption (a call, Siri, the app switcher) as soon as the page returns or the next touch lands. A hurt plant crunches; falls, raids, cleared gardens, boon offers and picks and trials each have their own short cue on every player's phone.

Bomb effects use a short, warm impact with a soft placement click and one nearby fuse cue. Distance falloff, a shared effects compressor and a limited number of overlapping voices keep co-op volleys from building into constant noise. Boss warnings, cyan openings and broken objectives have distinct cues on both host and guest. Failed trials do not play a reward cue.

Needles, stone cleaves, spores and Pølge’s three combo strikes have distinct short layered sounds. Class skills signal readiness once; important guardian warnings reserve headroom and briefly duck attack accents. Planting and watering use separate tactile cues. All strike sounds follow validated shared effects, including for guests.

The soundtrack player is streamed and survives menus/reconnects without decoding the whole playlist into memory.

## PWA / Safari

The game is designed to work as an iPhone PWA without experimental browser configuration.

Backgrounding may suspend JavaScript because iOS controls process lifetime. The multiplayer layer therefore reserves membership briefly and rebuilds Realtime channels when the app returns. Do not solve PWA issues by requiring Safari/WebKit experimental feature flags.

## Repository map

The project deliberately remains a small static game rather than a framework app.

- `index.html` — main simulation, renderer, controls and embedded original game art.
- `game-menu.mjs` / `game-menu.css` — menu, character/difficulty selection, settings, accounts, shared-play entry and the garden view (pinch out on the menu, scroll the found plants, tap one for its note, pinch in to return).
- `relics.mjs`, `last-seed.inc.js` — mode selection/access and Last Seed rules within the shared garden engine.
- `coop-session.mjs` — Supabase room/session/reconnect/authority transport.
- `coop-transport.mjs` — encoded realtime frame transport and limits.
- `coop-game.inc.js` — game-state replication, guest action validation and co-op simulation glue.
- `stage-layout.js` — seeded platform geometry: generated gardens 1–19 with reach guarantees, the authored Crown and the authored fallback.
- `garden-places.js` — each garden's explorable place: 20 designs drawn on a 6 px grid (rock, one-way ledges, false walls, caches, decor), placed beside the routes by the run seed and baked into native pixel art.
- `levels.js` / `levels-data.js` — gardens designed in Figma, which replace the generated ones when their frame is live. `levels-data.js` is written by `npm run figma:levels` (see `docs/design/figma-levels.md`).
- `run-director.inc.js` — raids, time pressure, specialist enemies, hazards and bosses.
- `rat-enemies.inc.js` — rat behavior and native rat integration.
- `secrets.inc.js` — rare seeded nights, hidden finds, date decorations and easter eggs (see `docs/design/secrets.md`).
- `wonders.inc.js` — per-run puzzles, chance encounters and hidden doors to special gardens, with a found list (see `docs/design/secrets.md`).
- `build-paths.js` — boon definitions and choice rules.
- `max-classes.js` / `player-loadout.mjs` — character rules and persisted selection.
- `companion.js` — Max watering robot.
- `sligo-life.inc.js` — Sligo body mass, meat, division, AI and control swapping.
- `soundtrack.mjs` — streamed soundtrack and music volume.
- `native-art.mjs` — native enemy/boss artwork integration.
- `run-results.js` / `run-results.css` — actual-run bouquet and records.
- `garden-leaderboard.mjs` — opt-in published run records.
- `review.html` — isolated visual/gameplay fixtures; never player save state.
- `scripts/build-static.cjs` — production static build.
- `scripts/figma-sync.mjs` / `scripts/figma-levels.mjs` — Figma art sync (`docs/figma.md`) and the garden export (`docs/design/figma-levels.md`), sharing the Dev Mode MCP client in `scripts/figma-mcp.mjs`.
- `tests/` — regression suite.
- `supabase/migrations/` — checked-in database history.

## Development

Requires Node 22 or newer.

```sh
npm ci
npm test
npm run build
```

Serve the production output locally:

```sh
python -m http.server 8765 --directory dist
```

Then open `http://localhost:8765`. Max's base kit is `review.html?mode=mech&portrait=1`; add `&boons=1` for the preserved upgraded branches. Its plants and live enemies allow Circuit, conserved irrigation, Wet and rover jobs to be observed using normal controls. Sligo review scenes: `review.html?mode=sligo-life&portrait=1` (birth and meat) and `review.html?mode=sligo-colony&portrait=1` (companions and swapping). Pølge's base kit is `review.html?mode=polge&portrait=1`; add `&boons=1` for his full build. Its close sentries use real warned attacks, and its observation panel reports combo, Rhythm, counter and cooldown state without changing your saves.

A change is not release-ready unless both `npm test` and `npm run build` pass. The regression suite covers gameplay, co-op transport/session behavior, database rules, native art contracts, mobile controls and review fixtures.

At the handoff on 22 September 2026, the latest verified `main` passed **319/319 tests** and the production smoke workflow.

## Supabase

Hosted project: `zuezxsuqkvrzypjhbbqq`.

Checked-in migrations:

```text
20260921160631_player_cloud_saves.sql
20260921163937_save_conflict_http_status.sql
20260921180722_coop_rooms.sql
20260921204258_bouquet_leaderboard.sql
20260922153500_single_shared_garden.sql
20260923110000_twenty_plant_kinds.sql
20260923120000_run_stats.sql
20260924150000_easter_eggs_and_sligo.sql
20260925114556_polge_character.sql
20260925131349_last_seed_mode.sql
```

The room schema has since been evolved in place through the shared-garden RPCs. Before changing hosted SQL, inspect the live project and the migration history rather than blindly replaying old migrations.

Frontend configuration accepts only the public Supabase URL and publishable key. **Never ship a service-role or secret key to the client.**

Accounts are optional metadata, not a separate gameplay mode. The game can establish a device identity for zero-friction Play.

The home footer lists online usernames, including signed-in players in the menu, their collection or an alternate game mode. `online-players.mjs` uses Realtime Presence and merges the shared garden's current roster, showing each name once. Only public usernames are broadcast; guests browsing the menu do not announce themselves. The list clears on disconnect and refreshes when the app returns. With nobody online, the footer stays empty.

## Deployment

Vercel project: `max.iverfinne.no`  
Project ID: `prj_QU1gHXGoDr99H3MxAUcaXGx2wgMe`

`vercel.json` builds static `dist/` with `npm ci` and `npm run build`. `main` is the production branch.

`max.iverfinne.no` belongs to this project's production deployment. Do not assign it in another project's `alias` list: a TV deployment previously reclaimed the domain and served unbuilt GitHub source. Serve the built game directly on the custom domain; do not redirect players to a generated Vercel URL.

When Vercel's remote build-rate quota is exhausted, do not try to evade account limits. Prefer an already-built deployment promotion, or a supported prebuilt deployment if authenticated CI/CLI credentials are available.

Before calling a release live, verify:

1. GitHub regression CI is green.
2. The Vercel production deployment SHA matches the intended `main` commit.
3. `https://max.iverfinne.no/` returns successfully.
4. Phone/PWA smoke behavior still works.

## Persistence

Active runs are intentionally **not** checkpointed for reload. Finished run records and published bouquets may persist, but a browser reload starts a fresh local attempt.

Brief PWA backgrounding is different: the app should reconnect to the still-running shared garden rather than treating the player as having intentionally left.

## Pixel-art contract

Runtime art is native-resolution pixel art.

- Keep integer placement.
- Keep image smoothing disabled.
- Do not resize every sprite to fill its atlas cell.
- Preserve each pack's documented anchor/origin.
- Atlas transparent padding is not object size.
- Do not replace existing runtime art with generated presentation-board imagery.

See `assets/` and the relevant pack READMEs before changing sprite registration.

The user-requested Hollow Crown Ascendant pack adds a slender native silver
king and a separate wounded, weaponless form. Its 128×96 cells preserve the
maul arcs at native body scale; they are not enlarged in game. Original generated
sources, reproducible import recipe and pinned exports accompany the pack.
All 192 body, chimera and effects frames keep fixed native registration. Current
Figma synchronization is recorded in [the art-source contract](docs/figma.md) and
[the pack README](assets/crown-ascendant-v1/README.md).

## Handoff

Start with [CLAUDE.md](CLAUDE.md) for the current engineering handoff, invariants, infrastructure notes and remaining branch/archive context. Historical verification documents in `docs/verification/` are evidence, not the current source of truth.

The source of truth for behavior is **current `main` + passing tests + this README**.

### Controller comfort

One horizontal Joy-Con (L) is detected automatically, with the stick on the left:

| Control | Action |
| --- | --- |
| Stick | Move; full run speed at three-quarter travel; up/down climb ladders |
| Bottom face button, printed ← | Jump; down + bottom tends or plants; confirm in menus |
| Right face button, printed ↓ | Tend, harvest or plant; back in menus |
| Left face button, printed ↑, or SR | Attack while moving; hold to charge, release to attack |
| Top face button, printed → | Class skill; focus an offered boon, then use the stick and bottom to choose |
| SL | Dodge; cancels a held attack |
| ZL | Hold and use the stick to aim precisely; release to attack; Max keeps moving while charging its planted bomb |
| L | Max Fan, Rattus Tail latch, Cairn Stone, Pølge Clinch; hold Tend + L to refill; Sligo cycles bodies |
| Stick click | Max dispatches/recalls, Rattus Driving, Cairn Brace; hold Tend + stick click for their lantern; Mycel/Pølge use lantern and Sligo cycles bodies |
| Home / Capture | Lantern when the browser exposes this button |
| Minus | Settings |

Settings → Map Joy-Con (L) learns the physical stick directions and buttons and saves the layout for that device. Unsupported buttons can be skipped. WebKit's nonstandard face aliases and analog D-pad stick values are normalized. Motion sensors are outside the browser Gamepad API, so this layout uses buttons and stick input.

Other controllers keep B/Y tending and stick-click dodge. Menus use spatial stick/D-pad navigation, held-direction repeat, confirm and back, with focus kept in the visible dialog. Live settings own controller input while the world continues. Held buttons are released before they can trigger a gameplay action after closing a menu or selecting a boon.

Aim has a 0.12 radial deadzone and reaches full throw distance at 0.75 stick travel; small resting drift is ignored. Light trigger pressure starts charging. A single Joy-Con can aim down with its movement stick without planting. Disconnecting cancels a held throw and releases controller movement.

### Upper districts

All twenty main gardens include an optional ascent of roughly 208–340 pixels with three side galleries, hidden seed caches and a keepsake. Gardens 1–5 introduce shorter climbs; gardens 6–20 retain the full platform phrases and can add a terrace circuit where it fits. Beyond the seven lower approach shelves, each run combines two different motifs: Broken Viaduct, Folded Stair, Hanging Galleries, Needle Crossing and Crown Steps. Broad encounter landings punctuate the climb. Shelter, needle and gallery detours have different footing and return safely without movement upgrades. The feather, dew or ember reward is visible at the entrance before committing to the climb. Relay beacons, ordered bells, salvage seals and guarded watch points earn a summit item while the global threat clock keeps running. Follow the trail lamps; use the existing tend and throw controls. The full level catalogue and review links are in [Upper districts](docs/design/upper-districts.md).

Where the terrain has room, an outer loop branches from the upper ascent and rejoins it higher up. The Old Pump Court, Split Bough Court and Broken Bell Court each have a broad combat terrace and two flank perches. A sign at the fork previews two gifts. Tend one altar to choose its reward, then clear the warned keepers to earn that gift for every teammate. The other altar closes for that visit. The loop can be crossed without accepting the fight, and every class can retreat by the normal platforms or walk off the terrace. Leaving for four seconds ends the challenge without a reward; it never locks the guardian. Native beacons, bells, salvage machinery, telescopes, altars and landmark sprites give the districts recognisable silhouettes.

### High Tide

High Tide now uses the complete supplied five-garden composition at native scale.
One motherplant grows on stored water while players explore ten upgrade pickups
and nine dew pickups. Tend restores water and health; five increasingly strong
native guardians gate growth. Each victory gives a boon, a short rest and a tide
retreat. Reach the final crown after all five victories. The host owns care,
pickups, guardians and health, including after authority handoff. See
[High Tide](docs/design/high-tide.md) for the source map, rules and initial balance.
