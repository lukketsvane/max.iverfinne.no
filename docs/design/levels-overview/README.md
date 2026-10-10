# Twenty-level scene stack

The owner requested **one unique full-scene image for each level**, with the
actual level stack as the priority. [stack.html](stack.html) presents all twenty
scenes in physical ascent order: **20 at the top, 01 at the bottom**. It opens at
Level 01, offers upward next-level navigation, a direct Turtle 04 link, editable
review titles, concise route ideas and a live playable link for every level.
Images use their complete composition without cropping. Current game entry
views sit beside the larger scene references.

The twenty [generated PNGs](generated/) are exact, unchanged **1672×941** tool
outputs from twenty individual image-generation calls. They are scene design
studies, not runtime artwork or verified playable geometry. These files and
the plugin are excluded from the production build. No production PNG pin,
native registration, existing gameplay plane or runtime source was changed by
this package.

[generated/source.json](generated/source.json) records every source path,
dimension, byte count, SHA-256, original tool-output path and exact-copy proof.
The four original prompt manifests remain unchanged beside it:
[01–05](generated/prompts-01-05.json), [06–10](generated/prompts-06-10.json),
[11–15](generated/prompts-11-15.json) and [16–20](generated/prompts-16-20.json).
[inventory.json](inventory.json) maps the actual filenames to the current
campaign titles and binds each unchanged current screenshot. The normal entry
captures are **334×217**, seed 1, from commit
`7e8a783f309dbe21d3f3144c7331d429102be557`; their manifest and proof are in
[current-captures/](current-captures/). They show entry views, not complete
levels, and are distinct from the generated images. Later live cue changes
are outside this frozen capture evidence.

| Level | Current title | Scene file |
| --- | --- | --- |
| 01 | Hollow Tree | `generated/level-01.png` |
| 02 | Railway Ruins | `generated/level-02.png` |
| 03 | Broken Aqueduct | `generated/level-03.png` |
| 04 | Mossback Sanctuary | `generated/level-04.png` |
| 05 | Root Stair | `generated/level-05.png` |
| 06 | Cairn Terraces | `generated/level-06.png` |
| 07 | Lantern Roots | `generated/level-07.png` |
| 08 | Silo Stair | `generated/level-08.png` |
| 09 | Collapsed Tower | `generated/level-09.png` |
| 10 | Bell Cellar | `generated/level-10.png` |
| 11 | Old Quarry | `generated/level-11.png` |
| 12 | Weeping Roots | `generated/level-12.png` |
| 13 | Twin Shafts | `generated/level-13.png` |
| 14 | Catacomb | `generated/level-14.png` |
| 15 | Fault Steps | `generated/level-15.png` |
| 16 | Giant's Stair | `generated/level-16.png` |
| 17 | Reactor Nest | `generated/level-17.png` |
| 18 | Last Sluice | `generated/level-18.png` |
| 19 | Surface Breach | `generated/level-19.png` |
| 20 | Radioactive Dawn | `generated/level-20.png` |

The default local Figma importer adds or updates one owned
`GeneratedSceneDesign · level_NN · title` reference for each existing MASTER
level. It targets file `TC0PHGMTCMR6im4hb3CSbF`, page `508:11825`, MASTER
`863:15150`, editor `863:15149`. All twenty saved row and plane identities,
ancestry and sibling ASSETS frames are checked before application. ASSETS is
a per-level workspace sibling, outside ART, ROUTES, POINTS, REGISTRATION and
TERRAIN. Bound TERRAIN must retain its actual identity too.

Each reference fits a free ASSETS slot without resizing existing containers.
When that would be unsafe or no slot is free, the explicitly authorized
fallback places a reference beside the actual row, beyond existing page
content; extra columns prevent references from overlapping. The importer
preserves existing source planes, registration, workspace bounds and other
references. Repeated imports update only its ownership-tagged frames; an
unowned name conflict or malformed binding fails preflight.

The optional comparison stack arranges separate editable design and current
preview frames in order 20→01. A repeated identical import selects the existing
validated owned stack. A conflicting or different-source stack is refused.

Build the self-contained plugin and review HTML:

```sh
node docs/design/levels-overview/build-stack.cjs
node docs/design/levels-overview/plugin/build-plugin.cjs
node docs/design/levels-overview/validate-plugin.mjs
```

The derived embedded `plugin/code.js` is about 78 MiB and is ignored in Git;
the source PNGs, template, UI, manifest and builder are preserved. The local
plugin ZIP includes the generated code so it needs no server or network.
In Figma Design choose **Plugins → Development → Import plugin from manifest**,
select `manifest.json`, then run **MAX — Level Stack Scene References**. If
Figma hides the file key, verify the exact configured file address in the
panel. **Add / update all 20 level references** is the primary action;
**Create comparison stack** is the secondary view. **Save import receipt**
downloads actual returned IDs after a successful local plugin execution.

This package is **not cloud-synchronized**. The configured Figma backend was
unavailable during preparation; no new cloud nodes or authenticated readback
are claimed. Local VM validation exercises fixtures and is not a Figma
execution. The prepared import also does not assume `941:450` belongs to
MASTER; that separately identified turtle reference is outside these bindings.

Use the existing [Native Level Studio bridge](../figma-level-studio/plugin/README.md)
for authoring: run `npm run build` and `npm run figma:studio`, select an actual
MASTER row, author supported native ART and gameplay planes, then preview the
temporary actual-game candidate. Scene-reference import alone does not add
`designed` or activate gameplay. Actual Figma readback, source compilation,
walking/return/planting checks and the normal release gate remain separate.

The review ZIP contains `stack.html`, images and provenance, and works when
served with `python3 -m http.server` from its extracted directory. The separate
Figma plugin ZIP is self-contained. Package receipts record the delivered
ZIP paths, sizes and hashes; neither ZIP is tracked in Git.
