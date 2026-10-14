# MAX — production placeholder-art inventory

Initial audit 14 October 2026 against foundation `ce97f671` and current main
`19e5acc7`; reconciled with the subsequently implemented native-role and altar
fixes and staged Tiara integration in the isolated worktree. This is the scope
of urgent milestone MG, not a claim that the replacements are shipped.
Source function names are stable evidence; line numbers move during integration.

## Original enemy coverage gaps — implementation present, verifying

At the audited baseline, `native-art.mjs:ENEMIES` mapped only ordinary kinds
3–6. `idFor` returned no atlas ID for kinds 9–11, and `load` never requested
their sheets, leaving permanent flat bodies and no native death artwork.
Current implementation includes all three role mappings and atlases, using the
original promoted Figma sheet below. Faster introductions exposed the old gap;
the cyan/teal dew leech was the likely screenshot defect.

| Kind / role | Former crude body | Implemented native source/state treatment | Status |
| --- | --- | --- | --- |
| 9 / thorn caster | Olive `#8fa66e` rectangle with dark/ochre accents | `assets/enemies-v1/thorn-caster/atlas.json`: original row 6 branch creature, native cast and recovery | Implemented; full acceptance/release verifying |
| 10 / dew leech | Cyan/teal `#6fa6a1` rectangle, dark `#285b57` and pale `#b8e0d1` accents | `assets/enemies-v1/dew-leech/atlas.json`: original row 1 slug with native draining poses | Implemented; full acceptance/release verifying |
| 11 / rammer | Brown `#9a745d` rectangle with dark/tan accents | `assets/enemies-v1/rammer/atlas.json`: original row 4 horned ram with native charge/recovery | Implemented; full acceptance/release verifying |

The original `assets/enemies-v2/sprites.png` master is now in production:
Figma source `414:3` moved from archive frame `425:2` into enemy section
`451:3`, frame `1040:21976`. Its SHA-1 is unchanged
`dd8c215a6ed39ec1db6a4e197ab5eb1829c84e2e`, dimensions 256×288,
23 original colours and binary alpha. See
[the source contract](../../assets/enemies-v2/README.md) and
[authenticated promotion receipt](../../assets/enemies-v2/figma-promotion.json).
Local SHA-1/dimensions and role atlas row/cell/anchor/clip listings were checked
while reconciling this inventory.

Each role uses its eight visually reviewed original poses in **32×32 native
cells, anchor `(16,31)`**, at 1:1 pixels. Shared idle/move/windup/attack/recover/
hurt/death clips plus explicit cast/drain/charge bindings read accepted state;
the empty final-row cell ends death. Existing four ordinary roles retain their
16×16 cells and anchor `(8,15)`. Preserve transparent margins, each pack's own
native scale, the existing five-pixel runtime foot offset and unchanged hitboxes.
No rescaling, regenerated imitation or new enemy admission is part of this fix.

## Confirmed non-enemy flat-body inventory

Replace physical bodies while retaining exact interaction locations, accepted
combat state, warning extents, costs, progress and rewards. Do not change
gameplay to accommodate an illustration. No suitable approved small source has
yet been established for rows marked pending.

| Production body | Exact rendering evidence | Replacement/source position | Status |
| --- | --- | --- | --- |
| Required guardian shrine | `run-director.inc.js:drawBossEvent`, former 19×24 rectangle stack | Existing native district altar, Figma `385:3`, 32px cell, anchor `(16,31)`; planting/Tend/wayfinding cues retained | Hook implemented; focused checks pass; integrated/phone/release verifying |
| All six optional trial shrines | `run-director.inc.js:drawRunExploration`, former 18×16 stack | Same approved district altar; reward/cost/guard/progress cues retained | Hook implemented; focused checks pass; integrated/phone/release verifying |
| Guardian objective nodes: wick, spindle, orchard, choir, engine, ferry | `run-director.inc.js:drawGuardianNodes`, common 9×9 square core with 7×7/3×3 interiors | Author/review role-readable small native objectives; approved Crown seals are separate and unchanged | Pending |
| Mycel/class spore projectile | `polge.inc.js:drawClassShots`, 5×4 teal body plus 2×1 highlight | Native small spore; retain flight/contact timing and separate intentional needle trail | Pending |
| Generic hostile spore | `run-director.inc.js:drawRunHazards`, 4×4 square plus 2×2 interior | Native hostile spore clearly distinct from the friendly shot | Pending |
| Generic active root strike | `run-director.inc.js:drawRunHazards`, three solid 2×14 bars | Native root shape; preserve its warned and active extent/lifetime | Pending |
| Rain Loom seedbed bodies | `run-director.inc.js:drawRunExploration`, two 7×4 pads | Native small seedbeds; preserve functional cyan charge strip and Tend behavior | Pending |
| Echo Nest physical posts | `run-director.inc.js:drawRunExploration`, three 7×9 posts with 5×7 coloured middles | Native nest/egg props with clear accepted active target; retain hits/progress | Pending |
| High Tide lower boon tokens | `high-tide.inc.js:drawHighTideWorld`, 5×5/3×3 squares and 1×1 spark | Native small collectible, retaining actual pickup and one-time reward | Pending |
| Night Relay carried lantern | `night-relay.inc.js:drawNightRelay`, 5×7 body, 9×3 cross and 3×3 light | Native small carried lantern; keep carry anchor and separate heat bar | Pending |

## Already native and deliberately simple elements

The coverage audit must distinguish missing bodies from intentional small
pixel motifs. These are not blanket replacement targets:

- Basic kinds 0–2 use approved biome bird PNGs through `drawBirdPest`, outside
  `MaxNativeArt`. Kinds 3–6 have native role packs; kind 8 has common/black/
  albino/plague rat packs. Kind 7's campaign/roaming bosses have native packs,
  including the separately integrated Tiara. Crown guards use their native
  ground/air chimera sheets. Trial, circuit, expedition and event guards reuse
  these admitted role mappings; their former shared kind 9–11 gap now has the
  implementation above under verification.
- Existing shaped bombs, beveled 6×6 Erasmus Berg Stone/grit, Sligo's native flesh,
  and `WONDER_ART`'s intentional native motifs are not crude placeholder bodies.
- HP/resource/progress bars, pips, reticles, warning brackets/lanes, impact
  extents, waterlines, particles and rings express exact state or danger.
  Preserve them. In particular keep the Crown's unbroken dangerous lane and
  approved seal/core sprites; do not scale Crown bolts into unrelated tiny art.
- Optional archival/expansion assets absent from the production manifest are
  not approved alternatives merely because a local filename or sheet exists.

## Loading/failure audit and closure evidence

The baseline `createNativeArt.load` cached one `Promise.allSettled`; a failed
request could leave procedural fallback bodies until reload. That policy is
being replaced with serialized, bounded loads, retention of decoded atlases,
retry of missing assets and complete-art admission. Implementation is present/
under verification, not a completed release gate. The two altar hooks still
retain their existing unavailable-image fallback, so ready/loading/failed paths
must be tested as part of complete admission rather than counted as solved by
the native hooks alone. Cover biome birds and fallbacks in `drawRoleEnemy`,
`drawRat`, `drawCrownBody` and `drawKrek` as well.

`tests/native-altar-rendering.test.cjs` observes the actual private rendering
functions: native 1:1 anchors, cues/rewards, unchanged gameplay and the existing
loading fallback. The integration owner reports 11 focused checks plus 12
Tiara checks passed: `node --test tests/native-altar-rendering.test.cjs
tests/level-guide.test.cjs` is 4 altar + 7 guide checks; the separate Tiara
files are `tests/tiara-head.test.cjs` (10) and `tests/tiara-head-art.test.cjs`
(2). There is no dedicated persisted log for the final 11-case run yet. These
are focused results, not a single completed integrated suite.
The full combined source/test/build/browser/release gates
remain pending; the foundation's earlier 916/916 result does not cover these
later implementations.

Closing each row requires an approved source/atlas/provenance entry, actual
native draw coverage for its supported states and same-camera phone evidence.
Renderers remain read-only; timings, damage, host attribution, hitboxes and
spawn limits stay unchanged. Catalogue-only tests are insufficient: exercise
real PNG readiness and all spawnable roles, plus slow/failed-load paths. Final
completion also requires full tests/build/native-source checks and exact-SHA
CI/production/custom-domain verification, recorded in the execution ledger.
