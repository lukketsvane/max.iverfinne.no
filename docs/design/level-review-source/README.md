# Editable level review source

This folder contains offline source for a twenty-garden Figma review. It is generated from the actual `stageLayout()` runtime, with picture levels enabled, rather than from a decorative map or a fabricated Figma capture. Gardens 1–17 remain underground; 18–19 are underground with the first dawn breaches and limited rooftop glimpses. Garden 20 reaches the radioactive hellscape at sunrise before the final boss.

The files are prepared locally. They have not been imported, screenshot-verified or synchronized with the remote Figma file. The snapshot's SHA-256 records the local source used to prepare it; it is not a Figma node or image hash. Runtime PNGs and `levels-data.js` are unchanged by this workflow.

## Prepare or refresh

```sh
npm run figma:level-drafts
npm run figma:level-drafts -- --seed 2026 --out /tmp/max-level-review
```

The default seed is 1. The exporter accepts an unsigned 32-bit seed and records its runtime platforms, route identities, campaign profiles, caches, expedition loops, ladder geometry, guardian destinations and soil courts. `reach-report.md` summarizes the ordinary jump graph; `snapshot.json` contains every measured tier and the exact runtime source data. A tier of −1 means the jump graph does not reach that surface. Ladder travel, solid-wall collision and safe returns require the repository's real physics checks.

## Import in Figma

Open the [configured Design file](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF?node-id=508-11825). Use **Plugins → Development → Import plugin from manifest** and select this folder's `manifest.json`, then run **MAX level review import**. If the desktop dialog requires a Figma-generated plugin ID, create a local development plugin first and retain its ID in the generated manifest; the supplied importer remains `code.js`.

For a connected Figma Plugin API session, inspect the target file and level page first, then execute `import.use-figma.js` through `use_figma` with the Figma API skills loaded. Save its returned node IDs and take a composition screenshot before describing the remote review as complete. `code.js` is the equivalent manual plugin entry point; it prints the same result to Figma's plugin console.

The importer targets the documented page `508:11825` and places the review to the right of existing top-level content. It creates compiler tag components and twenty `review-garden-NN` frames at native scale. Every ledge, solid block and supported spot is an editable, directly nested component instance at integer X/Y/W/H. Its returned `instanceSources` link Figma nodes back to runtime platform IDs. Re-running the same source returns the existing complete review without editing it; an incomplete prior import is reported for inspection instead of being overwritten.

## Review contract

Keep 1 Figma px = 1 game art px. `origin` and `soil` establish the original runtime registration. The locked terrain vector traces the rounded real ground at every integer x; water rectangles mark sampled ponds. References and source instances share the same world-to-frame conversion.

Amber outlines identify guardian shrines and their soil courts. Other locked outlines identify authored picture bounds, ladders, places, bounce blooms, hazards, expedition objectives, caches and circuit arenas. These outline layers are annotations, not fake playable tags. The `unsupported` list in each snapshot names the runtime features that the current Figma compiler cannot preserve.

The frames carry no `designed` marker and their review names stay outside the live compiler pattern. To integrate a specific design, edit its intended base geometry in an actual `garden-NN` frame, preserve runtime furnishing and authored picture behavior, then use the normal [level export and validation workflow](../figma-levels.md). Do not publish the furnished snapshot as a fixed level merely by renaming it: doing so can strip interactions and append another expedition over the copied one.

Required integration checks remain `npm test` and `npm run build`. Runtime art changes additionally require the [native Figma art contract](../../figma.md).
