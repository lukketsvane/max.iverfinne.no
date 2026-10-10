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

`seedTeamDown` is the shared defeat check for Last Seed, High Tide and Night Relay. It requires existing finite authoritative zero health for every current server room member, including locally hidden reserved members. Missing member/vitality blocks defeat without creating health or fresh input; known-down hidden members still count. Confirmed roster departure releases the requirement. Preserve solo loss, Night Relay's two-fresh-player freeze and High Tide's independent motherplant-death outcome.

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

- **Pølge**: limbless boxer; `polge.inc.js` owns all four native attack kits. Confirmed jab/cross/uppercut contacts advance the combo and build 0–3 Rhythm. Clinch is a separate close press (C / controller button 8). Slip uses the existing dodge controls, lasts .18 s on legal ground and travels at most 24 px; only avoiding an actual warned attack primes a single ×1.5 primary counter for 1.1 s. The moving flurry supplies six .35 D pulses and a 1.2 D uppercut finish, with 0–3 Rhythm pulses and at most three Many hands pulses. Misses grant no Rhythm or Ringcraft recovery; Second wind requires actual finisher contact. Haymaker extends uppercut reach/lift and guarded damage while bosses retain movement resistance. No bombs or projectiles; preserve all native body PNGs. Every combat scalar and cooldown is host-owned and survives normal snapshots/handoff. See `docs/design/polge-v3.md` for the exact kit and `review.html?mode=polge` for close sentries with real attack warnings; add `&boons=1` for the full build.
- **Max** (`mech` / `tide` compatibility keys): trap gardener; `mech.inc.js` owns 0–3 Circuit, one shared 4 s actual-care/primary-defence reward gate and Wet (25% slow for 2 s; one ×1.25 actual primary blast then consumed). Preserve shipped charge, damage, bomb slots and exact 2 s stationary fuse. C / Fan costs one Circuit: 6 s cooldown, .16 s windup, three .25 D pulses in a 56 px cone, .2 s recovery and at most 6 px legal recoil. Fan water requires one exact .04 debit from an owned water rover; packed, refilling, dry and Guard bot reserves are excluded. V / Rover is an independent 8 s utility: fixed 96 px reachable soil or walking recall, retaining the prepaid .25 dispatch budget and existing pour. E / Overload costs three Circuit: 18 s cooldown, .4 s planted warning, one 64 px 2.4 D ring and 4 s reachable threatened-plant priority using real remaining water. Mist/priority/passive care never recursively earn Circuit. Tide and all companion PNGs stay unchanged; all robot, Guard bot, harvest and bomb boons remain. `dispatchWorld` is host authority; `mechDispatch` sends tagged guest utility. Engineer phases/cooldowns, rover owner/slot, target ID and refiller ID survive snapshots/promotion. A refill follows its actual teammate, pausing if they leave. Both controller layouts refill with held Tend + Fan (button 8), suppressing garden action during the chord; ordinary Fan stays unchanged. Controller Fan is button 8, Rover 6 (horizontal single 10), Overload 4 (single 3), lantern 16; dodge/Tend remain separate. See `docs/design/mech-v3.md` and `review.html?mode=mech`, optionally `&boons=1`.
- **Rattus norvegicus** (`runner` / `moss` compatibility keys): grey-furred wrestler with orange hair, pink tail and magenta/gold Ring gear; no hat, cape or new body art. `rattus.inc.js` owns Momentum0–100 from real sprint/pull displacement and confirmed boot contacts, 3 s traction, Last Seed-only barrier8/cap16, accepted latch/Driving phases and one real stomp landing. B retains grounded1 D / airborne1.1 D boot damage. Hold C / Tail latch within96 px (accepted5 s, miss.25 s); hold V / Driving.2–.6 s, release to spend45 or remaining Momentum (CD5, path≤80); E spends50 or remaining (CD8) and hits only the first actual landing, using host-observed apex/fall≤96. Ordinary climbing, Tend and dodge remain separate; pure `rattusPhasePolicy` shares action/movement locks. IDs/ranks/prerequisites/mode lists for Heavy boots, Wide stance, Ring tempo, Crowd crush and Flying press remain; one full-meter wave and confirmed grapple→Driving→stomp signature never recursively reward resources. Owner tags, server-held clocks, canonical anchors, path/ascent budgets and consumed landing survive snapshots/handoff; stale start snapshots cannot re-arm canceled local input. The motion adapter reads accepted state without combat mutations; all25 clips/189 frames/native anchors and PNG/atlas bytes remain, and any input cancels the four-second idle routine. Complete planting splits retain their sow marker. Controller C8/V6/E4 (single C8/V10/E3); refill is held Tend+C8, lantern Home16 or held Tend+V, suppressing garden work; L remains. See `docs/design/rattus-v3.md` and `review.html?mode=runner`, optionally `&boons=1`; the scene earns its own Momentum.
- **Cairn** (`bulwark` / `ember` compatibility keys): preserve the broad living stone body, moss, all native PNG/atlas bytes and anchor16,31. `cairn.inc.js` owns Strata0–3, a shared1.5s actual-contact reward gate, delayed Three-Stone Rhythm, one physical Stone/grit, stationary Brace and one reserved/committed Ridge. B accepts1.15s apart with fixed.22startup/.3recovery; confirmed enemy contacts advance1/1/1.35D, first32/third36px plus Fault, grounded third route. C spends1/CD5 on a swept72px stone; actual enemy contact alone leaves24px/.8movement grit3s. V/CD10 guards65%/64px up to3s, with one actual frontal pest counter1.5D/36px during[0,.28), then remainingCD2.5. E reserves3 without debit/CD during.5; legal64×16 dry footprint48ahead commits one2.5D/r36 emergence,2s pest-only obstruction and6s45%/48px bite ward, CD20. Invalidity clears reservation without refund arithmetic. Strongest class guard wins; only genuinely saved living-plant bite health earns the effective owner a plate. Actual canonical source consumption prevents replay across callbacks/handoff; pure protection queries grant nothing. Five retained boon IDs/ranks/prerequisites/modes stay fixed: Fault primary reach, Reprisal genuine counter, Bedrock consumed-parry pulse, one Aftershock and accepted-Brace Sanctuary. Plain E is Ridge; solo owned Shovel uses explicit Down+E or controller Tend+Special. Personal phase policy controls common inputs; travel retains earned plates/paid clocks but cancels old-world phases/entities. The pure native adapter reads accepted state, keeps facing during reverse arm motion, and preserves gardening markers. Controller C8/V6/E4 (single C8/V10/E3), refill Tend+C, lantern Home16 or Tend+V. See `docs/design/cairn-v3.md` and `review.html?mode=cairn`, optionally `&boons=1`; the fixture starts at0plates and uses real sentries, rat and ram.
- **Mycel** (`herbalist` / `moon`): preserve the burgundy cap, cream/mint gills, ivory root body, original sheets/atlas and native32px anchor16,31. `mycel.inc.js` owns Culture0–6 (+.5 once per initial landed dart; actual wet-plant generation capped1/s), max3 real living network IDs, two finite clouds, one fixed Bloom and actual Drift proof. B is1D plus a network-enabled.65D chain, .58s recovery, speed140/life1.15; distinct links/LOS never recurse into Culture. C costs2/CD5, legal point≤80/r44, exactly three.25D pulses1/2/3 and ordinary.70/boss.90 movement slow. V/CD6 uses ordinary vulnerable collision/gravity, .35s/actual path≤48, fixed horizontal100 and bounded launchVY−90..0; B remains available, X cancels before ordinary ground dodge, first real support landing within its.8s lease waters at most one current network plot by.04 total. E costs4/CD12, fixedr48 pulses.8D at0/2/4, actor free after acceptance; reject empty before spend. Whole-cast per-plot restoration≤.12/.15 includes direct/interception/echo/Mulch/Garden Fever/deferred Ember; causal debt tail through5.6 creates no extra pulse/heal phase. Last Seed total12HP only other living reachable allies, none elsewhere; one exact currently retained Garden stub can revive within its8s window, preserving ID/kind/uint32seed/growth/stalk and bounded restoration. Retain Colony/Ferment/Symbiosis/Outbreak/Symphony IDs/ranks/prerequisites/modes: Ferment upgrades dart/Bloom damage and Cloud lifetime only; Symbiosis has actual per-owner/plot1s debt; healthy-network initial defense primes one×1.25 pulse, while owned Symphony readies B once on a useful pulse. Tagged host casts, source masks, paid clocks, debt/path/landing consumption persist through handoff. Pure native adapter changes cells/clocks only; explicit rejection/cancel policy defeats stale cues. Controller C8/V6/E4 (single C8/V10/E3), Tend+C refill, Tend+V/Home16 lantern. See `docs/design/mycel-v3.md` and `review.html?mode=mycel`, optionally `&boons=1` or `&network=none`; no Culture prefill.

The three old Max recolours are absent from active character art. `native-art.mjs` maps compatibility keys to `assets/characters-v2/`; `game-menu.mjs` does the same for portraits. Saved IDs, database constraints and unique role reservations remain compatible. Combat projectiles and fighter state are host-owned and snapshot-serialized. Attack/skill cooldowns travel through handoff. Native attacks use the ordinary attack input and objective handlers, so seals and guardian puzzles remain playable. New class combat is exercised by the `class-kits` review scene; review-only buttons send normal key events and never expose a production debug API.

- **Sligo** (Max Sligo Neverdahl): a hidden, pink defiled zygote (`hidden: true`), shown only once unlocked (see Easter eggs). Average stats. Skill: tun; curled for 3 s it cannot move, throw, dodge or tend, nothing knocks it back, and plants within 40 px take half of every kind of damage through `plantProtection` (the stronger of a tun and a Cairn guard counts, never both). A jump uncurls it early, the 9 s cooldown counts from the uncurl, and it adds no score. It grows only its two umbilical cords, `SLIGO_KINDS` (25 cord, 26 cap, the cap rarer before garden 6), decided by the planting actor's class, and nobody else grows them; the gallery hides both until Sligo is unlocked. It leaves a trail: slime every 2 px and a clot of dark blood every 10-20 px (more often while hurt or just after a tun), a smear where it lands, now and then a drip over a ledge lip. Purely visual and local: each client records the Sligo avatars it draws into a 700-mark ring (`sligoTrail`), solid pixels on the surface's top row drawn after the platforms, which dissolve by a 4×4 ordered dither over the last 5 of their 45 s. Its skin `sligo` loads on demand; until `assets/max-skins-v1/sligo/` exists the original Max stands in.
  Curled, it is drawn inside its blood sac, and the sac bursts in a splat where the tun ends (`SLIGO_FX`, `assets/max-skins-v1/sligo/specials.png` from the owner's specials sheet in `docs/asset-review/sligo-specials-v1`, built by [historical build-sligo-specials.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-sligo-specials.py)).
  Sligo evolves like Eevee (`SLIGO_EVO`, `sligoEvo`): the first path capstone it takes is its stone and settles its line for the run (`rogueRun.evoLine`): Bloom pulse grows the brood, Evergreen grows an armored root guardian, and Chain bloom grows a multi-eyed umbilical coil. Each line develops at 8 path ranks and matures at 12. The owner's 64-frame `brood.png` remains unchanged; `evergreen.png` and `chain.png` each add 24 generated poses in 40×40 cells, with per-line clips and the same foot anchor (20,39). The original branch exporter is [historical build-sligo-evolution-branches.py](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/scripts/build-sligo-evolution-branches.py); sources, native contact sheets and provenance live in `docs/asset-review/sligo-evolution-v1/`. Evolution changes shape only; food remains the sole source of mass and body size. Each client computes its own form and sends it with its avatar (`evo`, line×4+stage); local stage changes play growth once and remote actors begin in their current form ([historical sligo-evolution.test.cjs](https://github.com/lukketsvane/max.iverfinne.no/blob/050bc6ce0e31f0d37139297973822224d58a0be8/tests/sligo-evolution.test.cjs)).

Sligo's food/colony loop lives in `sligo-life.inc.js`, included by the build and VM harness. `SLIGO_LIFE` sets the 6 px starting height, 3 px minimum, 42 px division height, meat value and four-division run budget. Mass is proportional to area; division conserves it. Special plant harvests drop meat, while their ambient seed shedding still supplies planting seeds. The owner has one colony (`soloSligo` or `member.sligo`) with at most five bodies; clones never take player slots. The host owns mass, food, divisions and clone AI. Guests send body identity and swap requests; claimed mass is ignored. A predicted guest swap survives stale snapshots until its host acknowledgement, then reconciles. The colony and meat travel in snapshots and survive authority handoff; new runs reset them and stage transitions bring the cells along. Holding an AI cell for 480 ms swaps control; drag/cancel never swaps or throws. Q / left trigger cycles. `tests/sligo-life.test.cjs` exercises this through real harvest, input and co-op paths. Rendering changes size on integer destinations with nearest-neighbour pixels; runtime artwork is unchanged.

Gameplay has no on-screen action-button overlay. Canvas drag/swipe movement, threat taps, character-tap skills, horizontal-flick dodge, rover refill and climbing remain. C/V class actions, the Shovel chord and lantern toggle retain keyboard/controller access only; do not invent replacement touch bindings. Skills are one tap on the character or E and never pause the shared world. Guests run the local part. Rattus sends a tagged accepted stomp start; only the host's validated first landing consumes its hit, never a guest-reported drop. The host checks cooldown and position in the `skill` branch of `coopInput`, and `coopClassSkill` runs the guest's own class verb. Cairn's tagged Brace and Ridge use complete owner q, accepted age/phase and consumed markers in snapshots; promotion rebases remaining clocks without recreating counter, Sanctuary, emergence or resource. Legacy brace mirrors are derived from q. A guest's tun follows the host's remaining `tunLeft`; its host cooldown starts when the guest uncurls.

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
- `campaign-architecture.js` composes cached native world-space chambers around actual generated footing and expedition bounds in Gardens 3–19. It replaces the repeating backdrop columns with textured broken arches, grounded piers, attached place wings, lamps and a distinct large landmark. It never adds platforms or alters physics; exact tile/image crops keep source size, integer registration and disabled smoothing. Garden 18–19 breaches are drawn again after the architecture so their roof openings remain visible. Picture levels 1–2, Crown 20 and isolated modes keep their existing render paths. Material-only changes in `garden-places.js` preserve false-wall fades and Crown pixels. See `docs/design/campaign-chambers.md`.
- Garden 20 opens into a broad radioactive sunrise above a monumental stone court, with green fallout motes and mineral fissures. Fallout is visual only. Its Hollow Crown has four acts, a tall faceted steel body and armored maul silhouette, lunar adds and seals, empowered lanes and waves, and a wounded weaponless orb/needle stand. `hollow-crown.inc.js` owns flat replicated combat state; `hollow-crown-art.mjs` maps authoritative timers to the separate native body banks. Recovery still waits for every owned strike and preserves the planted-bomb exposure windows. High Tide keeps its separate guardian gate protocol. See `docs/design/hollow-crown.md`. Legacy night/Sanctuary functions remain available outside the campaign renderer.
- A garden drawn in Figma replaces the generated one when its frame carries a `designed` instance: `stageLayout()` asks `MaxLevels.layout` (`levels.js`, data in `levels-data.js` from `npm run figma:levels`) before `MaxStageLayout.create`. A designed layout adds `designed`, `frame`, `spots` (dig, secret, puzzle and door are live, see Garden places; start is not read yet) and `decor`. Its routes and tiers come from the stage-layout reach rules. See `docs/design/figma-levels.md`.

## Garden places

- `garden-places.js` holds one designed place per garden, drawn as rows of 6 px cells: `#` rock, `=` one-way ledge, `%` false wall, `$` cache, `_` back wall, `|` pillar, `!v*tm` decor. The bottom row stands on a flat footing; ramps step down to the soil.
- `stageLayout()` furnishes generated gardens only (`MaxPlaces.furnish`); Figma gardens and picture levels stay as drawn. Place platforms carry `place: true`; the route generator's platforms, routes and nodes are untouched.
- The seed picks the side (mirrored on the left) and the footing: dry, clear of every route ledge by 12 px with ramps, no soil more than two cells above a door.
- Caches are seed pickups `cache:<garden>:<i>` (host-owned, claimed by guests like any seed). Discovery and false-wall fades remain each player's own view; place-title banners are not drawn.
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

Plant protection is one rule, `plantProtection(plant, bite)`, and every kind of plant damage goes through it: bites, roots, spores, boss strikes, your own blasts and dew-leech drain. Thorns (`shield`) takes 22% per rank off bites only; Barkskin (`bark`) takes 22% per rank off everything that is not a bite. Grounded dry Cairn passive/Brace and a mature shelter plant reduce every kind; the fixed Ridge ward reduces bites only. Strongest Cairn/Sligo class guard counts once, with actual damage-point range and deterministic effective-owner attribution. Keep Shelter/Shield/Barkskin separate. `cairnProtection` is pure; actual accepted pest bite/strike hooks alone consume the canonical source, parry once or award genuinely saved bite health. High Tide uses actual bent-stem points, not distant root/soil geometry.

A boon is not done merely because it appears in the menu. Each must materially affect the live simulation and have a regression test.

Boon selection is a live overlay. Its cards show names and effects, rank dots, and a signature unlock when the next rank enables one (`MaxBuilds.unlocks`). Never restore the old pause/wait-for-team behavior. In co-op every team level adds one pick to each player's own queue (`owed`); a player works through it alone and nobody waits for anyone's pick.

`perkChoices` passes the active survival mode to the catalogue. Last Seed excludes `yield`, `bloom`, `spread`, `magnet`, `luck`, `recycle` and `bounty`: its only plant cannot be harvested and it has no loose seeds or plant neighbours. High Tide keeps its own motherplant whitelist. Mode filtering applies to continuation and unlock hints too, so no suggestion points into a disabled path. Quick Hands keeps the `cadence` ID; it shortens attack recovery, never the planted bomb's two-second fuse.

### Co-op boon owners

A boon belongs to the player who picked it. The host applies each effect with its owner's ranks, never one player's upgrade for the whole world:

- The acting player: movement, throws, tending, harvesting, pickups and the seed spots around them (Long Stride, Spring Step, Light Step, Quick Hands, Green Thumb, Wide Watering, Seed Rain, Bumper Crop, Bloom Pulse, Rain Engine, Seed Sense, Golden Seeds).
- The bomb's thrower: Big Blast, Wild Spark, Sap Burst, Chain Bloom and embers ride on the bomb. Rover boons ride on Max's own crew.
- The plant's carer, whoever planted it or last watered it (`plantPerks(p)`): Quick Roots, Deep Soil, Morning Dew, Sap and the seeds a plant sheds. A carer who left takes their boons along.
- The team's best rank (`coopTeamPerks`) only where the effect is global: Sticky Pollen, because pests belong to nobody, and Golden Seeds' bonus seed on a raid clear, a team reward that spawns at the host.
- Thorns, Barkskin and Bramble read `plantPerks(p)`; Evergreen uses the same actual `plantCarer(p)` and one `evergreenWorld` stamp per member. Taking over care switches ranks without refunding either owner's spent rescue. Explicit player attack Mulch reads the attack's own build; Mycel causal restoration bounds remain intact. Unattributed environmental kills retain their existing fallback.

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

`level-guide.inc.js` reads actual shared world state and preserves shrine discovery. It draws only off-screen direction arrows and small route/cache markers; nearby shrine cues stay brief. Permanent objective/district/route/cache text, location titles and arrival numbers are absent. Boss UI keeps thin health bars; Crown adds four phase pips and three seal/core dots. The small bottom teammate roster is hidden when alone. Local navigation never mutates host state or bypasses an objective.

`npm run figma:level-drafts` creates twenty editable review snapshots and a Figma import package from the current runtime. The authenticated ascent board `607:14028` on page `508:11825` contains all twenty editable scene instances with 1,549 route tags at actual seed-1 coordinates, climbing from 1 below to 20 above. These are review scenes without a `designed` marker, not live Figma overrides. Full world-only runtime captures are in `review/crown-ascent/`. The three Crown native masters on page `10:2` are separately synchronized and verified in the ordinary 665-MATCH production audit; review imagery does not grant source authority.

## October 4 Mycel release follow-up

The latest October 3 Mycel implementation (`57bd0d4`) reached production with all nine browser review jobs green, but its regression workflow failed five older integration assertions. The Mycel job was later found to lack an executable runner, so its earlier green status supplies no browser combat evidence. Class taps and guest Bloom tests now supply the required four Culture, observe the deferred first pulse and verify owner-only spending. Controller tests use stable plot IDs and real primary recovery instead of resetting one cooldown mirror; High Tide exercises actual spore darts with advancing cast clocks and preserves the guardian gate.

Actual Garden hazard contact now calls `mycelInterrupt('hazard')` before knockback. This cancels both active Drift and its remaining landing opportunity through the existing local/guest cancellation path, keeps the paid cooldown and lets normal knockback survive the next physics step. The physics regression covers both phases and confirms that the interrupted landing gives no water. Bloom, native artwork and the rest of the class kits retain their existing contracts.

## October 4 personal build choices and plant protection

`MaxBuilds.redraw` preserves the exact first offered boon and draws fresh alternatives from the current class/mode/prerequisite/rank pool. It prefers absent paths and unseen cards; sparse catalogues retain an old alternate only to fill the offer. No new alternative means no redraw. The normal overlay adds a compact footer and key4; controller navigation includes it. Each offer owns one free redraw, with no seed cost or boon award. Solo `choiceRedrawn/choiceRound` and host-owned member `redrawn/round/choices` keep it personal. Host validates the round and spent flag; replaced old cards are rejected by ordinary choice validation. Snapshots/handoff retain choices and the spent flag; a new offer resets it. Audio reads the stable offer round so redrawing cannot masquerade as a level-up. The browser review checks touch and keyboard on phone/compact layouts in Chromium and WebKit.

`plantCarer` is the shared live-owner lookup for growth and protection. Garden bites, hazards and friendly blasts use the cared plant's Shield/Barkskin; Bramble uses that same carer. Evergreen is once per actual carer per garden, with a validated `evergreenWorld` marker in every member snapshot. Promotion/rejoin cannot re-arm the rescue. Solo reset starts unused; moving to the next garden permits one new rescue. Strongest Cairn/Sligo guard, shelter auras, High Tide care, existing artwork and attacker-owned Mulch remain unchanged.

## October 4 Night Relay final escape

`relayTeamAtExit` checks every member of the current server room roster before the final exit charges. Fresh-only `relayActors` still owns rune inputs, carrying, health simulation and the two-human freeze. A stale participant outside the exit, a ten-second locally hidden PWA reservation or a member awaiting hydration cannot disappear from the escape requirement; accepted return or actual roster departure resolves it. Already accepted arrivals remain valid while stale controls cannot operate a rune. Existing scalar snapshots and promotion retain the rule without a new wire field. The roster regressions cover three/four players, charge decay, real timeout, input return, missing hydration, departure and host handoff.

## October 4 browser verification gate

`scripts/check-mycel-combat-browser.cjs` executes all thirteen declared groups in Chromium and WebKit by default. Each engine writes its actual group results, build hashes, viewport evidence and errors; diagnostic `MYCEL_BROWSER_GROUPS` selections are explicitly partial. Empty or unknown engine/group selections fail. The black-box startup regression requires an actual Playwright launch attempt and a nonzero, clean exit on failure; it catches the previous successful no-op without installing a browser. CI requires review artifacts to exist.

The observer remains confined to intercepted local review responses. Touch checks use actual canvas threat/character taps with DPR-safe coordinates; C/V retain keyboard/controller checks. Cost assertions compare state immediately before and after accepted casts, so legitimate passive Culture cannot distort the debit. Isolated causal fixtures clear incidental stage weather, retain strict restoration ledgers, enter genuine pond water for cancellation and keep a separate living plant for revival. No production debug API, action buttons or runtime/art changes are introduced by this gate repair.

The Rattus review's final heavy-latch/blur case observes the accepted cast and actual window blur in the same real C keydown task, retaining cast identity and paid cooldown. CI exposed an 835 ms frame gap: the genuine native tail-whip could draw after the real .75 s lease expired and be labelled idle by the phase observer. Waiting for another latch body before blur therefore tested a timing race rather than cancellation. Earlier heavy, guardian, light, geometry and plant cases still require their native rendered bodies. Do not extend gameplay clocks or add retries to conceal that gap.

## October 4 browser selection and replay checks

Boon reviews reject explicit empty or unknown engines. Cairn selects only its own declared groups and requires a nonempty selection after the existing pair/solo/idle filters; inherited Object names cannot count as verification. Cairn and Rattus reject simultaneous pair-only and solo-only flags before launch. Default group order and valid diagnostic selections remain. `tests/browser-review-config.test.cjs` checks actual CLI startup, rejection before launch, failure evidence and cleanup without installing browsers.

Rattus replay packets retain the guest's genuine avatar. Accepted movement can earn Momentum before the packet's old typed action is rejected, so comparing the meter across the entire packet conflates those effects. The local review observer wraps the actual actions array callbacks in one synchronous task after avatar validation. It requires one real dispatcher and every packet callback, then selects exactly the old action by its fresh ID captured at enqueue. Legitimate queued pickups remain valid. The selected action must advance its ACK while the utility tag, Momentum, cast/payment fields, rewards and target state remain exactly unchanged. Fresh movement, ordinary clocks, native rendering and production code retain their existing behavior.

## October 4 Night Relay promotion input freshness

Night Relay tracks accepted remote input with authority-local `relayInputAt`. Promotion clears remote confirmation rather than treating the shared `last` clock rebase as a new human input. Only an accepted current-world avatar in a valid input envelope refreshes Relay participation and held controls; rejected movement, wrong-world packets, snapshots and join handshakes cannot rearm stale Tend. The initial room grace remains until the first input confirmation. The marker never enters the wire snapshot.

Accepted arrival and authoritative health remain independent of input freshness. With fewer than two fresh humans the existing mode freeze takes precedence; an absent teammate already at the exit retains their arrival. A known down gardener can confirm presence with a clean stationary heartbeat at their authoritative body, without moving or reviving it. That heartbeat clears old Tend so revival cannot revive an old held control. Generic presence and class cast clocks retain their existing rebasing behavior.

The paired Relay browser review waits for exactly the selected number of mounted clients and for every client's real ready state. An empty status collection cannot satisfy readiness while the review shell's asynchronous source fetch is pending. CI completed the actual WebKit heist, then exposed that empty-collection startup race in Chromium; the guard preserves all gameplay assertions and timeouts.

## October 4 signature discovery

`MaxBuilds.signatureProgress` previews one unowned signature actually advanced by the offered prerequisite rank. It returns canonical remaining names/ranks after the proposed pick, filtered by class and mode, preferring dedicated class signatures and then the fewest missing ranks with catalogue-order ties. The live card retains immediate `Unlocks` hints first; otherwise it shows `Toward` and the remaining requirements, including in its accessible name. Owned signatures, already-satisfied prerequisites and unavailable ranks produce no progress claim. This is pure presentation: odds, IDs, prerequisites, combat and boon spending stay unchanged.

The boon browser review retains its original redraw case and adds all six classes' early signature previews on phone and compact viewports in Chromium and WebKit. It checks exact requirements, accessibility, before/after-redraw bounds, a live world and actual accepted picks. `review.html?mode=boons&class=runner&progress=1` starts with zero Ring tempo for the long two-prerequisite preview; normal review fixtures and production storage remain isolated.

## October 4 native and release observation

The signature release passed all 28 actual boon browser cases, but exposed existing class-review fixture/observation defects. Mycel's body gate requires its actual registered adapter cell, not an ordinary toss draw while the accepted primary cue is positive. The same two-second deadline and native coordinates, integer anchors and original sheet checks remain; no accepted body still fails. Full draw history reproduced the idle failure: the empty fixture's ambient timer is clamped to four seconds, and accumulated run time permits a scout whose genuine hurt suppresses every native release frame. A dedicated fresh idle fixture resets run elapsed once at setup, then lets the actual world run normally for seven seconds; it checks elapsed time, no threats and zero hurt before the accepted B wake. Other fixtures, gameplay clocks and hurt policy remain unchanged; no recurring cleanup, manufactured pose or timeout increase is used.

Rattus's private review probe records Momentum immediately before and after the actual `rattusDrivingReleaseWorld` call. Solo held Driving and promotion compare the exact accepted sample and debit for one canonical owner/cast/start tag, rather than a meter read in an earlier asynchronous task. The genuine 18-per-second fade remains: a controlled scheduling gap made the former .35 comparison fail while the actual release sampled exactly its current meter. Gameplay, motion leases, cooldowns, artwork and production APIs are unchanged; the observer regressions execute the tracked gates and reject absent/malformed native evidence, wrong owners, stale casts and bad payments.

## October 4 Garden 7 fungal composition

The owner's new level-reference archive is inspiration, not a runtime asset pack. Garden 7 now replaces its outer repeated stone arches with low-value fungal depth and broken organic roof/flank forms fitted to the exact main/route/place/expedition room bounds. Its single hero canopy has an asymmetric tilt, fuller native dome, dark gills, curved bark and restrained mint/amber accents. The original cavern layers remain visible; far forms must not acquire bright horizontal route-like lips.

That pass changed only Garden 7 scenery. It pinned complete ordered non-7 scenes and Garden 7 room/bounds/footings to `805551b`, retained original Sanctuary/Seed Vault bytes, and swept 100 seeded native compositions with caching and the unchanged operation budget. No source PNG, collision map, camera, live clock, shrine, guardian, control or co-op state changes. Same-camera actual browser evidence in `review/crown-ascent/garden-07-depth/` checks real walking, jumping and landing rather than a teleported success. Existing Figma scenes are historical review snapshots, not updated source authority for this pass.

## October 4 Garden 14 fossil composition

The next main loop is Garden 14 only. Five outer room recipes replace bright generic arches with quiet cold recesses, curved buried rib echoes and chipped dark cave framing. Landing arches and actual platform supports remain. The hero keeps its original footprint but gains a deeper rounded orbit, broken brow, an open layered jaw and varied teeth. Subdued irregular spine connections join uneven vertebrae without restoring a bright walkable-looking strip. Preserve winter ledges/weather, global cavern depth and the normal player camera.

Regression baselines are intentionally partitioned: complete gardens other than 7/14 retain `805551b` scene data; complete Garden 7 retains `8680e00`; Garden 7 geometry retains `805551b`; Garden 14 geometry retains `8680e00`. Do not refresh a whole combined hash just to bless another garden. Fully furnished seeded tests include Places, Expeditions and GuardianSites. Actual same-camera proof is in `review/crown-ascent/garden-14-depth/`; native PNGs, gameplay, co-op and Figma authority remain unchanged.

## October 4 Garden 3 aqueduct composition

The next bounded loop changes Garden 3 scenery only. Its aqueduct replaces thin repeated rings and the bright unbroken header with heavy worn masonry, unequal open portals and a fractured canal crown. Quiet retaining-wall depth follows the exact main/route/place/expedition rooms rather than stacking another set of generic arches. Original cavern layers remain visible; sparse moss and recessed stone do not become false walking surfaces. The hero retains its original width and upper envelope; only dark native pier foundations extend downward to follow the actual soil, closing inherited floating-base gaps. Upper landing arches and real platform supports remain unchanged.

The untouched scene partition now excludes only 3/7/14 and still derives from `805551b`. Complete Garden 7 stays pinned to `8680e00`; complete Garden 14 is separately pinned to `d5f501e`. Original geometry pins remain, with dedicated Garden 3 and fully furnished Garden 3 bounds/rooms/footings checks. Never replace these independent baselines with a new combined hash. The same-camera review in `review/crown-ascent/garden-03-depth/` records genuine first-ledge traversal. No runtime PNG, collision, shrine, camera, clock, control, co-op or Figma source-authority changes.

## October 10 Figma level implementation pipeline

The level compiler now preserves approved output on live-frame structural errors,
checks the metadata page ID, and atomically replaces valid exports. `--out`
creates a separate review export; it works with live reads or `--from` captures.
Authored integer `ladder` rectangles use the existing live ladder physics and
stable IDs. `MaxLevels.reachable` includes supported ladder endpoints; route
steps distinguish climbs from jumps. Actual Cairn ascent and return are tested
at 30/60/120 Hz. The graph is still an approximation of solid collision, so
new authored rooms require actual traversal checks.

Live variants of Gardens 1–2 can explicitly opt into `replace-picture`.
`furnish-place` retains the existing native place, false walls, caches and
available bounce blooms without duplicating furnishing. Existing unmarked
layouts, picture masters and all production PNG pins remain unchanged.

The latest twenty-level concepts are on Figma board `746:117481` and draft
PR #51. Their normalized composition anchors are not authored game geometry.
This pipeline batch does not implement their new regional artwork or nineteen
continuous connectors. Figma authoring must supply native playable frames;
new art must pass the existing production-source contract. Historical review
captures cannot establish fresh synchronization.
