# Claude handoff — MAX · NIGHT GARDEN

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
2. **Maximum four players.** Players can join a running garden.
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

Skills are one tap on Max or E, never a new pause, sprite or boon. Guests run the local part. The host checks cooldown and position in the `skill` branch of `coopInput`, and `coopClassSkill` runs the guest's own class verb. A guest's brace follows the host's: the snapshot carries what is left of it.

Character appearance and gameplay role are one selection. Do not reintroduce a separate skin/costume picker.

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
