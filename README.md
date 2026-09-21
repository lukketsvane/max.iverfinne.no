# MAX FUGLESPRENGER

A pixel garden roguelite for phones. Collect seeds, grow and protect a garden,
then climb a beanstalk to the next world. Your result is the garden you grew.

## Run locally

Serve this directory with any static server, for example `python -m http.server 8765`.
Open `http://localhost:8765`. There is no runtime dependency. For deployment,
`npm run build` copies the three game files into `dist/` without changing them.

- `index.html`: game, original embedded artwork and simulation.
- `run-results.js` / `run-results.css`: paged result garden using the game's plant atlas.
- `npm test`: dependency-free Node regression tests against the actual game script.

## Play

On a phone, hold open ground to walk and swipe up to jump. Long-press the ground
to plant a collected seed. Hold a plant to water it; tap a ripe plant to harvest
when it has regrown. Tap pests to throw a bomb. Tap a tall beanstalk to climb.

Keyboard: arrows or WASD to move/jump/crouch, Shift to run, E to interact, B to
throw, L for the lantern. At an upgrade, inspect an icon and confirm the choice.
Simulation pauses while choosing, while hidden, and on the result screen.

The playing field keeps its original art and has no persistent text HUD.
Mutation cards remain icons, with temporary effect text and a confirmation button.
Every new attempt starts in world one with no crops or mutations. Animal affinity
remains persistent; this is a local personal-best game, not a verified leaderboard.

## Balance and saves

Watering rewards meaningful hydration; watering a full plant cannot generate
points or artificial growth. A harvest needs 0.35 new growth since the previous
one. Tall plants keep their height. Mutation ranks stop at five, offers span
different play styles, and surplus XP retains every earned choice.

Each raid has a fixed enemy budget. Faster defence clears it sooner. Time in the
current world adds bounded pressure every 90 active seconds: up to three extra
enemies, 18% movement and 15% damage. Upgrades and background time do not advance
pressure. An approaching wave gives three brief edge flashes and chimes.

The save schema is version 7 under the existing v6 storage key. It preserves raid
enemies and their plant targets, countdowns, dead plants, harvest checkpoints,
pending upgrades, loose seeds and the full run's plant gallery across worlds.
Old v6 saves load; an incomplete legacy wave is replayed because that format did
not save its enemies. The result waits for an explicit new-run action.

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
`vercel.json`: Other framework, no dependency install, and a static `dist/` build.
The legacy hard-coded alias is removed; domain assignment belongs in that
project's Vercel settings. Preview branches can now deploy independently.

Before publishing, verify the custom domain against the exact deployment.
At the connection check it was still attached to the TV project. Do not deploy
this game over the unrelated project or change the TV site's deployment to preview it.
The legacy live workflow is only a smoke check; it does not prove byte-for-byte
equality between main and the public site.
