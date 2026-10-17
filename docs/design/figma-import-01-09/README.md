# Approved Figma level import

The owner explicitly requested importing all approved work in the levels 1–9 conversation into the game. Scene objective placements on 3, 5, 7, 8 and 9 were compiled and merged in #63. This continuation installs the approved five-screen Hollow Tree, Railway Ruins, Mossback Sanctuary and Cairn Terraces rows (1, 2, 4 and 6). It does not substitute Silo or alter levels 10–20.

## Native source

The three CSV files and `wide-source.json` preserve complete authenticated Figma collision/point captures, their record counts, coordinates and transport checksums. Hollow Tree selectively reuses only its actual approved source capture and exact PNG from #62, not that branch wholesale. The four PNG masters are actual, unmodified 3555×400 Figma exports.

The new production rectangles are 1412:21977 and 1432:21977–21979. The latter now have distinct actual parent frames 1442:21979–21981; source-layer IDs must not be shared between level bindings. `evidence/native-comparison.json` records exact actual paths, image hashes and native coordinates.

The compiler uses the existing native source binding and atomic geometry/art installer. It rejects incorrect source identities, bytes or registration; fractional/out-of-bounds geometry; duplicate IDs; unsupported objective feet; and ladders without both endpoint surfaces. All unrelated stages are preserved. The game spawns on the actual first ledge, and art-marked ladders are not drawn twice.

## Verification

Before Vercel Sandbox exhausted its usage allowance, all four source compilations, three source/runtime/spawn regression tests, normal palette/alpha checks and the production build passed. The real level-1 slow-class sweep explored 2,357 states: every marker and authored surface reached, all ladders climbed both ways, no traps, and full left-to-right traversal. A desktop browser check of level 1 reported no page errors. Full source screenshots for all four maps were inspected during the preceding design work; this does not certify final phone gameplay.

The first full regression attempt exposed tests that moved actors from the new ledge spawn to soil while retaining stale platform IDs, and old-passage tests that implicitly assumed the retired map. Their explicit setups were corrected without removing assertions. The archived passage tests now load their existing October 14 geometry fixture. Focused reruns passed. The draft exporter now identifies bound native artwork instead of naming a retired railway PNG. Final complete tests and remaining physical sweeps run in GitHub Actions after recovering the same reviewed changes.

## Unresolved whole-file synchronization

The ordinary `npm run figma:check` was actually run and did **not** pass: 24 pre-existing scene PNGs in Figma differ from unchanged baseline main. The four newly imported masters individually match. The first existing discrepancy, Frozen Seed Wheel foreground, differs at 234,446 RGBA pixels, not merely in PNG encoding. These unrelated masters were not overwritten or repinned to manufacture a successful global check.

The complete actual runtime hierarchy was read and cryptographically fingerprinted, and a lossless reconstruction matched its actual full digest. The native Tiara parser also ran again on every actual vector path, and its freshly exported PNG matched runtime. These bounded full-capture files and the original checker log remain in the persistent `max-figma-import-20261017` snapshot. Sandbox quota exhaustion prevented retrieving them during recovery; this candidate does not claim those files are committed here or claim a global Figma pass.

This candidate is not a verified production deployment. Main publication and exact deployment verification remain distinct steps; current CI status and remaining native-source problems must be reported honestly.
