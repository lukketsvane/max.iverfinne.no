# MAX · NIGHT GARDEN

A pixel garden roguelite for phones. Collect seeds, grow and protect a garden,
then climb a beanstalk to the next world. Your result is the garden you grew.

## Run locally

Use Node 22 or newer. Run `npm ci && npm run build`, then serve `dist/`, for
example with `python -m http.server 8765 --directory dist`. Open
`http://localhost:8765`. The game stays static; esbuild bundles the menu and the
pinned Supabase client. No server process or CDN script is required in production.

- `index.html`: game, original embedded artwork and simulation.
- `stage-layout.js`: the twenty gardens' platform routes, landing collision and native scenery.
- `run-director.inc.js`: mixed raids, exploration rewards, specialist enemies and milestone bosses.
- `run-results.js` / `run-results.css`: full-screen native bouquets from every plant grown during the run, with paged bundles and local records.
- `game-menu.mjs` / `game-menu.css`: main menu, controls and account UI.
- `player-account.mjs`: username mapping and legacy cloud-format utilities.
- `npm test`: game regressions plus account/restore and real Postgres RLS tests
  through PGlite. Supabase hosting and email configuration are not simulated by
  these tests; verify hosted sign-up and sign-in separately before release.

## Play

On a phone, drag left or right from anywhere to walk or run, and swipe up to
jump. Drag down to tend a plant within reach, harvest ripe seeds, or plant on
empty soil. A nearby beanstalk can be climbed the same way. Taps and stationary
holds never queue plant actions or walk to targets. Tap pests to defend.
Tap the robot nearby to refill. Moving cancels a hand action immediately.

Platforms have one-way collision: jump through from below, land on top, and
jump onward or walk off a ledge. Elevated routes lead to feathers and
shrine trials; higher optional perches reward improved jumps. Planting and
tending still require ground soil. No extra movement button is needed.

Keyboard: Left / Right (or A / D) to move, Up (or W) to jump, Down / Space to
tend the garden, Shift to run, X to dodge, B to defend, L for the lantern and R
to refill. Settings and Exit are available during play and leave the world
running. Only boon choices pause an active run; in co-op everyone chooses
before the team resumes. Tap a boon or use keys 1–3.

Choose Mech, Runner, Bulwark or Herbalist before Solo or Together. Classes
provide different starting abilities and remain open to every boon path. Moss,
Tide, Ember and Moon are independent costumes with the original animation
timings and anchors. Together supports a private room of 1–4 signed-in players;
the host starts after each player's class, costume and readiness are confirmed.

Reloading always starts a fresh attempt; no local or cloud checkpoint is
written or loaded. Finished garden records remain available. The browser may
suspend a background page, but this creates no resumable saved run.

## Accounts and Supabase

Players use a username and password, with **no email and no confirmation**.
Usernames are case-insensitive, 3–24 ASCII letters/digits/`_`/`-`, starting with
a letter or digit. Internally, `max` maps to `max@players.max.invalid`; `.invalid`
is intentionally non-deliverable. Supabase Auth hashes passwords and manages
refreshable sessions. The frontend never stores the password, and does not use
IP addresses as identity. The reserved identifier is an implementation detail,
not a player contact address. There is no email-based password recovery.

Only finished garden records, sound preferences and remembered login persist.
There are no save/load controls. Old cloud data and its protected database schema
are left intact, but the current frontend never reads or writes that slot.
Garden records are saved on the device. A signed-in player can choose to publish
a completed bouquet to the online leaderboard. Each published entry retains its
complete plant records; it never reads a private checkpoint. Published runs are
client-reported, rather than server-verified competitive scores.

Project: `zuezxsuqkvrzypjhbbqq`.

One-time hosted setup:

1. `npx supabase login`
2. `npx supabase link --project-ref zuezxsuqkvrzypjhbbqq`
3. Apply the checked-in `player_cloud_saves` migration with `npx supabase db push`.
4. In this project's Auth settings, enable password signups, disable **Confirm
   email**, and set the minimum password length to 8. The local `config.toml`
   already matches. Do not push the full local config onto an existing hosted
   project; it also contains local development URLs and unrelated defaults.
5. Set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel, or
   commit these two public values as `url` and `publishableKey` in
   `supabase/public-config.json`. Only `sb_publishable_…` keys are accepted by
   the build. **Never put a secret/service-role key in frontend config.**
6. Rebuild. Verify username signup returns a session immediately; sign out,
   sign in and refresh. Login stays remembered; the run starts fresh. No email is sent.

Without a publishable key the menu honestly presents guest mode. The checked-in
public config points to the project above. On 21 September 2026, both SQL
migrations were applied through the authenticated Supabase SQL Editor, email
confirmation was disabled, and minimum password length was set to 8.

`supabase init` has been run. CLI authentication/linking is separate from the
dashboard session and was not completed in the build environment. Because SQL
was applied through the dashboard, reconcile its history **after linking this
existing project and before running db push**:

```sh
npx supabase migration repair 20260921160631 20260921163937 --status applied --linked
```

For a new empty project, apply both migration files normally instead. Do not
mark migrations applied on a database that has not actually received them.

RLS restricts every exposed row to `auth.uid() = user_id`. Anonymous clients
have no table/function access. The save RPC is SECURITY INVOKER, checks the
expected account and revision, and cannot bypass RLS. The database rejects
oversized or malformed envelopes; the client validates game data before restore.

The playing field has no persistent text HUD. Upgrades reset between runs, as do
crops, seeds, robot upgrades and wildlife relationships.

## Balance and runs

Watering rewards meaningful hydration; watering a full plant cannot generate
points or artificial growth. A harvest needs 0.35 new growth since the previous
one. Tall plants keep their height. Mutation ranks stop at five, offers span
different play styles, and surplus XP retains every earned choice.

The twenty gardens use six route themes: terraces, canopy, crossings, ruins,
switchbacks and the final Crown layout. The five recurring themes vary their
platform widths and route rhythms as the run advances. Two elevated routes
offer exploration away from the garden; extra pickups on higher perches make
mobility upgrades useful without replacing the main route.

Raids send closely spaced mixed groups from alternating sides. Enemy mixes
depend on the layout and wave, and later gardens support more simultaneous
attackers. Each raid still has a finite budget: faster defence clears it sooner.
Pressure increases continuously with active run time and garden number, carrying
across travel. It increases enemy movement and damage, and affects the health
and budget of later encounters. Boon choices freeze this clock; Settings does
not. An approaching wave gives three brief edge flashes and chimes.

Specialists enter early: seed thieves in garden 2, spore casters in 3, shield
beetles in 4 and healing moths in 6. Marked dive attacks threaten players as they
move through the routes. Later spore volleys can target players above the ground
as well as crops, so higher ground does not remove every threat.

Clearing three raids unlocks each earlier garden's exit stalk. The final raid
in gardens 5, 10 and 15 includes a distinct milestone boss; garden 20 ends the
run at the Hollow Crown.

| Garden | Boss | Counterplay |
| --- | --- | --- |
| 5 | Mossback | Root markers announce a charge; jump clear or take a higher route, then attack during its exposed recovery. |
| 10 | Bellkeeper | Spore volleys alternate with roots aimed at players; intercept spores and move out of marked strikes. |
| 15 | Moon Moth | Interrupt its healing channel before it restores an ally, opening a vulnerability window. |
| 20 | Hollow Crown | Three phases mix roots, spores and summoned guards; use its exposed windows to finish the run. |

Optional shrine routes and passing weather events offer rewards at the cost of
time. Swan feathers, embers and dew pearls stack independently per player.
See [the run design](docs/run-design.md) for the broader class, item and co-op
rules; current layouts and encounter progression are defined in
`stage-layout.js` and `run-director.inc.js`.

Every attempt starts at world one. The run keeps its full bouquet across worlds
in memory and displays it when the attempt ends. Each finished attempt stores
its complete plant records and updates personal-best statistics on this device.
Completed bouquets remain available after reload and retry. Old v6/v7
checkpoints are ignored.

## Deployment and database

The connected Vercel project is **max.iverfinne.no**
(`prj_QU1gHXGoDr99H3MxAUcaXGx2wgMe`). `vercel.json` selects the Other framework,
`npm ci`, and the static `dist/` build. Pushes to a branch create a preview;
`main` is the production branch. Verify the deployment's commit and the custom
domain before calling a release live.

See the [21 September release verification](docs/verification/2026-09-21-release.md)
for the completed handoffs, automated checks, deployed browser evidence and
remaining manual coverage.

The hosted bouquet migration is
`20260921204258_bouquet_leaderboard.sql`. It creates public read access to
published personal bests, a private immutable submission receipt, and the
ownership-checked `submit_max_garden` RPC. Direct client writes are denied.
No private saved game is copied into the leaderboard.

The earlier room migration was applied under hosted version `20260921182418`.
The local file retains its original generated version `20260921180722`; reconcile
that existing migration history before using CLI `db push`. The two earlier
cloud-save migrations were applied manually as documented above. Do not apply
already-installed schemas again.

## Companion and result artwork

Mech starts with the small watering companion; other classes can unlock one
with their first Companion boon. It follows its owner, approaches
reachable thirsty plants, and transfers water from a finite tank up to 78%
moisture. It gives no care-score, XP, healing or instant growth. Tap the robot or
press R while nearby, then stay still for the two-second refill.
Ponds and steep ground block its walking route. It packs away during climbing
and world travel and rejoins after leaving the visible garden.

The `robot` run upgrade unlocks the companion and then has two further upgrades,
competing with normal boon choices. Small / upgraded / large tanks hold
1 / 1.6 / 2.4 units, with watering
rates of 0.10 / 0.13 / 0.16 moisture per second. Both upgrades reset on a new run.
Water remains consistent during world travel within the current attempt. Reload
or retry clears companion upgrades: Mech starts with the small robot and a fresh
tank; other classes begin without a robot until they choose a Companion boon.
All UI text is English.

Artwork is imported without resampling: the 32×32 starter from
`fix/native-sprite-contract` at `31805b7`, the supplied 48×40 robot developer pack,
and the supplied 80×48 watering rover. Cell dimensions include transparent
padding; the visible robots are 20–22, 29 and 31 pixels tall. Each tier uses its
own documented anchor and animation timing. The small rover uses the supplied
separate spray; larger watering frames already contain it.

The `assets/results-native/` pack at `205aae9` supplies the bouquet
compositor and 5×7 font. The live result uses `rogueRun.garden`, the original
plant drawing callback and the original landscape/Max sprites. Each bundle
contains up to 24 records; previous/next controls retain every plant in longer
runs. Static example bouquets and sample leaderboard names are never used as a
player result. Garden Records retains completed runs on this device, and the
online leaderboard renders each published entry from its own saved plants.

`/review.html` offers portrait/landscape result fixtures, empty and 53-plant
runs, all three companion tiers, all five Max appearances, enemy animation
states, and the Hollow Crown's three phases and attack tells. The native art
fixtures are `native-skins`, `native-enemies` and `native-crown`; choose one with
`?mode=native-skins&portrait=1`, or use the review page buttons. Its game copy
replaces storage with an in-memory map and uses a disconnected guest menu;
sample runs never replace player saves.
The production game exports no debug API.

The main menu uses native game sprites in a separate night scene with Play,
Garden, Settings and Credits. Sound is a device preference; help and account
controls appear only when opened. Gameplay has no persistent text HUD. The
control suite exercises touch cancellation, relative dragging, quick downward
swipes, keyboard actions and cancellation when movement resumes. Physical iOS
PWA testing is still needed to assess thumb feel and device-specific browser behavior.
