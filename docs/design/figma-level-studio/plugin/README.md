# MAX Native Level Studio

Download and unzip [the development plugin bundle](max-level-studio-plugin.zip).
Import this local development plugin once in Figma Design: **Plugins → Development
→ Import plugin from manifest**, choose [manifest.json](manifest.json), then run
**MAX Native Level Studio**. The ZIP contains the built plugin. It does not install
it automatically and needs no publishing account.

The authoritative source is MASTER `863:15150`, editor `863:15149`, page
`508:11825`, file `TC0PHGMTCMR6im4hb3CSbF`. The existing `level_01`…`level_20`
rows remain in their per-level workspaces with ASSETS. The outer row number
sets the campaign stage. Legacy titles and source IDs remain provenance.
The plugin re-resolves rows by name; it creates no duplicate garden boards.

From this checkout, start the actual-game preview bridge once:

```sh
npm run build
npm run figma:studio
```

Paste the printed session key into **Local preview connection**. Leave its
loopback endpoint on port 8765. Edit the selected MASTER row, then click
**Preview in game** and open the returned game link. Each click captures all 20
rows and the selected row's complete native ART, validates them, compiles a
temporary candidate, and serves the actual built game. The bridge preserves the
last successful candidate when a later export fails. Ctrl-C closes it and removes
the temporary files. A source/build change requires rebuilding and restarting.

**Local draft preview** explicitly permits a temporary `designed` projection.
It does not edit Figma. Source `replace-picture` remains required for Gardens
1–2; the plugin never adds it automatically. **Make review export live** instead
adds the real `designed` marker to the selected row's REGISTRATION. It requires
supported route geometry and remains a source choice, not a production release.
Checked source exports still pass gameplay tests, CI and deployment verification
before main and production.

1. Select a MASTER level, its plane or a per-level asset. **Show & select** makes
   the existing plane visible. Hiding or locking routes does not remove physics.
2. **Round & add** places an exact existing compiler component directly in ROUTES,
   POINTS or REGISTRATION, using native plane-local geometry. **Round selected**
   deliberately rounds supported direct source nodes; it preserves ART. Fix
   grouped, rotated, mirrored or scaled gameplay geometry first.
3. Pond top is water level; width is twice half-width and height is depth. Width
   rounds to an even integer. The bank input explicitly sets `pond:<bank>` while
   preserving the real component master. Complete pond banks must remain separate.
4. `terrain:court`, `terrain:void` and `terrain:entrance` add direct native
   rectangles to TERRAIN. An explicit first addition creates one aligned plane
   with the registration bounds; it does not change the row's existing bounds.
5. **Validate MASTER** uses the exact shared [decoder](../../../../scripts/master-levels.mjs).
   Gameplay points reward/seed/bonus/trial/puzzle/door/dig/secret/start map to their
   supported behavior. Legacy launch/destination/shortcut points stay metadata.
6. **Download all levels** saves the same source capture. Keep **Include selected
   row's native ART** checked for the converted Hollow Tree. Unsupported artwork
   blocks native preview instead of being rasterized or silently discarded.
   Uncheck it explicitly to download geometry only for older unconverted rows.

The selected row's ordered native rectangles and unchanged PNG crop references
use the shared ART capture/export contract. Other rows retain geometry metadata
only. Two equal complete ART fingerprints and equal geometry before/after reject
observed edits during asynchronous capture; these separate reads are not an
atomic Figma snapshot. The bridge checks source IDs, native registration, scene
binding and unchanged PNG bytes. Arbitrary vectors, filtering, unregistered
transforms, moving mechanisms and unsupported clipping need an implemented
contract before export.

Download fallback, without the UI connection:

```sh
node docs/design/figma-level-studio/plugin/preview.mjs --from ~/Downloads/max-master-levels-508-11825.json --stage 1 --seed 1 --draft-preview
```

The command consumes native ART when present. Geometry-only downloads use an
explicit geometry review path; they do not represent the complete visual source.
For a geometry-only compiler candidate outside the repository:

```sh
npm run figma:master-levels -- --from ~/Downloads/max-master-levels-508-11825.json --out /tmp/max-levels-review.js --stages 1
```

The shared adapter creates virtual compiler `garden-NNb` names while preserving
actual row and child IDs. It creates no Figma nodes. Without `designed`, ordinary
compilation excludes a draft. Compiler reachability is approximate: actual
walking, climbing, water, return and planting checks remain release gates.

The optional bindings panel verifies real component types, exact tag names and
IDs before saving overrides locally. If Figma does not expose its file key,
verify the configured file address; page, MASTER, editor and source IDs are still
checked. Network access is restricted to the development loopback bridge; the
panel has no push, deployment or publishing button.

Regenerate exact shared helpers after a decoder or native-capture change:

```sh
node docs/design/figma-level-studio/plugin/build-plugin.mjs
node docs/design/figma-level-studio/plugin/build-helpers.mjs
node docs/design/figma-level-studio/plugin/package-plugin.mjs
```

[plugin-template.js](plugin-template.js) is editable source. Generated
[plugin-main.js](plugin-main.js) is the manifest entry; [code.js](code.js) is an
identical compatibility copy. [helpers.use-figma.js](helpers.use-figma.js) reuses
the same functions and returns a bounded read-only document summary. Prepend
`const MAX_STUDIO_NATIVE_STAGE = 1;` to include native operation counts and
fingerprints without returning the full artwork payload. The desktop plugin
itself downloads/sends the complete source payload.
