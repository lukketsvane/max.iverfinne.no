# Watering robot: candidate review, not production integration

**Decision: pending. This robot is optional. Other robot assets may be better.**

The user requested a GIF-only ZIP and a handoff on main so the main developer
agent can inspect and evaluate the artwork. This change stages the existing
native candidate without selecting it, enabling gameplay, or replacing assets.
The GIF-only download was provided separately in the conversation.

## Review material

- [Atlas inspection page](index.html): all eight existing animations, both
  directions, integer enlargement and pause. This is an atlas bench, not a
  gameplay screenshot or an autonomous watering simulation.
- [Rover PNG](native/rover.png) and [JSON](native/rover.json): 256 x 192 sheet,
  48 frames in 32 x 32 cells; fixed ground anchor (16, 31).
- [Water FX](native/water-fx.png) and [JSON](native/water-fx.json): 16 frames.
- [Props](native/props.png) and [JSON](native/props.json): eight frames.
- [Optional icons](native/ui.png) and [JSON](native/ui.json): eight frames.
- [Palette](native/palette.json) and [drawing adapter](native/runtime.js).

Native files are reused byte-for-byte from draft
[PR #5](https://github.com/lukketsvane/max.iverfinne.no/pull/5), source commit
`31805b7cdadaaa9a11dc2ac74ebb21187364cffe`. The editable pixel generator and
historical real-engine fixture remain on that commit at
`scripts/native-assets/build.py` and `native-assets.html`. Do not copy its old
index.html, package files or build script over current main.

Serve the repository root with a static server, for example
`python -m http.server 8765`, and open
`http://localhost:8765/docs/asset-review/watering-robot/index.html`.
This review does not need the production build, credentials or saved games.
The adapter must receive this folder's explicit base URL when used elsewhere;
its historical default `assets/native/` is not the path staged here.

## What the main developer agent should evaluate

1. Inventory the other user-supplied robot sheets, incoming branches and any
   existing implementation first. Do not assume this is the preferred design
   because it is now in the repository. The inspected main file tree at
   `205aae9be52d3cf8c2544eb2ee794a351cb4dfb8` had no separate rover kit; other
   candidates supplied in conversation or parallel work are still relevant.
2. Compare candidates beside the original Max, plants and crow at identical
   world scale, ground position, camera and game lighting. Assess silhouette,
   palette, detail density, readability, and whether the robot belongs in the
   actual game. A technically valid grid alone does not settle the choice.
3. Check native 1:1 drawing, binary transparency, stable ground/body anchors,
   wheel contact and consistent nozzle/water alignment in both directions.
   Different transparent cell sizes are permissible when their visible scale
   and anchors are correct; 32 x 32 is this candidate's contract, not a rule
   that every possible robot must have that cell size.
4. Check idle, drive, deploy, water, retract, dry, refill and sleep states.
   Animation art is not behaviour: movement, terrain/pond handling, targets,
   water use, refill rules, pause/resume, persistence and progression still
   require design and implementation if a robot is chosen. Avoid hydration or
   reward exploits and do not let the helper obscure the player or touch input.
5. Record the selection or rejection with a brief reason and an in-engine
   comparison on current main. Keep whichever candidate fits best; combine
   parts only when scale and style remain coherent. Implement only after that
   evaluation, preserving concurrent game and account work.

The older 45 x 31 / 51 x 31 and 64 x 48 downloadable drafts were independently
sized and were not validated against the live renderer. Do not treat those
concept-derived packs, their display enlargements, or this candidate as an
approved replacement for the original artwork.

## Verification and limits

The current `drawPlayer()` at main commit
`205aae9be52d3cf8c2544eb2ee794a351cb4dfb8` still uses native-size source/destination
rectangles with the same cell-centred ground offset. This handoff rechecked the
four candidate PNG dimensions, binary alpha, all 80 frame bounds, animation
references and the rover's fixed (16, 31) anchor. There are 15 opaque colours
across the candidate sheets.

The inspection page's script passed syntax checking. Its eight animation views,
pause control and integer sizing were exercised in offline Chromium with the
same local PNG/JSON data. HTTP loading and current-main gameplay were not tested
in that browser session. Historical PR #5 tests and its game-animation GIF are
snapshot evidence, not proof of integration or tests passing on current main.

All new material is under `docs/asset-review/` plus the root `AGENTS.md` pointer.
The production build, runtime entry points, existing assets, accounts, saves,
Supabase configuration and deployment/domain settings are unchanged. The review
folder is not copied into `dist/` by the inspected build script. PR #5 remains a
draft reference, not a request to merge its outdated build changes.
