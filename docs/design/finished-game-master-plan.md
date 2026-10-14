# MAX — finished-game master plan

Established 14 October 2026. Owner: Iver Raknes Finne. Baseline: `778ab6e`.

## The goal

Make MAX at least as substantial, replayable and carefully finished as Risk of
Rain 2, through MAX's own garden, characters and underground ascent. Every
change must strengthen a player's decisions, mastery, discovery or confidence
in the game. Feature counts and passing tests alone do not establish fun.

The reference standard is the combination described on Risk of Rain 2's
[official store page](https://store.steampowered.com/app/632360/Risk_of_Rain_2/):
distinct characters and alternate skills, interacting items, authored places,
escalating danger, secrets, repeatable challenge and cooperative play. Its
advertised item count is a useful indication of depth, not MAX's completion
criterion. Re-evaluate the comparison against actual play, rather than chasing
its expanding DLC catalogue.

MAX's defining loop remains: **grow something worth protecting → defend and
explore → choose how to develop → overcome the guardian → physically climb
onward → leave behind the actual garden of that attempt**.

## What must remain recognisably MAX

- Native pixels, integer anchors, disabled smoothing, existing silhouettes,
  restrained moss/mineral colours, amber warnings and cyan openings.
- A strange living garden, the six existing characters, plants as care targets,
  recovery, tactical footing and the record of the run.
- The climb from buried vaults to the radioactive dawn, with no early outdoor
  sky and no ground teleport replacing the exit ascent.
- One low-friction shared Play flow, exclusive character slots, four players,
  inherited difficulty and a world that keeps moving during choices.
- A quiet phone interface: stable placement, native skill icons, small useful
  cues and unobscured play space. Preserve current gestures until a specific
  replacement is implemented and tested; the phone-access milestone explicitly
  revises the current C/V-only policy instead of pretending parity exists.
- Figma MASTER is the authoring authority for new level design. Reference
  images and review boards are studies, not collision/art exports. Preserve the
  existing Pixel Mill Turtle source until a verified MASTER replacement exists.

## Assessment of the actual baseline

This assessment combines current source, real in-memory combat/session probes,
native-source receipts, continuous physics tests and the completed browser
gates. It is not a completed human playtest or a claim of parity with RoR2.

| Area | Existing foundation | Gap to finished quality | Evidence |
| --- | --- | --- | --- |
| Character mastery | Six distinct roles, resource economies, confirmed-contact rewards, alternate loadouts and native motion | C/V depth is inaccessible to a phone-only player; some alternate skills bypass promised mutations | `max-classes.js`, `polge.inc.js`, class modules, `README.md` input contract |
| Builds | 49 boons, prerequisites, signatures, seeded continuation and personal redraw | Establish useful contrasting builds for every equipped kit; remove ineffective choices before growing the catalogue | `build-paths.js`, class contracts, actual alternate-cast probes |
| Combat pace | Fast role introductions, warned strikes, continuous clock, overstay guardians, bounded populations | Stage role profiles are deduplicated, losing composition weights; encounters need deliberate tactical phrases and measured recovery | `run-director.inc.js:combatProfiles/waveEnemyKind/nextRunEnemyKind` |
| Levels | Twenty stage identities, shared seeded routes, places/districts, physical ascent; bound Figma Garden 1 and native Turtle Garden 4 | Sixteen stages still derive much traversal from shared components; author distinct route problems and local consequences | `stage-layout.js`, `stage-expeditions.js`, level/source data |
| Discovery | Caches, puzzles, six trials, encounters, weather and secret modifiers | Several outcomes are automatic gifts or next-map modifiers; add genuine physical side spaces and meaningful commitments | `wonders.inc.js`, `run-director.inc.js`, `secrets.inc.js` |
| Native graphics coverage | Approved character, bird, rat, guardian and original ordinary-role packs; missing thorn/leech/rammer mappings now implemented from the promoted original Figma sheet | Three role replacements and native altar hooks are under verification, not released; remaining production objects/projectiles still need native bodies and loading/failure coverage | `native-art.mjs:ENEMIES/idFor/load`; [audited inventory](finished-game-art-inventory.md) |
| Phone clarity | Stable icon loadout; 48 Chromium/WebKit cases passed; tiny HUD and native cues | Live meter/help can describe the default skill after an alternate is selected; first-minute tests are not a fresh touch story | `index.html:drawSkillPip/help`, first-minute/browser fixtures |
| Co-op continuity | Host-owned combat, room reservations, snapshots, admission and promotion logic | A transient polling failure can leave the room; a departing host can send terminal `end` before promotion | `coop-session.mjs`; isolated real-session reproductions |
| Results/retention | Exact plant archive, actual-run bouquet, collection and optional accounts | Record the build, equipped loadout, difficulty and actual loss/win cause; explain why this attempt differed | `run-results.js`, `runStats`, records |
| Sound/finish | Separate music/effects, bounded voices, positional effects, priority warnings and iOS recovery | Two cycling music tracks; add chapter/combat dynamics and check mix/readability under real crowded play | `soundtrack.mjs`, effects/listenRun, audio pack |
| Release confidence | Extensive tests, browser reviews, source receipts and exact deployment checks; foundation `ce97f671` passed 916/916 locally | Original baseline was 881/882 before the historical/current source fixture repair. PR 54 release is pending; the local foundation result does not verify later Tiara integration or graphics changes. Live smoke and performance coverage need strengthening | `/tmp/max-finished-foundation-tests.log` and status receipt; `master-runtime-publication.test.cjs`; workflows/transport |

Concurrent Tiara/Garden 10 work belongs to the separate head-boss task. Integrate
its tested commits from current main; do not overwrite it or quietly count
unpublished staged work as finished.

## Execution order

Each milestone ends with an inspectable game checkpoint, its evidence and an
updated [execution ledger](finished-game-progress.json). Work on independent
repairs may proceed together; the release gates below determine completion.
Do not jump to a larger asset/content batch while a preceding player-facing
blocker remains. Development targets below are targets, not measured results.

**October 14 priority override:** the owner's screenshot and explicit request
to replace all remaining placeholder art make complete native-body coverage the
immediate next checkpoint, before M2 or any new content expansion. M0/M1 still
need their release evidence; their locally tested foundation is not a finished
game. Keep the separately authored Tiara/Garden 10 integration intact.

### M0 — a trustworthy baseline

Repair the stale source-publication fixture. Keep the original Hollow Tree
capture byte-equal to its immutable archived outputs. Separately prove that the
actual October 14 geometry and 29 complete ART chunks reproduce today's exact
geometry/art pair, receipt hashes and source binding. Keep all existing strict
compiler failure/atomic replacement checks.

**Done when:** full tests/build pass; the intended exact SHA passes CI; the
production deployment and custom-domain bundle match. Retain historical and
current proof rather than replacing one with the other.

### M1 — dependable, honest play

1. Retain room membership through temporary polling/network failures, recover
   through the existing authority/channel path, and distinguish confirmed
   expiration/auth loss from a recoverable interruption.
2. Let a healthy teammate inherit a departing host's run. A stale channel signal
   must not discard the server's still-live room. Preserve genuine defeat,
   deliberate cancellation and closed-room behavior.
3. Show the actually equipped skill's cost, cooldown and readiness; include
   Mycel's Culture. Help, denied-cast feedback and every controller binding must
   use the accepted kit. Rendering must remain read-only.

**Done when:** actual session tests prove interruption/recovery, healthy host
departure and confirmed closure; actual combat/input tests prove all equipped
specials, resource rejection and cooldown feedback without changing combat
spends. Existing guest replay, PWA, controller and class gates remain green.

### MG — complete native sprite coverage (urgent user priority)

Fix the permanent missing ordinary-enemy mappings first: kind 9 thorn caster,
kind 10 dew leech and kind 11 rammer. The dew leech's flat cyan/teal body is the
likely screenshot defect, not a new intentional style. Existing birds, rats,
role packs and bosses remain native; do not substitute oversized boss sprites
or recolour a rectangular placeholder and call it finished.

**Implementation checkpoint, not a release:** the unchanged original Figma
enemy sheet `414:3` has been promoted from archive `425:2` to production
`451:3`/`1040:21976`. Three native 32px role atlases now bind reviewed original
poses with anchor `(16,31)`; no rescaling or hitbox change. Guardian/trial altar
hooks use the approved native district altar. The integration owner reports
11 focused checks plus 12 Tiara checks passed. Retryable complete-art admission
is being implemented/verified; full source/test/build, phone and release gates
remain outstanding. The inventory records the exact source and remaining work.

Work through the [production placeholder inventory](finished-game-art-inventory.md)
until every confirmed crude body has an accepted native replacement: guardian
and trial altars, small guardian objective nodes, Mycel/hostile spores, root
strikes, Loom/Echo physical props, High Tide boon tokens and the Night Relay
carried lantern. Reuse a suitable approved source only at its native size and
anchor; otherwise author the missing asset in the actual Figma production
source and record its pack, atlas, provenance and authenticated readback.
An archived sheet is a candidate, not approved runtime coverage until verified.

Also audit loading and failed-asset paths. An atlas omitted from the load list
is a permanent coverage defect; a supported sprite missing because loading has
not finished is a different failure. Neither may silently leave a crude flat
body in normal playable production. Define and test bounded loading/recovery
behavior without changing enemy admission, hitboxes, timing or damage.

Preserve deliberately simple HUD pips, bars, warning/impact extents, particles,
existing shaped native pixel motifs and approved Crown objective art. A
`fillRect` call alone is not evidence of a placeholder. Changing hazard art must
not obscure its exact threatened region or turn animation into damage logic.

**Done when:** an exhaustive actual-spawn/render matrix covers ordinary roles
0–11, rat variants, all campaign/roaming bosses and trial/event/circuit guards;
the real native PNGs draw accepted movement, windup, attack, recovery, hurt and
death states where the role supports them. Every confirmed inventory row is
closed with source evidence and same-camera crowded-phone review; startup and
failed-load tests cannot silently retain flat fallback bodies. Native 1:1
registration, source/PNG pins, gameplay and untouched-stage contracts pass.
Run the full test/build/source gates and verify the exact release SHA. This
checkpoint fixes graphics coverage; it does not establish RoR2 quality parity.

### M2 — the whole kit on iPhone

Implement an explicit touch design for secondary and utility actions, including
Rattus's held latch/Driving and Erasmus Berg's actual tap/toggle Brace (up to three
seconds, released by movement/jump/dodge or an explicit toggle), while retaining
unobscured canvas play and the existing short character tap. Do not invent a
held-Brace requirement. Start with a transient native
icon gesture from the character; test its recognition before adopting it.
Separate movement and action fingers, cancellation, interrupted touches and
intentional holds. Cover lantern/refill/Shovel access only where the owned kit
and mode permit it. Update the documented input policy with the implementation.

Add a fresh, no-upgrade first-minute phone story: enter, move, plant, tend,
defend, dodge, use the equipped kit and discover the first route choice. Use
brief contextual gesture cues; do not add a permanent instruction paragraph.

**Done when:** all six classes can perform every supported base verb through
actual touch in portrait/landscape Chromium and WebKit; holds release safely on
cancel/blur/background; no unintended throw, movement, Tend or double cast;
host/guest receive the same admitted action. A first-time human can demonstrate
the core loop without Settings or a keyboard. Human comprehension remains an
unmeasured criterion until observed.

### M3 — coherent, surprising builds

Audit every boon against each eligible equipped skill. Integrate mutations that
promise shared damage/reach/recovery; filter or describe genuinely specialized
ones honestly. Preserve owner attribution, prerequisites and bounded proc
chains. This milestone repairs existing promises first. The wider target of
three tactically distinct directions per character, each with two useful
signature combinations, continues through M7 rather than delaying level work.

Develop the catalogue from missing interactions: useful care turns into
offense, motion changes attack opportunities, defense earns a counter, a garden
placement reshapes combat. Every added upgrade needs a noticeable live effect,
an original name/icon and a real integration test. Avoid numerically different
copies and unavoidable mandatory upgrades.

**Done when:** every currently offered mutation has its promised effect or an
honest, eligibility-correct description for the equipped kit; three contrasting
existing builds produce recorded ordinary Garden 1–3 stories. Seeded offers
retain alternatives and recovery from poor draws, without owner borrowing,
recursive proc farming or inaccessible mandatory signatures. Record actual
choices and outcomes, not prefilled showcase victories. Complete the wider
eighteen-direction content target through M7.

### M4 — the opening chapter as a complete game

Finish Gardens 1–5 as the quality reference for the whole campaign. Begin with
**Garden 3's Broken Aqueduct** in the actual Figma MASTER: a direct crossing, a
lower canal/root detour and a high lookout that all reconnect to the same dry
planting court. Preserve its underground masonry, existing native palette and
all other stage partitions. Static ledges/ladders/ponds first; moving machinery
requires its own implemented physics and co-op contract.

Then refine Hollow Tree, Railway Ruins, Turtle and the Mossback chapter finish
as one play sequence. Arrange visible rewards, sheltered/exposed combat space,
different jump rhythms, safe retreat and a clear optional gamble. Let care and
class movement offer shortcuts without making upgrades mandatory.

**Done when:** measured from actual spawn on declared seeds/input modes, the
first route decision is visible within a target 12 seconds; Garden 3's direct
court approach targets ≤35 seconds for unupgraded walking Erasmus Berg, without sprint,
setup relocation or skills;
measure each detour's extra time and reward against the pressure clock. All
six unupgraded classes complete continuous outbound/return at 30/60/120Hz,
real landing/water escape/planting/physical ascent pass, and the optional trial
cannot lock the guardian. Fresh phone chapter stories show actual first picks,
one discovery, warned fights and a guardian clear. Native geometry/art bindings
and untouched-stage/PNG checks pass.

### M5 — encounters with identity and rhythm

Use seeded budgeted encounter phrases: directional guard plus caster, thief
chase, healing escort, rammer flank, close swarm and vertical interceptor.
Respect the existing early role unlocks. Retain weighted family identity,
actual warning locations, melee reach, safe retreat and the population/voice
budgets. Mix pressure bursts with short useful opportunities to tend, traverse
or choose; menus and the global clock still run.

Calibrate Easy for learning, Medium for the baseline, Hard/Insane for player
survival. Overstay must progressively become untenable through readable real
threats, not invisible damage or an arbitrary instant-loss timer.

**Done when:** measured fresh runs meet different compositions across seeds
and chapters; all required classes have counterplay; no early rat regression,
unwarned unavoidable contact or endless healing stalemate. Normal progression
and deliberate camping have recorded pressure/outcome traces on all four
difficulties. Assess fun in actual play, alongside deterministic balance probes.

### M6 — twenty places worth remembering

Extend the opening chapter's standard in batches: 6–10 buried works, 11–15
frozen depths, 16–19 underworld machinery/breaches, then Crown approach/escape.
Give each garden a distinct traversal problem, one memorable landmark, a
local combat-space identity, a meaningful optional route and a return/rejoin.
Vary topology and objectives within that identity using authored native modules.

Build actual secret chambers/side loops with visible clues and persistent
one-time outcomes. Make selected weather change a route decision or opportunity;
do not claim a physical secret garden when the implementation is only a modifier.
Preserve required reach without upgrades, the shared seed and real exit climb.

**Done when:** every stage has a Figma source/evidence entry and continuous
ordinary-input traversal/combat story; chapters are distinguishable without
labels; fresh seeds change decisions, not only mirror positions. Each source
activation proves integer registration, complete ART export, normal compilation,
legal terrain and exact geometry/art binding. Publish one tested stage or small
connected batch at a time.

### M7 — rewarding risk, bosses and repeat play

Tune exploration income, care, enemy rewards, boon cadence and clock together.
Show real costs/payoff before committing to an optional fight. Preserve ways to
recover a viable build without turning safe farming into the dominant strategy.
Give each boss a readable objective, distinct spatial problem and rewarding
recovery; integrate Tiara only through its accepted source contract.

Finish the Crown, conclusion and existing Last Seed/High Tide/Night Relay modes
as complete variants of the same game. Add unlock challenges and chosen run
modifiers only when they create a new mastery problem. A seeded repeat challenge
must fit the existing shared-session model rather than add a contradictory Play
flow. Avoid account-power requirements for a fair fresh attempt.

**Done when:** eighteen documented build directions have distinguishable actual
run stories; boss-specific tactics matter for melee and delayed bombs alike;
every difficulty has measured attainable progression and meaningful failure;
secret rewards are real, paid once and survive handoff; endings/retries/archive
are complete; repeat runs invite a different decision/build, not only a score.

### M8 — visual, sonic and tactile finish

Audit every sprite/prop/effect for native registration, visual hierarchy and
readable threat state. Keep quiet scenery, clear footing and distinct silhouettes.
Finish placeholders through accepted Figma native masters and pack provenance.
Test camera framing, water, HP/resource pips, notch clearance, reduced motion,
audio-off and colour readability at the busiest normal encounter.

Develop MAX-specific chapter/exploration/guardian/climax music, verifying its
authorship/licensing and retaining the proper provenance for the current Ice
and Jim Hall recordings. Use bounded streaming/transitions. Keep effects
prioritized and brief; cues should
teach acceptance, risk and useful contact without a constant wall of noise.

**Done when:** same-camera phone evidence shows readable enemies, warning,
actor and footing simultaneously; no unregistered/overscaled art or incoherent
palette; playback resumes safely after iOS interruption; the mix remains useful
in four-player combat. Music/art changes retain their proper source audit.

### M9 — a run worth understanding and remembering

Keep the exact garden/bouquet as the result. Add accepted loadout, difficulty,
owned boons/signatures, meaningful discoveries and actual win/loss cause to the
local record and useful compact result explanation. Preserve private/local
defaults and opt-in leaderboard publishing; migrate old records safely.

Use collection notes and unlocks to invite mastery and discovery. Ordinary
accounts reveal what the player actually found. Preserve the explicitly
authorised owner/all-discovered testing entitlement; it grants no fabricated
run, score or gameplay reward. Keep hidden characters and review-fixture
progress outside ordinary defaults.

**Done when:** a player can explain what their build did and choose a different
next attempt; records agree with accepted host state and the actual plants;
old saves, guest outcomes, sign-out and mode exclusions remain correct.

### M10 — demonstrate a finished product

Measure performance before optimizing. Capture frame intervals, memory trend,
snapshot size/frequency and action latency through a full late-run four-player
soak with joins, temporary disconnects, authority replacement and repeated
PWA interruptions. Separate loading costs from sustained growth. Aim for 60fps
ordinary phone play, with a provisional p95 frame interval ≤33ms on target
iPhone hardware, alongside measured median/mean frame rate; p95 alone does not
prove 60fps. Validate the budget on real hardware before treating it as met.

Make release smoke follow the intended deployment, verify its exact SHA and
exercise real admission/reconnect as safely as the environment permits. Profile
slow tests and split independent gates without deleting continuous route proof.
Fix actual defects before adding margins or retries.

**Done when:** a release candidate passes all game/native/database/browser
checks; complete campaign and mode stories exist; no known critical failure
remains; performance/network budgets are recorded; representative first-time
and returning humans can learn, win/lose fairly, discover a secret and want
another run. List unresolved device/human evidence plainly. Quality parity
with RoR2 is judged here, not declared after one feature batch.

## Rules for every implementation loop

1. Read the ledger, current main, README/CLAUDE and relevant contracts. Preserve
   concurrent work; use an isolated worktree when another task is editing files.
2. Select the earliest unfinished milestone and one bounded player benefit.
   State the intended behavior and its observable acceptance checks.
3. For level/art changes: edit actual Figma source, capture authenticated
   readback, compile normally and verify source/registration. References do not
   substitute for native source.
4. Exercise normal inputs and real simulation. No instant-kill fresh-player
   story, between-hop teleport or prerecorded success standing in for play.
5. Run meaningful focused checks, full `npm test`, build and relevant actual
   Chromium/WebKit gates. Inspect failures; retain strict assertions.
6. Reconcile latest main, publish a tested checkpoint and verify exact-SHA CI,
   production READY/alias and the custom-domain build. Do not call it live while
   a required check is pending or failed.
7. Update the ledger with changed files, evidence, release SHA and the next
   unfinished task. Explain observed outcomes and outstanding evidence honestly.

Future work should follow this order unless an actual defect or new user
instruction changes the priority. Revise the plan with the reason; do not let
an unrelated cosmetic idea displace the completion goal.
