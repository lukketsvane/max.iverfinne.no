# MAX FUGLESPRENGER

A phone-first native-pixel garden roguelite. Grow a garden, defend it, explore twenty vertical stages and physically climb onward. The result of a run is the actual garden you grew.

**Production:** https://max.iverfinne.no  
**Production branch:** `main`  
**Runtime:** static HTML/JS/CSS built with esbuild and deployed on Vercel  
**Realtime/backend:** Supabase Auth + Realtime + Postgres RPCs

The [finished-game master plan](docs/design/finished-game-master-plan.md) sets the
ordered path toward Risk of Rain 2's depth and polish through MAX's own garden,
native art and physical ascent. Its [execution ledger](docs/design/finished-game-progress.json)
records verified work and the next milestone; planned quality targets are not
claims of completed playtesting.

Settings → Pixels cycles Auto, 4x, 6x, 8x and 10x native-canvas enlargement, defaulting to 8x. These change the actual render resolution, not a display mask. Each native pixel becomes an integer block of physical display pixels; smaller screens and the Crown retain readable framing. The saved device choice does not pause or restart the garden. See [pixel display strategies](docs/design/pixel-render-strategies.md).

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

Temporary room polling failures retain the admitted membership and retry with
1/2/4/8/10-second capped backoff. Returning online or to the foreground rebuilds
the same room's channels. A healthy host's departure lets the server promote a
remaining gardener; a genuine ended run or confirmed expired membership still
closes safely. These repairs do not create reload checkpoints or change access.

### Characters are exclusive

Five open characters and the hidden Sligo each own a gameplay role. Before Play, double-tap a character sprite to cycle its available cosmetic outfits. Rattus uses only her latest Ring gear; saved earlier outfits migrate to it. Costumes share the same character slot and abilities and stay fixed during the run. The garden still holds at most four players.

| Character | Primary attack | Skill (tap character / E) |
| --- | --- | --- |
| Max | Stationary bombs, fixed two-second fuse | Spend three Circuit on Floodgate Overload |
| Rattus norvegicus | Ground boot combination and airborne salto kick | Spend Momentum on one leaping splits-stomp landing |
| Erasmus Berg | Sweep → reverse sweep → planted knuckle; confirmed contacts build Strata | Spend three Strata on a garden ridge and bite ward |
| Mycel | Spore bolts that chain near living plants | Bloom heals and waters plants, revives a recent fall and strikes nearby pests |
| Pølge | Jab → cross → uppercut; confirmed contacts build Rhythm | Spend Rhythm in a freely steered close flurry |

Rattus norvegicus defaults to a grey-furred rat wrestler with orange hair, a pink tail, powerful thighs and magenta-and-gold ring gear, without a hat or cape. Her Figma-authored animation bank adds four-legged walking and sprinting, braking, kneeling after four seconds of input silence, resting and varied ground and aerial strikes. The 25 clips preserve native body scale, variable pose timing and co-op presentation. Erasmus Berg is a broad stone creature and Mycel a walking mushroom. Rattus fights with her boots: close dropkicks, airborne saltos and a wide splits stomp. She also lowers into a split while planting, then returns to her guard. Their generated native sheets replace the old Max recolours in the game, menus and results. The persisted IDs `runner`, `bulwark`, `herbalist` and legacy skin keys remain wire-compatible with existing accounts and room reservations; those are compatibility identifiers, not additional characters.

Rattus builds up to 100 **Momentum** from real sprinting, tail-pull travel and confirmed boot contacts. Hold **Tail latch** (C) toward a mature living stem, real ledge or pest; heavy anchors pull her and light pests are tugged toward her. Hold **Driving** (V) for .2–.6 seconds, then release for a short body kick through real collision. **Stomp** (E / tap Rattus) spends Momentum and hits only her first actual landing; longer falls add damage. A genuine boot contact at 40 Momentum gives three seconds of knockback resistance, with a bounded temporary barrier only in Last Seed. Tend and dodge remain separate from her wrestling moves. Her existing Ring gear and complete planting poses stay unchanged. See [Rattus's complete kit](docs/design/rattus-v3.md) for timings, controls and all five retained upgrades.

Erasmus Berg is a living stone guardian. Every third confirmed sweep or a truly reduced plant bite can build one of three **Strata** plates, with a shared 1.5-second gate. **Stone** (C) spends one plate on a low physical throw that leaves a short grounded-pest slow after enemy contact. **Brace** (V) protects nearby living plants; timing its first .28 seconds against a real frontal strike gives one close counter. **Ridge** (E / tap Erasmus Berg) reserves three plates, then raises a reachable dry ridge: one emergence hit, two seconds of ordinary grounded-pest obstruction and six seconds of bite protection. Players, flight, bosses and progression pass through. His existing stone body, moss and native sheets stay unchanged. See [Erasmus Berg’s complete kit](docs/design/cairn-v3.md) and [live review](review.html?mode=cairn).

Mycel is a walking mushroom colony. Initial spore hits and nearby living wet plants build **Culture** (0–6). **Cloud** (C) spends two on a fixed slow cloud with three damage pulses. **Drift** (V) is a vulnerable short hop; one real network landing waters one living plant by at most .04. **Bloom** (E / tap Mycel) spends four on three fixed pulses at 0, 2 and 4 seconds, while she remains free to move, shoot and tend. The whole cast restores at most .12 health / .15 water per plant; Last Seed adds at most 12 total HP to other living allies. Her burgundy cap, mint gills, ivory roots and original sheets stay unchanged. See [Mycel’s complete kit](docs/design/mycel-v3.md) and [live review](review.html?mode=mycel).

Max is a trap gardener and water engineer. Actual useful care or a bomb that interrupts a threat to a living plant builds up to three **Circuit**, with one shared four-second reward gate. **Fan** (C) spends one charge on a close forward mist that slows pests and sets up one stronger delayed primary blast. **Rover** (V) dispatches a watering robot to reachable soil within 96 px, or recalls it on foot. **Overload** (E / tap Max) spends three charges on a planted ring, then prioritizes threatened plants for four seconds. Fan irrigation debits exactly .04 from one available owned water rover; Overload priority spends the remaining reserve. Tend and X dodge remain separate. The original Tide body and all robot art are preserved. See [Max's complete kit](docs/design/mech-v3.md) for timings, controls, water conservation and existing upgrades.

Pølge is a limbless mannequin boxer and the glue of the pølgevenner. Confirmed jab, cross and uppercut contacts build up to three Rhythm beats; misses keep the current combo step. **Clinch** (C) makes room at close range. **Slip** (X or a quick horizontal flick) is a short ground weave: avoiding an actual warned attack primes one stronger primary for 1.1 seconds. Tap Pølge / E to unleash six close punches and an uppercut finish, with an extra punch for each spent beat. Steer throughout the flurry; every hit follows his current position and respects solid walls.

Pølge never creates a bomb or projectile. Close strikes can interrupt threats and break the same seals, soil and guardian objectives as other attacks. His old stand-ins have been retired. The host validates his combo, Rhythm, clinch, genuine counters, flurry contacts and cooldowns, and carries them through an authority handoff. His native body sheets and silhouette are preserved. See [Pølge's complete kit](docs/design/polge-v3.md) for timings, controls and upgrades.

A hidden character waits to be found: type its name into the Login form. **Sligo** (Max Sligo Neverdahl), the forgotten, defiled zygote drained of his endoplasm by the gluttonous twins JP and IE and starved out of the Triforce, taps Max to curl into a tun for 3 s: it cannot move or throw, nothing knocks it back, and plants within 40 px take half damage; a jump uncurls it and the 9 s cooldown starts then. He survived. He grows only his own two cords and leaves a slime-and-blood trail. He begins at half his previous height (about 6 art pixels). Harvesting either cord drops meat; walking over meat feeds a Sligo. Throws shed real body mass, down to a tiny 3-pixel body that must eat before throwing again. At 42 pixels (1.75× Max’s 24-pixel standing height), a cell divides into two equal-mass bodies. Four divisions are shared across the colony for the run: at most five bodies, one controlled and four AI companions. Companions follow, eat and defend with their own flesh. Hold a companion for 480 ms to exchange control in place, including momentum, size and cooldowns. Q or the left trigger cycles bodies. Throws keep the existing damage and boon rules. His specials sheet supplies throw, tending lash, hurt, floating tendrils and sleep poses.

Only one connected player may occupy each character. If Max is already playing, Max is disabled/greyed for the next player, and the same rule applies to every other character. The database also reserves the character so two clients cannot race into the same role.

### Difficulty belongs to the run

Difficulty is **Easy / Medium / Hard / Insane**.

Only the first player starting an empty shared garden chooses it. Once a run exists, later players see the running difficulty locked and inherit it. Difficulty is not a per-player preference inside an existing run.

Easy is intentionally forgiving. It has much lower enemy damage, durability, density and wave budget, slower pressure growth and a longer opening grace period.

Ordinary gardens on **Hard and Insane** also give each gardener 100 HP. Actual warned enemy contacts and hazards cause damage; dodge, Tun and Brace retain their protection. A hit grants .85 seconds of immunity. After four seconds without damage, a nearby healthy, watered plant restores 3 HP per second. A grounded teammate holding Tend for three seconds revives a downed gardener at 50 HP. Health persists through physical ascent and host handoff; all-down ends the run. Easy and Medium retain their plant-focused, no-player-HP rules. Own bombs remain knockback-only for players.

### Progression must be physical

Do not replace stage progression with a ground-level teleport.

A player must physically climb the cleared exit plant to its top and reach the next stage. When one player has successfully crossed into the next garden, the remaining teammates may be brought forward so the party can continue together. The player who made the ascent stays the ascender; do not teleport them before they complete the climb.

Ordinary plants do not provide stem climbing. Every character uses ladders and the shared cleared exit stalk; High Tide retains its motherplant route.

After a confirmed physical ascent, a short native-pixel upward view handoff joins the two gardens through a dark masonry seam. This is local presentation only: the simulation, pressure clock and shared stage advance immediately, while the HUD stays fixed. Late joins and unrelated stage jumps do not replay an ascent. Reduced-motion preferences keep the direct entry.

### Input and items

Gameplay uses canvas gestures without on-screen action buttons. C/V class actions, Shovel burrowing and lantern toggling require keyboard or controller input; there are no replacement touch gestures for them.

- Touch drag left/right: move.
- Swipe up: jump.
- Rattus norvegicus: B / threat tap kicks; hold C for Tail latch and release to retain actual velocity; hold V for Driving for .2–.6 seconds, then release to kick; E / tap Rattus starts one Stomp landing attack. Controller View/minus (8) latches, left trigger (6) drives and left shoulder (4) stomps; horizontal single controllers use View/minus (8), stick click (10) and top face (3).
- Drag down / Space: tend, harvest or plant when in reach.
- Tap a threat / B: throw/defend.
- X or a quick horizontal flick: dodge.
- Max: B plants a bomb; C / Fan spends one Circuit; V / Rover dispatches or recalls; E / tap Max uses Overload and spends three Circuit. Controller View/minus (8) uses Fan, left trigger (6) dispatches and left shoulder (4) overloads; horizontal single controllers use View/minus (8), stick click (10) and top face (3).
- Erasmus Berg: B / threat tap sweeps; C / Stone spends one Strata; V / Brace defends and can counter an actual frontal strike; E / tap Erasmus Berg uses Ridge and spends three Strata after valid placement. Controller C8/V6/E4, horizontal single C8/V10/E3. Moving, jumping or dodging releases Brace. A solo owned Shovel burrows with Down+E or controller Tend+Special.
- Pølge: C / Clinch makes room; X / horizontal flick uses Slip through a warned attack. Controller View/minus (button 8) clinches; his skill and dodge retain the existing controller mapping.
- Tap your character / E: class skill (Max Overload, Rattus Stomp, Erasmus Berg Ridge, Mycel Bloom, Pølge Flurry, Sligo Tun). A pest body right under the finger, or anywhere on a boss, still takes the tap, and every tap during an exit climb boosts the climb. While the skill cools, a character tap throws at a pest near the finger, or boosts a stem climb. Interrupted committed Rattus motion retains its spent Momentum and accepted cooldown.
- Mycel: B / threat tap fires Spore; C / Cloud spends two Culture; V / Drift hops without immunity; E / Bloom spends four. Controller C8/V6/E4, horizontal single C8/V10/E3. B can fire during Drift; X cancels its movement and landing reward. Tend+C refills and Tend+V or Home16 toggles the lantern.
- R or tap a nearby Max rover: refill; any grounded, stationary teammate can help. Max, Rattus and Erasmus Berg can also hold controller Tend and press their secondary (button 8), on standard and horizontal single controllers; the chord suppresses garden action while held.
- L: lantern. Max, Rattus and Erasmus Berg use controller Home (16), or hold Tend + Utility (standard left trigger 6 / horizontal single stick click 10) when Home is reserved by the device; the chord suppresses garden action.
- Sligo: hold an AI clone for half a second to swap; Q / left trigger cycles bodies.
- Shift: run on keyboard.

Pickups and bombs must work for both the authoritative player and guests. Guest actions are validated by the host rather than silently discarded.

## Relic stones

The signed-in owner also sees every plant (including Sligo's two cords) and every wonder as discovered. This follows the canonical account across devices and clears on sign-out; it does not create run records, scores or gameplay rewards. Future plants and wonders in the catalogues are included automatically.

The stones stand beside the collected flowers, at the beginning of **Garden**. Tap a visible flower or stone directly from the main menu to open its note. Double-click/tap the landscape, swipe up on it, scroll firmly down, or use **Garden** to enter the collection. A second quick tap keeps the opened note visible. Tap **Last Seed**, then **Enter**, choose your character and press **Play**. The canonical signed-in `lukketsvane@players.max.invalid` account receives all modes automatically. Other accounts use the `relic-last-seed` unlock. The server verifies the unlock when joining; a display name never grants access.

**Last Seed** uses the main garden engine with different rules. The team shares exactly one seed. Planting it starts the timer and endless waves of existing enemies. No more seeds drop, the single plant can be tended but never harvested, and the team stays in the same garden. Clearing a wave earns a boon and a short care break. A living, watered plant heals nearby gardeners; losing it removes that recovery but does not end the run.

Each player has 100 health. Attacks have a warning, dodging avoids damage and Erasmus Berg's brace reduces it. At zero health a gardener goes down. A living teammate holds the normal Tend control (↓ / Space, controller Tend, or touch drag down) within reach for three uninterrupted seconds to revive them at half health. Moving away, taking damage or releasing Tend resets progress. The run ends when everyone is down. Health, waves, the plant and revives replicate from the host and survive a host handoff.

Last Seed, High Tide and Night Relay check everyone still in the server room before declaring the team down. A living teammate whose PWA is briefly hidden keeps their reserved place; missing health after a host handoff waits for accepted state or a confirmed departure. Night Relay still freezes with fewer than two fresh players, and High Tide still ends if the motherplant dies.

Results preserve the actual single plant, wave, survival time and plant lifetime in the garden archive; they are excluded from normal garden scores and public leaderboard publishing. Retry keeps Last Seed selected. `review.html?mode=last-seed` runs the real simulation with isolated memory storage; `mode=relic-garden` previews the owner collection. Bastion and Minos have been removed.

## Garden runs

All twenty ordinary campaign stage slots currently use the same sparse [Figma MASTER](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF/max-fuglesprenger?node-id=1433-22060). The owner is rebuilding every level from scratch in that section. Historical picture levels, scene rooms, turtle geometry and generated architecture are excluded from the production game. Missing MASTER data or art stops loading instead of selecting an earlier layout.

One Figma pixel is one native game pixel. The real game animates Max separately, starts him at the authored position, and uses the existing Cavern piece for ground support. Movement, jumping, planting, bombs, raids and shared play remain active. MASTER currently contains no exit route or guardian site; those map elements await authoring there.

Keep terrain pieces loose and omit organizing frames and visible labels in Figma. Only artwork actually placed inside MASTER belongs to the map. [The current source contract](assets/master-source-v1/README.md) records native export, geometry and byte verification. [Earlier campaign descriptions](docs/design/retired-campaign-layouts.md) remain available as historical references and regression fixtures.

### Skill loadouts

Before Play, **03 / SKILLS** chooses secondary and special abilities. Choices are saved locally and confirmed in the shared-game handshake. Each character keeps its original primary and utility controls. The accepted loadout stays fixed for that membership, survives host handoff and never grants free boon ranks.

The setup page keeps its sections at fixed positions for every character, including Sligo. Native skill icons have 48-pixel touch targets and a selected underline; the current name and effect appear in a separate fixed-height readout.

During play, the small skill/resource meter and Controls describe the equipped
ability's actual cost and cooldown. Mycel's Culture has six small cells; an
unaffordable or rejected cast uses the existing brief denied pip. Controller
specials follow the same equipped verb as keyboard/touch, while Erasmus Berg's owned
Shovel keeps its explicit Tend/Down + Special chord. Rendering reads existing
owner state and does not create or alter a cast. C/V remain keyboard/controller
only until the master plan's explicit phone-input milestone is implemented.

| Character | Alternate secondary | Alternate special |
| --- | --- | --- |
| Max | Shock pulse: immediate close damage for one Circuit | Steam vent: radial damage and Wet for two Circuit, without rover priority |
| Rattus | Snapkick: close knockback for 15 Momentum | Earthshaker: grounded area strike for 35 Momentum, without a leap |
| Erasmus Berg | Fault clap: close forward cleave for one Strata | Quake: wider immediate damage for two Strata, without Ridge's ward |
| Mycel | Miasma burst: close damage and a brief slow for two Culture | Spore storm: wide damage for four Culture, without Bloom restoration |
| Pølge | Rising clinch: lifts one close pest for one Rhythm | Haymaker: one strong close uppercut for three Rhythm |
| Sligo | Existing colony controls | Watchful tun: half the duration, wider plant protection |

Offensive alternates require an actual reachable enemy before spending a resource. Solid walls, water, accepted movement phases, cooldowns and replayed guest actions cannot bypass admission. All hits remain owner-scoped and use the existing native art; Pølge stays melee-only. See [skill loadout implementation](docs/design/skill-loadouts.md).

New boss objectives reward tactics: crack Glass Snail’s front or flank it, snuff Wick Hermit’s wicks, cut Spindle Widow’s silk anchors, find Orchard Mimic’s cyan fruit, interrupt Tuning Fork’s echo, carry dew into Ash Ferryman, silence all Compost Choir voices, and break Seed Engine’s orbiting seeds. These actions open longer damage windows; ordinary attacks still work.

Optional trials include Dew Relay (retrieve a drop from a platform route), Rain Loom (tend both seedbeds before they dry), and Echo Nest (hit the cyan egg three times). Each awards a personal upgrade to every player. Defeating all the guards at a Nest, Rain or Cache shrine makes its remaining charge four times faster while a player is present. All six trial types fade after 75 seconds without a reward and retire their guards, so an abandoned optional route cannot lock the guardian altar forever.

Before starting a trial, its shrine shows the reward, seed cost and number of guards. Amber marks show the exact entry point for 1.35 seconds before each sentry arrives; a solo fight has at most two live trial sentries, while a full party has at most four. Sentries stay near their landing and within melee reach. Leave the trial area for four seconds to withdraw and open the other route; spent seeds are not refunded. Dew Relay counts the journey to its drop as participation. The global pressure clock keeps running.

Enemy variety starts immediately. Seed thieves join the three basic pests in Garden 1; spore casters, shield beetles and healing moths become available after 18, 32 and 48 seconds on Medium, followed by thorn casters at 65, dew leeches at 82 and rammers at 100 seconds. Reaching Gardens 2–4 can introduce them sooner. Easy delays the timed introductions by 14 seconds and retains its low damage, density and 28-second opening. Rats retain their separate later gates.

The host introduces an unseen role on the next ordinary spawn, avoids consecutive repeats and favours roles missing from the live crowd. Last Seed starts with four roles, adds casters and shields in wave 2, healing moths in wave 3, thorns and leeches in wave 4 and rammers in wave 5. Enemy history survives authority handoff.

Every ordinary opening garden has a puzzle and a chance encounter. A completed encounter can reveal a different second one. Seed offerings, lantern pacts, hidden springs and warned cache-keeper challenges join the existing discoveries. Two different seeded garden events begin around 18–27 seconds and 58–85 seconds: seedfall, bloom, drizzle, dew showers or hidden caches, with drought reserved for later non-Easy gardens. Event progress and one-time gifts remain host-owned. See [secrets and special events](docs/design/secrets.md).

Rats are deliberately a later threat and were softened after playtesting. Their introduction is difficulty-aware:

- Easy: Garden 10 or roughly 9 minutes of elapsed run time.
- Medium: Garden 8 or roughly 7 minutes.
- Hard: Garden 7 or roughly 6 minutes.
- Insane: Garden 6 or roughly 5 minutes.

Black, albino and plague rat variants unlock later still.

## Boons and run pickups

Boons are a live overlay; the simulation continues underneath them. Each choice shows its name, effect, rank and any signature upgrade that the pick unlocks. Earlier prerequisite picks preview a signature and the exact ranks still needed after that pick; hints use your own build and only upgrades supported by the current class and mode. Once a build is started, one choice develops it whenever possible: an unlocked signature first, then a missing prerequisite or another owned rank. The other two choices explore other paths. Current build paths include the original upgrades plus:

- Green Thumb — stronger tending.
- Wide Watering — reaches more neighbours.
- Thorns — plants take less bite damage.
- Barkskin — plants take less damage from roots, spores, blasts and drain.
- Mulch — defeated pests restore nearby plants.
- Long Stride — faster movement.
- Spring Step — higher jumps.
- Quick Hands — shorter recovery between attacks; planted bombs keep their two-second fuse.

Each offer has one free **Redraw alternatives** (tap its small footer, keyboard 4 or controller navigation). It keeps the first build card and replaces the remaining cards with eligible alternatives. An almost exhausted catalogue may replace only one; a fully exhausted offer has no redraw. Redrawing spends no seeds or boon pick and never pauses the world. Each teammate owns their offer and its redraw, including after reconnect or authority handoff.

Thorns, Barkskin and Bramble follow the player who planted or last watered each plant. Evergreen gives each carer one rescue per garden across all their plants; changing carers does not refund a used rescue. Departed carers take their protection ranks with them. Mulch follows the attacker for confirmed player attacks.

The close and spore fighters have three mutation directions and two signature combinations: Heavy boots, Wide stance and Ring tempo combine into Crowd crush and Flying press for Rattus norvegicus; cleave/parry/shelter for Erasmus Berg; chains/fermentation/plant symbiosis for Mycel; flurry/uppercut/skill recovery on confirmed hits for Pølge. Pølge's Haymaker extends uppercuts and strengthens them against guards without lifting bosses; Second wind restores plants only when his flurry finish contacts an enemy. Early choices introduce class mutations, while later choices continue invested paths and offer alternatives. Signatures show a gold edge. Offers use the actual run seed, so a new run can open differently. Bomb-only boons are restricted to Max and Sligo. Max keeps every existing robot, Guard bot, harvest and bomb upgrade; the new base abilities add no prerequisite boon.

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
- `levels.js` / `levels-data.js` — authored gameplay geometry. The current source is the twenty native rows in Figma MASTER; [MAX Native Level Studio](docs/design/figma-level-studio/plugin/README.md) captures and previews those rows through the normal compiler. Garden 1 uses the verified Hollow Tree row.
- `level-scenes.js` / `level-scenes-data.js` — native editable MASTER artwork, bound to the exact compiled geometry source. The renderer preserves integer registration, source order and unchanged PNG crops; isolated modes keep their own scenes.
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

Then open `http://localhost:8765`. Max's base kit is `review.html?mode=mech&portrait=1`; add `&boons=1` for the preserved upgraded branches. Its plants and live enemies allow Circuit, conserved irrigation, Wet and rover jobs to be observed using normal controls. Sligo review scenes: `review.html?mode=sligo-life&portrait=1` (birth and meat) and `review.html?mode=sligo-colony&portrait=1` (companions and swapping). Pølge's base kit is `review.html?mode=polge&portrait=1`; add `&boons=1` for his full build. Its close sentries use real warned attacks, and its observation panel reports combo, Rhythm, counter and cooldown state without changing your saves. Mycel uses `review.html?mode=mycel&portrait=1`: start at zero Culture with real wet/dry plants, a retained fallen stub and ordinary pests. Add `&network=none` for a plant-free start or `&boons=1` for its full build; the pure panel reports Culture, owned clouds/Bloom, actual network points and native motion.

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
| L | Max Fan, Rattus Tail latch, Erasmus Berg Stone, Pølge Clinch; hold Tend + L to refill; Sligo cycles bodies |
| Stick click | Max dispatches/recalls, Rattus Driving, Erasmus Berg Brace; hold Tend + stick click for their lantern; Mycel/Pølge use lantern and Sligo cycles bodies |
| Home / Capture | Lantern when the browser exposes this button |
| Minus | Settings |

Controllers rumble through the standard Gamepad haptics (`dual-rumble`, plus `trigger-rumble` where a pad offers impulse triggers): hits on your gardener, nearby blasts and impacts, hard landings, dodges, your own throws, a cleared garden, boon offers, guardian arrivals and stage travel. DualSense, Xbox and Switch pads rumble wherever the browser exposes their actuator; adaptive triggers and motion sensors are outside the Gamepad API. Only the pad used in the last 20 s rumbles, and Settings → Rumble turns it off. WebKit's nonstandard face aliases and analog D-pad stick values are normalized.

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
