# Editable MASTER artwork to game

The active first-level artwork comes from the session's Hollow Tree study, imported as editable native rectangles and unchanged Sanctuary crops into the actual Figma MASTER row. The previous pole/crane study is preserved outside MASTER.

- Page: `508:11825`; MASTER: `863:15150`; editor: `863:15149`.
- Active row: `level_01`, `887:13528`; ART: `887:13531`.
- Native planes: 640×400, origin x320, soil y280. Their y100 position below the row header is document layout and does not enter world coordinates.
- Actual readback: [28 fingerprinted chunks](hollow-tree-actual-chunks/), 6,965 native operations, 22 drawing groups, seven native PNG crops.
- Complete local-plugin fixture: [actual geometry and artwork](hollow-master-native-actual.json).
- [Compilation receipt](hollow-tree-actual/compilation-receipt.json) pins the actual geometry, actual ART readback, unchanged PNG and normal compiled runtime data.

The historical prototype contributed original editable scenery; the active runtime data was generated from the subsequent actual Figma readback. The 42 visible operations belonging to a seeded expedition nook were omitted from the import. Expedition and guardian furnishing remains real runtime geometry and retains its normal drawing.

`capture-native.js` exports a self-contained `captureNativeArt(figma, options)` function for the Figma plugin and headless connector. `all:true` captures the selected supported row in one local-plugin payload; the connector uses bounded operation chunks. Each layer must declare `PHASE BEFORE_GROUND` or `PHASE AFTER_SOIL`. Every capture validates native integer geometry, identity transforms, supported fills, native crop dimensions and unchanged image registration. Bounded calls are checked for consistent row/plane/registration/layer identity when joined; this is not a claim of an atomic whole-document snapshot.

`export-native.cjs` joins actual chunk fingerprints, rejects missing or overlapping operation intervals, and verifies every referenced native PNG's bytes and dimensions. `source-binding.cjs` binds that actual ART digest to the canonical normal compiler garden and exact source collision ledger. `compile-runtime.cjs` compiles the captured MASTER geometry through the normal level compiler, preserves unrelated production stages and writes the scene data. It never accepts the prepared offline import payload as an actual Figma capture.

```sh
node docs/design/master-levels/art/compile-runtime.cjs \
  --geometry docs/design/master-levels/art/hollow-master-geometry-actual.json \
  --art docs/design/master-levels/art/hollow-tree-actual-chunks \
  --out docs/design/master-levels/art/hollow-tree-actual
```

The optional explicit `--activate` flag writes the compiled stage and scene data to the local runtime source. Deployment and production verification are separate release steps.

`level-scenes.js` draws two phases at integer world positions using native 1× transient canvas caches. The editable ordered primitives remain the source; no scene PNG is created. The Sanctuary crops reuse the already loaded `TILES.img`. Drawing restores the caller's canvas state. A layout must carry the exact compiled `masterSceneSourceKey`; mismatched stages, frames or previous source versions cannot activate the scene. Picture stages 1–2 also require `replacePicture`.

`MaxLevelScenes.presentation(L, ground)` returns a shallow drawing view that omits only generic surfaces whose actual top, span, solid status and solid height match the registered Figma source. It never changes collision objects. `MaxLevelScenes.inspect(L, ground)` exposes matched and mismatched surfaces, native scene bounds and retained runtime furnishing for browser evidence.

The actual seed-1 normal-runtime registration check matched all 14 authored surfaces and retained 20 runtime furnishing surfaces. The finite court, lower-room void, entrance and pond come from the normal compiled source; the old Tree preview physics fixture is not installed. New phone/desktop evidence belongs in the parent `evidence/` directory and remains the source for playability and deployment claims.
