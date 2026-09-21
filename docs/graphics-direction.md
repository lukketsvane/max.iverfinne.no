# Graphics lead → main developer

Coordination: [issue #10](https://github.com/lukketsvane/max.iverfinne.no/issues/10).
The user assigned this thread graphics/art and soundtrack ownership. Keep changes
small and based on current main. Menu layout/native scene composition, gameplay,
controls, accounts, run persistence and co-op remain with the main developer. Record decisions here or in the issue.

## Visual contract

- Original game atlases, palette, sprite proportions and ground anchors are the
  source of truth. Native resolution, nearest-neighbour scaling and integer
  pixel placement. Do not replace the scene with painted high-resolution art.
- Follow the latest approved blue night garden: deep blue sky, layered blue
  mountains and mist, moon, bellflowers, mossy stones, crows and reflections.
  Keep native sprite shapes and restrained plant/flower colours.
- Existing 5×7 bitmap alphabet, pale outlines and stepped button corners.
  English, minimal words, no extra gameplay HUD, pause button or save button.
  The main developer's in-run Settings/Exit menu leaves the game running.
- Portrait first; retain landscape and iPhone safe areas and integer pixel
  scaling. Main developer owns the current menu composition; this PR preserves it.
- Follow the [approved bouquet reference](asset-review/bouquet/README.md).
  Every plant, species, seed, growth and stalk state must come from that saved
  run. Keep all records accessible. No points total or invented live scores.
  Preview order: IVER / RUNKEMANNEN / IDA, IVER marked YOU.

## Requested soundtrack

The user supplied **Ozan Koukle — Ice** (5:48) and
**Concierto De Aranjuez — Jim Hall** (19:20). Artists are from the MP3 metadata.
Play the complete songs in that order, repeating through menu, gameplay, results
and retries. Use one streamed element, never full-file decoded mobile buffers.

Respect the existing saved Sound toggle, begin on a user gesture, pause in the
background, and resume position on return. Use restrained Web Audio gain so SFX
remain audible on iOS. Handle blocked playback and missing files without a retry
loop. Add credits, no music HUD.

Implementation: `soundtrack.mjs` is installed once by the menu; the existing
`setSoundEnabled` bridge controls it. Web Audio gain is 0.28. Audio files are
128 kbps MP3 (Ozan) and 80 kbps AAC/M4A (Concierto), preserving both full recordings
and leaving original uploads unchanged. AAC keeps the long track under the upload limit.
`scripts/build-static.cjs` copies them into the build. Physical iPhone playback
still needs a device check; lifecycle behaviour is exercised automatically.

Validation covers gesture start, both-track cycling, mute,
background/foreground position, blocked playback, missing tracks and disposal.
Both complete recordings are retained.

## Run results and records

Completed runs retain their complete plant records on the device, including
species, seed, attained growth and stalk state. Every bouquet is rendered from
its own snapshot, and additional bundles keep all plants accessible. The online
leaderboard accepts explicitly published completed runs and renders their saved
plants. Never substitute the preview names or example bouquets for player data.

## Native co-op art integration

Four cosmetic Max skins are integrated independently of Mech, Moss, Bulwark
and Herbalist class choice: Moss (hood/satchel), Tide (rain hood/collar), Ember
(headband/ribbon), and Moon (cape/cap). Original Max remains the rendering fallback. The
current costumes supply the class selection; they do not change class powers.
Each skin retains the original 32×32 cells, anchor (16,31), animation rows,
timings and gameplay event markers. All exported pixels have binary alpha.

`native-art.mjs` preloads each complete main/interaction pair once. `drawPlayer`
uses the selected player's sheets while retaining all original animation and
water-clipping behavior. Missing or loading art falls back to original Max.
Co-op snapshots carry each player's cosmetic selection separately from class.

The same module integrates the four 16×16 role enemies and 32×32 Hollow Crown.
Enemy world coordinates remain body centres; rendering converts them to the
documented foot/hover anchor without moving physics or hitboxes. Windup frames
follow the actual tell timer. All three Crown phases retain the complete cyan
exposure window, and their health lights track the native crown. Healing links,
elite marks, amber attack tells and damage flash remain visible overlays.

Animation clocks are local to each visual state and survive replacement objects
from co-op snapshots through the existing enemy seed. Death effects are separate
from damage, rewards and victory. Retrying clears these visual clocks/effects.
Each failed enemy asset keeps its original primitive renderer. The production
build copies runtime sheets/JSON only; source masters and contact previews stay
in the repository.

### Milestone guardians

Mossback at garden 5, Bellkeeper at garden 10 and Moon Moth at garden 15 use
the supplied `assets/boss-milestones-v1/native/` sheets. Each has 64 frames on
a 256×256 sheet, 32×32 cells, anchor (16,31), and idle/move/windup/attack/recover/
vulnerable/hurt/death clips. Keep the source pixels unchanged. `bossId` selects
the appearance; `windup/tell` and `attackT/attackDuration` drive the actual tell
and attack poses, and `exposed` controls the complete cyan window.

Mossback's lower body uses a foot offset of 8 pixels from its world-space
body centre; Bellkeeper and Moon Moth use 13. Moon Moth's one-pixel hover
variation is part of the supplied poses and keeps the same anchor. The new
64-frame Crown appearance remains a reference: garden 20 retains the existing
128-frame Crown atlas and all three visual phases.

Validation: `scripts/verify-native-art.py` checks all 1,088 cells and 176 clips,
including palettes, alpha, bounds, foot registration and original hit/pour
markers. For the milestone sheets it also compares every packed cell with its
isolated PNG and checks that amber/cyan signals occur in their intended rows.
`tests/native-art.test.cjs` checks loading failure isolation, original
fallback, exact source frames/native scale, co-op animation continuity,
timer-driven tells and attacks, milestone identities, Crown phases/exposure,
specials and death cleanup.
`review.html` provides isolated `native-skins`, `native-enemies` and
`native-crown` fixtures using the actual game renderer, including portrait mode.
Future scenery layers must contain no baked text/buttons.

## Main menu composition

The home screen uses the native MAX wordmark above one primary Play action,
with Garden below and quieter Settings/Credits links. The blue night garden
remains visible around the title. Bitmap labels use integer scales, including
short landscape screens; the primary action keeps pale text on deep green.

Character selection presents a larger native costume preview and selected
class description beside a compact class grid. Each class shows its signature
ability, while four separate appearance swatches keep costume choice independent
of class. Phone layouts put the preview above the controls and respect safe
areas. The visual review page includes desktop, phone, small-phone and two short
landscape viewports for checking the actual menu without changing player saves.

Dismissing in-run Settings restores keyboard focus to its trigger and leaves
the active run advancing. Menu navigation, account restoration, independent
class/costume selection and co-op handshakes remain covered by the existing
behavioral suites.
