# Pictured levelart only: corrected PR 58 scope

The owner corrected the earlier levels 16-20 request on 17 October 2026 with
an image of the `levelart` sheet and the instruction **THESE LEVELS NO OTHER**.
Only the twelve foreground/background pairs in that sheet are approved for
this level-design work. Do not substitute procedural environments or the old
wide MASTER designs. This correction takes precedence over the earlier pass.

## Exact source

Figma file `TC0PHGMTCMR6im4hb3CSbF`, page `508:11825`, section `1271:34`.
The section screenshot was visually matched to the owner's image. Authenticated
readback checked all 24 painting nodes against the IDs and image hashes already
pinned in [art-recipe.json](../scene-levels/art-recipe.json): 24 matched, zero
mismatches, zero additional image nodes. The separator line is not level art.

The source artwork, palette, native exports and foreground/background pairings
are unchanged. The section's display names are not a new campaign order.

## Retained work

This PR retains only three scenes from the selected sheet:

- Salt Cistern Terraces (`1363:22212`, existing stage 17): pier seed, upper and
  tunnel trials, western terrace door.
- Heliostat Greenhouse (`1359:22595`, existing stage 18): five collision ledges
  following the painted brace, sunflower trial and arcade pickup.
- Twin Gondola Ravine (`1359:22669`, existing stage 19): two supported decks,
  visible native ladders and a trial on each gondola.

The compiled scene data and all nine other captured scenes are unchanged by
this correction. Concurrent source changes on other branches are not imported.

## Removed from this implementation

The unrelated Giant's Stair generator changes and Crown route widening are
reverted. `stage-layout.js`, `tests/campaign-architecture.test.cjs` and
`tests/hollow-branch-platforming.test.cjs` are restored byte-for-byte to main
`37d21a9ab8a645081d2c77a9b6a6cfae390665f9`. This also restores the original
historical geometry coverage instead of retaining exceptions for 16/17/20.

The wide Figma drafts for 16 and 20 are excluded from this work and must not
be activated. Their older captures and verification receipts in this directory
are historical evidence of the superseded pass, not approved level sources or
current completion claims. Existing Figma drafts have not been deleted.

## Verification and release

Authenticated artwork identity checks passed and the corrected production build
passed. The full regression rerun is in progress; no complete pass is claimed.
The earlier three scene graph sweeps remain evidence for the unchanged scene
geometry, not continuous browser playthroughs. Full current-head browser
traversal and the production-master check remain unverified.

The previous PR summary's 998/999 garden-12 timeout claim was incorrect. The
retrieved log for run `39064154437`, checkout `54381542774615c98bf404b7b7140abb7fe80021`,
reported 994/995 passing, with one turtle portrait test expecting native height
282 instead of the renderer's floor-fit height 281. This correction does not
change that unrelated test or import another agent's fix.

This is a review-branch correction, not a production release or a renumbering
of the campaign. Existing production stages outside the selected set have not
been removed by this patch. The owner's exclusive source selection governs
further level work; production replacement must not be claimed from this PR.
