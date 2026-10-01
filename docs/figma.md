# Figma: the source of runtime art

The game's runtime PNG files live in one Figma file and are mirrored byte for byte in this repository.

- File: **max.iverfinne.no max fuglesprenger** (team cells.garden), <https://www.figma.com/file/TC0PHGMTCMR6im4hb3CSbF>, key `TC0PHGMTCMR6im4hb3CSbF`.
- Link: `assets/figma-manifest.json` (generated), `scripts/figma-sync.mjs` (the tool), `tests/figma-assets.test.cjs` (offline guard).

## The rule

The production page **10:2** contains six runtime sections, `451:2` through `451:7`, configured in `scripts/figma-mcp.mjs`. They replaced the removed frame `160:2`. Each runtime section contains native PNG source rectangles, often inside component sets. Source layers use exact repository paths and native dimensions; export them as PNG at 1×. Separate encounter workbenches are promoted explicitly when their runtime integration is ready.
A production layer is:

- a rectangle inside one of the group frames of the configured runtime sections,
- named with the exact repository path (`assets/native/rover.png`),
- whose only fill is the PNG itself at native 1×, so layer W×H = PNG W×H,
- on integer X / Y / W / H, with nothing drawn over it.

Figma names each stored image by the SHA-1 of its bytes, so the manifest records exactly what Figma holds. `npm test` then requires, offline:

- every production entry exists in the repo with the same SHA-1 and IHDR size;
- every PNG file the runtime loads (native-art atlases, companion sheets, the pixel font, literal and concatenated `assets/…png` paths in the shipped JS, HTML and CSS) is a production layer, and every PNG the build copies is a production or `unused` layer;
- every production PNG has binary alpha, RGB 0 under alpha 0, only its pack's palette (`atlas.json` / `<name>.json` `palette`), and is not an exact k× upscale;
- every production atlas `opaqueBounds` matches the pixels of its sheet.

The 15 PNGs inlined as `data:image/png` URIs in `index.html` are preserved byte for byte in frame **398:2 "LEGACY INLINE ART — native runtime sources"** on references section `452:4`. They predate the file-based production workflow and are pinned by hash in `tests/figma-assets.test.cjs`. New art goes into `assets/` and the configured runtime sections, never into a data URI.

## Map

The live file was captured on 1 October 2026 for the Rattus integration. All 660 production PNGs matched by source SHA-1, native dimensions and node ID: 660 MATCH, zero problems. The connector capture covered the actual runtime hierarchy, archived layers and source contracts. The comparison used the normal sync tool through a local capture replay, not a desktop session.

| Node | Role |
| --- | --- |
| 451:2 | Runtime environment |
| 451:3 | Runtime enemies |
| 451:4 | Runtime bosses |
| 451:5 | Runtime player characters |
| 451:6 | Runtime companions |
| 451:7 | Runtime UI, boons and results |
| 451:8 | Retired runtime archive |
| 452:4 | References and source contracts |
| 396:2 | Native workbench rules and examples |
| 398:2 | Legacy inline originals |
| 548:13527 | Rattus animation studio, 25 clips |
| 558:13527 | Rattus runtime strips |

Rattus retains the 256×256 main and interaction sources at `437:3` and `437:4` for tending, planting, climbing, menus and results. The new motion pack has its own documented cells and anchor in `assets/rattus-motion/README.md`. Production and drafts now share page `10:2`; the level-design page is `508:11825`. Older page/frame IDs remain in Git history.

## Pixel-art rules

Verbatim from the Figma frame 396:3:

- 1 game pixel = 1 Figma pixel
- Work only on integer X / Y / W / H
- No rotation, blur or fractional scaling
- Use solid pixels or binary transparency
- Edit native sheets at high zoom; do not enlarge masters
- Export PNG at 1× with transparency
- Preserve the pack README, atlas anchors and palette

Export check, verbatim from 396:12:

- Verify native dimensions and integer anchors
- Export original PNG at 1×
- Name each source layer with its exact repository path
- Compare the source image hash with the repository
- Run figma:check, npm test and npm run build

The repository contracts are binding and win over anything in the Figma workbench:

- **Cell size and anchor** come from the pack README and its `atlas.json`. The master grids in 396:19 (16×16, 32×32, 48×32, 64×96 and 128×128) are size examples only and do not define anchors. Known mismatches: rats are 48×32 at anchor 28,28; role enemies 16×16 at 8,15; bosses and the Hollow Crown 32×32 cells; the robot 48×40 at 24,36; the large rover 80×48 at 40,44; the starter rover 32×32 at 16,31.
- **Colours** come from the pack's own palette (`atlas.json` / `<name>.json` `palette`, pack README). The palette frame 396:25 (copied into the manifest as `rules.palette`) is a picking aid for new art, not a rule; none of the current sheets is limited to it.

Contracts to read: `README.md` → *Pixel-art contract*; `assets/max-skins-v1/README.md`, `assets/enemies-v1/README.md`, `assets/rat-enemies-v1/README.md`, `assets/boss-milestones-v1/README.md`, `assets/native/README.md`, `assets/companion/README.txt`, `assets/companion/large-README.md`, `assets/results-native/`, `assets/expansion/`; before touching the Mech companion, `docs/asset-review/watering-robot/selection.md`.

## Native authoring

The configured runtime sections are now the editable native masters for every runtime PNG, including packs originally produced by generators. Edit the source layer at native 1×, preserve the pack palette and atlas registration, then use `figma:pull` and `figma:manifest`. These packs use the same hash, dimension, palette, alpha and resize validation as all other assets.

The one-time import, extraction, packing and preview generators were retired on 1 October 2026. Their source is retained in [Git history](https://github.com/lukketsvane/max.iverfinne.no/tree/050bc6ce0e31f0d37139297973822224d58a0be8/scripts). Original owner uploads, provenance, contact sheets, JSON atlases and every production PNG remain in the repository. The production build and Figma level compiler remain active.

All new runtime art must be in the Figma production frame before it can pass the offline tests. There is no pending-art exception.

## Tools

`scripts/figma-sync.mjs` talks to the Figma desktop app's local Dev Mode MCP server (`http://127.0.0.1:3845/mcp`; `FIGMA_MCP_URL` overrides it, for a local replay server only). It needs no token. Before running it:

1. open the Figma desktop app (the browser has no local server),
2. open the file and keep it as the active tab,
3. switch to Dev Mode (Shift+D),
4. enable the desktop MCP server.

If the local desktop server is unavailable, a local MCP replay server may serve a fresh capture from the authenticated Figma connector. Capture the actual current node hierarchy, image hashes and workbench text; label the capture time and run the unchanged comparison against it with `FIGMA_MCP_URL`. Never substitute repository pins for missing Figma evidence. A capture proves synchronization at its capture time; it does not start the desktop server.

CI never talks to Figma; `npm test` is offline.

| Command | What it does |
| --- | --- |
| `npm run figma:check` | Compares every path-named layer in the configured runtime sections with the repo file and the manifest; exits non-zero on any problem. |
| `npm run figma:pull` | Downloads DRIFT / NEW-IN-FIGMA / MISSING-IN-REPO layers, validates them, writes the PNGs and their manifest entries; records MANIFEST-STALE entries. `-- --dry-run` writes nothing; `-- --allow-resize` allows a new size. |
| `npm run figma:manifest` | Regenerates the whole manifest: production, unused, reference, rules, draft index. Refuses to write while a production layer breaks a rule or differs from its repo file. |
| `npm run figma:drafts` | Lists draft sections and their candidates with sizes, flagging off-grid nodes, labels that disagree with the size, and cells that do not tile. Read-only. |
| `npm run figma:levels` | Exports the live garden frames of the levels page into `levels-data.js` and prints a reach report (`docs/design/figma-levels.md`). |

Figma caps MCP tool calls per day; once spent it answers "Rate limit exceeded, please try again tomorrow". Image downloads are not tool calls, and any other Figma MCP use during the day spends from the same budget. Every run prints the tool calls it spent.

`check` statuses:

| Status | Meaning | Fix |
| --- | --- | --- |
| MATCH | Figma = repo = manifest | none |
| DRIFT | Figma changed | `figma:pull` |
| NEW-IN-FIGMA | a path-named layer not in the manifest | `figma:pull` |
| MISSING-IN-REPO | the repo file is gone | `figma:pull` restores it, or move the layer out of the configured runtime sections |
| MANIFEST-STALE | bytes agree, manifest entry is old (moved, re-created) | `figma:pull` |
| REPO-CHANGED | the repo file changed, Figma did not | put the new PNG into the Figma layer, or restore the file |
| CONFLICT | both changed | decide, then make the other side match |
| REMOVED-FROM-FIGMA | the layer left a runtime section | remove the runtime use, then `figma:manifest` |
| REJECTED | the layer or its pixels break a rule; the listed problems say which, the status it would have had is in brackets | fix it; nothing is pulled |

A layer is REJECTED when it is off the integer grid, has not exactly one image fill, has anything drawn over or inside it, differs in size from its PNG, or has a name that is not a posix path inside `assets/`. A download is REJECTED when it is not a PNG, differs from the Figma hash or the layer size, differs from the current repo size (without `--allow-resize`), has partial alpha, colour under alpha 0 or colours outside the pack palette, is an exact k× upscale,.

## Draft → production

1. Choose the target first: the pack, its README and `atlas.json` (cell size, anchor, palette).
2. Draw or process the asset in a Draft section at native 1× in that pack's cell size, anchor and palette, following the rules and the export check above. A master grid in 396:19 is a starting frame only. Source JPEGs stay on the references section.
3. `npm run figma:drafts` to see the candidates and their flags.
4. Integrate it in the repo following the pack README: atlas JSON, loader, tests, the exact repository path.
5. In Figma, export the finished sheet as PNG at 1× and place it as the only image fill of a rectangle in the appropriate runtime section (dropping the PNG onto the canvas creates exactly that), at the PNG's size, on integer coordinates, named with the exact repository path. To replace an existing asset, replace the image fill of its layer. To revive an archived asset, integrate it against its pack contract, move its layer into the correct production group and preserve its exact repository path.
6. `npm run figma:pull -- --dry-run`, then `npm run figma:pull`.
7. `npm run figma:manifest`.
8. `npm test` and `npm run build`; `npm run figma:check` reports all MATCH. Commit the PNG, the manifest and the runtime change together: the runtime test fails if either side lands alone.

To retire an asset: `npm run figma:check` (all MATCH), move its layer from its runtime section to an archive frame outside the configured runtime sections, remove the runtime use, `npm run figma:manifest`, `npm test`.

Logo and PWA icon exports are outside the native runtime atlas sync workflow.
