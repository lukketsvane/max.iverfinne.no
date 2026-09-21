# MAX · NIGHT GARDEN

A pixel garden roguelite for phones. Collect seeds, grow and protect a garden,
then climb a beanstalk to the next world. Your result is the garden you grew.

## Run locally

Use Node 22 or newer. Run `npm ci && npm run build`, then serve `dist/`, for
example with `python -m http.server 8765 --directory dist`. Open
`http://localhost:8765`. The game stays static; esbuild bundles the menu and the
pinned Supabase client. No server process or CDN script is required in production.

- `index.html`: game, original embedded artwork and simulation.
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

Keyboard: Left / Right (or A / D) to move, Up (or W) to jump, Down / Space to
tend the garden, Shift to run, B to defend, L for the lantern and R to refill.
There is no in-run menu or pause button. Upgrade offers are three live icons:
tap one or use keys 1–3 while the run continues. Reloading always starts a fresh
attempt; no local or cloud checkpoint is written or loaded. The browser may
suspend a background page, but this creates no resumable saved run.

## Accounts and Supabase

Players use a username and password, with **no email and no confirmation**.
Usernames are case-insensitive, 3–24 ASCII letters/digits/`_`/`-`, starting with
a letter or digit. Internally, `max` maps to `max@players.max.invalid`; `.invalid`
is intentionally non-deliverable. Supabase Auth hashes passwords and manages
refreshable sessions. The frontend never stores the password, and does not use
IP addresses as identity. The reserved identifier is an implementation detail,
not a player contact address. There is no email-based password recovery.

Only finished-run personal bests, sound preferences and remembered login persist.
There are no save/load controls. Old cloud data and its protected database schema
are left intact, but the current frontend never reads or writes that slot.
Personal records are local, not verified global leaderboard entries.

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

Each raid has a fixed enemy budget. Faster defence clears it sooner. Time in the
current world adds bounded pressure every 90 active seconds: up to three extra
enemies, 18% movement and 15% damage. Time continues during upgrade choices; browser background suspension does not
advance pressure. An approaching wave gives three brief edge flashes and chimes.

Every attempt starts at world one. The run keeps its full bouquet across worlds
in memory and displays it on death. Only completed personal-best statistics are
stored, once per finished attempt. Old v6/v7 checkpoints are ignored.

## Deployment audit (21 September 2026)

The audited main commit was `1283708c708ef65609c1b3af1d51733a2a048d78`.
It lacked the supplied beanstalk/world-progression prototype. Those changes are
restored here without the prototype's four automatically planted demo crops.

Live Vercel inspection found `max.iverfinne.no` attached to the **tv.iverfinne.no**
project (`prj_VQXHj0WNLhHH0OplajrjZ5Q4LH9F`). The repository's former
`.vercel/project.json` pointed to **v0-image-analysis-xy_gitless**, an unrelated
project. That stale local link is removed. A merge into this repository alone
does not establish that the domain will serve the new commit.

The repository has since been connected to the **max.iverfinne.no** Vercel project
(`prj_QU1gHXGoDr99H3MxAUcaXGx2wgMe`). Its old Next.js preset is overridden by
`vercel.json`: Other framework, `npm ci`, and a static `dist/` build.
The legacy hard-coded alias is removed; domain assignment belongs in that
project's Vercel settings. Preview branches can now deploy independently.

Before publishing, verify the custom domain against the exact deployment.
At the connection check it was still attached to the TV project. Do not deploy
this game over the unrelated project or change the TV site's deployment to preview it.
The legacy live workflow is only a smoke check; it does not prove byte-for-byte
equality between main and the public site.


## Companion and result artwork

Every new run starts with the small watering companion. It follows Max, approaches
reachable thirsty plants, and transfers water from a finite tank up to 78%
moisture. It gives no care-score, XP, healing or instant growth. Tap the robot or
press R while nearby, then stay still for the two-second refill.
Ponds and steep ground block its walking route. It packs away during climbing
and world travel and rejoins after leaving the visible garden.

The `robot` run upgrade has two ranks and competes with the normal upgrade
choices. Small / upgraded / large tanks hold 1 / 1.6 / 2.4 units, with watering
rates of 0.10 / 0.13 / 0.16 moisture per second. Both upgrades reset on a new run.
Water remains consistent during world travel within the current attempt. Reload
or retry creates the small robot with a fresh tank. All UI text is English.

Artwork is imported without resampling: the 32×32 starter from
`fix/native-sprite-contract` at `31805b7`, the supplied 48×40 robot developer pack,
and the supplied 80×48 watering rover. Cell dimensions include transparent
padding; the visible robots are 20–22, 29 and 31 pixels tall. Each tier uses its
own documented anchor and animation timing. The small rover uses the supplied
separate spray; larger watering frames already contain it.

The incoming `assets/results-native/` pack at `205aae9` supplies the bouquet
compositor and 5×7 font. The live result uses `rogueRun.garden`, the original
plant drawing callback and the original landscape/Max sprites. Each bundle
contains up to 24 records; previous/next controls retain every plant in longer
runs. Static example bouquets and sample leaderboard names are never used as a
player result. Garden Records shows personal bests on this device.

`/review.html` offers portrait/landscape result fixtures, empty and 53-plant
runs, and all three companion tiers. Its game copy replaces storage with an
in-memory map and uses a disconnected guest menu; sample runs never replace player saves.
The production game exports no debug API.

The main menu uses native game sprites in a separate night scene with Play,
Garden, Settings and Credits. Sound is a device preference; help and account
controls appear only when opened. Gameplay has no persistent text HUD. The
control suite exercises touch cancellation, relative dragging, quick downward
swipes, keyboard actions and cancellation when movement resumes. Physical iOS
PWA testing is still needed to assess thumb feel and device-specific browser behavior.
