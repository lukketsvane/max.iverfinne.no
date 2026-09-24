# Claude handoff — MAX FUGLESPRENGER

This file is the engineering handoff for the next primary agent. Read `README.md` first, then this file, then the relevant tests before changing behavior.

## Start here

```sh
npm ci
npm test
npm run build
```

Do not begin by rewriting the architecture. This is a deliberately compact static browser game with a large tested behavior surface.

## Non-negotiable product invariants

1. **One Play flow / one shared garden.** There is no player-facing Solo versus Multiplayer split.
2. **Maximum four players.** Players can join a running garden. There are five characters (the fifth, Sligo, is hidden until unlocked), but never more than four players.
3. **One player per character.** Mech, Moss, Bulwark and Herbalist are exclusive slots. Taken characters must be disabled in UI and reserved server-side.
4. **First player sets difficulty.** Easy/Medium/Hard/Insane is run-wide. Once a shared run exists, joiners inherit the existing difficulty and cannot change it.
5. **Physical stage progression.** A player must actually climb the cleared exit plant to the top and cross into the next garden. Do not replace this with a ground teleport. Once one player reaches the next stage, teammates may catch up automatically.
6. **Moss climbing.** Moss can climb ordinary living plants only after they reach at least 50% of maximum physical height. Ordinary climbing cannot skip an uncleared stage.
7. **Live world during UI.** Settings and boon choices do not pause gameplay.
8. **Guest parity.** Pickups, bombs/defend, movement and allowed interactions must work for guests as well as the authoritative client.
9. **PWA continuity.** Brief backgrounding must not mean intentional leave. Rebuild Realtime channels on return; host authority may hand off while a client is suspended.
10. **No WebKit experimental-flag dependency.** The owner may enable feature flags for testing, but production must not require them.
11. **Native pixel art only at runtime.** Preserve 1:1 pixels, integer registration, atlas anchors and no smoothing.
12. **No resumable reload checkpoint.** Reload starts a new local attempt. Finished records can persist; PWA reconnect is a separate realtime behavior.

## Current multiplayer model

Supabase holds one shared live garden. The first player creates/owns the run settings. Later players enter the current run up to four total.

The client obtains `max_coop_status` before joining. It reports the active run, occupied character IDs, run difficulty and the current user's reserved character. The menu greys occupied characters and locks difficulty when the run exists. Database RPCs are the final authority; UI disabling is not the security/concurrency guarantee.

`coop-session.mjs` owns room membership, Realtime channels, authority/reconnect and encoded snapshots. `coop-game.inc.js` owns the mapping between network members and actual game actors/actions.

When changing multiplayer, test race conditions, late join, background/foreground, former-host return, class reservation and run-difficulty inheritance.

When authority moves (`coopPromote`), the new host drops members the room no longer lists, restarts every teammate's input clock, rebases each teammate's acks on their next packet and jumps its id counters (effects, loose seeds, loot, hazards, plants) past anything the old host could have issued. A new session id from a room member is a rejoin. A teammate the host timed out after 10 s without input is only hidden, and comes back with the same build; one who left or dropped out of the room is removed. A player who joins, rejoins, or returns after the garden moved on is placed beside the host (`coopPlace`), and the snapshot's `place` counter moves that guest there.

## Stage progression

The intended sequence is:

1. Clear the required encounters.
2. Exit plant becomes the route upward.
3. A player physically climbs to the top.
4. That ascender crosses into the next garden.
5. The host/shared state advances.
6. Other active players may be moved forward to catch up.

The player who earned the ascent must not be pre-teleported. This behavior was added after ground-level travel felt wrong.

Relevant tests cover physical ascent and co-op catch-up. Keep them when refactoring.

## Characters

- **Mech**: only character with watering robot. Robot boons must not leak to another character through stale snapshots or forged selections. Skill: dispatch the rover to one threatened plant; the pour is the rover's only heal and shelters that plant from friendly blasts.
- **Moss**: climbing specialist. Skill: pounce; the host clamps the slam to the drop it saw and starts the cooldown at landing.
- **Bulwark**: plant protection/tank role. Skill: brace; it swallows warned roots only, never spores, gusts or rats, and ends when he moves.
- **Herbalist**: care/healing role. Skill: bloom; it revives one freshly fallen plant and never the last one, and adds no score.
- **Sligo** (Max Sligo Neverdahl): a hidden, pink defiled zygote (`hidden: true`), shown only once unlocked (see Easter eggs). Average stats. Skill: tun; curled for 3 s it cannot move, throw, dodge or tend, nothing knocks it back, and plants within 40 px take half of every kind of damage through `plantProtection` (the stronger of a tun and a Bulwark guard counts, never both). A jump uncurls it early, the 9 s cooldown counts from the uncurl, and it adds no score. It grows only its two umbilical cords, `SLIGO_KINDS` (25 cord, 26 cap, the cap rarer before garden 6), decided by the planting actor's class, and nobody else grows them; the gallery hides both until Sligo is unlocked. It leaves a trail: slime every 2 px and a clot of dark blood every 10-20 px (more often while hurt or just after a tun), a smear where it lands, now and then a drip over a ledge lip. Purely visual and local: each client records the Sligo avatars it draws into a 700-mark ring (`sligoTrail`), solid pixels on the surface's top row drawn after the platforms, which dissolve by a 4×4 ordered dither over the last 5 of their 45 s. Its skin `sligo` loads on demand; until `assets/max-skins-v1/sligo/` exists the original Max stands in.
  Curled, it is drawn inside its blood sac, and the sac bursts in a splat where the tun ends (`SLIGO_FX`, `assets/max-skins-v1/sligo/specials.png` from the owner's specials sheet in `docs/asset-review/sligo-specials-v1`, built by `scripts/build-sligo-specials.py`).

Skills are one tap on Max or E, never a new pause, sprite or boon. Guests run the local part. The host checks cooldown and position in the `skill` branch of `coopInput`, and `coopClassSkill` runs the guest's own class verb. A guest's brace and tun follow the host's: the snapshot carries what is left of them (`braceLeft`, `tunLeft`, tagged by `braceTag`), and a tun's host cooldown starts when the guest uncurls.

Character appearance and gameplay role are one selection. Do not reintroduce a separate skin/costume picker.

Sligo, the hidden character, has two umbilical plants of its own: kind 25, the cord (`PA.fam` 9, `assets/plants-v1/sligo-cord/`), and kind 26, the cap (`PA.fam` 10, `sligo-cap/`). Both are built by `scripts/build-sligo-plants.py` from the owner's paintings in `docs/asset-review/sligo-plants-v1/`. Each family has its own blooms (`b`) and roots (`r`), and `SLIGO_PLANTS` keeps both kinds away from ordinary seeds (`gardenKindFor`) and out of the garden collection (`tests/sligo-plants.test.cjs`).

## Difficulty / current balance intent

Easy must actually feel easy. Do not tune every mode upward because late Hard/Insane is survivable.

Easy currently reduces damage, enemy durability, density, wave budget and time-pressure growth and gives a longer opening grace period.

Friendly fire scales with the difficulty's damage factor but not with the clock: a dry blast costs a plant three quarters of an opening bite on every difficulty.

Rats were intentionally moved later and softened. Current entry gates are documented in `README.md`. Rat variants stage in after common rats; do not put plague/armoured rats back into the opening gardens.

The recent expanded specialists are:

- Thorn caster: warned root control; killing it before the root lands cancels the root.
- Dew leech: moisture drain + self sustain.
- Rammer: warned straight charge.

Their attacks need readable counterplay and must not become unavoidable background damage.

## Run power (Risk of Rain rules)

The enemy clock stays superlinear and unbounded; the team answers it the way Risk of Rain does.

- Every level adds a fifth of base damage to every hit the team lands (`runPlayerPower`), bombs, skills and burns alike.
- Kill, raid and shrine XP scale with `runRewardScale()`, the square root of the clock's toughness factor, so levels keep coming while kills slow down. Harvest and seed-shed XP stay flat so the Cultivator snowball does not grow.
- Every cleared garden and every milestone boss grants one guaranteed boon (`grantRogueLevel`), which waits behind any open choice. Milestone bosses also drop seven seeds.
- Boon offers are a seeded weighted roll (`MaxBuilds.choices`): a freshly unlocked capstone always shows, class boons weigh 1.6x for their class, and an offer always spans at least two paths.
- Easy keeps its 28 s opening in every garden (`openingRaidT`).
- Enemy heals (healing moth, dew leech, Moon Moth channel) go through `healPest`, which divides by `runDurabilityScale()` exactly as `damagePest` does, so a heal is worth the same number of hits at every point of the clock.

## Seeded gardens

- `resetRogueRun` rolls `rogueRun.seed`. `coopCapture` sends it and `coopState` applies it before anything reads the layout. Never seed from `room.id`: the shared garden reuses the room.
- `MaxStageLayout.create(stage, origin, ground, wet, seed)` generates gardens 1–19 and caches by stage and seed. Without a seed it returns the authored shape, which is also the fallback and the Crown.
- The generator never calls `Math.random`. Every required ledge must stay reachable by a walking Bulwark (`tests/seeded-gardens.test.cjs`), and `tests/seeded-physics-*.test.cjs` jumps every hop of 20 seeds with all four classes. Change a reach rule only together with those tests.
- `layout.nodes` holds each platform's capability tier (C0–C3) for loot placement.
- The run starts at the bottom of a silo, dark and wet, and climbs out towards dusk. Gardens 1 and 2 are picture levels, the Seed Vault at the bottom and the Railway Ruins above it; every other garden is designed or generated. `stageLayout()` returns `pictureLayout(level)` for gardens 1 and 2 only (the owner first took the pictures out to get the old generated gardens back, then asked for the Railway Ruins as the first garden, then for the silo's bottom below it). `pictureLayout(n)` reads `window.MaxPictureLevels[garden]` from `levels-v1/*.js`: one painted art rectangle, 3 px rock blocks traced from it, one-way ledges the art already draws (`art: true`, never drawn again), markers and an `entry` that sits on the soil. Under the art the soil runs level at the entry height (`surfaceY` reads the layout's `ground`; `terrainY` is the rolling terrain). The Seed Vault is built by `scripts/build-seed-vault.py` from the owner's scene in `docs/asset-review/seed-vault-v1/` at 1/3 (its keepers and doors are drawn smaller than the railway's), whole, with the near-black cave it is painted in cleared from the edges so the cavern and soil show round it, and with one-way floors, the ice bridge, the pool's pedestal and rungs 17 px apart up each ladder. The Railway Ruins are built at Max's scale by `scripts/build-railway-ruins.py` from the owner's scene and kit sheets in `docs/asset-review/railway-ruins-v1/`: everything is painted at about 4× native, so the scene and the kits are brought down to native pixels (1/4, the machinery 1/8) and never drawn larger, the kit pieces are placed west and east of the scene with a role each (deck, tops, stair, ladder, back, decor), and placed pieces are clipped at the soil so the game's ground runs under the garden. `tests/picture-sweep.cjs` searches a picture with the real physics as a walking Bulwark; every marker must be reached, both ways across, no traps; the Sunken Sanctuary (`pictureLayout(21)`, `scripts/build-sunken-sanctuary.py`, from the concept sheet in `docs/asset-review/sunken-sanctuary-v1/`) waits outside the sequence for the bonus realms. `tests/picture-level.test.cjs` walks every class through both.
- Generated gardens draw their ledges and rock from the Sanctuary tile atlas: `tiles.js` and `assets/tiles-v1/` (built by `scripts/build-tiles.py` from `docs/asset-review/sanctuary-tiles-v1/`), passed to `MaxStageLayout.draw`; stone ledges are mossy strips with flora, branch and root ledges are planks, ruin ledges are lintels, rock is nine-sliced. Frost and ember gardens keep their baked snow and ember ledges (`MaxPlaces.ledgeArt`), and until the atlas loads the baked ledges stand in. Garden places and pictures keep their own art.
- The underground gardens (1–10, the climb out of the silo) draw the cavern: five 180-tall layers in `assets/cavern-v1/` (far cave, stalactite ceiling, ruins on a far shore, a black lake, misty ruins in the water; built by `scripts/build-cavern-layers.py` from the owner's layers in `docs/asset-review/cavern-layers-v1/` and `coast-layers-v1/`) in place of the sky, moon, birds and clouds (`drawCavernLayers`, `CAVERN_LAYERS`). They are not in Figma yet: `assets/figma-pending.json` pins them (docs/figma.md, "Waiting for Figma").
- Above ground, gardens without a biome backdrop draw one of two painted backdrops. The even ones and the Crown draw the Sanctuary backdrop: five 320×180 parallax layers in `assets/backdrop-v1/` (sky, band, mountains, ruins, forest; built by `scripts/build-backdrop.py` from `docs/asset-review/sanctuary-backdrop-v1/`), tiled with mirrored alternate tiles at the rates in `SANCTUARY_PAR`. The odd ones (1–9) draw the night forest: ten 180-tall wrapping layers in `assets/night-v1/`, sky to terrain (built by `scripts/build-night-layers.py` from the owner's layer sheet in `docs/asset-review/night-layers-v1/`, whose `layers/` keeps the clean full-width set), drawn by `drawNightLayers` at the rates in `NIGHT_LAYERS`; the moon stays put and the stars repeat up a tall sky. Frost and ember gardens keep their biome backdrops. Until the layers load the old sky and hills stand in (`tests/backdrop.test.cjs`).
- A garden drawn in Figma replaces the generated one when its frame carries a `designed` instance: `stageLayout()` asks `MaxLevels.layout` (`levels.js`, data in `levels-data.js` from `npm run figma:levels`) before `MaxStageLayout.create`. A designed layout adds `designed`, `frame`, `spots` (dig, secret, puzzle and door are live, see Garden places; start is not read yet) and `decor`. Its routes and tiers come from the stage-layout reach rules. See `docs/design/figma-levels.md`.

## Garden places

- `garden-places.js` holds one designed place per garden, drawn as rows of 6 px cells: `#` rock, `=` one-way ledge, `%` false wall, `$` cache, `_` back wall, `|` pillar, `!v*tm` decor. The bottom row stands on a flat footing; ramps step down to the soil.
- `stageLayout()` furnishes generated gardens only (`MaxPlaces.furnish`); Figma gardens and picture levels stay as drawn. Place platforms carry `place: true`; the route generator's platforms, routes and nodes are untouched.
- The seed picks the side (mirrored on the left) and the footing: dry, clear of every route ledge by 12 px with ramps, no soil more than two cells above a door.
- Caches are seed pickups `cache:<garden>:<i>` (host-owned, claimed by guests like any seed). Discovery banners and false-wall fades are each player's own view.
- `tests/place-sweep.cjs` explores every place with the real physics as a walking, unupgraded Bulwark: both caches reached, no spot that strands Max, crossable both ways. Every ledge needs a walk-off end with headroom (there is no drop-through), every entrance is at least two cells wide, and a jump needs about seven cells of air above its take-off.
- **Bounce blooms** (`MaxPlaces.bloomAt`, `layout.blooms`): up to one per route side, on dry flat soil clear of the place, straight under a route ledge 26–44 px up. A jump from a bloom or a drop onto it launches 212 px/s (52 px apex) for every class, through the one-way ledge and onto it; walking across does nothing, down held lands normally, a pounce slams instead. They are a shortcut, never the only way up. `tests/bounce-blooms.test.cjs`.
- **Ledge materials** (`MaxPlaces.ledgePixels` / `ledgeArt`): route ledges are baked with the place shader by style (cobble, ashlar with pillar stubs, leafy branch, root with strands); the top row stays the walking surface. Gardens 11–15 wear snow and 16–19 ember moss on ledges and places (`MaxPlaces.biome`). `tests/ledge-art.test.cjs`.
- **High ground** (`highGround(a)`): a bomb records how high its thrower stood above the soil (`perks.high`, 0 below 20 px, 1 at 56 px) and hits up to 35% harder, so route ledges matter during raids. A guest's throw uses the guest's own avatar on the host. `tests/high-ground.test.cjs`.
- **Designer spots** (`levelSpots`, garden 1's painting and Figma gardens): a `secret` spot lays a hidden cache `secret:<garden>:<i>` that is drawn only within 34 px of Max (`pickupShown`); a `dig` spot is cracked soil that any blast within reach digs open (`digBlast`, host only), marking `dig:<garden>:<i>` collected and dropping seeds `dig:<garden>:<i>:s`. Guests see both through the collected list and the seeds on the ground. A `puzzle` spot always holds the garden's wonder puzzle, one that works off the soil (`SPOT_PUZZLES`: crack, echo, stars, or a rare well, crown or clover), and a `door` spot always holds the secret-garden gate in gardens 2–18. `tests/level-spots.test.cjs`.

## Boons

`build-paths.js` is the canonical boon catalogue. In addition to the older tree, recent upgrades include:

- `tender` — Green Thumb
- `spread` — Wide Watering
- `bark` — Barkskin
- `mulch` — Mulch
- `stride` — Long Stride
- `spring` — Spring Step

Plant protection is one rule, `plantProtection(plant, bite)`, and every kind of plant damage goes through it: bites, roots, spores, boss strikes, your own blasts and dew-leech drain. Thorns (`shield`) takes 22% per rank off bites only; Barkskin (`bark`) takes 22% per rank off everything that is not a bite. A Bulwark guard and a mature shelter plant reduce every kind.

A boon is not done merely because it appears in the menu. Each must materially affect the live simulation and have a regression test.

Boon selection is a live overlay. Never restore the old pause/wait-for-team behavior. In co-op every team level adds one pick to each player's own queue (`owed`); a player works through it alone and nobody waits for anyone's pick.

### Co-op boon owners

A boon belongs to the player who picked it. The host applies each effect with its owner's ranks, never one player's upgrade for the whole world:

- The acting player: movement, throws, tending, harvesting, pickups and the seed spots around them (Long Stride, Spring Step, Light Step, Quick Fuse, Green Thumb, Wide Watering, Seed Rain, Bumper Crop, Bloom Pulse, Rain Engine, Seed Sense, Golden Seeds).
- The bomb's thrower: Big Blast, Wild Spark, Sap Burst, Chain Bloom and embers ride on the bomb. Rover boons ride on the Mech's own crew.
- The plant's carer, whoever planted it or last watered it (`plantPerks(p)`): Quick Roots, Deep Soil, Morning Dew, Sap and the seeds a plant sheds. A carer who left takes their boons along.
- The team's best rank (`coopTeamPerks`) only where the effect is global: Sticky Pollen, because pests belong to nobody, and Golden Seeds' bonus seed on a raid clear, a team reward that spawns at the host.
- Thorns, Barkskin, Bramble, Evergreen and Mulch still read the team's best rank inside the protection code; they move to `plantPerks(p)` with the protection rework.

## Audio

Music and effects are separate. Settings uses discrete steps 75 / 50 / 25 / off.

- `soundtrack.mjs`: streamed music and music gain.
- `effectsAudio()`: the one effects context and effects gain. It resumes on focus, pageshow, visibility and the next touch, including the iOS `interrupted` state, and a closed context is rebuilt on the next touch.
- `listenRun()` hears garden events from state every frame (a crunch when a plant is hurt, then fall, lost, raid, clear, boon offer and pick, trial start and done), so guests hear what the host simulates. Do not put those cues back at the event sites.

Do not collapse them back into one `soundEnabled` flag.

## Safari / iPhone

The project is iPhone/PWA-first. Recent diagnostics specifically addressed blank-screen investigation and stale smoke-test title assumptions.

If Safari/PWA fails:

1. Reproduce on the current production SHA.
2. Check page errors and console errors.
3. Confirm static assets/build output.
4. Check Supabase/Reatime reconnect separately from rendering.
5. Use the live verification workflow.
6. Do **not** ask users to enable experimental WebKit features as the product fix.

## Data and infrastructure

### Vercel

- project: `max.iverfinne.no`
- project ID: `prj_QU1gHXGoDr99H3MxAUcaXGx2wgMe`
- production branch: `main`
- build: `npm ci && npm run build`
- output: `dist/`

Remote Vercel build quotas have been hit during rapid iteration. Do not try to bypass account restrictions. Promotion or authenticated prebuilt deploys are acceptable supported alternatives.

### Supabase

- project ref: `zuezxsuqkvrzypjhbbqq`
- frontend uses publishable credentials only
- never expose service-role/secret keys

Important checked-in migrations are listed in `README.md`. Hosted migration history was partly applied manually during the initial build; inspect live state before replaying old migrations.

### Accounts

Account UI is optional metadata. Play should remain low-friction and can establish a device identity. Passwords are never stored by the game client.

### Easter eggs

`easter-eggs.mjs` keeps the unlocks under one device key (`max-easter-eggs-v1`): eggs typed on the device, plus each account's list from the server. Typing "sligo" or "max sligo neverdahl" (case, spaces and punctuation ignored) into the Login form's username unlocks Sligo at once with a reveal and never signs in; signing in to an account named sligo counts too. After sign-in the menu loads `public.max_my_unlocks()` and sends local unlocks with `public.max_unlock(p_phrase)`; before joining as Sligo it makes sure the server has the unlock. `player-loadout.mjs` treats a hidden character as valid only when unlocked; inside a room the server's reservation decides (`coop-session.mjs`). `window.MaxEasterEggs` lets the game read the list.

Migration `20260924150000_easter_eggs_and_sligo.sql`: the catalogue `public.max_easter_eggs` and `public.max_unlocks` (RLS, own rows readable, no client writes), `max_egg_private.all_access` (the owner, lukketsvane, found by email, has every egg, including later ones), the two public RPCs, 'sligo' in both class checks, `global_join` admitting Sligo only with the unlock, `submit` accepting Sligo runs and `valid_plants` kinds 0-26. `tests/easter-eggs-database.test.cjs` runs it in PGlite on the checked-in history.

## Release gate

Before claiming a change is live:

1. `npm test` passes.
2. `npm run build` passes.
3. GitHub Actions on the intended SHA is green.
4. Vercel reports a READY production deployment for the intended SHA.
5. The custom domain is checked, not merely the generated deployment URL.
6. For multiplayer/PWA changes, perform a live reconnect/join smoke check where possible.

At the 22 September 2026 handoff, the gameplay code immediately before documentation cleanup passed **319/319 tests** and the live verification workflow.

## Review fixtures

`review.html` is useful for deterministic visual/gameplay states. It must remain isolated from real player storage and must not create a debug API in production.

Use it for:

- all 20 layouts
- bosses
- expanded enemy mix
- rats
- Moss plant climbing
- time-pressure scenes
- player/robot/native art
- result bouquets

## Branch and PR hygiene

`main` is the only authoritative development line.

The 22 September cleanup removed 27 merged/superseded working branches and closed obsolete asset PRs #5 and #6. The only intentionally retained non-main branch is:

- `assets/crow-moonroot-native-v1` — unique, unmerged Raven/Moonroot boss artwork, tracked by PR #23.

Do not merge PR #23 wholesale into current main. Its art is future source material and its gameplay assumptions predate the current run. If that artwork is used, integrate the specific audited assets against current boss IDs, anchors and tests.

Old closed PRs and historical verification documents are evidence, not architectural truth.

## Files to read before common tasks

- gameplay/balance: `index.html`, `run-director.inc.js`, corresponding tests
- co-op: `coop-session.mjs`, `coop-transport.mjs`, `coop-game.inc.js`, Supabase migration/RPC tests
- menu/join flow: `game-menu.mjs`, `player-loadout.mjs`, menu tests
- Moss/progression: climb code in `index.html`, `tests/moss-climb.test.cjs`, co-op progression tests
- rats: `rat-enemies.inc.js`, `tests/rat-enemies.test.cjs`
- art: `native-art.mjs`, relevant `assets/**/README.md`, native-art tests
- bouquet/results: `run-results.js`, `assets/results-native/`, record/leaderboard tests
- soundtrack: `soundtrack.mjs`, soundtrack/menu tests

## Working style for the next agent

Prefer small commits that keep CI green. Preserve concurrent changes already on `main`. Search the tests before removing behavior that looks redundant; many odd-looking checks exist because an earlier real bug occurred on mobile, co-op or PWA resume.

When the user says a mechanic feels wrong, fix the actual interaction rather than documenting around it.

Sligo now uses 40 native specials frames: sac/burst, throw, tending lash, hurt, floating tendrils, sleep, and two detached flesh/cord projectiles. `bomb.sligo` survives the scalar co-op snapshot and the same flag on the blast selects blood effects; perks retain the original combat rules. `drawSligoAction` follows existing animation frames without changing hit/pour timing. Figma desktop MCP was unavailable; the existing pending-art entry pins the expanded strip.
