# Native drafts for concepts 4–6

Rot- og beinbrotet, Leviatanen and Sopphvelvet extend the [first three native prototypes](../native-level-drafts/README.md). These are newly authored integer collision layouts based on the newer [twenty-level concept board](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=746-117481), pinned to concept commit `b12d88a3ab2a6d39a5c2deda4ef51cb30e95a4c1` and runtime baseline `97f3782dbf1fd7f56e7630ff9c39911978aae5cc`.

These drafts have not been imported into Figma or activated in production. Both connected Figma accounts still required reauthentication during preparation. Synthetic local nodes provide isolated simulation data and do not establish authenticated source authority.

The compositions become 50 native standing surfaces and eight ladders, with two trials, two rewards and a seed reserve in each room. [The route overview](route-overview.svg) draws the editable geometry in game pixels.

| Garden | Route composition | Surfaces | Ladders |
| --- | --- | --- | --- |
| 4 · Rot- og beinbrotet | Right-to-left railway salvage/root approach into calcite/fossil switchbacks | 13 | 2 |
| 5 · Leviatanen | Three uneven paths through a spine and ribs toward the high right skull destination | 21 | 4 |
| 6 · Sopphvelvet | Right-to-left broad, unequal cap islands with stepped gaps and ladder connections | 16 | 2 |

The concept images are composition references. Their normalized entry/exit percentages and compact Figma JPEG fills are not native collision coordinates or runtime PNG masters. Pools, curved ribs/caps, regional artwork, authored spawns and continuous inter-stage connectors remain outside these collision prototypes. Existing terrain, water, artwork and runtime furnishing retain their normal behavior. The pinned source audit identifies the 3→4 and 6→7 joins as weak/unregistered; these drafts make no seamless-connector claim.

[geometry.json](geometry.json) contains the editable native source, with x offsets relative to the stage origin and rises above its seed-1 soil line. Generate the separate import and simulation bundle with:

```sh
node scripts/figma-authored-drafts.mjs \
  --from docs/design/native-level-drafts-batch-02/geometry.json \
  --out docs/design/native-level-drafts-batch-02/review
```

The editable Figma import uses `review-garden-04` through `review-garden-06`, without `designed` markers. Its synthetic compiler fixture adds those markers only for local simulation. Production `levels-data.js` and runtime art remain separate.

Reproduce actual movement verification with the explicit stage selection:

```sh
node docs/design/native-level-drafts/verification/playtest-authored-candidates.cjs docs/design/native-level-drafts-batch-02/review/candidate-levels-data.js /tmp/max-native-04-06-routes.json --stages 4,5,6
node docs/design/native-level-drafts/verification/playtest-candidate-guardians.cjs docs/design/native-level-drafts-batch-02/review/candidate-levels-data.js /tmp/max-native-04-06-guardians.json --stages 4,5,6
node docs/design/native-level-drafts/verification/playtest-candidate-starts.cjs docs/design/native-level-drafts-batch-02/review/candidate-levels-data.js /tmp/max-native-04-06-starts.json --stages 4,5,6
```

[Actual player-physics verification](verification/candidate-verification.json) passes all 36 room/class/rate combinations: four base classes at 30, 60 and 120 Hz, with 600 surface reaches, 408 authored marker contacts, 108 reward/seed returns, 96 independent ladder round trips and 96 gallery crossings/returns. The independent start walk passes another 36 checks; those start markers are already included in the route marker total. Two clients produce identical furnished layouts for three seeds in each room, and all 27 guardian outbound/return trips pass.

The routes replay real movement inputs. Each independent route begins once at its supported soil entry; jump retries restore the same takeoff state. Alternative returns search from the reached reward state and then replay inputs using authored supports. See the raw [route](verification/authored-candidate-playtest.json), [start](verification/authored-candidate-starts.json) and [guardian](verification/authored-candidate-guardians.json) reports for their reset semantics and coverage.

Real ladder movement caught an issue that the C0 graph missed: Leviatanen's stacked shafts shared centres, so normal up input selected the lower ladder again at the middle landing. Offsetting the upper shafts by 16 native pixels preserves supported endpoints and makes them independently enterable. The [before/after trace](verification/ladder-before-after.json) records the old stalled ascent and the corrected climb and descent; the full matrix above tests the corrected candidate.

All final physics reports bind candidate SHA-256 `69da784a13650b9a92d868dddd898f7e8ff17d71fcc35ded83c5ad0e9f091ca7`. [Independent source pairing](verification/source-pairing.json) recompiles the saved synthetic metadata with the actual compiler and compares every candidate byte. That proves the offline fixture pairing; authenticated Figma source authority remains pending.

[Six browser previews](previews/preview-report.json) pass with the actual built renderer at phone 390×844 and desktop 1000×650 viewports. The helper serves the build read-only and substitutes the candidate and observer only in HTTP responses. It verifies the selected authored frame, isolated storage, disabled smoothing, loaded native assets, no browser/request errors and unchanged source/build inputs. Screenshots capture the rendered game iframe at device scale 1; browser edge rounding can add one image pixel. Existing campaign names and materials still appear because these are geometry prototypes.

| Garden | Desktop | Phone |
| --- | --- | --- |
| 4 | [Preview](previews/garden-04-desktop.png) | [Preview](previews/garden-04-phone.png) |
| 5 | [Preview](previews/garden-05-desktop.png) | [Preview](previews/garden-05-phone.png) |
| 6 | [Preview](previews/garden-06-desktop.png) | [Preview](previews/garden-06-phone.png) |

Reproduce the browser evidence after building, with a locally installed Playwright module and Chromium:

```sh
npm run build
node scripts/check-native-level-drafts-browser.cjs \
  --candidate docs/design/native-level-drafts-batch-02/review/candidate-levels-data.js \
  --stages 4,5,6 --out /tmp/max-native-04-06-browser
```

Use `--playwright /path/to/playwright` and `--chromium /path/to/chromium` when those tools are outside the usual module/executable locations. The helper does not install dependencies. Its `--help` lists all options.

Authenticated Figma import/export, inspection and physics checks against that exported geometry, native art authoring, and the ordinary regression/build/deployment gate are still required before runtime activation.
