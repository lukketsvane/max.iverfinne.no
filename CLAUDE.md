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
2. **Maximum four players.** Players can join a running garden. There are six characters (Sligo is hidden until unlocked), but never more than four players.
3. **One player per character.** Max, Rattus norvegicus, Cairn, Mycel and Pølge are exclusive slots. Taken characters must be disabled in UI and reserved server-side.
4. **First player sets difficulty.** Easy/Medium/Hard/Insane is run-wide. Once a shared run exists, joiners inherit the existing difficulty and cannot change it.
5. **Physical stage progression.** A player must actually climb the cleared exit plant to the top and cross into the next garden. Do not replace this with a ground teleport. Once one player reaches the next stage, teammates may catch up automatically.
6. **Rattus norvegicus climbing.** Rattus norvegicus can climb ordinary living plants only after they reach at least 50% of maximum physical height. Ordinary climbing cannot skip an uncleared stage.
7. **Live world during UI.** Settings and boon choices do not pause gameplay.
8. **Guest parity.** Pickups, bombs/defend, movement and allowed interactions must work for guests as well as the authoritative client.
9. **PWA continuity.** Brief backgrounding must not mean intentional leave. Rebuild Realtime channels on return; host authority may hand off while a client is suspended.
10. **No WebKit experimental-flag dependency.** The owner may enable feature flags for testing, but production must not require them.
11. **Native pixel art only at runtime.** Preserve 1:1 pixels, integer registration, atlas anchors and no smoothing.
12. **No resumable reload checkpoint.** Reload starts a new local attempt. Finished records can persist; PWA reconnect is a separate realtime behavior.

The 3 October 2026 request explicitly authorizes generated Hollow Crown sprite
sheets. `assets/crown-ascendant-v1/` contains the second-pass tall silver king,
three native sheets and 192 registered frames. Its provenance pins all five
unchanged generated originals and the previous-pass archive, and records actual
Figma authority and capture evidence. The three verified masters now use
ordinary Figma production coverage without a local exception. See its README
and `docs/figma.md`; preserve every other established production PNG pin.

## Current multiplayer model

`night-relay.inc.js` adds Night Relay, a public 2–4 player light heist. It uses
the existing engine and controls, not planting or raids. The first member waits
for a partner; a missing partner freezes its mode clock and hazards. Locks need
two distinct players and a new carrier after each lock; every connected player
must make the final escape. Preserve freshness checks, gate bounds, checkpoints,
handoff latching, health and host-owned snapshots. See `docs/design/night-relay.md`.
Its records contain no plants and remain outside the normal leaderboard.

Relic stones now select modes of the real garden game. Bastion and Minos and their standalone canvases were removed. `relics.mjs` defines the Last Seed stone and grants collection access to the canonical signed-in owner account; other accounts use `relic-last-seed`. Hosted joining also checks this entitlement. Never infer owner rights from a display name or `user_metadata`.

`last-seed.inc.js` changes the shared engine's rules: one team seed, planting starts endless waves, no replenishment or travel, player health and three-second Tend revives, and all-down ends the run. The living plant heals nearby gardeners; its loss removes healing but does not end the game. Preserve host authority, late-join state and host handoff for health and wave progress. Keep the existing sprites, terrain, attacks and controls. Last Seed records contain only the actual plant and remain outside the normal leaderboard and meta scores.

Mode entry goes through the collection and normal character/difficulty selection, never live Settings. Supabase keeps one shared live room per mode (`garden` or `last-seed`), each with four players and unique characters. The first player owns the difficulty. Existing two-argument/no-argument RPCs still enter `garden`; the mode-aware overload takes `p_mode`. The review-only owner fixture is compiled out of production and uses memory storage.

The home footer shows usernames only, merging `max-online-v1` Realtime Presence with the shared-game status roster. Presence covers signed-in menu/collection/relic players as well as normal Play. `online-players.mjs` broadcasts only the canonical public username, deduplicates names across tabs and roster entries, removes the old identity on sign-out, and rebuilds its channel on foreground/BFCache return. It never joins a game, changes its difficulty, or provides authorization. No empty-garden message is shown.

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

- **Pølge**: limbless boxer; `polge.inc.js` owns all four native attack kits. Confirmed jab/cross/uppercut contacts advance the combo and build 0–3 Rhythm. Clinch is a separate close press (C / touch Clinch / controller button 8). Slip uses the existing dodge controls, lasts .18 s on legal ground and travels at most 24 px; only avoiding an actual warned attack primes a single ×1.5 primary counter for 1.1 s. The moving flurry supplies six .35 D pulses and a 1.2 D uppercut finish, with 0–3 Rhythm pulses and at most three Many hands pulses. Misses grant no Rhythm or Ringcraft recovery; Second wind requires actual finisher contact. Haymaker extends uppercut reach/lift and guarded damage while bosses retain movement resistance. No bombs or projectiles; preserve all native body PNGs. Every combat scalar and cooldown is host-owned and survives normal snapshots/handoff. See `docs/design/polge-v3.md` for the exact kit and `review.html?mode=polge` for close sentries with real attack warnings; add `&boons=1` for the full build.
- **Max** (`mech` / `tide` compatibility keys): trap gardener; `mech.inc.js` owns 0–3 Circuit, one shared 4 s actual-care/primary-defence reward gate and Wet (25% slow for 2 s; one ×1.25 actual primary blast then consumed). Preserve shipped charge, damage, bomb slots and exact 2 s stationary fuse. C / Fan costs one Circuit: 6 s cooldown, .16 s windup, three .25 D pulses in a 56 px cone, .2 s recovery and at most 6 px legal recoil. Fan water requires one exact .04 debit from an owned water rover; packed, refilling, dry and Guard bot reserves are excluded. V / Rover is an independent 8 s utility: fixed 96 px reachable soil or walking recall, retaining the prepaid .25 dispatch budget and existing pour. E / Overload costs three Circuit: 18 s cooldown, .4 s planted warning, one 64 px 2.4 D ring and 4 s reachable threatened-plant priority using real remaining water. Mist/priority/passive care never recursively earn Circuit. Tide and all companion PNGs stay unchanged; all robot, Guard bot, harvest and bomb boons remain. `dispatchWorld` is host authority; `mechDispatch` sends tagged guest utility. Engineer phases/cooldowns, rover owner/slot, target ID and refiller ID survive snapshots/promotion. A refill follows its actual teammate, pausing if they leave. Both controller layouts refill with held Tend + Fan (button 8), suppressing garden action during the chord; ordinary Fan stays unchanged. Controller Fan is button 8, Rover 6 (horizontal single 10), Overload 4 (single 3), lantern 16; dodge/Tend remain separate. See `docs/design/mech-v3.md` and `review.html?mode=mech`, optionally `&boons=1`.
- **Rattus norvegicus** (`runner` / `moss` compatibility keys): grey-furred wrestler with orange hair, pink tail and magenta/gold Ring gear; no hat, cape or new body art. `rattus.inc.js` owns Momentum0–100 from real sprint/pull displacement and confirmed boot contacts, 3 s traction, Last Seed-only barrier8/cap16, accepted latch/Driving phases and one real stomp landing. B retains grounded1 D / airborne1.1 D boot damage. Hold C / Tail latch within96 px (accepted5 s, miss.25 s); hold V / Driving.2–.6 s, release to spend45 or remaining Momentum (CD5, path≤80); E spends50 or remaining (CD8) and hits only the first actual landing, using host-observed apex/fall≤96. Ordinary climbing, Tend and dodge remain separate; pure `rattusPhasePolicy` shares action/movement locks. IDs/ranks/prerequisites/mode lists for Heavy boots, Wide stance, Ring tempo, Crowd crush and Flying press remain; one full-meter wave and confirmed grapple→Driving→stomp signature never recursively reward resources. Owner tags, server-held clocks, canonical anchors, path/ascent budgets and consumed landing survive snapshots/handoff; stale start snapshots cannot re-arm canceled local input. The motion adapter reads accepted state without combat mutations; all25 clips/189 frames/native anchors and PNG/atlas bytes remain, and any input cancels the four-second idle routine. Complete planting splits retain their sow marker. Controller C8/V6/E4 (single C8/V10/E3); refill is held Tend+C8, lantern Home16 or held Tend+V, suppressing garden work; L remains. See `docs/design/rattus-v3.md` and `review.html?mode=runner`, optionally `&boons=1`; the scene earns its own Momentum.
- **Cairn** (`bulwark` / `ember`): stone close fighter, cleave, brace/parry and soil burrow. Fault, Counter and Bedrock combine into Aftershock and Sanctuary.
- **Mycel** (`herbalist` / `moon`): mushroom spore caster, plant-adjacent chains and offensive healing bloom. Colony, Ferment and Symbiosis combine into Outbreak and Symphony.

The three old Max recolours are absent from active character art. `native-art.mjs` maps compatibility keys to `assets/characters-v2/`; `game-menu.mjs` does the same for portraits. Saved IDs, database constraints and unique role reservations remain compatible. Combat projectiles and fighter state are host-owned and snapshot-serialized. Attack/skill cooldowns travel through handoff. Native attacks use the ordinary attack input and objective handlers, so seals and guardian puzzles remain playable. New class combat is exercised by the `class-kits` review scene; review-only buttons send normal key events and never expose a production debug API.

- **Sligo** (Max Sligo Neverdahl): a hidden, pink defiled zygote (`hidden: true`), shown only once unlocked (see Easter eggs). Average stats. Skill: tun; curled for 3 s it cannot move, throw, dodge or tend, nothing knocks it back, and plants within 40 px take half of every kind of damage through `plantProtection` (the stronger of a tun and a Cairn guard counts, never both). A jump uncurls it early, the 9 s cooldown counts from the uncurl, and it adds no score. It grows only its two umbilical cords, `SLIGO_KINDS` (25 cord, 26 cap, the cap rarer before garden 6), decided by the planting actor's class, and nobody else grows them; the gallery hides both until Sligo is unlocked. It leaves a trail: slime every 2 px and a clot of dark blood every 10-20 px (more often while hurt or just after a tun), a smear where it lands, now and then a drip over a ledge lip. Purely visual and local: each client records the Sligo avatars it draws into a 700-mark ring (`sligoTrail`), solid pixels on the surface's top row drawn after the platforms, which dissolve by a 4×4 ordered dither over the last 5 of their 45 s. Its skin `sligo` loads on demand; until `assets/max-skins-v1/sligo/` exists the original Max stands in.
  Curled, it is drawn inside its blood sac, and the sac bursts in a splat where the tun ends (`SLIGO_FX`, `assets/max-skins-v1/sligo/specials.png` from the owner's specials sheet in `docs/asset-review/sligo-specials-v1`, built by [historical build-sligo-specials.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-sligo-specials.py)).
  Sligo evolves like Eevee (`SLIGO_EVO`, `sligoEvo`): the first path capstone it takes is its stone and settles its line for the run (`rogueRun.evoLine`): Bloom pulse grows the brood, Evergreen grows an armored root guardian, and Chain bloom grows a multi-eyed umbilical coil. Each line develops at 8 path ranks and matures at 12. The owner's 64-frame `brood.png` remains unchanged; `evergreen.png` and `chain.png` each add 24 generated poses in 40×40 cells, with per-line clips and the same foot anchor (20,39). The original branch exporter is [historical build-sligo-evolution-branches.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-sligo-evolution-branches.py); sources, native contact sheets and provenance live in `docs/asset-review/sligo-evolution-v1/`. Evolution changes shape only; food remains the sole source of mass and body size. Each client computes its own form and sends it with its avatar (`evo`, line×4+stage); local stage changes play growth once and remote actors begin in their current form ([historical sligo-evolution.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/sligo-evolution.test.cjs)).

Sligo's food/colony loop lives in `sligo-life.inc.js`, included by the build and VM harness. `SLIGO_LIFE` sets the 6 px starting height, 3 px minimum, 42 px division height, meat value and four-division run budget. Mass is proportional to area; division conserves it. Special plant harvests drop meat, while their ambient seed shedding still supplies planting seeds. The owner has one colony (`soloSligo` or `member.sligo`) with at most five bodies; clones never take player slots. The host owns mass, food, divisions and clone AI. Guests send body identity and swap requests; claimed mass is ignored. A predicted guest swap survives stale snapshots until its host acknowledgement, then reconciles. The colony and meat travel in snapshots and survive authority handoff; new runs reset them and stage transitions bring the cells along. Holding an AI cell for 480 ms swaps control; drag/cancel never swaps or throws. Q / left trigger cycles. `tests/sligo-life.test.cjs` exercises this through real harvest, input and co-op paths. Rendering changes size on integer destinations with nearest-neighbour pixels; runtime artwork is unchanged.

Skills are one tap on the character or E and never pause the shared world. Guests run the local part. Rattus sends a tagged accepted stomp start; only the host's validated first landing consumes its hit, never a guest-reported drop. The host checks cooldown and position in the `skill` branch of `coopInput`, and `coopClassSkill` runs the guest's own class verb. A guest's brace and tun follow the host's: the snapshot carries what is left of them (`braceLeft`, `tunLeft`, tagged by `braceTag`), and a tun's host cooldown starts when the guest uncurls.

Each current character has one appearance. Rattus uses `moss-pink` (Ring gear), and saved `moss` choices migrate to it. Character choice carries the fixed outfit through co-op selection, snapshots and results; there is no separate costume control.

Sligo, the hidden character, has two umbilical plants of its own: kind 25, the cord (`PA.fam` 9, `assets/plants-v1/sligo-cord/`), and kind 26, the cap (`PA.fam` 10, `sligo-cap/`). Both are built by [historical build-sligo-plants.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-sligo-plants.py) from the owner's paintings in `docs/asset-review/sligo-plants-v1/`. Each family has its own blooms (`b`) and roots (`r`), and `SLIGO_PLANTS` keeps both kinds away from ordinary seeds (`gardenKindFor`) and out of the garden collection ([historical sligo-plants.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/sligo-plants.test.cjs)).

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

`guardian-sites.js` supplies three deliberate shrine destinations per layout, each with an actual standing surface and a nearby dry soil court. `initBossEvent` chooses one from the run seed and stage; `bossEvent.siteId/siteIndex/x/y/courtX/courtY/courtLeft/courtRight` travel in the ordinary host snapshot. Do not reroll a shrine on join, resume or handoff. The shrine requires a living plant above .12 growth inside the court, within 160 px of its centre; `guardianCourtPlant` supplies the shared living-plant rule for activation, targeting and exit preference. Its shared two-seed cache uses the ordinary authoritative pickup ID `guardian:<world>:seeds`, remains a world pickup and cannot respawn after collection. The guardian spawns and fights at the selected court; its charge, objectives and strikes must not drift back to the entry plant. A raised shrine is activated on its exact support and shows the court below. The cleared exit prefers a living court plant, but travel still requires a physical climb.

The site contract is three distinct exploration destinations with dry courts at least 100 px wide and 32 px of solid-rock headroom. Elevated approaches are preferred where a nearby court fits. The 100-seed-per-map audit checked all 6,000 sites: 1,999 of 2,000 layouts kept a raised option, 25 using an early expedition landing. Garden 7 seed `260931841` instead uses three clear banks at offsets −276, +201 and +469 px. Eight sites used a district-bank alternative, all within 40 px of an existing expedition or landmark approach; the furthest ordinary site was 1,155 px from entry. No audited layout used unverified metadata or failed entry. [historical guardian-sites-geometry.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/guardian-sites-geometry.test.cjs) preserves this safety contract without demanding an elevated shrine when its court cannot fit.

The mandatory guardians' cyan recovery windows fit a two-second planted bomb plus reaction time: Easy 3.2 s, Medium 2.75 s, Hard 2.5 s, Insane 2.35 s. `guardianHazard` records the last strike's remaining time plus contact lifetime in the scalar `settleT`; movement ends, the volley finishes, then `guardianRecovery` opens the target. `settleT` travels in the ordinary co-op snapshot and must survive a host handoff. Objective interrupts use `openGuardian` to cancel their owner's strikes and grant 3.4 s. Moon Moth and Hollow Crown descend to ground-bomb reach during cyan. Enrage shortens only the following gap, not the fuse window. [historical garden-guardian-pacing.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/garden-guardian-pacing.test.cjs) exercises all twenty fights at 30/60/120 Hz, including planted damage and hazard clearance.

All six optional trial types expire after 75 s, set `failed`, award nothing and release their guards to flee. Successful Nest/Rain/Cache defence charges four times faster after its guards have fallen, but still requires a gardener at the shrine. Failed trials must not play the success cue. Neither trial expiry nor boss recovery changes the global pressure clock.

## Run power (Risk of Rain rules)

The enemy clock stays superlinear and unbounded; the team answers it the way Risk of Rain does.

- Every level adds a fifth of base damage to every hit the team lands (`runPlayerPower`), bombs, skills and burns alike.
- Kill, raid and shrine XP scale with `runRewardScale()`, the square root of the clock's toughness factor, so levels keep coming while kills slow down. Harvest and seed-shed XP stay flat so the Cultivator snowball does not grow.
- Every cleared garden and every milestone boss grants one guaranteed boon (`grantRogueLevel`), which waits behind any open choice. Milestone bosses also drop seven seeds.
- Boon offers are seeded (`MaxBuilds.choices`). One slot continues an invested build: an unlocked capstone, a missing prerequisite toward one, or another owned rank. The other two slots use other paths when available. Max's free starter rover does not count as chosen investment. Class boons still weigh 1.6x in weighted draws, and offers span at least two paths whenever possible.
- Easy keeps its 28 s opening in every garden (`openingRaidT`).
- Enemy heals (healing moth, dew leech, Moon Moth channel) go through `healPest`, which divides by `runDurabilityScale()` exactly as `damagePest` does, so a heal is worth the same number of hits at every point of the clock.

## Seeded gardens

- `resetRogueRun` rolls `rogueRun.seed`. `coopCapture` sends it and `coopState` applies it before anything reads the layout. Never seed from `room.id`: the shared garden reuses the room.
- `MaxStageLayout.create(stage, origin, ground, wet, seed)` generates gardens 1–19 and caches by stage and seed. Without a seed it returns the authored shape, which is also the fallback and the Crown.
- The generator never calls `Math.random`. Every required ledge must stay reachable by a walking Cairn ([historical seeded-gardens.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/seeded-gardens.test.cjs)), and `tests/seeded-physics-*.test.cjs` jumps every hop of 20 seeds with all four classes. Change a reach rule only together with those tests.
- `layout.nodes` holds each platform's capability tier (C0–C3) for loot placement.
- The campaign starts in the deepest vaults and climbs toward sunrise. Gardens 1–17 stay underground; the first limited dawn breaches are high above the routes in 18–19. Garden 20 emerges into a radioactive hellscape for the Hollow Crown. Gardens 1 and 2 retain the authored Seed Vault and Railway Ruins; the other gardens use seeded or live Figma geometry.
- Generated gardens draw their ledges and rock from the Sanctuary tile atlas: `tiles.js` and `assets/tiles-v1/` (built by [historical build-tiles.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-tiles.py) from `docs/asset-review/sanctuary-tiles-v1/`), passed to `MaxStageLayout.draw`; stone ledges are mossy strips with flora, branch and root ledges are planks, ruin ledges are lintels, rock is nine-sliced. Frost and ember gardens keep their baked snow and ember ledges (`MaxPlaces.ledgeArt`), and until the atlas loads the baked ledges stand in. Garden places and pictures keep their own art.
- `campaign-atmosphere.inc.js` renders native cavern layers through Garden 19, even during partial image loading. Mineral haze differentiates underground chapters; only 18–19 have a bounded roof aperture. No outdoor moon, stars or exit-cloud effects appear before the surface. All existing PNG sources remain unchanged.
- Garden 20 opens into a broad radioactive sunrise above a monumental stone court, with green fallout motes and mineral fissures. Fallout is visual only. Its Hollow Crown has four acts, a tall faceted steel body and armored maul silhouette, lunar adds and seals, empowered lanes and waves, and a wounded weaponless orb/needle stand. `hollow-crown.inc.js` owns flat replicated combat state; `hollow-crown-art.mjs` maps authoritative timers to the separate native body banks. Recovery still waits for every owned strike and preserves the planted-bomb exposure windows. High Tide keeps its separate guardian gate protocol. See `docs/design/hollow-crown.md`. Legacy night/Sanctuary functions remain available outside the campaign renderer.
- A garden drawn in Figma replaces the generated one when its frame carries a `designed` instance: `stageLayout()` asks `MaxLevels.layout` (`levels.js`, data in `levels-data.js` from `npm run figma:levels`) before `MaxStageLayout.create`. A designed layout adds `designed`, `frame`, `spots` (dig, secret, puzzle and door are live, see Garden places; start is not read yet) and `decor`. Its routes and tiers come from the stage-layout reach rules. See `docs/design/figma-levels.md`.

## Garden places

- `garden-places.js` holds one designed place per garden, drawn as rows of 6 px cells: `#` rock, `=` one-way ledge, `%` false wall, `$` cache, `_` back wall, `|` pillar, `!v*tm` decor. The bottom row stands on a flat footing; ramps step down to the soil.
- `stageLayout()` furnishes generated gardens only (`MaxPlaces.furnish`); Figma gardens and picture levels stay as drawn. Place platforms carry `place: true`; the route generator's platforms, routes and nodes are untouched.
- The seed picks the side (mirrored on the left) and the footing: dry, clear of every route ledge by 12 px with ramps, no soil more than two cells above a door.
- Caches are seed pickups `cache:<garden>:<i>` (host-owned, claimed by guests like any seed). Discovery banners and false-wall fades are each player's own view.
- [historical place-sweep.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/place-sweep.cjs) explores every place with the real physics as a walking, unupgraded Cairn: both caches reached, no spot that strands Max, crossable both ways. Every ledge needs a walk-off end with headroom (there is no drop-through), every entrance is at least two cells wide, and a jump needs about seven cells of air above its take-off.
- **Bounce blooms** (`MaxPlaces.bloomAt`, `layout.blooms`): up to one per route side, on dry flat soil clear of the place, straight under a route ledge 26–44 px up. A jump from a bloom or a drop onto it launches 212 px/s (52 px apex) for every class, through the one-way ledge and onto it; walking across does nothing, down held lands normally, a pounce slams instead. They are a shortcut, never the only way up. [historical bounce-blooms.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/bounce-blooms.test.cjs).
- **Ledge materials** (`MaxPlaces.ledgePixels` / `ledgeArt`): route ledges are baked with the place shader by style (cobble, ashlar with pillar stubs, leafy branch, root with strands); the top row stays the walking surface. Gardens 11–15 wear snow and 16–19 ember moss on ledges and places (`MaxPlaces.biome`). [historical ledge-art.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/ledge-art.test.cjs).
- **High ground** (`highGround(a)`): a bomb records how high its thrower stood above the soil (`perks.high`, 0 below 20 px, 1 at 56 px) and hits up to 35% harder, so route ledges matter during raids. A guest's throw uses the guest's own avatar on the host. [historical high-ground.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/high-ground.test.cjs).
- **Designer spots** (`levelSpots`, garden 1's painting and Figma gardens): a `secret` spot lays a hidden cache `secret:<garden>:<i>` that is drawn only within 34 px of Max (`pickupShown`); a `dig` spot is cracked soil that any blast within reach digs open (`digBlast`, host only), marking `dig:<garden>:<i>` collected and dropping seeds `dig:<garden>:<i>:s`. Guests see both through the collected list and the seeds on the ground. A `puzzle` spot always holds the garden's wonder puzzle, one that works off the soil (`SPOT_PUZZLES`: crack, echo, stars, or a rare well, crown or clover), and a `door` spot always holds the secret-garden gate in gardens 2–18. [historical level-spots.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/level-spots.test.cjs).

## Boons

`build-paths.js` is the canonical boon catalogue. In addition to the older tree, recent upgrades include:

- `tender` — Green Thumb
- `spread` — Wide Watering
- `bark` — Barkskin
- `mulch` — Mulch
- `stride` — Long Stride
- `spring` — Spring Step

Plant protection is one rule, `plantProtection(plant, bite)`, and every kind of plant damage goes through it: bites, roots, spores, boss strikes, your own blasts and dew-leech drain. Thorns (`shield`) takes 22% per rank off bites only; Barkskin (`bark`) takes 22% per rank off everything that is not a bite. A Cairn guard and a mature shelter plant reduce every kind.

A boon is not done merely because it appears in the menu. Each must materially affect the live simulation and have a regression test.

Boon selection is a live overlay. Its cards show names and effects, rank dots, and a signature unlock when the next rank enables one (`MaxBuilds.unlocks`). Never restore the old pause/wait-for-team behavior. In co-op every team level adds one pick to each player's own queue (`owed`); a player works through it alone and nobody waits for anyone's pick.

`perkChoices` passes the active survival mode to the catalogue. Last Seed excludes `yield`, `bloom`, `spread`, `magnet`, `luck`, `recycle` and `bounty`: its only plant cannot be harvested and it has no loose seeds or plant neighbours. High Tide keeps its own motherplant whitelist. Mode filtering applies to continuation and unlock hints too, so no suggestion points into a disabled path. Quick Hands keeps the `cadence` ID; it shortens attack recovery, never the planted bomb's two-second fuse.

### Co-op boon owners

A boon belongs to the player who picked it. The host applies each effect with its owner's ranks, never one player's upgrade for the whole world:

- The acting player: movement, throws, tending, harvesting, pickups and the seed spots around them (Long Stride, Spring Step, Light Step, Quick Hands, Green Thumb, Wide Watering, Seed Rain, Bumper Crop, Bloom Pulse, Rain Engine, Seed Sense, Golden Seeds).
- The bomb's thrower: Big Blast, Wild Spark, Sap Burst, Chain Bloom and embers ride on the bomb. Rover boons ride on Max's own crew.
- The plant's carer, whoever planted it or last watered it (`plantPerks(p)`): Quick Roots, Deep Soil, Morning Dew, Sap and the seeds a plant sheds. A carer who left takes their boons along.
- The team's best rank (`coopTeamPerks`) only where the effect is global: Sticky Pollen, because pests belong to nobody, and Golden Seeds' bonus seed on a raid clear, a team reward that spawns at the host.
- Thorns, Barkskin, Bramble, Evergreen and Mulch still read the team's best rank inside the protection code; they move to `plantPerks(p)` with the protection rework.

## Audio

Music and effects are separate. Settings uses discrete steps 75 / 50 / 25 / off.

- `soundtrack.mjs`: streamed music and music gain.
- `effectsBus()`: one effects-only low-pass/compressor/gain bus, with distance falloff and a bounded voice budget. Music never passes through it.
- `effectsAudio()`: the one effects context and effects gain. It resumes on focus, pageshow, visibility and the next touch, including the iOS `interrupted` state, and a closed context is rebuilt on the next touch.
- `listenRun()` hears garden events from state every frame (a crunch when a plant is hurt, then fall, lost, raid, clear, boon offer and pick, trial start and done), so guests hear what the host simulates. Do not put those cues back at the event sites.

Bomb placement and a single near-detonation fuse cue stay quiet. Boss windup, exposure, objective breaks and hit feedback also come from shared state. Failed trial expiry is not a completion cue. Keep explosion envelopes short and camera impulses local/non-additive when adding combat effects.

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

Migration `20260924150000_easter_eggs_and_sligo.sql`: the catalogue `public.max_easter_eggs` and `public.max_unlocks` (RLS, own rows readable, no client writes), `max_egg_private.all_access` (the owner, lukketsvane, found by email, has every egg, including later ones), the two public RPCs, 'sligo' in both class checks, `global_join` admitting Sligo only with the unlock, `submit` accepting Sligo runs and `valid_plants` kinds 0-26. [historical easter-eggs-database.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/easter-eggs-database.test.cjs) runs it in PGlite on the checked-in history.

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
- Rattus norvegicus plant climbing
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
- Rattus norvegicus/progression: climb code in `index.html`, [historical moss-climb.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/moss-climb.test.cjs), co-op progression tests
- rats: `rat-enemies.inc.js`, [historical rat-enemies.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/rat-enemies.test.cjs)
- art: `native-art.mjs`, relevant `assets/**/README.md`, native-art tests
- bouquet/results: `run-results.js`, `assets/results-native/`, record/leaderboard tests
- soundtrack: `soundtrack.mjs`, soundtrack/menu tests

## Working style for the next agent

Prefer small commits that keep CI green. Preserve concurrent changes already on `main`. Search the tests before removing behavior that looks redundant; many odd-looking checks exist because an earlier real bug occurred on mobile, co-op or PWA resume.

When the user says a mechanic feels wrong, fix the actual interaction rather than documenting around it.

Sligo now uses 40 native specials frames: sac/burst, throw, tending lash, hurt, floating tendrils, sleep, and two detached flesh/cord projectiles. `bomb.sligo` survives the scalar co-op snapshot and the same flag on the blast selects blood effects; perks retain the original combat rules. `drawSligoAction` follows existing animation frames without changing hit/pour timing. The expanded strip is synchronized in Figma native source frame `160:2`.

## September 27 class and exploration revision

`build-paths.js` contains 49 boons, including 20 class mutations/signatures. The first offers emphasize class identity; continuation, mode restrictions and prerequisite hints remain seeded. `perkChoices` includes `rogueRun.seed`, not just level/world/member salt. Four bomb-only boons are restricted to the two actual bomb/flesh users. Every mutation has a live combat effect; never add menu-only upgrades.

Upper districts preserve the first seven approach shelves for guardian placement, then compose two different seeded motifs with wide encounter landings and three cache detours. The summit item is seeded and displayed at the entrance. The generator and physics tests preserve the slowest class's unupgraded outbound and return hops.

The next level-design pass adds `expedition.circuit` only where the complete loop fits without obstructing existing paths. Its `family` is `pump`, `arch` or `bell`; `outbound` and `return` join two upper ascent ledges, and `arena` records the actual 88–104 px floor plus two flank perches. The two `choices` hold different item types, both different from the summit item. Every loop is traversable without activating its challenge or using a class skill. Never force a circuit into a seed that fails geometry validation.

Circuit runtime is part of `runExpedition`: flat `circuitChoice/Active/Done/Failed/Queued/Serial/Tell/SpawnX/SpawnY/Kind/Age/Away` fields survive ordinary scalar snapshots. Tend an altar to commit the shared choice; 2–4 keepers enter at warned floor positions. Keepers have `circuit: true`, `eventId: 2000 + world`, stay within the terrace, and remain punchable. Completion drops one owner-reserved chosen item per member once; retreat after four seconds or 75 s expiry retires the challenge without rewards. Pending circuit strikes retire with it. It is independent of the summit and ordinary shrine/guardian locks. Circuit cues are read from shared state by `listenRun`, including for guests.

Ordinary shrine encounters use a 1.35 s exact-position ingress warning and a local sentry cap of `2 + floor(coopSize()/2)`. `trialGuard` AI holds the shrine's elevation. `failEncounter` retires pending strikes, guards and ingress and unlocks the other unfinished shrine; a failed shrine cannot restart or refund its cost. Four seconds outside the encounter withdraws, with a larger participation region for Dew Relay's intended journey. The existing 75 s timeout and world threat clock remain.

District world art is `assets/district-props-v1`: six 32×32 prop pairs anchored at (16,31), three 48×64 landmarks at (24,63), generated sources and deterministic [historical build-district-props.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-district-props.py). Only native PNG/JSON files ship; sources/contact sheets remain development evidence. Both runtime sheets are synchronized in Figma native source frame `160:2`.

Audio keeps music separate from effects. Class attack envelopes use modest variation, bounded voices and distance falloff; guardian warnings have reserved headroom. Guest strike audio comes from validated shared FX once. Class readiness cues fire once on cooldown completion. Native UI glyph masters are edited in Figma frame 160:2 and verified by the same production manifest as other runtime art.

## October 3 campaign level redesign

`MaxStageLayout.profile(stage)` supplies twenty distinct garden identities and asymmetric preparation/exploration route rhythms. Existing native tile families remain compatible; both required paths retain walking Cairn access. Early optional upper districts shorten repeated transit; broad completion terraces and distinct cache branches improve later pacing. The first seven guardian approach ledges remain fixed.

`level-guide.inc.js` reads actual shared world state, preserves shrine discovery, directs players to the court/summon/fight and living physical exit, and wraps bitmap labels within narrow phones. Local navigation never mutates host state or bypasses an objective.

`npm run figma:level-drafts` creates twenty editable review snapshots and a Figma import package from the current runtime. The authenticated second-pass board `607:14028` on page `508:11825` now contains all twenty editable scene instances with 1,569 route tags at actual seed-1 coordinates, climbing from 1 below to 20 above. These are review scenes without a `designed` marker, not live Figma overrides. Full world-only runtime captures are in `review/crown-ascent/`. The three Crown native masters on page `10:2` are separately synchronized and verified in the ordinary 665-MATCH production audit; review imagery does not grant source authority.
