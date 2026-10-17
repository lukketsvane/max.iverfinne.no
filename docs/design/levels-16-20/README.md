# Levels 16–20: route and pacing pass

The owner requested improvements to levels 16–20 in Figma on 2026-10-17. This
is a bounded M6 task alongside the unfinished MG work. It does not mark the
twenty-level campaign, native-art milestone or production release complete.

## Changes

| Level | Figma change | Current game change |
| --- | --- | --- |
| 16 · Giant's Stair | Three 56 px native moss rests on the central climb, with the puzzle moved onto the upper rest | A broader, lower Crossing and a taller Lookout give the two generated routes different rhythms |
| 17 · Salt Cistern Terraces | Seed moved to the lower pier; trials distributed between the upper cistern and east tunnel; optional sluice door on the west terrace | Compiled directly from the edited scene frame |
| 18 · Heliostat Greenhouse | Five small ledges follow the painted diagonal brace; the second trial moves to the sunflower rail and the dew pickup to the lower arcade | The brace becomes a cross-route between the west terrace and sunflower rail |
| 19 · Twin Gondola Ravine | Two gondola decks, two returnable ladders and one trial on each deck; native ladder rails and rungs are visible in the design | Both gondolas become reachable optional destinations, with the existing ground crossing retained |
| 20 · Crown Summit | Three approach rests broaden from 32 to 64 px; the final seed moves to the preparation landing | Every third shelf of both nine-shelf Crown routes becomes a wider rest |

For the representative stage-16 seed 260926, the Crossing has eight shelves
and reaches 117 px above the soil, while the Lookout has fourteen shelves and
reaches 214 px. In the Crown, the three west rests are 46/46/50 px wide and
the east rests are 44/48/48 px after the existing width adjustment. The
original rises, nine-shelf structure, open arena floor and physical exit
ascent remain in place.

## Source authority

All edits were made through authenticated Figma tools in file
`TC0PHGMTCMR6im4hb3CSbF`, page `508:11825`, followed by metadata readback and
screenshot inspection. [figma-changes.json](figma-changes.json) records the
affected IDs and write results.

| Source | Frame |
| --- | --- |
| Scene 17 | [1363:22212](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=1363-22212) |
| Scene 18 | [1359:22595](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=1359-22595) |
| Scene 19 | [1359:22669](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=1359-22669) |
| Wide draft 16 | [1228:39056](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=1228-39056) |
| Wide draft 20 | [1228:51785](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=1228-51785) |

Scenes 17–19 use the normal Figma scene compiler. The current
[scene capture](../scene-levels/figma-capture.json) refreshes only those three
authenticated frame subtrees. The other nine committed scene subtrees are
retained verbatim from commit `801e517`. Its provenance records both the
selected refresh and the retained snapshot; it is not a fresh export of all
twelve scenes. Concurrent edits to other levels in Figma were not imported.
When integrating newer main changes, reapply these three subtrees onto the
newer capture instead of replacing another worker's capture wholesale.

The wide MASTER frames for 16 and 20 remain inactive drafts, recorded in
[wide-draft-capture.json](wide-draft-capture.json). Their new resting ledges
crop existing native image children without resizing the images. Their
runtime generator changes follow the same pacing direction but are not a
compilation of those wide layouts. No runtime PNG, production image master,
registration or anchor changed in this pass.

`LADDER · key · visible` adds an explicit scene-source annotation for the
existing native runtime ladder renderer. Ordinary `LADDER · key` still uses
the ladder painted into the foreground. The additional scene-19
`NATIVE LADDERS · runtime preview` layer is editable pixel geometry matching
the runtime rails and rungs; it is ignored by the collision compiler.

Changing the stage-16 profile also changes the seeded stage-17 fallback for
seed 81 because the generator compares neighboring profiles. The active
stage-17 scene still comes from Figma. The historical geometry partition
therefore excludes 16 and this fallback 17 while retaining its independent
3/7/14 pins and all other unchanged-stage coverage.

## Verification

[scene-route-verification.json](scene-route-verification.json) records three
successful 60 Hz Bulwark sweeps using the existing game physics: every
marker and ledge reached, every ladder traversed in both directions, no
unreturnable states. The graph explorer repositions between explored states;
these results are separate from continuous browser play.

The stage-16/Crown audit exercised four ordinary classes at 30/60/120 Hz
across three seed/rate pairs, all 24 cases passing. An additional 32 stage-16
seeds selected authored generated routes without fallback. These checks
measure traversal, not first-time comprehension or human enjoyment.

The full suite, build and browser results are recorded in
[verification.json](verification.json). The desktop-only `npm run
figma:check` could not connect to `127.0.0.1:3845` in this environment.
Authenticated connector readback and exact scene compilation succeeded;
the full production-master check remains a release gate. No production
deployment or physical-phone performance result is claimed here.
