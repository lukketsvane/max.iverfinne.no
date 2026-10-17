# Current Level 1 candidate

Candidate source: Figma `TC0PHGMTCMR6im4hb3CSbF`, level-design page `508:11825`, current MASTER `1228:21976`, row `1228:29201`, `level_01 / Hollow Tree / 5 screens`.

The source choice remains unconfirmed: the same Figma file also contains `01 Silo` (`1133:22294`). Do not merge this candidate as the selected starting level until the owner confirms which Level 1 is intended. Fullscreen presentation is independently implemented in PR61; this branch does not duplicate it.

This isolated candidate binds stage 1 to the actual 3555×400 ART export, rather than renaming or stretching the previous 640×400 scene. The existing source binding, native renderer and atomic data-pair publisher are reused. Only stage 1's compiled geometry/art rows change. Existing snapshots and sources remain reference-only.

The source's empty REGISTRATION frame was sized to the actual row and given ORIGIN x168 and SOIL y350. Thirteen collision strips were added in ROUTES for thirteen already-visible access ladders, each with supported landings. Artwork and authored marker positions were not changed. The decorative large ladder landmark with no valid landing was not silently converted into traversable geometry.

The exact native ART export was registered as production node `1412:21977`, `assets/levels-v2/hollow-tree-current.png`, under `1412:21976`. Native size 3555×400, SHA1 `89298c6b2d99e71d93977c45d2fa2eec3eedf38f`. Actual authenticated readback at 2026-10-17T20:40:43.406Z confirmed that image hash, dimensions, 0,0 placement and one fully opaque FILL image paint. The export passes binary-alpha, clean-transparency and palette guards. No generated replacement image or temporary image URL is loaded at runtime.

`node scripts/current-level-one.mjs` reproduces the candidate data from the committed capture and exact image. The authored START is respected at reset, including its actual platform. Existing ladder artwork is preserved rather than drawing a second ladder over it. No character abilities, enemy balancing or cooperative admission rules are changed.

## Verification and blockers

- Four focused tests pass: exact level identity, 185 registered collision surfaces with zero geometry mismatches, all six characters at the authored start, real walking down to the floor and climbing the first ladder back, and the exact production asset.
- The manifest and full production PNG native-rule checks pass, two tests. The initially misplaced/unsorted manifest entry was corrected without weakening the assertions.
- `npm run build` passes.
- Chromium actual Play/Play flow passes in portrait and landscape at DPR3. It starts world1 and reads source row1228:29201, loads native3555×400 art, walks using ordinary keyboard input and keeps the clock running. Browser observations and screenshots are stored here. This branch still retains main's aspect framing; PR61 owns its removal.
- Mandatory `npm test` was invoked. The running suite reports failures in authored-ground character actions, cooperative Cairn state, controller actions and class skills. In a separately reproduced class-skill test, Cairn's expected ridge reservation is0 instead of3. These are NOT declared harmless fixture-only failures. No original tests are removed or rewritten to get green.
- `npm run figma:check` exits2 because the isolated machine cannot reach the desktop Dev Mode server at127.0.0.1:3845. The new asset has authenticated exact-byte evidence, but that does not replace the required whole-file Figma check.
- Source-only and source-ladder exploration JSONs are diagnostics, not a final all-collider acceptance certificate. The ladder probe touches the authored markers and has no trapped states, but one automatically furnished court outside its bounded search remains unvisited, as do redundant/overlapping surfaces. Normal multiplayer completion, full source validation and human visual acceptance remain unverified.

Next step: confirm `01 Silo` versus `Hollow Tree`, then reproduce the failed action/co-op flows at the confirmed start and reconcile their ground assumptions without relaxing gameplay safeguards. Run final-SHA tests/build, finish figma:check, then review together with PR61. Do not merge or call this live before those gates pass.
