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

Unlocked **relic stones** in the collection garden open separate personal challenges. They have their own rules and results; ordinary Play still enters the shared garden.

- 1–4 players can be present.
- Players may join an already-running garden.
- A brief PWA/background interruption must not count as leaving.
- If the authoritative player disappears, authority can hand over to another active player.
- A returning player reconnects to the same shared run when the reserved membership is still valid.
- Settings and boon selection do **not** pause the world.
- The app must work with normal current Safari/WebKit behavior. Experimental WebKit feature flags are not a requirement.

### Characters are exclusive

The four playable characters are also the four gameplay roles. There is no separate skin picker.

| Character | Exclusive ability | Skill (tap Max / E) |
| --- | --- | --- |
| Mech | Owns the watering robot and robot upgrades | Dispatch: sends the rover (a quarter tank, 8 s) to the plant under attack; it floods the soil, staggers biters and mends the plant while it pours |
| Moss | Climbs living plants once they are at least half their maximum physical height | Pounce: a hop, or a dive from a stem, that slams pests on landing, up to double damage from 96 px or higher (6 s) |
| Bulwark | Protects nearby plants and resists knockback | Brace: 65% guard to 64 px for 3 s, shoves pests, swallows warned roots (1 s each); steering, jumping or leaving the ground ends it (10 s) |
| Herbalist | Stronger tending and nearby plant healing | Bloom: heals nearby plants by 49% of their missing health, waters them and revives the one plant that fell most recently (12 s) |

A fifth, hidden character waits to be found: type its name into the Login form. **Sligo** (Max Sligo Neverdahl), the forgotten, defiled zygote drained of his endoplasm by the gluttonous twins JP and IE and starved out of the Triforce, taps Max to curl into a tun for 3 s: it cannot move or throw, nothing knocks it back, and plants within 40 px take half damage; a jump uncurls it and the 9 s cooldown starts then. He survived. He grows only his own two cords and leaves a slime-and-blood trail. He begins at half his previous height (about 6 art pixels). Harvesting either cord drops meat; walking over meat feeds a Sligo. Throws shed real body mass, down to a tiny 3-pixel body that must eat before throwing again. At 42 pixels (1.75× Max’s 24-pixel standing height), a cell divides into two equal-mass bodies. Four divisions are shared across the colony for the run: at most five bodies, one controlled and four AI companions. Companions follow, eat and defend with their own flesh. Hold a companion for 480 ms to exchange control in place, including momentum, size and cooldowns. Q or the left trigger cycles bodies. Throws keep the existing damage and boon rules. His specials sheet supplies throw, tending lash, hurt, floating tendrils and sleep poses.

Only one connected player may occupy each character. If Mech is already playing, Mech is disabled/greyed for the next player, and the same rule applies to the other three characters. The database also reserves the character so two clients cannot race into the same role.

### Difficulty belongs to the run

Difficulty is **Easy / Medium / Hard / Insane**.

Only the first player starting an empty shared garden chooses it. Once a run exists, later players see the running difficulty locked and inherit it. Difficulty is not a per-player preference inside an existing run.

Easy is intentionally forgiving. It has much lower enemy damage, durability, density and wave budget, slower pressure growth and a longer opening grace period.

### Progression must be physical

Do not replace stage progression with a ground-level teleport.

A player must physically climb the cleared exit plant to its top and reach the next stage. When one player has successfully crossed into the next garden, the remaining teammates may be brought forward so the party can continue together. The player who made the ascent stays the ascender; do not teleport them before they complete the climb.

Moss can also climb ordinary living plants for traversal, but ordinary plant climbing never skips uncleared stages.

### Input and items

- Touch drag left/right: move.
- Swipe up: jump.
- Moss: swipe up beside a climbable plant to attach; swipe upward again to leap between plants; drag down to descend. A tap on Max pounces, even beside a stem, a tap on the held stem climbs faster and never throws, and any other tap throws from an ordinary stem.
- Drag down / Space: tend, harvest or plant when in reach.
- Tap a threat / B: throw/defend.
- X: dodge.
- Tap Max / E: class skill. A pest body right under the finger, or anywhere on a boss, still takes the tap, and every tap during an exit climb boosts the climb. While the skill cools, a tap on Max throws at a pest near the finger, or boosts a stem climb. A Mech rover too low to dispatch refills when tapped over Max. A brace refuses while you steer, and jumping or grabbing a stem out of a pounce spends its cooldown.
- R or tap nearby Mech rover: refill.
- L: lantern.
- Sligo: hold an AI clone for half a second to swap; Q / left trigger cycles bodies.
- Shift: run on keyboard.

Pickups and bombs must work for both the authoritative player and guests. Guest actions are validated by the host rather than silently discarded.

## Relic stones

The stones stand beside the collected flowers, at the beginning of **Garden**. Tap one, then **Enter**. The signed-in `lukketsvane@players.max.invalid` account receives every relic automatically. Other accounts can receive `relic-bastion` and `relic-minos` through the existing account unlock list; their discovery conditions are intentionally left for later. This is a client-side entitlement to local games, not a database or shared-room permission. A typed display name never grants owner access.

- **Bastion** is a twelve-wave tower defence. Plant Thorn (fast single shots), Frost (slowing shots), and Ember (armour-piercing splash) towers along the road. Kills and cleared waves pay seeds. Towers have three levels and can be sold for 70% of their investment. Runners, shells and brutes lead to the final Crown. Protect the heart, or the run ends. Time can run at 1× or 2×.
- **Minos** is a new seeded labyrinth on every attempt. Collect three seals and reach the opened door while the minotaur follows the corridors. Its straight charge has a stationary warning and a recovery. Drag to move or tap a seen corridor to walk there. Dash escapes a charge; Pulse briefly stuns a nearby hunter. The map and a small compass point toward the remaining objectives, and a thread traces the route you walked.

Both modes support touch and keyboard. Bastion: arrows move the tile cursor, Enter builds/selects, 1–3 choose flowers, U upgrades, Space starts a wave. Minos: WASD/arrows move, Space/Shift dash, E pulses, M opens the map. Escape pauses. On a controller, Bastion uses the stick/D-pad and A to build/select, shoulders to choose flowers, X to start a wave and Y to upgrade; Minos uses the stick, A to dash, X to pulse and Y for the map. Start pauses. Backgrounding pauses these personal challenges and clears held input.

Finishing records only the account's relic wins and best times under `max-relic-records-v1`. These games never create bouquet records, discover ordinary flowers, join a shared room or alter its difficulty. Returning restores the same garden view. `review.html?mode=relic-garden&portrait=1` provides an isolated owner fixture with in-memory storage and no connected account client.

## Garden runs

Every garden also has a **place** of its own to explore beside its routes (`garden-places.js`): a Shepherd Hut, a Hollow Oak, a Broken Aqueduct, a Sunken Chapel, a Root Stair, Cairn Terraces, a Lantern Tree, a Sky Stair, a Collapsed Tower, a Bell Cellar, an Old Quarry, a Weeping Willow, Twin Towers, a Catacomb, Moon Steps, a Giant's Stair, a Nest Crown, a Sluice Gate, a Gatehouse and the Throne Vault. Each has rooms, climbs and a false wall; one seed cache is out in the open and one is hidden behind the false wall. The run seed only picks its side and footing. A walking Bulwark reaches both caches, can always get back out, and can cross the place in both directions.

Routes now look like their family: mossy cobble for terraces and crossings, ashlar ruins with broken pillars, leafy canopy branches and hanging roots on switchbacks. The frost gardens (11–15) wear snow and the ember gardens (16–19) ember moss. Each route side can grow a **bounce bloom**: jump or drop onto it and it springs Max through the ledge above, a shortcut up the route. Ledges also pay in a fight: a bomb thrown from high ground (20 px or more above the soil) hits harder, up to 35% from two ledges up. Hand-made gardens (the Seed Vault, the Railway Ruins and gardens drawn in Figma) now use their marked spots: a secret cache that only shows itself up close, cracked soil you blast open for seeds, a wonder puzzle on their puzzle spot, and a secret-garden gate at their door.

There are 20 gardens with six route families: terraces, canopy, crossings, ruins, switchbacks and the final Crown layout. Every run rolls a seed and grows gardens 1–19 from it, so no two runs climb the same ledges; the Crown stays authored. One-way platforms let players jump through from below and land on top. Elevated routes contain exploration rewards and shrine trials.

The run starts at the bottom of a silo and climbs out: gardens 1–10 are underground, in front of a dark cavern with a black lake and ruins on its far shore, and the surface comes at garden 11. Garden 1 is the **Seed Vault**, frozen and dark: glass tanks of plants, a great wheel of seed jars, an ice bridge over a frozen pool, and ladders up three floors to a lit door. Garden 2 is the **Railway Ruins**, built at Max's scale from the owner's railway scene and kit sheets: a mill with its wheel and a wooden pier to the west, the station, viaduct and lift tower in the middle, and stone ruins and mossy floating islands to the east. Climb the vine off the viaduct or the lift tower to its roof beam. The other gardens are generated from the run's seed or drawn in Figma.

Each normal garden has three finite raids. The global run clock raises pressure continuously, including after a garden is cleared, so camping remains dangerous. Active populations and hazards are capped even though time pressure keeps increasing.

Milestone bosses:

| Garden | Boss |
| --- | --- |
| 5 | Mossback |
| 10 | Bellkeeper |
| 15 | Moon Moth |
| 20 | Hollow Crown |

Later specialist enemies include seed thieves, spore casters, shield beetles, healing moths, thorn casters, dew leeches and rammers.

Rats are deliberately a later threat and were softened after playtesting. Their introduction is difficulty-aware:

- Easy: Garden 10 or roughly 9 minutes of elapsed run time.
- Medium: Garden 8 or roughly 7 minutes.
- Hard: Garden 7 or roughly 6 minutes.
- Insane: Garden 6 or roughly 5 minutes.

Black, albino and plague rat variants unlock later still.

## Boons and run pickups

Boons are a live overlay; the simulation continues underneath them. Current build paths include the original upgrades plus:

- Green Thumb — stronger tending.
- Wide Watering — reaches more neighbours.
- Thorns — plants take less bite damage.
- Barkskin — plants take less damage from roots, spores, blasts and drain.
- Mulch — defeated pests restore nearby plants.
- Long Stride — faster movement.
- Spring Step — higher jumps.

Mech-only robot boons remain exclusive to Mech.

Run pickups include feathers, embers and dew. They are collected in-world and belong to the current attempt. A run keeps its full plant archive across all twenty gardens and builds the result bouquet from those exact plants.

## Audio

Music and effects are separate device preferences.

Settings cycles each independently through **75% → 50% → 25% → Off**. Muting music must not mute effects, and muting effects must not stop the soundtrack. Effects come back after an iPhone interruption (a call, Siri, the app switcher) as soon as the page returns or the next touch lands. A hurt plant crunches; falls, raids, cleared gardens, boon offers and picks and trials each have their own short cue on every player's phone.

The soundtrack player is streamed and survives menus/reconnects without decoding the whole playlist into memory.

## PWA / Safari

The game is designed to work as an iPhone PWA without experimental browser configuration.

Backgrounding may suspend JavaScript because iOS controls process lifetime. The multiplayer layer therefore reserves membership briefly and rebuilds Realtime channels when the app returns. Do not solve PWA issues by requiring Safari/WebKit experimental feature flags.

## Repository map

The project deliberately remains a small static game rather than a framework app.

- `index.html` — main simulation, renderer, controls and embedded original game art.
- `game-menu.mjs` / `game-menu.css` — menu, character/difficulty selection, settings, accounts, shared-play entry and the garden view (pinch out on the menu, scroll the found plants, tap one for its note, pinch in to return).
- `relics.mjs`, `relic-tower.mjs`, `relic-minos.mjs`, `relic-play.mjs` / `.css` — garden relics, account access, the two deterministic game engines, their mobile presentation and personal records.
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
- `companion.js` — Mech watering robot.
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

Then open `http://localhost:8765`. Sligo review scenes: `review.html?mode=sligo-life&portrait=1` (birth and meat) and `review.html?mode=sligo-colony&portrait=1` (companions and swapping).

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
```

The room schema has since been evolved in place through the shared-garden RPCs. Before changing hosted SQL, inspect the live project and the migration history rather than blindly replaying old migrations.

Frontend configuration accepts only the public Supabase URL and publishable key. **Never ship a service-role or secret key to the client.**

Accounts are optional metadata, not a separate gameplay mode. The game can establish a device identity for zero-friction Play.

## Deployment

Vercel project: `max.iverfinne.no`  
Project ID: `prj_QU1gHXGoDr99H3MxAUcaXGx2wgMe`

`vercel.json` builds static `dist/` with `npm ci` and `npm run build`. `main` is the production branch.

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

## Handoff

Start with [CLAUDE.md](CLAUDE.md) for the current engineering handoff, invariants, infrastructure notes and remaining branch/archive context. Historical verification documents in `docs/verification/` are evidence, not the current source of truth.

The source of truth for behavior is **current `main` + passing tests + this README**.

### Controller comfort

B and Y tend or plant; down plus the bottom face button also plants without jumping. Dodge is on either stick click, never B or down. Menus use spatial stick/D-pad navigation, held-direction repeat, confirm and back, with focus kept in the visible dialog. Held confirm is released before it can trigger a gameplay action.

Aim has a 0.12 radial deadzone and reaches full throw distance at 0.75 stick travel; small resting drift is ignored. Light trigger pressure starts charging. A single Joy-Con can aim down with its movement stick without planting. Disconnecting cancels a held throw and releases controller movement.
