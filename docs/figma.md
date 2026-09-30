# Figma: runtime art and level design

[Open the design file](https://www.figma.com/design/TC0PHGMTCMR6im4hb3CSbF).

The production frame **160:2** on page **production / 10:2** contains 632 individual PNG source layers. Each layer has its exact repository path, native dimensions, one image fill and a PNG export preset at 1×. On 30 September 2026 every source image hash matched the repository. `assets/figma-manifest.json` records the current nodes. The previous production section 52:2 and level page 218:2 no longer exist in the file.

Page **References / 162:2** contains the pixel-art workbench **396:2** and the fifteen original inline image sources in **398:2**. Those legacy images still live inside `index.html`; `docs/design/figma-inline-snapshot.json` records their native Figma layers and hashes. Their bytes remain pinned by `tests/figma-assets.test.cjs`. The older composite contact sheets are comparison material, not individual runtime source layers.

Page **Level Design / 382:2** contains an editable component kit, native district prop components and all twenty garden blueprints. See [Designing a garden](design/figma-levels.md).

## Pixel-art contracts

The pack README, atlas JSON and palette are binding. Keep source dimensions, integer coordinates, binary transparency, integer anchors and disabled smoothing. Edit at high zoom instead of enlarging a master. Export at 1×. A source layer must have one PNG image fill, with no overlay left above it.

Read the relevant contract before changing art:

- `assets/max-skins-v1/README.md`, `assets/characters-v2/README.md` and `assets/enemies-v1/README.md`;
- `assets/rat-enemies-v1/README.md` and `assets/boss-milestones-v1/README.md`;
- `assets/garden-guardians-v1/README.md` and `assets/district-props-v1/README.md`;
- companion and result asset contracts for those packs.

Generated packs change in their source and generator first. The atlas's actual frame dimensions and anchor take precedence over the example master grids in Figma. In particular, rats use 48×32 cells and guardian frames use 32×32 cells.

## Editing artwork

1. Find the path-named source layer and read its pack contract.
2. Make the change at native size. If drawing additional pixel shapes, export the finished result and replace the source layer's image fill with that PNG.
3. For generated packs, update the generator's source and regenerate the pack before replacing the Figma image.
4. Pull the PNG, update the manifest and verify the runtime rendering at 1×.
5. Run the asset checks, `npm test` and `npm run build` before release.

`assets/figma-pending.json` is now empty. List new runtime artwork there only while it is waiting for a verified production source layer.

## Synchronization commands

The default commands use the Figma desktop Dev Mode MCP server at `http://127.0.0.1:3845/mcp`. Open this file in the desktop app, enable Dev Mode and the MCP server, then run:

| Command | Result |
| --- | --- |
| `npm run figma:check` | Compares current Figma layers, repository bytes and manifest. |
| `npm run figma:pull -- --dry-run` | Reports proposed PNG updates. |
| `npm run figma:pull` | Pulls validated source changes. Generated packs must be changed through their generator. |
| `npm run figma:manifest` | Refreshes node IDs and image hashes after verification. |
| `npm run figma:levels` | Exports frames containing a `designed` instance and reports physical reach. |
| `npm run figma:levels -- --watch` | Repeats level export while designing. |

When the desktop server is unavailable, the captured hosted-file state can be checked with:

```sh
npm run figma:check -- --snapshot docs/design/figma-production-snapshot.json
```

This verifies the captured image hashes, node IDs, dimensions and registration against the repository and manifest. It does not fetch later Figma edits. The captured state reports **632 MATCH, zero problems**. Offline tests also check each production PNG's pixels, palette and atlas bounds.

Legacy inline sources are editable in References. Updating one in the game requires replacing the corresponding inline PNG bytes and its explicit hash pin together; do not silently change or resize a legacy sheet.
