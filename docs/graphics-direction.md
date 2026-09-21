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

Validation: all 81 tests and the production build pass, including gesture start,
both-track cycling, mute, background/foreground position, blocked playback,
missing tracks and disposal. Both complete recordings are retained.

## Remaining result work

Current main exposes local Garden records, not a global leaderboard. The main
developer should verify saved stalk/growth appearance and complete run records
for every leaderboard entry against the approved reference. This graphics pass
does not replace that data/gameplay integration.

## Next co-op art handoff

Main developer requested four recognisable cosmetic Max skins, separate from
build paths. Preserve 32×32 cells, anchor (16,31), roughly 11×24 standing
silhouette, existing rows/timings and binary alpha. Deliver matching main and
interaction sheets, JSON and an actual-scale contact sheet. Distinguish
accessories/silhouettes as well as palette. These assets are not part of the
soundtrack PR. Future scenery layers must contain no baked text/buttons.
